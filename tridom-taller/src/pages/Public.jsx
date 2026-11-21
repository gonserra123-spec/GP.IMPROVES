import { useEffect, useState } from 'react';
import { Btn, Plate, StateChip, Wordmark } from '../components.jsx';
import { get, post } from '../lib/api.js';

// Baja de avisos por correo: un enlace en cada correo, sin iniciar sesión.
export function Unsub({ token }) {
  const [info, setInfo] = useState(undefined);
  const [done, setDone] = useState(false);
  useEffect(() => { get(`/public/unsub/${token}`).then((r) => setInfo(r.ok ? r : null)).catch(() => setInfo(null)); }, [token]);
  return (
    <main className="login"><div className="login-card">
      <Wordmark /><h1>No recibir más avisos</h1>
      {info === undefined && <p className="hint">Cargando…</p>}
      {info === null && <p className="notice notice--error">Este enlace no es válido o ha caducado.</p>}
      {info && !done && (<>
        <p>{info.workshop} dejará de enviar avisos por correo a <strong>{info.email}</strong>. Podrás seguir preguntando por tu coche en el taller.</p>
        <Btn variant="block" onClick={async () => { const r = await post(`/public/unsub/${token}`, {}); if (r.ok) setDone(true); }}>Confirmar</Btn>
      </>)}
      {done && <p className="notice notice--ok">Listo. No recibirás más avisos por correo.</p>}
    </div></main>
  );
}

const HEADLINE = { received: 'Tu coche está en el taller', in_progress: 'Estamos trabajando en tu coche', finished: 'Tu coche está listo' };
const SUBLINE = { received: 'Lo hemos recibido y pronto empezaremos con él.', in_progress: 'Te avisaremos por correo en cuanto esté listo.', finished: 'Ya puedes pasar a recogerlo.' };
const fmtDay = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });
const fmtTime = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
const when = (iso) => (iso ? `${fmtDay.format(new Date(iso))}, ${fmtTime.format(new Date(iso))}` : null);

// Seguimiento para el cliente: se abre desde el botón del correo, sin cuenta ni contraseña.
export function Track({ token }) {
  const [info, setInfo] = useState(undefined);
  useEffect(() => {
    const m = document.createElement('meta'); m.name = 'robots'; m.content = 'noindex,nofollow'; document.head.appendChild(m);
    return () => m.remove();
  }, []);
  useEffect(() => {
    let alive = true;
    const load = () => get(`/public/track/${token}`).then((r) => { if (alive) setInfo(r.ok ? r : null); }).catch(() => { if (alive) setInfo((cur) => (cur === undefined ? null : cur)); });
    load();
    const t = setInterval(() => { if (!document.hidden) load(); }, 30_000);
    return () => { alive = false; clearInterval(t); };
  }, [token]);
  useEffect(() => { document.title = info ? `${info.workshop} · Tu coche` : 'Tu coche'; }, [info]);

  if (info === undefined) return <p className="hint" style={{ padding: 24 }} role="status">Cargando…</p>;
  if (info === null) {
    return (
      <main className="login"><div className="login-card">
        <Wordmark /><h1>Enlace no válido</h1>
        <p className="notice notice--error">No encontramos ese coche. Usa el botón del último correo que te enviamos o llama al taller.</p>
      </div></main>
    );
  }
  const steps = [['received', 'En el taller', info.receivedAt], ['in_progress', 'En curso', info.inProgressAt], ['finished', 'Listo', info.finishedAt]];
  const at = steps.findIndex(([s]) => s === info.state);
  const car = [info.make, info.model].filter(Boolean).join(' ');
  return (
    <main className="page track">
      <p className="track-shop">{info.workshop}</p>
      <section className="card track-card" data-state={info.state} aria-live="polite">
        <StateChip state={info.state} />
        <h1>{HEADLINE[info.state]}</h1>
        <p>{SUBLINE[info.state]}</p>
        <div className="track-car"><Plate value={info.plate} />{car && <span>{car}</span>}</div>
        {info.eta && <p className="notice">Entrega prevista: <strong>{fmtDay.format(new Date(`${info.eta}T12:00:00Z`))}</strong></p>}
      </section>
      <ol className="track-steps" aria-label="Progreso">
        {steps.map(([s, label, iso], i) => (
          <li key={s} data-on={i <= at} data-now={i === at}>
            <i aria-hidden="true" />
            <div><strong>{label}</strong><span>{when(iso) || (i > at ? 'Pendiente' : '')}</span></div>
          </li>
        ))}
      </ol>
      {(info.phone || info.hours) && (
        <section className="card">
          <h2>Contacto</h2>
          {info.hours && <p>Horario: {info.hours}</p>}
          {info.phone && <a className="btn btn--block" href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>Llamar al taller · {info.phone}</a>}
        </section>
      )}
      <p className="hint track-foot">Esta página se actualiza sola. Servicio de <a href="/privacidad">Tridom Automotive</a>.</p>
    </main>
  );
}

export function Privacy() {
  return (
    <main className="page" style={{ paddingTop: 32 }}>
      <Wordmark />
      <h1 className="sign" style={{ fontSize: '2.25rem', color: 'var(--blue-900)' }}>Privacidad</h1>
      <p className="notice notice--warn">Borrador pendiente de completar con los datos del responsable y del encargado.</p>
      {[
        ['Quién trata los datos', 'El responsable es cada taller. Tridom presta el software como encargado del tratamiento y solo actúa siguiendo las instrucciones del taller, bajo un contrato firmado con él. Razón social, NIF y contacto: FALTA.'],
        ['Qué datos se guardan', 'Si el cliente pide cita desde la web del taller: nombre, matrícula, correo, móvil (opcional) y el motivo que escribe. Además, matrícula, marca y modelo, correo del cliente, la fecha y hora de cada paso (entrada, en curso, finalizado), la fecha de entrega prevista y, si el mecánico la hace, una foto del coche. Se guardan también los correos enviados y su resultado.'],
        ['Para qué', 'Para avisar al cliente de cómo va su coche (ejecución del encargo de reparación) y para que el taller lleve su control y sus tiempos de trabajo.'],
        ['Separación entre talleres', 'Cada taller tiene su propia base de datos y su propia clave de acceso. Un taller nunca ve los datos de otro.'],
        ['Avisos por correo', 'Cada correo lleva un enlace para no recibir más avisos. Quien se da de baja no recibe más correos de ese taller.'],
        ['Hoja de cálculo', 'Si el taller lo activa, una copia de los datos del coche se escribe en una hoja de Google del propio taller.'],
        ['Conservación y derechos', 'Plazo de conservación: FALTA (lo fija el taller). Los clientes pueden pedir al taller acceso, rectificación o supresión de sus datos.'],
      ].map(([t, p]) => <section key={t} className="card"><h2>{t}</h2><p>{p}</p></section>)}
    </main>
  );
}
