import { useEffect, useId, useRef, useState } from 'react';
import { getInfo, sendBooking } from './api.js';
import { classifyPlate, formatPlate, normalizePlate } from './plates.js';

const TOPICS = ['Pasar la ITV', 'Revisión', 'Cambio de aceite', 'Frenos', 'Aire acondicionado', 'Ruidos o vibraciones', 'Luz de avería'];
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^[+\d\s().-]{6,24}$/;
const MAX_PROBLEM = 600;
const TALLER = new URLSearchParams(window.location.search).get('taller') || '';

const MSG = {
  name: 'Escribe tu nombre.', plate: 'Revisa la matrícula: 4 cifras y 3 letras (1234 BCD) o formato antiguo.', email: 'Revisa el correo electrónico.',
  phone: 'Revisa el móvil (solo cifras, espacios y +).', problem: 'Cuéntanos brevemente qué le pasa al coche o qué necesitas (mínimo 5 letras).', consent: 'Necesitamos que aceptes para poder guardar tu solicitud.',
};

function validate(f) {
  const e = {};
  if (f.name.trim().length < 2) e.name = MSG.name;
  if (!classifyPlate(normalizePlate(f.plate))) e.plate = MSG.plate;
  if (!EMAIL.test(f.email.trim())) e.email = MSG.email;
  if (f.phone.trim() && !PHONE.test(f.phone.trim())) e.phone = MSG.phone;
  if (f.problem.trim().length < 5) e.problem = MSG.problem;
  if (!f.consent) e.consent = MSG.consent;
  return e;
}

function Field({ label, optional, error, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="opt"> (opcional)</span>}</label>
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-e` : hint ? `${id}-h` : undefined })}
      {hint && !error && <p className="hint" id={`${id}-h`}>{hint}</p>}
      {error && <p className="err" id={`${id}-e`} role="alert">{error}</p>}
    </div>
  );
}

export default function App() {
  const [info, setInfo] = useState(undefined); // undefined = cargando
  const [f, setF] = useState({ name: '', plate: '', email: '', phone: '', problem: '', consent: false, website: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);
  const [top, setTop] = useState(null); // error general (red, demasiadas solicitudes…)
  const [done, setDone] = useState(null);
  const opened = useRef(Date.now());
  const root = useRef(null);

  useEffect(() => { document.title = info?.workshop ? `Pedir cita · ${info.workshop}` : 'Pedir cita'; }, [info]);
  useEffect(() => { if (!TALLER) { setInfo({ missing: true }); return; } getInfo(TALLER).then(setInfo); }, []);

  // Si está dentro de la web del taller, le dice a la página qué altura necesita para que no salgan barras de desplazamiento.
  useEffect(() => {
    if (window.parent === window || !root.current) return undefined;
    const send = () => window.parent.postMessage({ source: 'tridom-citas', type: 'height', height: root.current.getBoundingClientRect().height + 2 }, '*');
    const ro = new ResizeObserver(send); ro.observe(root.current); send();
    return () => ro.disconnect();
  }, []);

  const set = (k) => (e) => { setF((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value })); if (errors[k]) setErrors((x) => ({ ...x, [k]: undefined })); };
  const addTopic = (t) => setF((s) => {
    if (s.problem.toLowerCase().includes(t.toLowerCase())) return s;
    const next = s.problem.trim() ? `${s.problem.trim().replace(/[,.]$/, '')}, ${t.toLowerCase()}` : t;
    return { ...s, problem: next.slice(0, MAX_PROBLEM) };
  });

  const submit = async (e) => {
    e.preventDefault(); setTop(null);
    const v = validate(f); setErrors(v);
    if (Object.keys(v).length) { setTimeout(() => root.current?.querySelector('[aria-invalid="true"]')?.focus(), 0); return; }
    setBusy(true);
    const r = await sendBooking(TALLER, { name: f.name, plate: f.plate, email: f.email, phone: f.phone, problem: f.problem, consent: true, website: f.website, elapsed: Date.now() - opened.current });
    setBusy(false);
    if (r.offline) { setTop('No hemos podido conectar. Revisa tu conexión e inténtalo de nuevo.'); return; }
    if (r.status === 201) { setDone({ email: f.email.trim() }); return; }
    if (r.status === 422 && r.errors) { setErrors(Object.fromEntries(Object.keys(r.errors).map((k) => [k, MSG[k] || 'Revisa este dato.']))); return; }
    if (r.status === 429) { setTop('Has enviado varias solicitudes seguidas. Espera unos minutos o llama al taller.'); return; }
    setTop('Algo ha fallado. Inténtalo de nuevo o llama al taller.');
  };

  const again = () => { setDone(null); setF({ name: '', plate: '', email: '', phone: '', problem: '', consent: false, website: '' }); setErrors({}); opened.current = Date.now(); };
  const contact = info?.phone || info?.hours;

  return (
    <main className="wrap" ref={root}>
      {info === undefined && <p className="hint" role="status">Cargando…</p>}
      {(info?.missing || info?.notFound || info?.error) && <section className="card"><h1>Formulario no disponible</h1><p>{info.missing ? 'Falta el identificador del taller en el enlace.' : 'Este formulario de cita no está disponible. Llama directamente al taller.'}</p></section>}
      {info?.offline && <section className="card"><h1>Sin conexión</h1><p>No hemos podido cargar el formulario. Revisa tu conexión e inténtalo de nuevo.</p></section>}

      {info?.workshop && !done && (
        <form className="card" onSubmit={submit} noValidate>
          <header>
            <p className="shop">{info.workshop}</p>
            <h1>Pedir cita</h1>
            <p className="lead">Déjanos tus datos y cuéntanos qué necesita tu coche. El taller se pondrá en contacto contigo para acordar el día y la hora.</p>
          </header>

          <Field label="Nombre" error={errors.name}>{(a) => <input className="input" autoComplete="name" value={f.name} onChange={set('name')} maxLength={80} {...a} />}</Field>
          <div className="row2">
            <Field label="Matrícula" error={errors.plate}>{(a) => <input className="input input--plate" autoComplete="off" autoCapitalize="characters" spellCheck="false" value={f.plate} onChange={set('plate')} onBlur={() => { const n = normalizePlate(f.plate); if (classifyPlate(n)) setF((s) => ({ ...s, plate: formatPlate(n) })); }} maxLength={14} placeholder="1234 BCD" {...a} />}</Field>
            <Field label="Móvil" optional error={errors.phone}>{(a) => <input className="input" type="tel" autoComplete="tel" inputMode="tel" value={f.phone} onChange={set('phone')} maxLength={24} {...a} />}</Field>
          </div>
          <Field label="Correo electrónico" error={errors.email} hint="Aquí te confirmaremos la solicitud y te avisaremos de cómo va tu coche.">{(a) => <input className="input" type="email" autoComplete="email" inputMode="email" value={f.email} onChange={set('email')} maxLength={254} {...a} />}</Field>

          <Field label="¿Por qué llevas el coche al taller?" error={errors.problem} hint={`${f.problem.length}/${MAX_PROBLEM}`}>
            {(a) => <textarea className="input" rows={4} value={f.problem} onChange={set('problem')} maxLength={MAX_PROBLEM} placeholder="Por ejemplo: no me va el aire acondicionado" {...a} />}
          </Field>
          <div className="chips" role="group" aria-label="Motivos frecuentes">
            {TOPICS.map((t) => <button key={t} type="button" className="chip" onClick={() => addTopic(t)}>{t}</button>)}
          </div>

          {/* Casilla trampa: las personas no la ven, los programas automáticos sí la rellenan. */}
          <div className="trap" aria-hidden="true"><label>Web<input tabIndex={-1} autoComplete="off" value={f.website} onChange={set('website')} /></label></div>

          <div className="consent">
            <label className="check"><input type="checkbox" checked={f.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} /><span>Acepto que {info.workshop} use estos datos para gestionar mi cita.</span></label>
            {errors.consent && <p className="err" role="alert">{errors.consent}</p>}
            <details>
              <summary>Cómo tratamos tus datos</summary>
              <p>Responsable: {info.workshop}. Usamos tu nombre, matrícula, correo, móvil y el motivo solo para gestionar tu cita y avisarte de cómo va tu coche. No los cedemos a terceros. Tridom Automotive presta el software como encargado del tratamiento, solo por cuenta del taller. Puedes pedir al taller acceso, rectificación o supresión de tus datos.</p>
            </details>
          </div>

          {top && <p className="notice notice--error" role="alert">{top}</p>}
          <button className="btn" type="submit" disabled={busy}>{busy ? 'Enviando…' : 'Pedir cita'}</button>
        </form>
      )}

      {info?.workshop && done && (
        <section className="card" role="status">
          <p className="shop">{info.workshop}</p>
          <h1>Solicitud enviada</h1>
          <p className="notice notice--ok">Hemos recibido tu solicitud. Te hemos escrito a <strong>{done.email}</strong> (mira también en spam).</p>
          <p>{info.workshop} se pondrá en contacto contigo para acordar el día y la hora.</p>
          {contact && <p className="hint">{info.phone && <>Teléfono: <a href={`tel:${info.phone.replace(/[^\d+]/g, '')}`}>{info.phone}</a></>}{info.phone && info.hours ? ' · ' : ''}{info.hours && `Horario: ${info.hours}`}</p>}
          <button className="btn btn--ghost" type="button" onClick={again}>Pedir otra cita</button>
        </section>
      )}

      <p className="foot">Formulario de cita de Tridom Automotive</p>
    </main>
  );
}
