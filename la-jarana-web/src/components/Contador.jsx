import { useEffect, useState } from 'react';
import { AnimatePresence, frame, cancelFrame, motion, useReducedMotion } from 'motion/react';

const TZ = 'Europe/Madrid';
const fmt = new Intl.DateTimeFormat('en-GB', { timeZone: TZ, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' });

// Fecha/hora "de pared" en Madrid para un instante.
function madridParts(ms) {
  const p = Object.fromEntries(fmt.formatToParts(new Date(ms)).map((x) => [x.type, Number(x.value)]));
  return p;
}
// Instante UTC en que en Madrid son las 00:00 del día dado (resuelve horario de verano).
function madridMidnight(y, m, d) {
  let guess = Date.UTC(y, m - 1, d);
  for (let i = 0; i < 2; i++) {
    const p = madridParts(guess);
    const asUTC = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
    guess += Date.UTC(y, m - 1, d) - asUTC;
  }
  return guess;
}
// Próximo 14 de septiembre; el 14 y el 15 → "en patronales".
export function estadoPatronales(now = Date.now()) {
  const p = madridParts(now);
  if (p.month === 9 && (p.day === 14 || p.day === 15)) return { fiesta: true };
  const y = p.month < 9 || (p.month === 9 && p.day < 14) ? p.year : p.year + 1;
  const diff = Math.max(0, madridMidnight(y, 9, 14) - now);
  const s = Math.floor(diff / 1000);
  return { fiesta: false, d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

function Flip({ v, label, reduce }) {
  const txt = String(v).padStart(2, '0');
  return (
    <span className="cd-unit">
      <span className="cd-num display">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span key={txt} initial={reduce ? false : { y: '-70%', opacity: 0, rotateX: 70 }} animate={{ y: '0%', opacity: 1, rotateX: 0 }}
            exit={reduce ? { opacity: 0 } : { y: '60%', opacity: 0, rotateX: -70 }} transition={{ type: 'spring', stiffness: 420, damping: 28 }}>
            {txt}
          </motion.span>
        </AnimatePresence>
      </span>
      <span className="cd-lab">{label}</span>
    </span>
  );
}

export default function Contador() {
  const reduce = useReducedMotion();
  const [st, setSt] = useState(() => estadoPatronales());
  useEffect(() => {
    let last = -1;
    const t = () => { const sec = Math.floor(Date.now() / 1000); if (sec !== last) { last = sec; setSt(estadoPatronales()); } };
    frame.update(t, true); // ticker único; solo re-renderiza al cambiar el segundo
    return () => cancelFrame(t);
  }, []);
  if (st.fiesta) return <p className="cd cd-fiesta display" role="status">¡Estamos en patronales!</p>;
  return (
    <div className="cd" role="timer" aria-label={`Faltan ${st.d} días, ${st.h} horas y ${st.m} minutos para las patronales`}>
      <p className="cd-title">Cuenta atrás para las patronales · 14 sept</p>
      <div className="cd-row" aria-hidden="true">
        <Flip v={st.d} label="días" reduce={reduce} /><Flip v={st.h} label="horas" reduce={reduce} />
        <Flip v={st.m} label="min" reduce={reduce} /><Flip v={st.s} label="seg" reduce={reduce} />
      </div>
    </div>
  );
}
