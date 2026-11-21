import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { MERCH } from '../content/site.js';
import { MaskWords } from './Reveal.jsx';
import Sticker from './Sticker.jsx';

const VasoCanvas = lazy(() => import('./VasoCanvas.jsx'));

function Ph({ m }) {
  return m.img ? <img src={m.img} alt={m.alt} loading="lazy" className={m.img.endsWith('.jpg') ? 'cover' : undefined} /> : <span className="m-falta"><span className="g-logo" aria-hidden="true" />[FALTA IMAGEN]</span>;
}

// Detalle: imagen grande o, para el vaso, el vaso 3D interactivo.
function Detalle({ m, onClose }) {
  const closeRef = useRef(null);
  useEffect(() => {
    const prev = document.activeElement;
    document.body.style.overflow = 'hidden'; closeRef.current?.focus();
    const k = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', k);
    return () => { document.body.style.overflow = ''; window.removeEventListener('keydown', k); prev?.focus?.(); };
  }, [onClose]);
  return (
    <motion.div className="m-modal" role="dialog" aria-modal="true" aria-labelledby="m-title" onClick={onClose}
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
      <motion.div className="m-sheet" onClick={(e) => e.stopPropagation()}
        initial={{ y: 60, scale: 0.96 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}>
        <button ref={closeRef} className="m-close" onClick={onClose} aria-label="Cerrar">✕</button>
        <div className={`m-big ${m.tipo === 'vaso3d' ? 'is-3d' : ''}`}>
          {m.tipo === 'vaso3d' ? <Suspense fallback={null}><VasoCanvas /></Suspense> : <Ph m={m} />}
        </div>
        <div className="m-info">
          <h3 id="m-title" className="display">{m.nombre}</h3>
          <p>{m.txt}</p>
          {m.tipo === 'vaso3d' && <p className="m-tip">Arrastra para girarlo.</p>}
        </div>
      </motion.div>
    </motion.div>
  );
}

export default function Merch() {
  const [open, setOpen] = useState(null);
  const close = useCallback(() => setOpen(null), []);
  return (
    <section id="merch" className="sec sky" data-logo="sky" aria-labelledby="t-mer">
      <Sticker style={{ left: '4%', bottom: '6%' }} rotate={-11} />
      <div className="wrap">
        <p className="kicker">Merchandising</p>
        <h2 id="t-mer" className="display big"><MaskWords text="Ponte la peña encima" /></h2>
        <p className="lead">Edición limitada. Como nosotros.</p>
        <ul className="merch">
          {MERCH.map((m, i) => (
            <motion.li key={m.id} className={m.destacado ? 'is-big' : ''}
              initial={{ y: 50, opacity: 0 }} whileInView={{ y: 0, opacity: 1 }} viewport={{ once: true, amount: 0.25 }}
              transition={{ type: 'spring', stiffness: 130, damping: 20, delay: (i % 3) * 0.07 }}>
              <motion.button className="m-card" onClick={() => setOpen(m)} aria-haspopup="dialog"
                whileHover={{ y: -8, rotate: i % 2 ? 1.2 : -1.2 }} whileTap={{ scale: 0.97 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20 }}>
                <span className="m-ph"><Ph m={m} /></span>
                <span className="m-name display">{m.nombre}</span>
                <span className="m-txt">{m.txt}</span>
                <span className="m-more">{m.tipo === 'vaso3d' ? 'Girar en 3D →' : 'Ver de cerca →'}</span>
              </motion.button>
            </motion.li>
          ))}
        </ul>
      </div>
      <AnimatePresence>{open && <Detalle m={open} onClose={close} />}</AnimatePresence>
    </section>
  );
}
