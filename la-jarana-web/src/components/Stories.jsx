import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, frame, cancelFrame } from 'motion/react';
import { COMUNICADOS, FIRMA } from '../content/comunicados.js';

const MS = 6000;

// M16 — overlay tipo historias de Instagram: una barra de progreso por diapositiva.
export default function Stories({ index, onClose, onChange }) {
  const open = index !== null;
  const [slide, setSlide] = useState(0);
  const [pct, setPct] = useState(0);
  const hold = useRef(false); const closeRef = useRef(null);
  const c = open ? COMUNICADOS[index] : null;

  useEffect(() => { setSlide(0); setPct(0); }, [index]);
  const next = () => {
    if (slide < c.slides.length - 1) { setSlide(slide + 1); setPct(0); }
    else if (index < COMUNICADOS.length - 1) onChange(index + 1);
    else onClose();
  };
  const prev = () => { if (pct > 0.15 || slide === 0) { setPct(0); } else { setSlide(slide - 1); setPct(0); } };

  useEffect(() => {
    if (!open) return;
    let p = 0;
    const t = ({ delta }) => { if (hold.current) return; p += delta / MS; setPct(Math.min(p, 1)); };
    p = 0; frame.update(t, true);
    return () => cancelFrame(t);
  }, [open, slide, index]);
  useEffect(() => { if (open && pct >= 1) next(); }, [pct]); // eslint-disable-line

  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden'; closeRef.current?.focus();
    const k = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowRight') next(); if (e.key === 'ArrowLeft') prev(); };
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k); };
  }); // eslint-disable-line

  return (
    <AnimatePresence>
      {open && (
        <motion.div className="stories" role="dialog" aria-modal="true" aria-label={`Comunicado ${c.n}`}
          initial={{ clipPath: 'inset(0 0 100% 0)' }} animate={{ clipPath: 'inset(0 0 0% 0)' }} exit={{ clipPath: 'inset(100% 0 0 0)' }}
          transition={{ type: 'spring', stiffness: 160, damping: 26 }}
          onPointerDown={() => { hold.current = true; }} onPointerUp={() => { hold.current = false; }} onPointerLeave={() => { hold.current = false; }}>
          <div className="bars">
            {c.slides.map((_, i) => <i key={i}><b style={{ transform: `scaleX(${i < slide ? 1 : i === slide ? pct : 0})` }} /></i>)}
          </div>
          <div className="s-head"><span>La Jarana · Comunicado nº {String(c.n).padStart(2, '0')}</span>
            <button ref={closeRef} onClick={onClose} aria-label="Cerrar">✕</button></div>
          <AnimatePresence mode="wait">
            <motion.div key={`${index}-${slide}`} className="s-body" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
              <h3 className="display">{c.titulo}</h3>
              <p>{c.slides[slide]}</p>
              {slide === c.slides.length - 1 && <p className="firma">— {FIRMA}</p>}
            </motion.div>
          </AnimatePresence>
          <button className="tap l" onClick={prev} aria-label="Anterior" />
          <button className="tap r" onClick={next} aria-label="Siguiente" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
