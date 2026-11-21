import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';

const IMGS = ['/img/merch/pegatina.webp', '/img/logo-color.webp', '/img/merch/vaso.webp'];
const N = 40, TOTAL = 5000;

// Lluvia de pegatinas: botón flotante + easter egg (teclear "JARANA" en cualquier parte).
// Encima de todo y sin bloquear clics (pointer-events: none). Se dispara con el evento 'jarana:lluvia'.
export default function Lluvia() {
  const reduce = useReducedMotion();
  const [drops, setDrops] = useState([]);
  const timer = useRef(0);

  const start = useCallback(() => {
    const vw = window.innerWidth, vh = window.innerHeight;
    const n = reduce ? 12 : N;
    setDrops(Array.from({ length: n }, (_, i) => {
      const size = 56 + Math.random() * 70;
      return {
        id: `${Date.now()}-${i}`, src: IMGS[i % IMGS.length], size,
        x: Math.random() * (vw - size), floor: vh - size - Math.random() * 40, vh,
        delay: reduce ? 0 : Math.random() * (TOTAL / 1000 - 2.4), rot: (Math.random() - 0.5) * 720,
      };
    }));
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setDrops([]), reduce ? 1600 : TOTAL + 600);
  }, [reduce]);

  useEffect(() => {
    let buf = '';
    const onKey = (e) => {
      if (e.key.length !== 1) return;
      buf = (buf + e.key.toUpperCase()).slice(-6);
      if (buf === 'JARANA') { buf = ''; start(); }
    };
    const onEvt = () => start();
    window.addEventListener('keydown', onKey); window.addEventListener('jarana:lluvia', onEvt);
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('jarana:lluvia', onEvt); };
  }, [start]);
  useEffect(() => () => clearTimeout(timer.current), []);

  return (
    <>
      <motion.button className="rain-btn" onClick={start} aria-label="Lluvia de pegatinas"
        whileHover={{ rotate: -8, scale: 1.06 }} whileTap={{ scale: 0.92 }} transition={{ type: 'spring', stiffness: 400, damping: 15 }}>
        <img src="/img/merch/pegatina.webp" alt="" aria-hidden="true" />
        <span>Lluvia de pegatinas</span>
      </motion.button>
      <div className="rain" aria-hidden="true">
          {drops.map((d) => (
            <motion.img key={d.id} src={d.src} alt="" className="drop"
              style={{ left: d.x, width: d.size }}
              initial={{ y: -d.size - 40, rotate: 0, opacity: reduce ? 0 : 1 }}
              animate={reduce
                ? { y: d.floor * 0.5, opacity: [0, 1, 1, 0] }
                : { y: [-d.size - 40, d.floor, d.floor - 70, d.floor, d.vh + 80], rotate: [0, d.rot * 0.6, d.rot * 0.8, d.rot, d.rot * 1.2] }}
              transition={reduce
                ? { duration: 1.4, ease: 'easeOut' }
                : { duration: 2.4, delay: d.delay, times: [0, 0.42, 0.56, 0.68, 1], ease: ['easeIn', 'easeOut', 'easeIn', 'easeIn'] }}
            />
          ))}
      </div>
    </>
  );
}
