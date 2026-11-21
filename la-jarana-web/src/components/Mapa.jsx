import { useEffect, useRef, useState } from 'react';
import { animate, motion, useMotionValueEvent, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';

// Pajar de La Jarana: 40°11'15.9"N 0°39'17.2"W
const PAJAR = [-0.654778, 40.18775];
export const RUTA = 'https://www.google.com/maps/dir/?api=1&destination=40.187750,-0.654778';
const STYLE = 'https://tiles.openfreemap.org/styles/liberty';
const DEM = 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png';
const HANDLERS = ['dragPan', 'dragRotate', 'keyboard', 'doubleClickZoom', 'touchZoomRotate', 'touchPitch', 'boxZoom'];

const lerp = (a, b, t) => a + (b - a) * t;
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const hasWebGL = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

// Cámara "modo GTA": del pueblo entero a encima del pajar (zoom, inclinación y giro ligados al scroll).
function camara(t) {
  const e = ease(Math.min(1, Math.max(0, t)));
  return { center: PAJAR, zoom: lerp(12.3, 18.4, e), pitch: lerp(0, 62, Math.min(1, e * 1.25)), bearing: lerp(-35, 28, e) };
}

// Interior del pajar: UNA sola imagen (cover), escalada a 1.1 y con un desplazamiento máximo de ±2,5 %
// al mover el ratón, así nunca se ven bordes ni una segunda copia. En táctil no hay parallax.
function Dentro({ explore, onExplore }) {
  const reduce = useReducedMotion();
  const mx = useSpring(0, { stiffness: 70, damping: 18 }), my = useSpring(0, { stiffness: 70, damping: 18 });
  const x = useTransform(mx, (v) => `${v * 2.5}%`), y = useTransform(my, (v) => `${v * 2}%`);
  const move = (e) => {
    if (reduce || e.pointerType !== 'mouse') return;
    const r = e.currentTarget.getBoundingClientRect();
    mx.set(((e.clientX - r.left) / r.width - 0.5) * -2); my.set(((e.clientY - r.top) / r.height - 0.5) * -2);
  };
  return (
    <div className="dentro" onPointerMove={move} onPointerLeave={() => { mx.set(0); my.set(0); }}>
      <motion.img src="/img/pajar/dentro.webp" alt="Interior del pajar de La Jarana: vigas de madera, cartel de Rubielos de Mora, bandera y barra" className="d-img" style={{ x, y, scale: 1.1 }} />
      <div className="dentro-copy">
        <p className="kicker">Sede central de operaciones</p>
        <h3 className="display">Bienvenido al pajar</h3>
        <div className="cta">
          <a className="btn btn-lg" href={RUTA} target="_blank" rel="noopener noreferrer"><span>Cómo llegar</span></a>
          {onExplore && <button className="btn btn-lg alt" onClick={onExplore} aria-pressed={explore}><span>Explorar el mapa</span></button>}
        </div>
      </div>
    </div>
  );
}

export default function Mapa() {
  const ref = useRef(null), host = useRef(null), map = useRef(null), marker = useRef(null);
  const reduce = useReducedMotion();
  const [near, setNear] = useState(false);
  const [state, setState] = useState('idle'); // idle | ok | fallback
  const [explore, setExplore] = useState(false);
  const exploreRef = useRef(false); exploreRef.current = explore;
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const sp = useSpring(scrollYProgress, { stiffness: 70, damping: 20, restDelta: 0.0005 });
  const mapT = useTransform(sp, [0, 0.76], [0, 1]);
  // Final: el mapa sigue acercándose y se funde directamente en "Bienvenido al pajar".
  const mapS = useTransform(sp, [0.76, 0.92], [1, 1.45]);
  const mapO = useTransform(sp, [0.8, 0.92], [1, 0]);
  const dentroO = useTransform(sp, [0.8, 0.92], [0, 1]);
  const dentroS = useTransform(sp, [0.8, 0.96], [1.15, 1]);
  const hud = useTransform(sp, [0, 0.7, 0.76], [1, 1, 0]);
  const [pct, setPct] = useState(0);
  const [inside, setInside] = useState(false);

  // Carga diferida: MapLibre solo cuando la sección está cerca.
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setNear(true); io.disconnect(); } }, { rootMargin: '150% 0px' });
    io.observe(ref.current); return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!near) return;
    if (!hasWebGL()) { setState('fallback'); return; }
    let cancelled = false, m, timeout, ready = false;
    // MapLibre 6 busca su worker junto a su propio módulo; al empaquetar hay que decirle dónde quedó.
    Promise.all([import('maplibre-gl'), import('maplibre-gl/dist/maplibre-gl-worker.mjs?url'), import('maplibre-gl/dist/maplibre-gl.css')]).then(([mod, worker]) => {
      const maplibregl = mod.default?.Map ? mod.default : mod;
      maplibregl.setWorkerUrl(worker.default);
      if (cancelled || !host.current) return;
      m = new maplibregl.Map({
        container: host.current, style: STYLE, ...camara(reduce ? 1 : 0),
        interactive: true, scrollZoom: false, attributionControl: { compact: true }, maxPitch: 75, fadeDuration: 0,
      });
      HANDLERS.forEach((h) => m[h]?.disable());
      map.current = m;
      m.on('load', () => {
        if (cancelled) return;
        m.addSource('dem', { type: 'raster-dem', tiles: [DEM], tileSize: 256, encoding: 'terrarium', maxzoom: 14 });
        m.setTerrain({ source: 'dem', exaggeration: 1.4 });
        const el = document.createElement('button');
        el.className = 'map-marker'; el.type = 'button'; el.setAttribute('aria-label', 'El pajar de La Jarana: abrir ruta en Google Maps');
        el.innerHTML = '<span class="mm-ring"></span><img src="/img/logo-color.webp" alt="">';
        el.addEventListener('click', () => window.open(RUTA, '_blank', 'noopener,noreferrer'));
        if (!reduce) animate(el.querySelector('.mm-ring'), { scale: [1, 1.7], opacity: [0.9, 0] }, { duration: 1.4, repeat: Infinity, ease: 'easeOut' });
        marker.current = new maplibregl.Marker({ element: el, anchor: 'bottom' }).setLngLat(PAJAR).addTo(m);
        ready = true; clearTimeout(timeout); setState('ok');
      });
      // Si el estilo no llega a cargar (red caída, OpenFreeMap fuera), foto de respaldo en vez de mapa vacío.
      // Errores sueltos de teselas tras cargar no tumban el mapa.
      const giveUp = () => { if (cancelled || ready) return; setState('fallback'); };
      m.on('error', () => { if (!ready) giveUp(); });
      timeout = setTimeout(giveUp, 15000);
    }).catch((err) => { console.warn('Mapa: usando la imagen de respaldo', err); setState('fallback'); });
    return () => { cancelled = true; clearTimeout(timeout); marker.current?.remove(); m?.remove(); map.current = null; };
  }, [near, reduce]);

  useMotionValueEvent(mapT, 'change', (t) => {
    if (!map.current || exploreRef.current) return;
    map.current.jumpTo(camara(reduce ? 1 : t));
    const n = Math.round(t * 100); setPct((o) => (o === n ? o : n));
  });
  useMotionValueEvent(sp, 'change', (p) => {
    setInside(p > 0.86);
    if (p < 0.88 && exploreRef.current) toggleExplore(false);
  });

  const toggleExplore = (on = !exploreRef.current) => {
    const m = map.current; if (!m) return;
    setExplore(on);
    HANDLERS.forEach((h) => (on ? m[h]?.enable() : m[h]?.disable()));
    if (!on) m.jumpTo(camara(mapT.get()));
  };

  return (
    <section id="pajar" ref={ref} className="mapa" data-logo="sky" aria-labelledby="t-map">
      <div className="mapa-stage">
        <motion.div className="map-wrap" style={explore ? { scale: 1, opacity: 1 } : { scale: mapS, opacity: mapO }}>
          <div className={`map ${explore ? 'is-live' : ''}`} ref={host} aria-hidden={!explore} />
        </motion.div>
        {state === 'fallback' && <div className="map-fallback"><img src="/img/pajar/dentro.webp" alt="Interior del pajar de La Jarana" /></div>}
        <motion.div className="map-hud" style={{ opacity: hud }}>
          <p className="kicker">Modo GTA</p>
          <h2 id="t-map" className="display">Rumbo al pajar</h2>
          <p className="map-pct" aria-hidden="true">{pct}%</p>
        </motion.div>
        {!explore && (
          <>
            <motion.div className="dentro-wrap" style={{ opacity: dentroO, scale: dentroS, pointerEvents: inside ? 'auto' : 'none' }}>
              <Dentro explore={explore} onExplore={state === 'ok' ? () => toggleExplore(true) : null} />
            </motion.div>
          </>
        )}
        {explore && <button className="btn map-close" onClick={() => toggleExplore(false)}><span>Volver al pajar</span></button>}
      </div>
    </section>
  );
}
