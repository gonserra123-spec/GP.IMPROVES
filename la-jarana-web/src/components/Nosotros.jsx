import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useSpring, useTransform } from 'motion/react';
import { HISTORIA } from '../content/site.js';
import { splitWords } from '../lib/hooks.js';
import Sticker from './Sticker.jsx';

// Ritmo de lectura: cada frase tiene su tramo de scroll y luego una pausa en la que no cambia nada.
const TRAMO = 40, PAUSA = 22, PASO = TRAMO + PAUSA; // en svh (más ágil: unos 3 golpes de rueda por frase)
const N = HISTORIA.length, TOTAL = N * PASO;

function Word({ w, a, b, p }) {
  const o = useTransform(p, [a, b], [0.16, 1], { clamp: true });
  return <motion.span style={{ opacity: o }}>{w} </motion.span>;
}

function Frase({ texto, i, p }) {
  const words = splitWords(texto);
  const m = words.length;
  return (
    <span className="frase">
      {words.map((w, j) => {
        const a = (i * PASO + (TRAMO * j) / m) / TOTAL;
        const b = (i * PASO + Math.min(TRAMO, (TRAMO * (j + 1.6)) / m)) / TOTAL;
        return <Word key={j} w={w} a={a} b={b} p={p} />;
      })}
    </span>
  );
}

// Historia anclada: se ilumina frase a frase, con pausa y scroll-snap (proximity) al final de cada frase.
export default function Nosotros() {
  const ref = useRef(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const p = useSpring(scrollYProgress, { stiffness: 260, damping: 34, restDelta: 0.0005 });
  return (
    <section id="nosotros" className="nosotros sky" data-logo="sky" aria-labelledby="t-nos">
      <div ref={ref} className={`historia ${reduce ? 'is-static' : ''}`} style={reduce ? undefined : { height: `calc(${TOTAL}svh + 100svh)` }}>
        {!reduce && HISTORIA.map((_, i) => <i key={i} className="snap" aria-hidden="true" style={{ top: `calc(${i * PASO + TRAMO + 4}svh + 72px)` }} />)}
        <div className="historia-stage">
          <Sticker style={{ right: '6%', top: '12%' }} rotate={9} />
          <div className="wrap">
            <p className="kicker">La historia (resumida, que somos muy grandes)</p>
            <h2 id="t-nos" className="sr">La historia de La Jarana</h2>
            <p className="reveal-text display" aria-hidden={!reduce}>
              {reduce ? HISTORIA.join(' ') : HISTORIA.map((f, i) => <Frase key={i} texto={f} i={i} p={p} />)}
            </p>
            {!reduce && <p className="sr">{HISTORIA.join(' ')}</p>}
          </div>
        </div>
      </div>
      <div className="wrap">
        <div className="escudo">
          <div className="escudo-slot" role="img" aria-label="Escudo de Rubielos de Mora (pendiente)">
            <span>[FALTA ESCUDO RUBIELOS]</span>
          </div>
          <div>
            <h3 className="display">Con el escudo por delante</h3>
            <p className="lead">Rubielos de Mora en el pecho. La Jarana en la espalda. Por si alguien dudaba de dónde venimos.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
