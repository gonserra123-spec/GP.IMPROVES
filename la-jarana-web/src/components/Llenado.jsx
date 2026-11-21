import { lazy, Suspense, useRef, useState } from 'react';
import { motion, useMotionValueEvent, useReducedMotion, useScroll, useTransform } from 'motion/react';

const VasoCanvas = lazy(() => import('./VasoCanvas.jsx'));

// Sección anclada: el vaso se queda fijo y el scroll lo llena (chorro, burbujas y espuma que rebosa).
// El progreso del scroll solo llama a setFill(); la rotación sigue siendo del módulo (se puede girar).
export default function Llenado() {
  const ref = useRef(null);
  const vaso = useRef(null);
  const reduce = useReducedMotion();
  const [pct, setPct] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const fillP = useTransform(scrollYProgress, [0.05, 0.85], [0, 1], { clamp: true });
  const outro = useTransform(scrollYProgress, [0.88, 1], [1, 0.92]);
  useMotionValueEvent(fillP, 'change', (p) => {
    const v = reduce ? 1 : p;
    vaso.current?.setFill(v);
    const n = Math.round(v * 100);
    setPct((o) => (o === n ? o : n));
  });
  const onReady = (v) => { vaso.current = v; v?.setFill(reduce ? 1 : fillP.get()); };
  const msg = pct >= 100 ? 'Rebosando. Como nosotros.' : pct > 60 ? 'Casi. No pares ahora.' : pct > 0 ? 'Sirviendo…' : 'Baja para servirte una';
  return (
    <section id="llenado" ref={ref} className="pour" data-logo="sky" aria-label="Sírvete una">
      <motion.div className="pour-stage" style={{ scale: outro }}>
        <div className="pour-copy">
          <p className="kicker">Sírvete una</p>
          <p className="display pour-pct" aria-live="off">{reduce ? 100 : pct}<small>%</small></p>
          <p className="pour-msg">{reduce ? 'Rebosando. Como nosotros.' : msg}</p>
        </div>
        <div className="pour-vaso"><Suspense fallback={null}><VasoCanvas onReady={onReady} label="Vaso de La Jarana llenándose de cerveza al hacer scroll. Arrástralo para girarlo." /></Suspense></div>
        <p className="hint pour-hint" aria-hidden="true">Haz scroll para servirte · arrastra para girar</p>
      </motion.div>
    </section>
  );
}
