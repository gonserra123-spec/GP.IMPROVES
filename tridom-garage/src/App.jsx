import { lazy, Suspense, useEffect, useState } from 'react';
import Landing from './pages/Landing.jsx';
import { useT } from './i18n/index.jsx';

const Panel = lazy(() => import('./pages/Panel.jsx'));
const Consulta = lazy(() => import('./pages/Consulta.jsx'));
const Privacy = lazy(() => import('./pages/Privacy.jsx'));
const Tv = lazy(() => import('./pages/Tv.jsx'));
const Cita = lazy(() => import('./pages/Cita.jsx'));

function match(path) {
  if (path === '/' || path === '') return { page: 'landing' };
  if (path === '/panel' || path === '/panel/') return { page: 'panel' };
  if (path === '/tv' || path === '/tv/') return { page: 'tv' };
  const c = /^\/cita\/([A-Za-z0-9]{4,12})\/?$/.exec(path);
  if (c) return { page: 'cita', code: c[1].toUpperCase() };
  if (path === '/privacidad' || path === '/privacidad/') return { page: 'privacy' };
  const m = /^\/consulta\/([A-Za-z0-9]{4,12})\/?$/.exec(path);
  if (m) return { page: 'consulta', code: m[1].toUpperCase() };
  return { page: 'landing', unknown: true };
}

export default function App() {
  const [path, setPath] = useState(window.location.pathname);
  const { t } = useT();
  useEffect(() => {
    const on = () => setPath(window.location.pathname);
    window.addEventListener('popstate', on);
    return () => window.removeEventListener('popstate', on);
  }, []);
  const route = match(path);
  useEffect(() => {
    // Panel y consulta no se indexan: son herramientas con datos de un taller.
    let meta = document.querySelector('meta[name="robots"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'robots'; document.head.appendChild(meta); }
    meta.content = route.page === 'landing' || route.page === 'privacy' ? 'index, follow' : 'noindex, nofollow';
    const titles = { landing: 'Tridom Automotive · Seguimiento de vehículos para talleres', panel: `${t('panel.title')} · Tridom Automotive`, consulta: `${t('consulta.title')} · Tridom Automotive`, privacy: `${t('privacy.title')} · Tridom Automotive`, tv: `${t('tv.title')} · Tridom Automotive`, cita: `${t('cita.title')} · Tridom Automotive` };
    document.title = titles[route.page];
  }, [route.page, t]);
  return (
    <Suspense fallback={<p className="scene-loading" role="status">{t('common.loading')}</p>}>
      {route.page === 'landing' && <Landing />}
      {route.page === 'panel' && <Panel />}
      {route.page === 'consulta' && <Consulta code={route.code} />}
      {route.page === 'privacy' && <Privacy />}
      {route.page === 'tv' && <Tv />}
      {route.page === 'cita' && <Cita code={route.code} />}
    </Suspense>
  );
}
