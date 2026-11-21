import { useEffect, useRef } from 'react';
import { frame, cancelFrame, useScroll, useSpring, useVelocity, useReducedMotion } from 'motion/react';

import { MARQUEE as TXT } from '../content/site.js';

// Cinta infinita movida por el ticker de Motion; el scroll la acelera y la invierte con inercia.
export default function Marquee() {
  const el = useRef(null); const reduce = useReducedMotion();
  const { scrollY } = useScroll();
  const vel = useSpring(useVelocity(scrollY), { stiffness: 80, damping: 30 });
  useEffect(() => {
    if (reduce || !el.current) return;
    let x = 0;
    const t = ({ delta }) => {
      const w = el.current.scrollWidth / 2;
      x -= (delta / 1000) * (60 + vel.get() * 0.06);
      if (x <= -w) x += w;
      if (x > 0) x -= w;
      el.current.style.transform = `translate3d(${x}px,0,0)`;
    };
    frame.update(t, true); return () => cancelFrame(t);
  }, [reduce, vel]);
  const row = [...TXT, ...TXT].map((t, i) => <span key={i}>{t}<em aria-hidden="true">✦</em></span>);
  return (
    <div className="marquee" data-logo="white" aria-hidden="true">
      <div className="track" ref={el}>{row}{row}</div>
    </div>
  );
}
