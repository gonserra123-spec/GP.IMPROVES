import { useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useI18n } from '../i18n/index.jsx';
import Picture from './Picture.jsx';

const easeOut = (x) => 1 - (1 - x) ** 3;

// Animación de firma «Vano de obra»: un muro abre un hueco (clip-path) que crece con el scroll
// hasta revelar la estancia. El título se parte en dos mitades que se separan al abrirse el hueco.
export default function Vano() {
  const { t } = useI18n();
  const reduce = useReducedMotion();
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end end'] });
  const p = useTransform(scrollYProgress, [0.06, 0.8], [0, 1], { clamp: true });
  const e = useTransform(p, easeOut);

  const clipPath = useTransform(e, (v) => {
    const top = 66 * (1 - v); const side = 43 * (1 - v);
    return `inset(${top}% ${side}% 0% ${side}% round 64px 64px 0 0)`;
  });
  const scale = useTransform(e, [0, 1], [1.4, 1]);
  const capOpacity = useTransform(p, [0.85, 1], [0, 1]);
  const [w1, w2] = t('vano.title').split(' ').reduce((acc, w, i, arr) => {
    const mid = Math.ceil(arr.length / 2);
    acc[i < mid ? 0 : 1].push(w);
    return acc;
  }, [[], []]).map((a) => a.join(' '));
  const x1 = useTransform(e, [0, 1], ['0vw', '-3vw']);
  const x2 = useTransform(e, [0, 1], ['0vw', '3vw']);

  if (reduce) {
    return (
      <section className="vano static" aria-labelledby="vano-t">
        <div className="wrap">
          <h2 id="vano-t" className="vano-title" style={{ position: 'static', marginBottom: 40 }}>
            <span>{w1}</span> <span>{w2}</span>
          </h2>
        </div>
        <div className="wrap">
          <div className="vano-box" style={{ position: 'relative' }}>
            <div className="vano-clip"><Picture id="cocina-marmol-negra" alt={t('vano.alt')} sizes="(min-width: 1248px) 1200px, 92vw" /></div>
            <span className="tag vano-cap">{t('vano.caption')}</span>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section ref={ref} className="vano" aria-labelledby="vano-t">
      <div className="vano-stage">
        <h2 id="vano-t" className="vano-title">
          <motion.span style={{ x: x1 }}>{w1}</motion.span>
          <motion.span style={{ x: x2 }}>{w2}</motion.span>
        </h2>
        <div className="vano-box">
          <motion.div className="vano-clip" style={{ clipPath }}>
            <motion.div className="vano-img" style={{ scale }}>
              <Picture id="cocina-marmol-negra" alt={t('vano.alt')} sizes="(min-width: 1248px) 1200px, 92vw" />
            </motion.div>
          </motion.div>
          <motion.span className="tag vano-cap" style={{ opacity: capOpacity }}>{t('vano.caption')}</motion.span>
        </div>
      </div>
    </section>
  );
}
