import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { BUSINESS } from '../data/business.js';
import { asset } from '../lib/asset.js';

const LINKS = [['studio', '#estudio'], ['services', '#reformas'], ['process', '#proceso'], ['projects', '#proyectos'], ['faq', '#preguntas'], ['contact', '#contacto']];

const parse = (c) => {
  const m = c.match(/rgba?\(([^)]+)\)/);
  if (!m) return null;
  const [r, g, b, a = 1] = m[1].split(/[ ,/]+/).filter(Boolean).map(Number);
  return { r, g, b, a };
};
const lum = ({ r, g, b }) => {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const contrast = (l1, l2) => (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
const WHITE = { r: 255, g: 255, b: 255, a: 1 };

// Elige logo blanco/negro según el fondo real bajo el logo. Si ninguna versión alcanza AA (4.5:1)
// o hay una imagen debajo, añade una placa del color base de la sección detrás del logo.
function useLogoTone(ref) {
  const [tone, setTone] = useState({ ink: 'black', plate: null });
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      raf = 0;
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      const stack = document.elementsFromPoint(r.left + r.width / 2, r.top + r.height / 2)
        .filter((n) => !n.closest('[data-logo-ui]'));
      let bg = null; let image = false;
      for (const n of stack) {
        if (n.tagName === 'IMG' || n.tagName === 'VIDEO') { image = true; continue; }
        const c = parse(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0.9) { bg = c; break; }
      }
      bg = bg || WHITE;
      const L = lum(bg);
      const cb = contrast(L, lum({ r: 38, g: 38, b: 38 })); const cw = contrast(L, 1);
      const best = Math.max(cb, cw);
      if (image || best < 4.5) {
        let base = WHITE;
        for (const n of stack) {
          if (n.tagName !== 'SECTION' && n.tagName !== 'FOOTER') continue;
          const c = parse(getComputedStyle(n).backgroundColor);
          if (c && c.a > 0.9) { base = c; break; }
        }
        const Lp = lum(base);
        const plate = `rgb(${base.r}, ${base.g}, ${base.b})`;
        setTone({ ink: contrast(Lp, 0) >= contrast(Lp, 1) ? 'black' : 'white', plate });
      } else {
        setTone({ ink: cb >= cw ? 'black' : 'white', plate: null });
      }
    };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(measure); };
    measure();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    const id = setTimeout(measure, 400);
    return () => { cancelAnimationFrame(raf); clearTimeout(id); window.removeEventListener('scroll', onScroll); window.removeEventListener('resize', onScroll); };
  }, [ref]);
  return tone;
}

export default function Header() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const logoRef = useRef(null);
  const tone = useLogoTone(logoRef);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <header className="header" data-logo-ui>
      <div className="hchip left">
        <button type="button" className="burger" aria-expanded={open} aria-controls="menu" aria-label={open ? t('a11y.closeMenu') : t('a11y.menu')} onClick={() => setOpen((o) => !o)}>
          <i aria-hidden="true" />
          <span className="lbl" aria-hidden="true">{t('a11y.menuLabel')}</span>
        </button>
      </div>

      <a
        ref={logoRef}
        className="logo"
        href="#top"
        aria-label={t('a11y.home')}
        data-ink={tone.ink}
        data-plate={tone.plate ? '' : undefined}
        style={tone.plate ? { '--plate': tone.plate } : undefined}
      >
        <img className="logo-b" src={asset('logo-2con2estudio-negro.png')} width="480" height="442" alt="" />
        <img className="logo-w" src={asset('logo-2con2estudio-blanco.png')} width="480" height="442" alt="" />
      </a>

      <div className="hchip right">
        <a className="ig" href={BUSINESS.instagram.url} target="_blank" rel="noopener noreferrer" aria-label={t('a11y.instagram')}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
            <rect x="3.5" y="3.5" width="17" height="17" rx="5" /><circle cx="12" cy="12" r="4" /><circle cx="17.2" cy="6.8" r="0.6" fill="currentColor" />
          </svg>
        </a>
        <div className="lang" role="group" aria-label={t('a11y.langGroup')}>
          <button type="button" lang="es" aria-pressed={lang === 'es'} aria-label={t('a11y.langEs')} onClick={() => setLang('es')}>ES</button>
          <button type="button" lang="en" aria-pressed={lang === 'en'} aria-label={t('a11y.langEn')} onClick={() => setLang('en')}>EN</button>
        </div>
      </div>

      <nav id="menu" className="menu" data-open={open} aria-label={t('a11y.mainNav')}>
        {LINKS.map(([k, href]) => <a key={k} href={href} onClick={() => setOpen(false)}>{t(`nav.${k}`)}</a>)}
        <a className="btn btn-fill" href="#presupuesto" onClick={() => setOpen(false)}>{t('nav.cta')}</a>
      </nav>
    </header>
  );
}
