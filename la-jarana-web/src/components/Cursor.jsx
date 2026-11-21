import { useEffect } from 'react';
import { motion, useMotionValue, useSpring, useReducedMotion } from 'motion/react';
import { useFinePointer } from '../lib/hooks.js';

// M14 — cursor de doble anillo con el toro en miniatura. Tamaño FIJO: el feedback de hover vive en el elemento.
export default function Cursor() {
  const fine = useFinePointer(); const reduce = useReducedMotion();
  const x = useMotionValue(-100), y = useMotionValue(-100);
  const inX = useSpring(x, { stiffness: 900, damping: 40 }), inY = useSpring(y, { stiffness: 900, damping: 40 });
  const outX = useSpring(x, { stiffness: 160, damping: 20 }), outY = useSpring(y, { stiffness: 160, damping: 20 });
  const toroX = useSpring(x, { stiffness: 80, damping: 16 }), toroY = useSpring(y, { stiffness: 80, damping: 16 });
  useEffect(() => {
    if (!fine || reduce) return;
    const m = (e) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener('pointermove', m); return () => window.removeEventListener('pointermove', m);
  }, [fine, reduce, x, y]);
  if (!fine || reduce) return null;
  return (
    <div className="cursor" aria-hidden="true">
      <motion.i className="c-out" style={{ x: outX, y: outY }} />
      <motion.i className="c-in" style={{ x: inX, y: inY }} />
      <motion.i className="c-toro" style={{ x: toroX, y: toroY }}><b /></motion.i>
    </div>
  );
}
