import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import es from './es.js';
import en from './en.js';

const DICTS = { es, en };
const Ctx = createContext(null);

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o && o[k] !== undefined ? o[k] : undefined), dict);

function initialLang() {
  try { const s = localStorage.getItem('tg_lang'); if (s === 'es' || s === 'en') return s; } catch { /* almacenamiento bloqueado */ }
  return 'es';
}

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  const setLang = useCallback((l) => { setLangState(l); try { localStorage.setItem('tg_lang', l); } catch { /* sin almacenamiento */ } }, []);
  const value = useMemo(() => {
    const t = (key, vars) => {
      let s = lookup(DICTS[lang], key) ?? lookup(DICTS.es, key) ?? key;
      if (vars && typeof s === 'string') for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, v);
      return s;
    };
    const date = (iso, opts = { day: 'numeric', month: 'long' }) => (iso ? new Intl.DateTimeFormat(lang === 'es' ? 'es-ES' : 'en-GB', opts).format(new Date(iso)) : '');
    const money = (n) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency: 'EUR' }).format(n);
    return { lang, setLang, t, date, money };
  }, [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useT = () => useContext(Ctx);

export function LangSwitch({ className = '' }) {
  const { lang, setLang, t } = useT();
  return (
    <div className={`lang ${className}`} role="group" aria-label={t('common.language')}>
      {['es', 'en'].map((l) => (
        <button key={l} type="button" className="lang-btn" aria-pressed={lang === l} onClick={() => setLang(l)} lang={l}>{l.toUpperCase()}</button>
      ))}
    </div>
  );
}
