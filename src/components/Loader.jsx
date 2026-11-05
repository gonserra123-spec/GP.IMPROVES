import { useLayoutEffect, useRef } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useTick, reducedMotion } from '../lib/hooks.js';
import { getLenis } from '../lib/ticker.js';
import { createSpring, clamp, range, easeOut } from '../lib/spring.js';
import { setReady } from '../lib/ready.js';
import { LOGO } from '../content/images.js';

// M7 + M20 — Velo de carga «Baukasten de obra» (mecánica del Design E; piezas y paleta propias).
//  1) Pantalla negra: solo contornos de piezas extruidas moviéndose en 3D.
//  2) Las caras se rellenan (blanco roto, grafito, negro mate).
//  3) Las piezas se ensamblan formando el marco del logo (el marco real del logo aportado).
//  4) El logo real (PNG blanco, sin redibujar) entra y las piezas de relleno se disuelven.
//  5) Cortina que sube y deja la home; ahí se activa la bandera «ready».
// Contador 000→100 con easing, franja inferior de tres neutros, tiempo mínimo y máximo garantizados.
// Sin librerías 3D: proyección en perspectiva a mano sobre canvas 2D. Móvil: menos piezas.
const T_FILL = 1100; // ms: empiezan a rellenarse
const T_ASSEMBLE = 1900; // ms: empiezan a ensamblarse
const T_MIN = 3400; // ms mínimos antes de poder salir
const T_MAX = 6500; // ms máximos (si el hero aún no cargó, sale igual)
const ASPECT = LOGO.height / LOGO.width;
const TONES = { w: [242, 240, 235], g: [74, 73, 70], k: [22, 22, 21] };
const LIGHT = (() => { const v = [-0.34, -0.49, -0.8]; const m = Math.hypot(...v); return v.map((c) => c / m); })();

const rect = (w, h) => [[-w / 2, -h / 2], [w / 2, -h / 2], [w / 2, h / 2], [-w / 2, h / 2]];
const circle = (r, n = 28) => Array.from({ length: n }, (_, i) => [Math.cos((i / n) * Math.PI * 2) * r, Math.sin((i / n) * Math.PI * 2) * r]);
const arch = (w, h, n = 12) => {
  const r = w / 2; const cy = -h / 2 + r;
  const pts = [[-r, h / 2], [-r, cy]];
  for (let i = 1; i < n; i += 1) { const a = Math.PI + (i / n) * Math.PI; pts.push([Math.cos(a) * r, cy + Math.sin(a) * r]); }
  pts.push([r, cy], [r, h / 2]);
  return pts;
};
const rnd = (a, b) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };

// Unidades: ancho del logo = 1. Posiciones finales medidas sobre el PNG del cliente (1578×1452):
// barra superior y dos patas del marco abierto por abajo; el resto se coloca en el vano inferior.
function makePieces(mobile) {
  const defs = [
    { id: 'top', frame: true, outer: rect(0.9055, 0.0209), d: 0.03, tone: 'w', tx: 0, ty: -0.4039 },
    { id: 'legL', frame: true, outer: rect(0.0203, 0.8283), d: 0.03, tone: 'w', tx: -0.4423, ty: 0 },
    { id: 'legR', frame: true, outer: rect(0.0203, 0.8283), d: 0.03, tone: 'w', tx: 0.4423, ty: 0 },
    { id: 'arch', outer: arch(0.12, 0.17), d: 0.05, tone: 'w', tx: -0.25, ty: 0.27 },
    { id: 'ring', outer: circle(0.06), d: 0.05, tone: 'g', tx: -0.08, ty: 0.3 },
    { id: 'sq', outer: rect(0.15, 0.15), inner: rect(0.105, 0.105), d: 0.05, tone: 'w', tx: 0.1, ty: 0.29 },
    { id: 'slab', outer: rect(0.72, 0.024), d: 0.04, tone: 'g', tx: 0, ty: 0.385 },
  ];
  if (!mobile) {
    defs.push(
      { id: 's1', outer: rect(0.02, 0.15), d: 0.04, tone: 'g', tx: 0.27, ty: 0.28 },
      { id: 's2', outer: rect(0.02, 0.15), d: 0.04, tone: 'w', tx: 0.31, ty: 0.28 },
      { id: 's3', outer: rect(0.02, 0.15), d: 0.04, tone: 'k', tx: 0.35, ty: 0.28 },
    );
  }
  return defs.map((d, i) => ({
    ...d, i,
    sx: (rnd(i, 1) - 0.5) * 2.4, sy: (rnd(i, 2) - 0.5) * 1.5, sz: (rnd(i, 3) - 0.25) * 0.7,
    r0: [rnd(i, 4) * 6.28, rnd(i, 5) * 6.28, rnd(i, 6) * 6.28],
    w: [(rnd(i, 7) - 0.5) * 0.9, (rnd(i, 8) - 0.5) * 1.1, (rnd(i, 9) - 0.5) * 0.7],
    fx: 0.5 + rnd(i, 10) * 0.6, fy: 0.5 + rnd(i, 11) * 0.6, ph: rnd(i, 12) * 6.28,
    assembling: false,
  }));
}

function rot(x, y, z, rx, ry, rz) {
  let c = Math.cos(rx); let s = Math.sin(rx);
  const y1 = y * c - z * s; const z1 = y * s + z * c;
  c = Math.cos(ry); s = Math.sin(ry);
  const x2 = x * c + z1 * s; const z2 = -x * s + z1 * c;
  c = Math.cos(rz); s = Math.sin(rz);
  return [x2 * c - y1 * s, x2 * s + y1 * c, z2];
}

const fmt = (n) => String(n).padStart(3, '0');
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - ((-2 * t + 2) ** 3) / 2);

export function loaderWanted() {
  if (reducedMotion || typeof window === 'undefined') return false;
  return !/[?&]noloader\b/.test(window.location.search);
}

export default function Loader({ onDone }) {
  const { t } = useI18n();
  const root = useRef(null);
  const canvas = useRef(null);
  const logo = useRef(null);
  const count = useRef(null);
  const bar = useRef(null);
  const S = useRef(null);
  const assetsReady = useRef(false);

  useLayoutEffect(() => {
    document.documentElement.classList.add('loading');
    return () => { document.documentElement.classList.remove('loading'); getLenis()?.start(); };
  }, []);

  // Recursos que el velo espera: tipografías y la foto del hero (con tope de T_MAX).
  useLayoutEffect(() => {
    let alive = true;
    const img = new Image();
    const imgDone = new Promise((res) => { img.onload = res; img.onerror = res; img.src = '/img-cliente/cocina-roble-grafito-bn-1400.webp'; });
    Promise.all([document.fonts?.ready, imgDone]).then(() => { if (alive) assetsReady.current = true; });
    return () => { alive = false; };
  }, []);

  useTick((tk) => {
    const c = canvas.current;
    if (!c) return;
    let s = S.current;
    if (!s) {
      const mobile = tk.tier === 'mobile';
      s = S.current = {
        start: tk.time, pieces: makePieces(mobile), mobile, w: 0, h: 0, wL: 0, hL: 0, cx: 0, cy: 0, F: 1000,
        finish: null, curtain: null, curtainSpring: createSpring(0, { tension: 90, friction: 24 }), lenisStopped: false,
        shown: -1, done: false,
      };
      s.pieces.forEach((p) => {
        const mk = (v) => createSpring(v, { tension: 70, friction: 15 });
        p.sp = { x: mk(p.sx), y: mk(p.sy), z: mk(p.sz), rx: mk(p.r0[0]), ry: mk(p.r0[1]), rz: mk(p.r0[2]), d: mk(1) };
      });
    }
    if (!s.lenisStopped && getLenis()) { getLenis().stop(); s.lenisStopped = true; }
    const ctx = c.getContext('2d');
    if (tk.resized || !s.w) {
      const dpr = Math.min(s.mobile ? 1.5 : 2, window.devicePixelRatio || 1);
      s.w = tk.vw; s.h = tk.vh;
      c.width = Math.round(s.w * dpr); c.height = Math.round(s.h * dpr);
      s.dpr = dpr;
      s.hL = Math.min(s.h * 0.56, s.w * (s.mobile ? 0.8 : 0.5) * ASPECT);
      s.wL = s.hL / ASPECT;
      s.cx = s.w / 2; s.cy = s.h / 2; s.F = Math.max(s.w, s.h);
      const l = logo.current;
      if (l) { l.style.width = `${s.wL}px`; l.style.height = `${s.hL}px`; l.style.left = `${s.cx - s.wL / 2}px`; l.style.top = `${s.cy - s.hL / 2}px`; }
    }
    const t = tk.time - s.start;
    const sec = t / 1000;
    const k = s.wL;

    // ── objetivos de cada pieza ──
    for (const p of s.pieces) {
      const sp = p.sp;
      if (!p.assembling && t >= T_ASSEMBLE + p.i * 55) {
        p.assembling = true;
        const near = (v) => Math.round(v / (Math.PI * 2)) * Math.PI * 2;
        p.fin = [near(sp.rx.value), near(sp.ry.value), near(sp.rz.value)];
      }
      if (!p.assembling) {
        sp.x.set(p.sx + Math.sin(sec * p.fx + p.ph) * 0.05);
        sp.y.set(p.sy + Math.cos(sec * p.fy + p.ph) * 0.05);
        sp.z.set(p.sz);
        sp.rx.set(p.r0[0] + sec * p.w[0]); sp.ry.set(p.r0[1] + sec * p.w[1]); sp.rz.set(p.r0[2] + sec * p.w[2]);
      } else {
        sp.x.set(p.tx); sp.y.set(p.ty); sp.z.set(0);
        sp.rx.set(p.fin[0]); sp.ry.set(p.fin[1]); sp.rz.set(p.fin[2]);
      }
    }

    // ── salida: tiempo mínimo, recursos listos o tope máximo ──
    if (s.finish === null && t >= T_MIN && (assetsReady.current || t >= T_MAX)) {
      s.finish = t;
      s.pieces.forEach((p) => p.sp.d.set(0.06)); // las piezas se aplanan sobre el logo
    }
    const logoA = s.finish === null ? 0 : easeOut(range(t - s.finish, 0, 650));
    if (s.finish !== null && s.curtain === null && t - s.finish > 1000) { s.curtain = t; s.curtainSpring.set(-105); setReady(); }

    // ── contador y franja ──
    const prog = s.finish === null ? Math.min(99, Math.round(99 * easeInOut(clamp(t / T_MIN)))) : (logoA > 0.05 ? 100 : 99);
    if (prog !== s.shown) {
      s.shown = prog;
      if (count.current) count.current.textContent = fmt(prog);
      if (bar.current) bar.current.style.clipPath = `inset(0 ${100 - prog}% 0 0)`;
    }

    // ── dibujo ──
    for (const p of s.pieces) for (const key in p.sp) p.sp[key].step(tk.dt);
    ctx.setTransform(s.dpr, 0, 0, s.dpr, 0, 0);
    ctx.clearRect(0, 0, s.w, s.h);
    if (logoA < 1 || s.finish === null) {
      const order = s.pieces.map((p) => ({ p, z: p.sp.z.value })).sort((a, b) => b.z - a.z);
      for (const { p } of order) {
        const appear = easeOut(range(t, p.i * 60, p.i * 60 + 450));
        if (appear <= 0) continue;
        const fill = easeOut(range(t, T_FILL + p.i * 70, T_FILL + p.i * 70 + 520));
        const alpha = p.frame ? 1 : 1 - logoA;
        if (alpha <= 0.01) continue;
        drawPiece(ctx, p, k, s, appear * alpha, fill);
      }
    }
    if (logo.current) logo.current.style.opacity = logoA.toFixed(3);

    // ── cortina ──
    if (s.curtain !== null) {
      s.curtainSpring.step(tk.dt);
      const y = s.curtainSpring.value;
      if (root.current) root.current.style.transform = `translate3d(0,${y.toFixed(3)}%,0)`;
      if (y < -104.6 && !s.done) { s.done = true; onDone(); }
    }
  });

  return (
    <div className="loader" ref={root} data-logo="dark" role="status" aria-live="polite">
      <span className="sr-only">{t('loader.label')}</span>
      <canvas className="loader__canvas" ref={canvas} aria-hidden="true" />
      <img className="loader__logo" ref={logo} src="/img-cliente/logo/logo-2con2estudio-blanco.png" width={LOGO.width} height={LOGO.height} alt="" aria-hidden="true" />
      <p className="loader__tag label" aria-hidden="true">{t('loader.tag')}</p>
      <p className="loader__count display" ref={count} aria-hidden="true">000</p>
      <div className="loader__bar" aria-hidden="true">
        <div className="loader__fill" ref={bar}><i /><i /><i /></div>
      </div>
    </div>
  );
}

function drawPiece(ctx, p, k, s, alpha, fill) {
  const { sp } = p;
  const rx = sp.rx.value; const ry = sp.ry.value; const rz = sp.rz.value;
  const px = sp.x.value * k; const py = sp.y.value * k; const pz = sp.z.value * k;
  const half = (p.d * sp.d.value * k) / 2;
  const to3 = (loop, z) => loop.map(([x, y]) => { const r = rot(x * k, y * k, z, rx, ry, rz); return [r[0] + px, r[1] + py, r[2] + pz]; });
  const to2 = (pts) => pts.map(([x, y, z]) => { const f = s.F / (s.F + z); return [s.cx + x * f, s.cy + y * f]; });
  const loops = [p.outer, ...(p.inner ? [p.inner] : [])];
  const A = loops.map((l) => to3(l, -half)); // cara delantera
  const B = loops.map((l) => to3(l, half)); // cara trasera
  const A2 = A.map(to2); const B2 = B.map(to2);
  const tone = TONES[p.tone];
  const faces = [];
  const shade = (a, b, c) => {
    const u = [b[0] - a[0], b[1] - a[1], b[2] - a[2]]; const v = [c[0] - a[0], c[1] - a[1], c[2] - a[2]];
    const n = [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
    const m = Math.hypot(...n) || 1;
    return 0.5 + 0.5 * Math.abs((n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]) / m);
  };
  const avgZ = (pts) => pts.reduce((a, q) => a + q[2], 0) / pts.length;
  faces.push({ paths: A2, z: avgZ(A[0]), b: shade(A[0][0], A[0][1], A[0][2]), eo: loops.length > 1 });
  faces.push({ paths: B2, z: avgZ(B[0]), b: shade(B[0][0], B[0][1], B[0][2]), eo: loops.length > 1 });
  loops.forEach((_, li) => {
    const a = A[li]; const b = B[li]; const n = a.length;
    for (let i = 0; i < n; i += 1) {
      const j = (i + 1) % n;
      faces.push({ paths: [[A2[li][i], A2[li][j], B2[li][j], B2[li][i]]], z: avgZ([a[i], a[j], b[j], b[i]]), b: shade(a[i], a[j], b[j]), eo: false });
    }
  });
  faces.sort((q, r) => r.z - q.z);

  ctx.lineJoin = 'round';
  if (fill > 0.01) {
    for (const f of faces) {
      ctx.globalAlpha = alpha * fill;
      ctx.fillStyle = `rgb(${(tone[0] * f.b) | 0},${(tone[1] * f.b) | 0},${(tone[2] * f.b) | 0})`;
      ctx.beginPath();
      for (const path of f.paths) { path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); }
      ctx.fill(f.eo ? 'evenodd' : 'nonzero');
      ctx.globalAlpha = alpha * fill * 0.28;
      ctx.strokeStyle = '#F2F0EB'; ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
  // Contorno (alambre): visible hasta que las caras se rellenan
  const wire = alpha * (1 - fill * 0.92);
  if (wire > 0.01) {
    ctx.globalAlpha = wire;
    ctx.strokeStyle = '#F2F0EB'; ctx.lineWidth = 1.2;
    ctx.beginPath();
    loops.forEach((_, li) => {
      [A2[li], B2[li]].forEach((loop) => { loop.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); });
      const step = A2[li].length > 12 ? 4 : 1;
      for (let i = 0; i < A2[li].length; i += step) { ctx.moveTo(...A2[li][i]); ctx.lineTo(...B2[li][i]); }
    });
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}
