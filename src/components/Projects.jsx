import { useCallback, useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { IMAGES } from '../data/images.js';
import { PROJECTS, SHOW_PLACEHOLDERS } from '../data/business.js';
import Picture from './Picture.jsx';
import Ph from './Ph.jsx';

const Chevron = ({ dir }) => (
  <svg viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
    <path d={dir === 'l' ? 'M11 3 5 9l6 6' : 'M7 3l6 6-6 6'} />
  </svg>
);

// Carrusel horizontal con encaje (scroll-snap): desplazable con el dedo, el ratón, el teclado o las flechas.
export default function Projects() {
  const { t, lang } = useI18n();
  const ref = useRef(null);
  const [idx, setIdx] = useState(0);

  const update = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const mid = el.scrollLeft + el.clientWidth / 2;
    let best = 0; let dist = Infinity;
    [...el.children].forEach((c, i) => {
      const d = Math.abs(c.offsetLeft + c.offsetWidth / 2 - mid);
      if (d < dist) { dist = d; best = i; }
    });
    setIdx(best);
  }, []);

  useEffect(() => { update(); window.addEventListener('resize', update); return () => window.removeEventListener('resize', update); }, [update]);

  const go = (i) => {
    const el = ref.current;
    const c = el?.children[Math.max(0, Math.min(PROJECTS.length - 1, i))];
    if (!c) return;
    el.scrollTo({ left: c.offsetLeft + c.offsetWidth / 2 - el.clientWidth / 2, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  return (
    <section className="projects" id="proyectos" aria-labelledby="proj-t">
      <h2 id="proj-t" className="sr-only">{t('projects.title')}</h2>
      <div
        ref={ref} className="carousel" role="region" aria-roledescription="carousel" aria-label={t('projects.title')} tabIndex={0}
        onScroll={update}
      >
        {PROJECTS.map((p, i) => {
          const m = IMAGES[p.id];
          return (
            <figure key={p.id} className="slide" aria-label={`${i + 1} / ${PROJECTS.length}`}>
              <div className="ph" style={{ '--ar': m.width / m.height }}>
                <Picture id={p.id} alt={p.alt[lang]} sizes="(min-width: 900px) 640px, 86vw" priority={i === 0} />
              </div>
              <figcaption>
                <span>{p.cap[lang]}</span>
                {SHOW_PLACEHOLDERS && (
                  <span className="flags">
                    {!p.own && <span className="tag">{t('projects.unconfirmed')}</span>}
                    <span className="tag">{t('projects.lowres')}</span>
                  </span>
                )}
              </figcaption>
            </figure>
          );
        })}
      </div>
      <div className="car-ctl">
        <button type="button" aria-label={t('carousel.prev')} disabled={idx === 0} onClick={() => go(idx - 1)}><Chevron dir="l" /></button>
        <span className="mono count" aria-live="polite">{t('carousel.counter', { n: idx + 1, total: PROJECTS.length })}</span>
        <button type="button" aria-label={t('carousel.next')} disabled={idx === PROJECTS.length - 1} onClick={() => go(idx + 1)}><Chevron dir="r" /></button>
      </div>
      <div className="wrap center" style={{ marginTop: 20 }}><Ph k="projects" /></div>
      <div className="actions">
        <a className="btn btn-fill" href="#presupuesto">{t('hero.cta')}</a>
        <a className="btn btn-ghost" href="#estudio">{t('hero.ctaStudio')}</a>
      </div>
    </section>
  );
}
