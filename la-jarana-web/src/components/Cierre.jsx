import { useRef } from 'react';
import { motion, useScroll, useSpring, useTransform } from 'motion/react';
import { SITE } from '../content/site.js';

function Ghost({ w, k, sp }) {
  const y = useTransform(sp, [0, 1], [k * 60, 0]);
  const x = useTransform(sp, [0, 1], [k % 2 ? 50 : -50, 0]);
  return <motion.span className="ghost-w" style={{ y, x }}>{w}</motion.span>;
}

// M18 — titular fantasma gigante con parallax sutil por palabra.
export default function Cierre() {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] });
  const sp = useSpring(scrollYProgress, { stiffness: 70, damping: 20 });
  return (
    <footer ref={ref} className="sec sky cierre" data-logo="sky">
      <div className="ghost" aria-hidden="true">{['MAKE', 'RUBIELOS', 'GREAT', 'AGAIN'].map((w, k) => <Ghost key={w} w={w} k={k} sp={sp} />)}</div>
      <div className="wrap foot">
        <p className="display">{SITE.nombre}</p>
        <p>{SITE.lugar} · <a href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer">{SITE.instagram}</a></p>
        <p className="small">Desde el pajar, con cariño y cero humildad.</p>
      </div>
    </footer>
  );
}
