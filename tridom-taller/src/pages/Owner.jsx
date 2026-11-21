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

const PERIOD_BTNS = [['day', 'Hoy'], ['month', 'Mensual'], ['year', 'Anual']];

// Diferencia con el periodo anterior: ▲ sube, ▼ baja, = igual.
function Diff({ cur, prev, label, lowerIsBetter = false }) {
  if (cur === null || prev === null || cur === undefined || prev === undefined) return <span className="diff">Sin datos para comparar</span>;
  const d = cur - prev;
  const good = d === 0 ? null : lowerIsBetter ? d < 0 : d > 0;
  return <span className="diff" data-good={good}>{d === 0 ? '= igual que' : `${d > 0 ? '▲ +' : '▼ '}${lowerIsBetter ? fmtMin(Math.abs(d)).replace(/^/, d > 0 ? '' : '-') : d} vs`} {label}</span>;
}

// Lo que lleva el taller hoy, este mes o este año, con un botón para cada periodo.
const MONTH_SHORT = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MONTH_LONG = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

// Gráfico de puntos del año: cuántos coches entraron y cuántos se finalizaron en cada mes.
// Círculo azul = entradas, cuadrado verde = finalizados (la forma distingue las series aunque no se vean los colores).
function YearChart({ buckets, year }) {
  const [hover, setHover] = useState(null);
  const by = new Map(buckets.map((b) => [Number(b.key.slice(5, 7)) - 1, b]));
  const last = buckets.length ? Math.max(...by.keys()) : -1;
  const vals = buckets.flatMap((b) => [b.received, b.finished]);
  const max = Math.max(1, ...vals);
  const step = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000].find((v) => v >= max / 4) || 1000;
  const top = step * Math.ceil(max / step);
  const W = 720; const H = 300; const L = 40; const R = 24; const T = 28; const B = 38;
  const x = (i) => L + ((W - L - R) * (i + 0.5)) / 12;
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const ticks = Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
  const pts = (k) => Array.from({ length: last + 1 }, (_, i) => [x(i), y(by.get(i)?.[k] || 0)]);
  const line = (k) => pts(k).map(([px, py], i) => `${i ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`).join(' ');
  const hb = hover === null ? null : by.get(hover) || { received: 0, finished: 0 };
  const diff = hb ? hb.finished - hb.received : 0;
  const lb = last >= 0 ? by.get(last) : null;
  const hi = lb ? lb.received >= lb.finished : true;
  return (
    <figure className="chart" aria-label={`Entradas y finalizados por mes, ${year}`}>
      <div className="legend" aria-hidden="true">
        <span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5" fill="var(--c-in)" /></svg>Entradas</span>
        <span><svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="2" width="10" height="10" fill="var(--c-out)" /></svg>Finalizados</span>
      </div>
      <div className="chart-box">
        <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Gráfico de puntos: por cada mes de ${year}, coches que entraron y coches finalizados. Los datos están en la tabla de debajo.`}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} className="grid" />
              <text x={L - 8} y={y(t) + 4} textAnchor="end" className="axis">{t}</text>
            </g>
          ))}
          {MONTH_SHORT.map((m, i) => <text key={m} x={x(i)} y={H - 12} textAnchor="middle" className="axis" data-future={i > last}>{m}</text>)}
          {last >= 0 && <path d={line('received')} className="ln ln--in" />}
          {last >= 0 && <path d={line('finished')} className="ln ln--out" />}
          {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} className="cross" />}
          {pts('received').map(([px, py], i) => <circle key={`i${i}`} cx={px} cy={py} r={5} className="dot dot--in" />)}
          {pts('finished').map(([px, py], i) => <rect key={`o${i}`} x={px - 5} y={py - 5} width={10} height={10} className="dot dot--out" />)}
          {lb && <text x={x(last)} y={y(lb.received) + (hi ? -12 : 20)} textAnchor="middle" className="val">{lb.received}</text>}
          {lb && <text x={x(last)} y={y(lb.finished) + (hi ? 20 : -12)} textAnchor="middle" className="val">{lb.finished}</text>}
          {MONTH_SHORT.map((m, i) => (
            <rect key={`h${m}`} x={x(i) - (W - L - R) / 24} y={T} width={(W - L - R) / 12} height={H - T - B} className="hit" tabIndex={i <= last ? 0 : -1}
              aria-label={i <= last ? `${MONTH_LONG[i]}: ${by.get(i)?.received || 0} entradas, ${by.get(i)?.finished || 0} finalizados` : undefined}
              onMouseEnter={() => { if (i <= last) setHover(i); }} onMouseLeave={() => setHover(null)} onFocus={() => { if (i <= last) setHover(i); }} onBlur={() => setHover(null)} />
          ))}
        </svg>
        {hb && (
          <div className="tip" data-side={hover >= 6 ? 'left' : 'right'} style={{ left: `${(x(hover) / W) * 100}%` }} role="status">
            <b>{MONTH_LONG[hover]}</b>
            <span><i className="sw sw--in" />Entradas: {hb.received}</span>
            <span><i className="sw sw--out" />Finalizados: {hb.finished}</span>
            <span className="hint">{diff === 0 ? 'Salieron tantos como entraron' : diff > 0 ? `Salieron ${diff} más de los que entraron` : `Se acumulan ${-diff} en el taller`}</span>
          </div>
        )}
      </div>
    </figure>
  );
}

function Period() {
  const [p, setP] = useState('day');
  const { data, error } = useLoad(`/owner/period?p=${p}`);
  const max = data ? Math.max(1, ...data.buckets.map((b) => Math.max(b.received, b.finished))) : 1;
  return (
    <div className="card">
      <div className="actions" role="tablist" aria-label="Periodo">
        {PERIOD_BTNS.map(([k, l]) => <button key={k} type="button" role="tab" className="eta-chip" aria-pressed={p === k} onClick={() => setP(k)}>{l}</button>)}
      </div>
      {error && <p className="notice notice--error">{error}</p>}
      {data && data.period === p && (
        <>
          <h2>{data.label}</h2>
          <div className="stats stats--4">
            <div className="stat"><b>{data.cur.received}</b><span>Entradas</span><Diff cur={data.cur.received} prev={data.prev.received} label={data.prevLabel} /></div>
            <div className="stat"><b>{data.cur.finished}</b><span>Finalizados</span><Diff cur={data.cur.finished} prev={data.prev.finished} label={data.prevLabel} /></div>
            <div className="stat"><b>{data.open.pending}</b><span>Siguen en el taller ahora</span><span className="diff">{data.open.inProgress} en curso</span></div>
            <div className="stat"><b>{fmtMin(data.cur.avgTotalMin)}</b><span>Tiempo medio en el taller</span><Diff cur={data.cur.avgTotalMin} prev={data.prev.avgTotalMin} label={data.prevLabel} lowerIsBetter /></div>
          </div>
          {p === 'year' && <YearChart buckets={data.buckets} year={data.from.slice(0, 4)} />}
          {data.buckets.length === 0 && <p className="empty">Todavía no hay movimientos en este periodo.</p>}
          {data.buckets.length > 0 && (
            <table className="table table--bars">
              <thead><tr><th>{p === 'day' ? 'Hora' : p === 'month' ? 'Día' : 'Mes'}</th><th>Entradas</th><th>Finalizados</th><th aria-hidden="true" /></tr></thead>
              <tbody>
                {data.buckets.map((b) => (
                  <tr key={b.key}><td style={{ textTransform: 'capitalize' }}>{b.label}</td><td>{b.received}</td><td>{b.finished}</td>
                    <td className="bars" aria-hidden="true"><i style={{ width: `${(b.received / max) * 100}%` }} /><i data-f="1" style={{ width: `${(b.finished / max) * 100}%` }} /></td></tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
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
          <Period />
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

const WEEK_DAYS = [[1, 'Lunes'], [2, 'Martes'], [3, 'Miércoles'], [4, 'Jueves'], [5, 'Viernes'], [6, 'Sábado'], [7, 'Domingo']];

// Ver cómo queda el informe de esta semana y mandártelo ahora, sin esperar al día de envío.
function Weekly() {
  const [pv, setPv] = useState(null);
  const [msg, setMsg] = useState(null);
  const view = async () => { setMsg(null); try { const r = await get('/owner/weekly-preview'); setPv(r.ok ? r : null); if (!r.ok) setMsg(errText(r.error)); } catch { setMsg('Sin conexión.'); } };
  const sendNow = async () => {
    setMsg(null);
    try { const r = await post('/owner/weekly/send', {}); setMsg(r.ok ? 'Enviado: llegará en unos segundos a tu correo.' : r.error === 'no_owner_email' ? 'Guarda primero tu correo en «Mi correo».' : errText(r.error)); } catch { setMsg('Sin conexión.'); }
  };
  return (
    <>
      <div className="actions">
        <Btn variant="ghost" onClick={view}>Ver el informe de esta semana</Btn>
        <Btn variant="ghost" onClick={sendNow}>Enviármelo ahora</Btn>
      </div>
      {msg && <p className="notice" role="status">{msg}</p>}
      {pv && <div className="notice"><strong>{pv.subject}</strong><pre style={{ whiteSpace: 'pre-wrap', font: 'inherit', margin: '8px 0 0' }}>{pv.body}</pre></div>}
    </>
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
    const body = {
      phone: f.phone, hours: f.hours, replyTo: f.replyTo, ownerEmail: f.ownerEmail, summaryOn: f.summaryOn, summaryHour: Number(f.summaryHour),
      weeklyOn: f.weeklyOn, weeklyDay: Number(f.weeklyDay), weeklyHour: Number(f.weeklyHour), staleDays: Number(f.staleDays),
      sheetId: f.sheetId.trim(), templates: f.templates,
    };
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
        <h2>Informe semanal</h2>
        <label className="check"><input type="checkbox" checked={f.weeklyOn} onChange={set('weeklyOn')} /><span>Enviarme cada semana los coches reparados, los que siguen en curso y los que llevan mucho tiempo sin terminar, comparado con la semana anterior</span></label>
        <div className="row2">
          <Field label="Día de envío" error={errors.weeklyDay && ERR.invalid}>{(a) => <select className="input" value={f.weeklyDay} onChange={set('weeklyDay')} {...a}>{WEEK_DAYS.map(([n, l]) => <option key={n} value={n}>{l}</option>)}</select>}</Field>
          <Field label="A partir de la hora">{(a) => <select className="input" value={f.weeklyHour} onChange={set('weeklyHour')} {...a}>{Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{String(h).padStart(2, '0')}:00</option>)}</select>}</Field>
        </div>
        <Field label="Un coche se considera atascado a partir de (días)" error={errors.staleDays && 'Entre 2 y 60 días.'} hint="Aparece en el apartado «Atención» si lleva tantos días o más en el taller sin estar finalizado.">{(a) => <input className="input" type="number" min="2" max="60" value={f.staleDays} onChange={set('staleDays')} {...a} />}</Field>
        <p className="hint">Se envía al correo de arriba («Mi correo»). Guarda los ajustes antes de probarlo.</p>
        <Weekly />
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
