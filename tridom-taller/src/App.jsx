import { useEffect } from 'react';
import { boot, useStore } from './lib/store.js';
import Login from './pages/Login.jsx';
import Work from './pages/Work.jsx';
import Admin from './pages/Admin.jsx';
import { Privacy, Track, Unsub } from './pages/Public.jsx';

export default function App() {
  const path = window.location.pathname;
  const { status } = useStore();
  const own = path === '/' || path === '';
  useEffect(() => { if (own) boot(); }, [own]);
  useEffect(() => { document.title = path.startsWith('/admin') ? 'Administración · Tridom Automotive' : 'Taller · Tridom Automotive'; }, [path]);
  if (path.startsWith('/admin')) return <Admin />;
  if (path.startsWith('/coche/')) return <Track token={decodeURIComponent(path.slice(7))} />;
  if (path.startsWith('/baja/')) return <Unsub token={decodeURIComponent(path.slice(6))} />;
  if (path.startsWith('/privacidad')) return <Privacy />;
  if (status === 'boot') return <p className="hint" style={{ padding: 24 }} role="status">Cargando…</p>;
  return status === 'ready' ? <Work /> : <Login />;
}
