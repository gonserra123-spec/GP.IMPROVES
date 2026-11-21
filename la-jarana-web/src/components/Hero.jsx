import { lazy, Suspense, useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import ShatterLogo from './ShatterLogo.jsx';
import { MaskWords } from './Reveal.jsx';
import { SITE, HERO } from '../content/site.js';
import Contador from './Contador.jsx';

const VasoCanvas = lazy(() => import('./VasoCanvas.jsx'));
const BUBBLES = [[8, 22, 70, 0.5], [18, 70, 30, 0.9], [30, 12, 46, 0.7], [62, 80, 90, 0.4], [74, 18, 38, 1.1], [86, 64, 64, 0.6], [92, 30, 26, 1.3], [48, 90, 34, 0.8]];

// Cada transform tiene UN dueño: el scroll mueve los envoltorios (logo, texto, vaso, burbujas);
// la rotación del vaso la lleva solo el módulo 3D. Así no se pelean al soltar el pin.
export default function Hero() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const sp = useSpring(scrollYProgress, { stiffness: 90, damping: 22, mass: 0.6, restDelta: 0.0005 });
  const logoY = useTransform(sp, [0, 1], [0, -90]);
  const copyY = useTransform(sp, [0, 1], [0, -40]);
  const vasoY = useTransform(sp, [0, 1], [0, 70]);
  const vasoS = useTransform(sp, [0, 1], [1, 0.9]);
  const hint = useTransform(sp, [0, 0.15], [1, 0]);
  return (
    <section id="inicio" ref={ref} className="hero" data-logo="sky" aria-label="Inicio">
      <div className="hero-stage">
        {BUBBLES.map(([l, t, s, d], i) => <Bubble key={i} sp={sp} l={l} t={t} s={s} d={d} />)}
        <div className="hero-grid">
          <motion.div className="hero-logo" style={{ y: logoY }}><ShatterLogo /></motion.div>
          <motion.div className="hero-copy" style={{ y: copyY }}>
            <p className="kicker">{HERO.kicker}</p>
            <h1 className="display"><MaskWords text={SITE.eslogan} delay={0.9} /></h1>
            <p className="lead">{HERO.lead}</p>
            <Contador />
          </motion.div>
          <motion.div className="hero-vaso" style={{ y: vasoY, scale: vasoS }}>
            <Suspense fallback={null}><VasoCanvas /></Suspense>
          </motion.div>
        </div>
        <motion.p className="hint" style={{ opacity: hint }} aria-hidden="true">Arrastra el vaso · baja si te atreves</motion.p>
      </div>
    </section>
  );
}

function Bubble({ sp, l, t, s, d }) {
  const y = useTransform(sp, [0, 1], [0, -320 * d]);
  return <motion.i className="bubble" aria-hidden="true" style={{ left: `${l}%`, top: `${t}%`, width: s, height: s, y }} />;
}
