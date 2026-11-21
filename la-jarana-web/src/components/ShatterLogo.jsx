import { motion, useReducedMotion } from 'motion/react';
import { useMemo } from 'react';

const COLS = 6, ROWS = 8;
const rnd = (s) => { const x = Math.sin(s * 9301 + 49297) * 233280; return x - Math.floor(x); };

// El logo entra hecho pedazos (espuma salpicada) y se recompone de golpe con un spring duro.
export default function ShatterLogo() {
  const reduce = useReducedMotion();
  const tiles = useMemo(() => Array.from({ length: COLS * ROWS }, (_, i) => {
    const cx = i % COLS, cy = Math.floor(i / COLS);
    const a = rnd(i + 1) * Math.PI * 2, d = 160 + rnd(i + 90) * 340;
    return { cx, cy, x: Math.cos(a) * d, y: Math.sin(a) * d - 80, r: (rnd(i + 7) - 0.5) * 260, s: 0.3 + rnd(i + 33) * 0.9, k: rnd(i + 5) * 0.28 };
  }), []);
  const foam = useMemo(() => Array.from({ length: 16 }, (_, i) => {
    const a = rnd(i + 200) * Math.PI * 2, d = 70 + rnd(i + 300) * 150;
    return { x: Math.cos(a) * d, y: Math.sin(a) * d * 0.9, z: 8 + rnd(i + 400) * 26 };
  }), []);
  return (
    <div className="shatter" role="img" aria-label="La Jarana: un toro sentado sobre una jarra de cerveza">
      {tiles.map((t, i) => (
        <motion.i
          key={i}
          className="tile"
          style={{ '--cx': t.cx, '--cy': t.cy }}
          initial={reduce ? false : { x: t.x, y: t.y, rotate: t.r, scale: t.s, opacity: 0 }}
          animate={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 430, damping: 24, mass: 0.9, delay: 0.25 + t.k }}
        />
      ))}
      {!reduce && foam.map((f, i) => (
        <motion.b
          key={i}
          className="foam"
          style={{ width: f.z, height: f.z }}
          initial={{ x: 0, y: 0, scale: 0, opacity: 0 }}
          animate={{ x: [0, f.x, f.x * 1.15], y: [0, f.y, f.y * 1.15 + 20], scale: [0, 1, 0], opacity: [0, 1, 0] }}
          transition={{ duration: 1.1, delay: 0.55 + (i % 5) * 0.03, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
