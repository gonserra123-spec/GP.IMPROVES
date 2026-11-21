import { useEffect, useState } from 'react';
import { motion, useMotionValueEvent, useScroll, useSpring } from 'motion/react';

const LINKS = [['comunicados', 'Comunicados'], ['nosotros', 'Nosotros'], ['pajar', 'El Pajar'], ['galeria', 'Galería'], ['merch', 'Merch']];

// Logo pequeño: a partir del primer scroll aparece la silueta en línea en tinta (#1B2733), que se lee
// sobre azul y sobre blanco. Navegación en píldora translúcida con desenfoque; enlace activo en azul cielo.
export default function Nav() {
  const { scrollY, scrollYProgress } = useScroll();
  const [shown, setShown] = useState(false);
  const [active, setActive] = useState('');
  const [open, setOpen] = useState(false);
  const bar = useSpring(scrollYProgress, { stiffness: 120, damping: 24 });
  const probe = () => {
    setShown(window.scrollY > 40);
    const mid = window.innerHeight * 0.35;
    let a = '';
    LINKS.forEach(([id]) => { const s = document.getElementById(id); if (!s) return; const r = s.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) a = id; });
    setActive(a);
  };
  useMotionValueEvent(scrollY, 'change', probe);
  useEffect(() => { probe(); window.addEventListener('resize', probe); return () => window.removeEventListener('resize', probe); }, []);
  useEffect(() => {
    if (!open) return;
    const k = (e) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k);
  }, [open]);
  return (
    <header className="nav">
      <a href="#inicio" className="logo-link" aria-label="La Jarana, inicio">
        <motion.span className="logo-mark" initial={false}
          animate={{ opacity: shown ? 1 : 0, scale: shown ? 1 : 1.6, y: shown ? 0 : 18 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }}>
          <span className="logo-img" />
        </motion.span>
      </a>
      <div className="pill">
        <nav id="menu" className={`links ${open ? 'open' : ''}`} aria-label="Principal">
          {LINKS.map(([id, t]) => <a key={id} href={`#${id}`} className={active === id ? 'is-active' : ''} aria-current={active === id ? 'true' : undefined} onClick={() => setOpen(false)}>{t}</a>)}
        </nav>
        <a href="#envia" className="btn btn-sm" onClick={() => setOpen(false)}><span>Envíanos algo</span></a>
        <button className="burger" aria-expanded={open} aria-controls="menu" aria-label={open ? 'Cerrar menú' : 'Abrir menú'} onClick={() => setOpen(!open)}><i /><i /></button>
      </div>
      <motion.div className="progress" style={{ scaleX: bar }} />
    </header>
  );
}
