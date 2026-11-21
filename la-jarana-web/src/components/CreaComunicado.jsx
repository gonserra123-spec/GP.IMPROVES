import { useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ESTILOS, EXTENSIONES, generaLocal, limpiaTema } from '../content/plantillas.js';
import { FORMULA, descargaComunicado } from '../lib/comunicadoCanvas.js';
import { Sello } from './Comunicados.jsx';

// Endpoint del Worker (Cloudflare) que llama a Gemini con la clave guardada como secreto.
// Se configura en build: VITE_COMUNICADO_API=https://<tu-worker>.workers.dev
const API = import.meta.env.VITE_COMUNICADO_API || '';

async function generaRemoto(datos) {
  if (!/^https:\/\/[\w.-]+\.workers\.dev(\/.*)?$/.test(API)) throw new Error('sin api');
  const ctrl = new AbortController(); const t = setTimeout(() => ctrl.abort(), 9000);
  try {
    const r = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(datos), signal: ctrl.signal });
    if (!r.ok) throw new Error(String(r.status));
    const j = await r.json();
    const titulo = typeof j.titulo === 'string' ? j.titulo.slice(0, 140) : '';
    const puntos = Array.isArray(j.puntos) ? j.puntos.filter((p) => typeof p === 'string').map((p) => p.slice(0, 220)).slice(0, 6) : [];
    if (!titulo || !puntos.length) throw new Error('vacío');
    return { titulo, puntos, origen: 'ia' };
  } finally { clearTimeout(t); }
}

export default function CreaComunicado() {
  const reduce = useReducedMotion();
  const [tema, setTema] = useState('');
  const [estilo, setEstilo] = useState('gamberro');
  const [extension, setExtension] = useState('medio');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const [n, setN] = useState(0);
  const [dlErr, setDlErr] = useState('');
  const baja = async (f) => { setDlErr(''); if (!(await descargaComunicado(res, f))) setDlErr('No se pudo generar la imagen en este navegador. Prueba con otro o haz captura.'); };

  const submit = async (e) => {
    e.preventDefault();
    const datos = { tema: limpiaTema(tema), estilo, extension };
    setBusy(true);
    let c;
    try { c = await generaRemoto(datos); } catch { c = generaLocal(datos); }
    setRes(c); setN((x) => x + 1); setBusy(false);
  };

  return (
    <div className="crea" id="crea">
      <form className="crea-form" onSubmit={submit}>
        <h3 className="display">Crea tu propio comunicado</h3>
        <p>Pon el tema, elige el tono y la peña dispone.</p>
        <label htmlFor="c-tema">Tema <small>({tema.length}/120)</small></label>
        <input id="c-tema" type="text" maxLength={120} value={tema} onChange={(e) => setTema(e.target.value)} placeholder="p. ej. la fuente de la plaza, el tardeo del sábado…" autoComplete="off" />
        <label htmlFor="c-estilo">Estilo de léxico</label>
        <select id="c-estilo" value={estilo} onChange={(e) => setEstilo(e.target.value)}>
          {ESTILOS.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
        <fieldset>
          <legend>Extensión</legend>
          {EXTENSIONES.map((x) => (
            <label key={x.id} className={`seg ${extension === x.id ? 'on' : ''}`}>
              <input type="radio" name="ext" value={x.id} checked={extension === x.id} onChange={() => setExtension(x.id)} />{x.nombre}
            </label>
          ))}
        </fieldset>
        <button className="btn btn-lg" type="submit" disabled={busy}><span>{busy ? 'Redactando…' : 'Generar comunicado'}</span></button>
      </form>

      <div className="crea-out" aria-live="polite">
        <AnimatePresence mode="wait">
          {res ? (
            <motion.div key={n} initial={reduce ? false : { y: 30, opacity: 0, rotate: -1.5 }} animate={{ y: 0, opacity: 1, rotate: 0 }} exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}>
              <article className="doc" lang="es">
                <header className="doc-head"><span className="doc-logo" role="img" aria-label="Logo de La Jarana" /><span className="display">La Jarana · Rubielos de Mora</span></header>
                <h4 className="display doc-title">{res.titulo}</h4>
                <p className="doc-formula"><span className="cap display">{FORMULA[0]}</span>{FORMULA.slice(1)}</p>
                <ol className="doc-list">{res.puntos.map((p, i) => <li key={i}>{p}</li>)}</ol>
                <footer className="doc-foot">
                  <div>
                    <p className="display">Make Rubielos Great Again · CEO of Gúdar-Javalambre</p>
                    <p className="small">Comunicado proporcionado por La Jarana</p>
                  </div>
                  <Sello i={`crea-${n}`} className="doc-stamp" delay={0.35} />
                </footer>
              </article>
              <div className="doc-actions">
                <button className="btn" onClick={() => baja('story')}><span>Descargar story (1080×1920)</span></button>
                <button className="btn" onClick={() => baja('a4')}><span>Descargar A4</span></button>
              </div>
              {dlErr && <p className="doc-note" role="alert">{dlErr}</p>}
              {res.origen === 'plantillas' && API && <p className="doc-note">El redactor con IA está descansando; esto sale de nuestras plantillas oficiales.</p>}
            </motion.div>
          ) : (
            <motion.div key="vacio" className="doc-empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <p className="display">Aquí saldrá tu comunicado.</p><p>Con sello y todo.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
