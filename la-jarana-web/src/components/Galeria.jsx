import { motion } from 'motion/react';
import { MaskWords } from './Reveal.jsx';
import { GALERIA } from '../content/site.js';

// Fotos por categoría: se detectan solas en src/assets/galeria/<categoria>/ (tardeos, fiestas, pajar, merch).
const found = import.meta.glob('../assets/galeria/*/*.{jpg,jpeg,png,webp,avif}', { eager: true, query: '?url', import: 'default' });
const byCat = {};
Object.keys(found).sort().forEach((k) => { const c = k.split('/').at(-2); (byCat[c] ||= []).push(found[k]); });
const MIN = 4;

function Grupo({ g, gi }) {
  const fotos = byCat[g.id] ?? [];
  const items = Array.from({ length: Math.max(MIN, fotos.length) }, (_, i) => fotos[i] ?? null);
  return (
    <section className="g-cat" aria-labelledby={`g-${g.id}`}>
      <header className="g-head">
        <span className="g-num" aria-hidden="true">{String(gi + 1).padStart(2, '0')}</span>
        <h3 id={`g-${g.id}`} className="display">{g.titulo}</h3>
        <p>{g.txt}</p>
      </header>
      <ul className="g-row">
        {items.map((src, i) => (
          <motion.li key={i} className={`g-item h${(i + gi) % 3}`}
            initial={{ y: 40, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, amount: 0.25 }}
            transition={{ type: 'spring', stiffness: 140, damping: 20, delay: i * 0.06 }}>
            {src ? <img src={src} alt={`${g.titulo}: foto de La Jarana`} loading="lazy" />
              : <><span className="g-logo" aria-hidden="true" /><span className="g-falta">[FALTA FOTO]</span></>}
          </motion.li>
        ))}
      </ul>
    </section>
  );
}

export default function Galeria() {
  return (
    <section id="galeria" className="sec white" data-logo="white" aria-labelledby="t-gal">
      <div className="wrap">
        <p className="kicker">Galería</p>
        <h2 id="t-gal" className="display big"><MaskWords text="Pruebas gráficas" /></h2>
        <p className="lead">Por si alguien pensaba que exagerábamos.</p>
        {GALERIA.map((g, gi) => <Grupo key={g.id} g={g} gi={gi} />)}
      </div>
    </section>
  );
}
