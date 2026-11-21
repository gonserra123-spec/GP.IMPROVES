import { motion, useReducedMotion } from 'motion/react';
import { splitWords } from '../lib/hooks.js';

// Titular con máscara: cada palabra sube desde una línea recortada (spring).
export function MaskWords({ text, delay = 0, className = '', once = true }) {
  const reduce = useReducedMotion();
  return (
    <motion.span className={`mask-words ${className}`} aria-label={text} initial="h" whileInView="s" viewport={{ once, amount: 0.4 }}>
      {splitWords(text).map((w, i) => (
        <span key={i} aria-hidden="true">
          <span className="mw">
            <motion.span
              className="mw-in"
              variants={{ h: { y: reduce ? '0%' : '115%' }, s: { y: '0%' } }}
              transition={{ type: 'spring', stiffness: 170, damping: 22, delay: delay + i * 0.06 }}
            >{w}</motion.span>
          </span>{' '}
        </span>
      ))}
    </motion.span>
  );
}
