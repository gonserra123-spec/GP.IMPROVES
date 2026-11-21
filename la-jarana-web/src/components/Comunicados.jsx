import { useRef } from 'react';
import { motion, useAnimationControls, useReducedMotion } from 'motion/react';
import { COMUNICADOS, FIRMA } from '../content/comunicados.js';
import { MaskWords } from './Reveal.jsx';
import CreaComunicado from './CreaComunicado.jsx';

// Sello oficial: entra con golpe seco (spring duro) al aparecer en pantalla.
export function Sello({ i, className = 'stamp', delay = 0.45, onLanded }) {
  const reduce = useReducedMotion();
  return (
    <motion.svg
      className={className} viewBox="0 0 120 120" aria-hidden="true"
      initial={reduce ? false : { scale: 2.8, opacity: 0, rotate: -34 }}
      whileInView={{ scale: 1, opacity: 0.92, rotate: -12 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: 'spring', stiffness: 520, damping: 17, delay }}
      onAnimationComplete={onLanded}
    >
      <defs><path id={`arc${i}`} d="M60,60 m-44,0 a44,44 0 1,1 88,0 a44,44 0 1,1 -88,0" /></defs>
      <circle cx="60" cy="60" r="56" fill="none" stroke="currentColor" strokeWidth="3" />
      <circle cx="60" cy="60" r="30" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <text fontSize="11" letterSpacing="2.2" fill="currentColor" fontWeight="700"><textPath href={`#arc${i}`}>LA JARANA · RUBIELOS DE MORA · OFICIAL ·</textPath></text>
      <text x="60" y="66" textAnchor="middle" fontSize="15" fontWeight="800" fill="currentColor">SELLO</text>
    </motion.svg>
  );
}

// Al aterrizar el sello, la tarjeta vibra brevemente.
function Card({ c, i, onOpen }) {
  const shake = useAnimationControls(); const reduce = useReducedMotion(); const done = useRef(false);
  const landed = () => { if (done.current || reduce) return; done.current = true; shake.start({ x: [0, -5, 4, -3, 1, 0], rotate: [0, -0.6, 0.5, -0.3, 0], transition: { duration: 0.28, ease: 'easeOut' } }); };
  return (
    <motion.article
      className="card"
      initial={reduce ? false : { y: 60, opacity: 0 }}
      whileInView={{ y: 0, opacity: 1 }}
      viewport={{ once: true, amount: 0.35 }}
      transition={{ type: 'spring', stiffness: 120, damping: 20, delay: i * 0.08 }}
    >
      <motion.div animate={shake} className="card-in">
        <p className="card-n">Comunicado nº {String(c.n).padStart(2, '0')}</p>
        <h3 className="display">{c.titulo}</h3>
        <p className="card-p">{c.slides[0]}</p>
        <p className="firma">— {FIRMA}</p>
        <button className="btn" onClick={() => onOpen(i)}><span>Leer en historias</span></button>
        <Sello i={i} delay={0.45 + i * 0.08} onLanded={landed} />
      </motion.div>
    </motion.article>
  );
}

export default function Comunicados({ onOpen }) {
  return (
    <section id="comunicados" className="sec white" data-logo="white" aria-labelledby="t-com">
      <div className="wrap">
        <p className="kicker">Tablón</p>
        <h2 id="t-com" className="display big"><MaskWords text="Comunicados oficiales" /></h2>
        <p className="lead">Lo último, arriba. Leer es obligatorio; obedecer, muy recomendable.</p>
        <div className="cards">{COMUNICADOS.map((c, i) => <Card key={c.n} c={c} i={i} onOpen={onOpen} />)}</div>
        <CreaComunicado />
      </div>
    </section>
  );
}
