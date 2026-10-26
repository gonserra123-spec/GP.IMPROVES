import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

export default function Faq() {
  const { t, dict } = useI18n();
  const [open, setOpen] = useState(0);
  return (
    <section className="section faq" id="preguntas" aria-labelledby="faq-t" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="narrow">
        <h2 id="faq-t" className="display">{t('faq.title')}</h2>
        <div className="faq-list">
          {dict.faq.items.map((it, i) => {
            const isOpen = open === i;
            return (
              <div className="faq-item" key={it.q}>
                <h3>
                  <button type="button" className="faq-q" aria-expanded={isOpen} aria-controls={`faq-a-${i}`} id={`faq-q-${i}`} onClick={() => setOpen(isOpen ? -1 : i)}>
                    <span>{it.q}</span>
                    <span className="pm" aria-hidden="true" />
                  </button>
                </h3>
                <div className="faq-a" data-open={isOpen} id={`faq-a-${i}`} role="region" aria-labelledby={`faq-q-${i}`} inert={!isOpen}>
                  <div><p>{it.a}</p></div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
