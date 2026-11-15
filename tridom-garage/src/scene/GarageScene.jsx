import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Canvas, useThree } from '@react-three/fiber';
import { OrthographicCamera } from '@react-three/drei';
import { createEngine } from './engine.js';
import { createRig } from './camera.js';
import { useScene } from './store.js';
import { useTick } from '../lib/hooks.js';
import { reducedMotion, tickerState } from '../lib/ticker.js';
import { useT } from '../i18n/index.jsx';

const fontsReady = () => Promise.race([
  Promise.all([document.fonts.load('600 96px "Saira Condensed"'), document.fonts.load('700 96px "Saira Condensed"')]),
  new Promise((r) => { setTimeout(r, 1500); }),
]);

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch { return false; }
}

// El lienzo de R3F es otra raíz de React: el idioma llega por props, no por contexto.
function Bridge({ template, name, brandColor, mode, interactive, onSelect, onReady, sim, simulate, api, lang }) {
  const { gl, invalidate, size } = useThree();
  const get = useThree((s) => s.get); // la cámara por defecto la fija drei tras montar: se lee al usarla
  const ref = useRef({ engine: null, rig: null, perf: { n: 0, sum: 0, max: 0, slow: 0, warm: 0, samples: [] } });
  const [built, setBuilt] = useState(0);

  useEffect(() => {
    let alive = true; let engine = null; let unsub = () => {};
    fontsReady().then(() => {
      if (!alive) return;
      engine = createEngine({ template, name, brandColor, lang, mode, reduced: reducedMotion });
      const rig = createRig(get().camera, engine.bounds, template.building.wallH);
      rig.setSize(size.width, size.height); rig.fit(true);
      ref.current.engine = engine; ref.current.rig = rig;
      const st = useScene.getState();
      engine.setVehicles(st.vehicles, st.others); engine.setHighlight(st.selectedId);
      unsub = useScene.subscribe((s, p) => {
        if (s.vehicles !== p.vehicles || s.others !== p.others) engine.setVehicles(s.vehicles, s.others);
        if (s.selectedId !== p.selectedId || s.vehicles !== p.vehicles) engine.setHighlight(s.selectedId);
        if (s.focus !== p.focus && s.focus) {
          const pos = engine.carPosition(s.focus.id);
          if (pos) { rig.focus(pos.x, pos.z); if (reducedMotion) rig.jump(); }
        }
        invalidate();
      });
      api.current = { engine, rig, gl };
      window.__garage = {
        engine, rig, sim,
        frame: () => engine.snapshot(),
        stats: () => {
          const p = ref.current.perf; const s = [...p.samples].sort((a, b) => a - b);
          const avg = s.reduce((a, b) => a + b, 0) / (s.length || 1);
          return { frames: s.length, fps: s.length ? +(1000 / avg).toFixed(1) : null, frameMs: +avg.toFixed(2), p95Ms: s.length ? +s[Math.floor(s.length * 0.95)].toFixed(2) : null, triangles: engine.triangles(), drawCalls: gl.info.render.calls, dpr: gl.getPixelRatio() };
        },
        resetStats: () => { ref.current.perf.samples = []; },
      };
      useScene.getState().setReady(true);
      setBuilt((n) => n + 1);
      onReady?.({ engine, rig });
      invalidate();
    });
    return () => {
      alive = false; unsub();
      if (engine) engine.dispose();
      ref.current.engine = null; api.current = null;
      useScene.getState().setReady(false);
    };
  }, [template, name, brandColor, lang, mode]);

  useEffect(() => { ref.current.rig?.setSize(size.width, size.height); invalidate(); }, [size.width, size.height]);

  useTick((s) => {
    const { engine, rig, perf } = ref.current;
    if (!engine) return;
    const dt = s.dt / 1000;
    if (simulate && sim && !reducedMotion) sim.tick(Math.min(0.05, dt) * engine.timeScale, engine);
    const a = engine.update(dt);
    const b = rig.update(dt);
    if (!(a || b)) { perf.warm = 0; perf.slow = 0; return; }
    invalidate();
    // Medición real de fotogramas mientras algo se mueve; si cae de forma sostenida, se pasa a la vista en lista.
    perf.warm += 1;
    if (perf.warm > 20 && s.dt < 250) {
      perf.samples.push(s.dt); if (perf.samples.length > 600) perf.samples.shift();
      perf.slow = s.dt > 70 ? perf.slow + s.dt : Math.max(0, perf.slow - s.dt * 2);
      if (perf.slow > 6000 && !new URLSearchParams(window.location.search).has('gl')) useScene.getState().setFallback(true);
    }
  }, 'write');

  // Gestos: arrastrar desplaza, rueda o pellizco hacen zoom, Mayús/botón derecho o giro de dos dedos rotan.
  useEffect(() => {
    const el = gl.domElement;
    const { rig, engine } = ref.current;
    if (!rig || !engine || interactive === 'none') return undefined;
    const pts = new Map(); let moved = 0; let pinch = null;
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const down = (e) => {
      if (interactive !== 'full' && e.pointerType === 'touch') { pts.set(e.pointerId, { x: e.clientX, y: e.clientY, tap: true }); moved = 0; return; }
      el.setPointerCapture(e.pointerId); pts.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; pinch = null;
    };
    const move = (e) => {
      const p = pts.get(e.pointerId);
      if (!p || p.tap) return;
      const dx = e.clientX - p.x; const dy = e.clientY - p.y;
      if (pts.size === 2) {
        p.x = e.clientX; p.y = e.clientY;
        const [a, b] = [...pts.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y); const ang = Math.atan2(b.y - a.y, b.x - a.x);
        if (pinch) { rig.zoomBy(d / pinch.d); rig.rotate(ang - pinch.ang); }
        pinch = { d, ang }; moved = 99;
      } else {
        moved += Math.abs(dx) + Math.abs(dy);
        if (e.shiftKey || e.buttons === 2) rig.rotate(-dx * 0.005); else rig.pan(dx, dy);
        p.x = e.clientX; p.y = e.clientY;
      }
      invalidate();
    };
    const up = (e) => {
      if (!pts.has(e.pointerId)) return;
      pts.delete(e.pointerId); pinch = null;
      if (moved < 6 && onSelect) {
        const r = el.getBoundingClientRect();
        ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
        ray.setFromCamera(ndc, get().camera);
        const hit = ray.intersectObjects(engine.pickables(), false)[0];
        onSelect(hit ? hit.object.userData.carId : null);
      }
    };
    const wheel = (e) => { if (interactive !== 'full') return; e.preventDefault(); rig.zoomBy(Math.exp(-e.deltaY * 0.0012)); invalidate(); };
    const ctx = (e) => e.preventDefault();
    el.addEventListener('pointerdown', down); el.addEventListener('pointermove', move); el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false }); el.addEventListener('contextmenu', ctx);
    return () => {
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move); el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel); el.removeEventListener('contextmenu', ctx);
    };
  }, [built, interactive, onSelect]);

  const eng = ref.current.engine;
  return eng ? <primitive object={eng.root} /> : null;
}

export default function GarageScene({ template, name, brandColor, mode = 'panel', interactive = 'full', onSelect, onReady, sim, simulate = false, label, controls = true }) {
  const { t, lang } = useT();
  const api = useRef(null);
  const mobile = tickerState.tier === 'mobile' || (typeof window !== 'undefined' && window.innerWidth < 768);
  const act = (fn) => () => { const a = api.current; if (a) { fn(a.rig); a.rig.update(0.016); } };
  const onKey = (e) => {
    const a = api.current; if (!a || interactive === 'none') return;
    const k = { ArrowLeft: () => a.rig.pan(60, 0), ArrowRight: () => a.rig.pan(-60, 0), ArrowUp: () => a.rig.pan(0, 60), ArrowDown: () => a.rig.pan(0, -60), '+': () => a.rig.zoomBy(1.2), '-': () => a.rig.zoomBy(1 / 1.2), 0: () => a.rig.fit() }[e.key];
    if (k) { e.preventDefault(); k(); a.rig.update(0.016); }
  };
  return (
    <div className="scene" data-interactive={interactive}>
      <div className="scene-canvas" role="img" aria-label={label || t('scene.label')} tabIndex={interactive === 'none' ? -1 : 0} onKeyDown={onKey}>
        <Canvas
          frameloop="demand" dpr={mobile ? 1 : [1, 1.5]} flat
          gl={{ antialias: true, alpha: true, powerPreference: 'high-performance', stencil: false }}
          onCreated={({ gl }) => { gl.setClearColor(0x000000, 0); }}
        >
          <OrthographicCamera makeDefault near={0.1} far={400} position={[80, 80, 80]} />
          <Bridge template={template} name={name} brandColor={brandColor} mode={mode} interactive={interactive} onSelect={onSelect} onReady={onReady} sim={sim} simulate={simulate} api={api} lang={lang} />
        </Canvas>
      </div>
      {controls && interactive !== 'none' && (
        <div className="scene-controls" role="group" aria-label={t('scene.controls')}>
          <button type="button" className="icon-btn" onClick={act((r) => r.zoomBy(1.3))} aria-label={t('scene.zoomIn')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg></button>
          <button type="button" className="icon-btn" onClick={act((r) => r.zoomBy(1 / 1.3))} aria-label={t('scene.zoomOut')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14" /></svg></button>
          <button type="button" className="icon-btn" onClick={act((r) => r.rotate(0.3))} aria-label={t('scene.rotateL')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12a8 8 0 1 0 3-6.2M4 4v4h4" /></svg></button>
          <button type="button" className="icon-btn" onClick={act((r) => r.rotate(-0.3))} aria-label={t('scene.rotateR')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-3-6.2M20 4v4h-4" /></svg></button>
          <button type="button" className="icon-btn" onClick={act((r) => r.fit())} aria-label={t('scene.reframe')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg></button>
        </div>
      )}
    </div>
  );
}
