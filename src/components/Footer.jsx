import { useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { BUSINESS } from '../data/business.js';
import { asset } from '../lib/asset.js';
import Ph from './Ph.jsx';

export default function Footer() {
  const { t, lang, dict } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <footer className="footer on-dark" id="privacidad-pie">
      <div className="wrap">
        <img className="flogo" src={asset('logo-2con2estudio-blanco.png')} width="480" height="442" alt={t('a11y.logoAlt')} loading="lazy" />
        <p className="slogan">{BUSINESS.slogan[lang]}</p>
        <div className="footer-links">
          <a href={BUSINESS.instagram.url} target="_blank" rel="noopener noreferrer">{BUSINESS.instagram.handle}</a>
          <button type="button" aria-expanded={open} aria-controls="privacidad" onClick={() => setOpen((o) => !o)}>{t('footer.privacy')}</button>
          <a href="#top">{t('footer.top')}</a>
        </div>
        <div id="privacidad" className="privacy" data-open={open}>
          <h2 className="h40">{dict.privacy.title}</h2>
          <dl>
            {dict.privacy.items.map(([k, v]) => (
              <div key={k}><dt>{k}</dt><dd>{v.replace('{email}', BUSINESS.email)}</dd></div>
            ))}
          </dl>
          <div style={{ marginTop: 16 }}><Ph k="privacy" /></div>
        </div>
        <p className="mono footer-meta">{t('footer.rights', { year: new Date().getFullYear() })}</p>
      </div>
    </footer>
  );
}
