import { useCallback, useEffect, useState } from 'react';
import { Btn, Field } from '../components.jsx';
import { ERR, errText, get, patch, post } from '../lib/api.js';
import { DEFAULT_TEMPLATES, PLACEHOLDERS, STATE_LABEL, STATES, renderTemplate } from '../../shared/rules.js';

const fmtMin = (m) => (m === null || m === undefined ? '—' : m < 60 ? `${m} min` : `${Math.floor(m / 60)} h ${m % 60 ? `${m % 60} min` : ''}`.trim());
const when = (iso) => (iso ? new Date(iso).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '');

// Carga de datos con recarga manual; los errores de red se muestran en vez de dejar la pantalla vacía.
function useLoad(path) {
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(async () => {
    try { const r = await get(path); if (r.ok) { setData(r); setError(null); } else setError(errText(r.error)); } catch { setError('Sin conexión.'); }
  }, [path]);
  useEffect(() => { load(); }, [load]);
  return { data, error, load, setData };
}

const KIND = { received: 'Alta', in_progress: 'En curso', finished: 'Finalizado', summary: 'Resumen' };
const STATUS = { pending: 'En camino', sending: 'Enviando', sent: 'Enviado', failed: 'Falló', bounced: 'Rebotó', cancelled: 'Deshecho', skipped_dup: 'Repetido (no se envió)', skipped_unsub: 'Baja del cliente' };

export function Mail() {
  const { data, error, load } = useLoad('/owner/mail');
  const bad = data?.mail.filter((m) => ['bounced', 'failed'].includes(m.status)) || [];
  return (
    <div className="page page--wide">
      <div className="card">
        <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}><h2>Correos enviados</h2><Btn variant="ghost sm" onClick={load}>Actualizar</Btn></div>
        {data?.provider === 'dev' && <p className="notice notice--warn">Modo de pruebas: los correos no salen de verdad. Falta conectar el servicio de correo (ver «Despliegue»).</p>}
        {bad.length > 0 && <p className="notice notice--error" role="alert">⚠ {bad.length} correo(s) no han llegado: {bad.slice(0, 3).map((m) => m.toEmail).join(', ')}. Llama a esos clientes.</p>}
        {error && <p className="notice notice--error">{error}</p>}
        {data && !data.mail.length && <p className="empty">Todavía no se ha enviado ningún correo.</p>}
        <ul className="list">
          {data?.mail.map((m) => (
            <li key={m.id}><time>{when(m.createdAt)}</time><span><strong>{KIND[m.kind] || m.kind}</strong> · {m.toEmail}{m.error ? <><br /><span className="hint">{m.error}</span></> : null}</span><span className="badge" data-s={m.status}>{STATUS[m.status] || m.status}</span></li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function Summary() {
  const { data, error, load } = useLoad('/owner/stats');
  const { data: st, load: loadSettings } = useLoad('/owner/settings');
  const sheetId = st?.settings.sheetId;
  const [msg, setMsg] = useState(null);
  const sync = async () => { setMsg('Sincronizando…'); try { const r = await post('/owner/sheet/sync'); setMsg(r.status === 'ok' ? 'Hoja actualizada.' : r.status === 'no_credentials' ? 'Falta conectar Google (lo hace Tridom).' : r.error || 'No se pudo sincronizar.'); } catch { setMsg('Sin conexión.'); } loadSettings(); };
  return (
    <div className="page page--wide">
      {error && <p className="notice notice--error">{error}</p>}
      {data && (
        <>
          <div className="stats">
            <div className="stat"><b>{data.today.received}</b><span>Entradas hoy</span></div>
            <div className="stat"><b>{data.today.finished}</b><span>Finalizados hoy</span></div>
            <div className="stat"><b>{data.pending}</b><span>Siguen en el taller</span></div>
          </div>
          <div className="card">
            <h2>Cuánto tarda cada coche</h2>
            <div className="stats" style={{ gridTemplateColumns: '1fr 1fr' }}>
              <div className="stat"><b>{fmtMin(data.avgTotalMin)}</b><span>Media desde que entra hasta que acaba</span></div>
              <div className="stat"><b>{fmtMin(data.avgWorkMin)}</b><span>Media desde «En curso» hasta «Finalizado»</span></div>
            </div>
            <p className="hint">Calculado con {data.finishedCount} coche(s) finalizados.</p>
            {data.days.length > 0 && (
              <table className="table"><thead><tr><th>Día</th><th>Entradas</th><th>Finalizados</th><th>Media en taller</th></tr></thead>
                <tbody>{data.days.map((d) => <tr key={d.date}><td>{d.date}</td><td>{d.received}</td><td>{d.finished}</td><td>{fmtMin(d.avgTotalMin)}</td></tr>)}</tbody></table>
            )}
          </div>
        </>
      )}
      <div className="card">
        <h2>Hoja de cálculo</h2>
        <p className="hint">Se actualiza sola con cada botón. La base de datos manda: si borras filas de la hoja, se vuelven a escribir.</p>
        <div className="actions">
          <a className="btn btn--ghost" href="/api/owner/export.xlsx" download>Descargar Excel</a>
          {sheetId && <a className="btn btn--ghost" href={`https://docs.google.com/spreadsheets/d/${sheetId}`} target="_blank" rel="noreferrer">Abrir hoja de Google</a>}
          {sheetId && <Btn variant="ghost" onClick={sync}>Sincronizar ahora</Btn>}
          <Btn variant="ghost" onClick={load}>Actualizar</Btn>
        </div>
        {msg && <p className="notice" role="status">{msg}</p>}
        {!sheetId && <p className="hint">Aún no hay hoja de Google conectada: ve a «Ajustes».</p>}
      </div>
    </div>
  );
}

const STATUS_SHEET = { ok: 'Conectada', pending: 'Pendiente de la primera sincronización', error: 'Error', no_credentials: 'Falta conectar Google (lo hace Tridom)', off: 'Sin hoja' };

export function Settings() {
  const { data, error, setData } = useLoad('/owner/settings');
  const [f, setF] = useState(null);
  const [errors, setErrors] = useState({});
  const [saved, setSaved] = useState(null);
  const [newKey, setNewKey] = useState(null);
  const [confirm, setConfirm] = useState(false);
  const [tplKey, setTplKey] = useState('received');
  useEffect(() => { if (data && !f) setF(data.settings); }, [data, f]);
  if (error) return <div className="page"><p className="notice notice--error">{error}</p></div>;
  if (!f) return <div className="page"><p className="hint">Cargando…</p></div>;
  const set = (k) => (e) => setF({ ...f, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value });
  const setTpl = (k, v) => setF({ ...f, templates: { ...f.templates, [tplKey]: { ...f.templates[tplKey], [k]: v } } });
  const preview = renderTemplate(f.templates[tplKey], { workshop: 'Tu taller', plateText: '1234 BCD', model: 'Seat Ibiza', eta: new Date(Date.now() + 86_400_000).toISOString().slice(0, 10), phone: f.phone, hours: f.hours });

  const save = async (e) => {
    e.preventDefault(); setSaved(null);
    const body = { phone: f.phone, hours: f.hours, replyTo: f.replyTo, ownerEmail: f.ownerEmail, summaryOn: f.summaryOn, summaryHour: Number(f.summaryHour), sheetId: f.sheetId.trim(), templates: f.templates };
    try {
      const r = await patch('/owner/settings', body);
      if (r.ok) { setErrors({}); setData({ ...data, settings: r.settings }); setF(r.settings); setSaved('Guardado.'); }
      else { setErrors(r.errors || {}); setSaved(errText(r.error)); }
    } catch { setSaved('Sin conexión: no se ha guardado.'); }
  };
  const regen = async () => {
    if (!confirm) { setConfirm(true); return; }
    const r = await post('/owner/keys/mechanic'); setConfirm(false);
    if (r.ok) setNewKey(r.key);
  };
  const tplErr = errors.templates?.[tplKey];

  return (
    <form className="page page--wide" onSubmit={save} noValidate>
      <div className="card">
        <h2>Datos del taller en los correos</h2>
        <div className="row2">
          <Field label="Teléfono del taller" error={errors.phone && ERR.invalid}>{(a) => <input className="input" type="tel" value={f.phone} onChange={set('phone')} {...a} />}</Field>
          <Field label="Horario" error={errors.hours && ERR.invalid}>{(a) => <input className="input" value={f.hours} onChange={set('hours')} placeholder="L-V 8:00-18:00" {...a} />}</Field>
        </div>
        <Field label="Correo al que responden los clientes" error={errors.replyTo && ERR.email_format} hint="Si un cliente responde a un aviso, le llega aquí.">{(a) => <input className="input" type="email" value={f.replyTo} onChange={set('replyTo')} {...a} />}</Field>
      </div>

      <div className="card">
        <h2>Textos de los correos</h2>
        <div className="actions" role="tablist" aria-label="Correo a editar">
          {STATES.map((s) => <button key={s} type="button" role="tab" className="eta-chip" aria-pressed={tplKey === s} onClick={() => setTplKey(s)}>{s === 'received' ? 'Al dar de alta' : `«${STATE_LABEL[s]}»`}</button>)}
        </div>
        <div className="tpl">
          <Field label="Asunto" error={tplErr === 'subject_short' ? 'El asunto es demasiado corto.' : null}>{(a) => <input className="input" value={f.templates[tplKey].subject} onChange={(e) => setTpl('subject', e.target.value)} {...a} />}</Field>
          <Field label="Mensaje" error={tplErr === 'body_length' ? 'El mensaje debe tener entre 15 y 2000 caracteres.' : null} hint={`Puedes usar: ${PLACEHOLDERS.join(' ')}. Si un dato no existe (entrega, horario), esa línea desaparece.`}>{(a) => <textarea className="input" rows={6} value={f.templates[tplKey].body} onChange={(e) => setTpl('body', e.target.value)} {...a} />}</Field>
          <div className="notice"><strong>{preview.subject}</strong><br /><span style={{ whiteSpace: 'pre-line' }}>{preview.body}</span></div>
          <Btn variant="ghost sm" onClick={() => setF({ ...f, templates: { ...f.templates, [tplKey]: DEFAULT_TEMPLATES[tplKey] } })}>Restaurar este texto</Btn>
        </div>
        <p className="hint">Cada correo lleva el nombre del taller, tu teléfono y horario, y un enlace para no recibir más avisos.</p>
      </div>

      <div className="card">
        <h2>Resumen diario</h2>
        <label className="check"><input type="checkbox" checked={f.summaryOn} onChange={set('summaryOn')} /><span>Enviarme cada día cuántos coches entran, salen y siguen pendientes</span></label>
        <div className="row2">
          <Field label="Mi correo" error={errors.ownerEmail && ERR.email_format}>{(a) => <input className="input" type="email" value={f.ownerEmail} onChange={set('ownerEmail')} {...a} />}</Field>
          <Field label="A partir de la hora">{(a) => <select className="input" value={f.summaryHour} onChange={set('summaryHour')} {...a}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>}</Field>
        </div>
      </div>

      <div className="card">
        <h2>Hoja de Google</h2>
        <p className="hint">Estado: <strong>{STATUS_SHEET[f.sheetStatus] || f.sheetStatus}</strong>{f.sheetSyncedAt ? ` · última vez ${when(f.sheetSyncedAt)}` : ''}{f.sheetError ? ` · ${f.sheetError}` : ''}</p>
        <Field label="Identificador de la hoja" error={errors.sheetId && 'Pega solo el identificador (lo que va entre /d/ y /edit en la dirección).'} hint={data.service.email ? `Comparte la hoja, como editor, con: ${data.service.email}` : 'Tridom conectará la cuenta de Google al activar el servicio.'}>{(a) => <input className="input" value={f.sheetId} onChange={set('sheetId')} spellCheck="false" {...a} />}</Field>
      </div>

      <Btn variant="block" type="submit" style={{ minHeight: 64 }}>Guardar ajustes</Btn>
      {saved && <p className="notice" role="status">{saved}</p>}

      <div className="card">
        <h2>Clave del mecánico</h2>
        <p className="hint">Si un mecánico se va o la clave se ha perdido, cámbiala aquí. La anterior deja de valer al momento y sus sesiones se cierran.</p>
        {newKey ? <><p className="notice notice--ok">Nueva clave del mecánico (solo se muestra ahora):</p><p className="keybox">{newKey}</p></> : (
          <Btn variant="danger" onClick={regen}>{confirm ? 'Pulsa otra vez para cambiarla' : 'Cambiar la clave del mecánico'}</Btn>
        )}
      </div>
    </form>
  );
}
