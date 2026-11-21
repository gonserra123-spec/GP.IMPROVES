import { useCallback, useEffect, useState } from 'react';
import { Btn, Field, Wordmark } from '../components.jsx';
import { errText, get, post } from '../lib/api.js';

// Comprueba que el correo está bien conectado: manda un mensaje de prueba por el mismo camino que los avisos.
function MailTest({ provider }) {
  const [to, setTo] = useState('');
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const send = async (e) => {
    e.preventDefault(); setRes(null); setBusy(true);
    try { setRes(await post('/admin/mail-test', { to })); } catch { setRes({ ok: false, error: 'Sin conexión.' }); }
    setBusy(false);
  };
  return (
    <form className="card" onSubmit={send} noValidate>
      <h2>Correo</h2>
      {provider === 'dev'
        ? <p className="notice notice--warn">Modo de pruebas: los correos no salen de verdad. Para conectarlo, define <code>RESEND_API_KEY</code> y <code>MAIL_FROM</code> en el servidor (ver docs/despliegue.md).</p>
        : <p className="notice notice--ok">Servicio de correo conectado (Resend).</p>}
      <Field label="Enviar un correo de prueba a" error={res?.errors?.to && 'Revisa el correo.'}>{(a) => <input className="input" type="email" value={to} onChange={(e) => setTo(e.target.value)} {...a} />}</Field>
      <Btn variant="ghost" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Enviar prueba'}</Btn>
      {res && !res.errors && <p className={`notice ${res.ok ? 'notice--ok' : 'notice--error'}`} role="status">{res.ok ? (res.provider === 'dev' ? 'Simulado: se ha guardado en data/outbox-dev (no ha salido de verdad).' : 'Enviado. Mira tu bandeja de entrada y la de spam.') : `No se pudo enviar: ${res.error}`}</p>}
    </form>
  );
}

// Panel de administración de Tridom: alta de talleres, pausa y cambio de claves. Solo con la clave de administrador.
export default function Admin() {
  const [auth, setAuth] = useState(null); // null = comprobando
  const [key, setKey] = useState('');
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);
  const [form, setForm] = useState({ name: '', replyTo: '', ownerEmail: '', sheetId: '' });
  const [errors, setErrors] = useState({});
  const [shown, setShown] = useState(null); // claves recién creadas: se enseñan una sola vez
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => { const r = await get('/admin/workshops'); if (r.ok) setData(r); }, []);
  useEffect(() => { get('/session').then((r) => { setAuth(r.ok && r.role === 'admin'); if (r.ok && r.role === 'admin') load(); }).catch(() => setAuth(false)); }, [load]);

  const login = async (e) => {
    e.preventDefault(); setError(null);
    const r = await post('/admin/login', { key });
    if (r.ok) { setAuth(true); load(); } else setError(r.error === 'locked' ? 'Demasiados intentos.' : errText(r.error));
  };
  const create = async (e) => {
    e.preventDefault(); setErrors({});
    const r = await post('/admin/workshops', form);
    if (r.ok) { setShown({ title: `Taller «${r.workshop.name}» creado`, keys: [['Clave del mecánico', r.mechanicKey], ['Clave del dueño', r.ownerKey]] }); setForm({ name: '', replyTo: '', ownerEmail: '', sheetId: '' }); load(); } else setErrors(r.errors || {});
  };
  const act = async (id, action, body = {}) => {
    const r = await post(`/admin/workshops/${id}/${action}`, body);
    if (r.ok && r.key) setShown({ title: 'Clave nueva (la anterior ya no vale)', keys: [[body.role === 'owner' ? 'Clave del dueño' : 'Clave del mecánico', r.key]] });
    setConfirm(null); load();
  };

  if (auth === null) return <p className="hint" style={{ padding: 24 }}>Cargando…</p>;
  if (!auth) {
    return (
      <main className="login"><form className="login-card" onSubmit={login}>
        <Wordmark /><h1>Administración</h1>
        <Field label="Clave de administrador" error={error}>{(a) => <input className="input" type="password" autoComplete="off" value={key} onChange={(e) => setKey(e.target.value)} {...a} />}</Field>
        <Btn variant="block" type="submit">Entrar</Btn>
      </form></main>
    );
  }
  return (
    <div className="app">
      <header className="bar"><Wordmark /><span className="who">Administración</span><span className="grow" />
        {data && <span className="net" data-off={data.mail === 'dev'}>{data.mail === 'dev' ? 'Correo: pruebas' : 'Correo: activo'}</span>}
        {data && <span className="net" data-off={!data.sheets}>{data.sheets ? 'Google: conectado' : 'Google: sin conectar'}</span>}
        <Btn variant="ghost sm" onClick={async () => { await post('/logout'); setAuth(false); }}>Salir</Btn>
      </header>
      <main className="page page--wide">
        {shown && (
          <div className="card" role="alert">
            <h2>{shown.title}</h2>
            <p className="notice notice--warn">Cópialas ahora y pásaselas al taller: por seguridad no se pueden volver a ver.</p>
            {shown.keys.map(([l, k]) => <div key={l}><p className="hint">{l}</p><p className="keybox">{k}</p></div>)}
            <Btn variant="ghost" onClick={() => setShown(null)}>Ya las he copiado</Btn>
          </div>
        )}
        <MailTest provider={data?.mail} />
        <form className="card" onSubmit={create} noValidate>
          <h2>Nuevo taller</h2>
          <Field label="Nombre del taller" error={errors.name && 'Pon el nombre (mínimo 2 letras).'}>{(a) => <input className="input" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} {...a} />}</Field>
          <div className="row2">
            <Field label="Correo de respuesta (opcional)" error={errors.replyTo && 'Revisa el correo.'}>{(a) => <input className="input" type="email" value={form.replyTo} onChange={(e) => setForm({ ...form, replyTo: e.target.value })} {...a} />}</Field>
            <Field label="Correo del dueño (resumen diario)" error={errors.ownerEmail && 'Revisa el correo.'}>{(a) => <input className="input" type="email" value={form.ownerEmail} onChange={(e) => setForm({ ...form, ownerEmail: e.target.value })} {...a} />}</Field>
          </div>
          <Field label="Identificador de la hoja de Google (opcional)" error={errors.sheetId && 'Identificador no válido.'}>{(a) => <input className="input" value={form.sheetId} onChange={(e) => setForm({ ...form, sheetId: e.target.value })} spellCheck="false" {...a} />}</Field>
          <Btn variant="block" type="submit">Crear taller y generar claves</Btn>
        </form>
        <div className="card">
          <h2>Talleres</h2>
          {data && !data.workshops.length && <p className="empty">Todavía no hay ningún taller.</p>}
          {data?.workshops.map((w) => (
            <div key={w.id} className="admin-row" data-paused={w.status === 'paused'}>
              <div className="actions" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <strong>{w.name}</strong>
                <span className="hint">{w.visits} coche(s) · {w.status === 'active' ? 'Activo' : 'Pausado'}</span>
              </div>
              <div className="actions">
                <Btn variant="ghost sm" onClick={() => act(w.id, w.status === 'active' ? 'pause' : 'activate')}>{w.status === 'active' ? 'Pausar' : 'Reactivar'}</Btn>
                {['mechanic', 'owner'].map((role) => {
                  const k = `${w.id}${role}`;
                  return <Btn key={role} variant="danger sm" onClick={() => (confirm === k ? act(w.id, 'regenerate', { role }) : setConfirm(k))}>{confirm === k ? 'Confirmar cambio' : `Cambiar clave ${role === 'owner' ? 'del dueño' : 'del mecánico'}`}</Btn>;
                })}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  );
}
