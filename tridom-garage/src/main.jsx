import { createRoot } from 'react-dom/client';
import '@fontsource-variable/figtree';
import '@fontsource/saira-condensed/600.css';
import '@fontsource/saira-condensed/700.css';
import './styles/app.css';
import './styles/live.css';
import './styles/taller.css';
import './styles/taller-info.css';
import App from './App.jsx';
import { LangProvider } from './i18n/index.jsx';
import { startTicker } from './lib/ticker.js';

startTicker();

// ?debug en la dirección: muestra en pantalla los errores y los datos de WebGL del dispositivo.
if (new URLSearchParams(window.location.search).has('debug')) {
  const box = document.createElement('pre');
  box.style.cssText = 'position:fixed;inset:auto 0 0 0;max-height:45vh;overflow:auto;margin:0;padding:8px 10px;background:#fff;color:#a92a2a;border-top:2px solid #a92a2a;font:11px/1.35 monospace;white-space:pre-wrap;z-index:99999';
  const log = (t) => { box.textContent += `${t}\n`; if (!box.isConnected) document.body.appendChild(box); };
  window.addEventListener('error', (e) => log(`ERROR: ${e.message} (${(e.filename || '').split('/').pop()}:${e.lineno})`));
  window.addEventListener('unhandledrejection', (e) => log(`PROMESA: ${e.reason?.stack || e.reason}`));
  try {
    const gl = document.createElement('canvas').getContext('webgl2') || document.createElement('canvas').getContext('webgl');
    const dbg = gl && gl.getExtension('WEBGL_debug_renderer_info');
    log(`WebGL: ${gl ? (dbg ? gl.getParameter(dbg.UNMASKED_RENDERER_WEBGL) : 'sí') : 'NO'} · ${navigator.userAgent}`);
  } catch (e) { log(`WebGL falló: ${e}`); }
  window.setTimeout(() => log(`Escena: ${window.__garage ? 'lista' : 'sin arrancar'}${window.__garageError ? `\n${window.__garageError}` : ''}`), 8000);
}
createRoot(document.getElementById('root')).render(<LangProvider><App /></LangProvider>);

// PWA: el service worker solo se registra con el build (en dev estorbaría al HMR).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => { navigator.serviceWorker.register('/sw.js').catch(() => {}); });
}
