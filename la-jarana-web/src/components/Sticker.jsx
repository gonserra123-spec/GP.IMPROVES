import { motion, useReducedMotion } from 'motion/react';

// Pegatina que se "pega" en la página al entrar en pantalla: cae grande, rebota y se queda.
export default function Sticker({ style, rotate = -8, size = 'clamp(110px, 14vw, 190px)' }) {
  const reduce = useReducedMotion();
  return (
    <motion.img
      src="/img/merch/pegatina.webp" alt="" aria-hidden="true" className="sticker" loading="lazy"
      style={{ ...style, width: size }}
      initial={reduce ? false : { scale: 1.9, opacity: 0, rotate: rotate - 28, y: -40 }}
      whileInView={{ scale: 1, opacity: 1, rotate, y: 0 }}
      viewport={{ once: true, amount: 0.6 }}
      transition={{ type: 'spring', stiffness: 380, damping: 14, mass: 0.8 }}
    />
  );
}
