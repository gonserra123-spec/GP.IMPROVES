import { useRef, useState } from 'react';
import Reveal from './Reveal.jsx';
import { useTr } from '../lib/store.js';
import { CHECK, Field, aria, useErrorText } from './Booking.jsx';
import Photo from './Photo.jsx';
import { PHOTOS } from '../content/data.js';
import { postForm } from '../lib/api.js';

// La lista: recoge cumpleaños y sala preferida, la base de las campañas de cumpleaños y
// de reactivación con enlace exclusivo.
export default function Lista() {
  const tr = useTr();
  const errText = useErrorText();
  const ref = useRef(null);
  const [form, setForm] = useState({ name: '', email: '', birth: '', room: '', consent: false, website: '' });
  const [errors, setErrors] = useState({});
  const [done, setDone] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendErr, setSendErr] = useState('');
  const set = (k) => (e) => { const v = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setForm((f) => ({ ...f, [k]: v })); setErrors((er) => ({ ...er, [k]: undefined })); setDone(false); };
  const submit = async (e) => {
    e.preventDefault();
    if (sending) return;
    const er = {};
    for (const k of ['name', 'email', 'birth', 'consent']) { const c = CHECK[k](form[k]); if (c) er[k] = c; }
    if (!form.room) er.room = 'required';
    setErrors(er);
    setSendErr('');
    const focusBad = (errs) => {
      const bad = ['name', 'email', 'birth', 'room', 'consent'].find((k) => errs[k]);
      if (bad) ref.current.querySelector(`[name="${bad}"]`)?.focus();
      return Boolean(bad);
    };
    if (focusBad(er)) return;
    setSending(true);
    const res = await postForm('lista', form); // el servidor valida de nuevo
    setSending(false);
    if (res.ok) { setDone(true); return; }
    if (res.status === 422 && Object.keys(res.errors).length) { setErrors(res.errors); focusBad(res.errors); return; }
    setSendErr(res.status === 429
      ? tr('Demasiados intentos. Espera unos minutos y vuelve a probar.', 'Too many attempts. Wait a few minutes and try again.')
      : tr('No hemos podido enviar tus datos. Inténtalo de nuevo en un momento.', 'We could not send your details. Please try again in a moment.'));
  };
  const e = (k) => (errors[k] ? errText(errors[k]) : null);
  return (
    <section className="lista" id="lista" data-tone="dark" aria-labelledby="lista-title">
      <div className="wrap lista__grid">
        <div>
          <Reveal as="h2" id="lista-title" className="display" text={tr('Tu cumpleaños, con mesa.', 'Your birthday, with a table.')} />
          <p className="lead">{tr(
            'Apúntate a la lista. La semana de tu cumpleaños te llega un enlace solo para ti, con una ventaja en mesa o en entrada para esa noche. Y si hace tiempo que no venís, os avisamos cuando haya algo que merezca la vuelta.',
            'Join the list. In your birthday week you get a link made just for you, with a perk on a table or entry for that night. And if it has been a while, we will let you know when there is something worth coming back for.',
          )}</p>
          <ul className="lista__points">
            <li>{tr('Un enlace por persona, válido solo esa noche.', 'One link per person, valid that night only.')}</li>
            <li>{tr('Como mucho un mensaje al mes.', 'One message a month at most.')}</li>
            <li>{tr('Te das de baja con un toque.', 'Unsubscribe with one tap.')}</li>
          </ul>
          <p className="note">{tr('Función propuesta, pendiente de aprobación del club.', 'Proposed feature, pending the club’s approval.')}</p>
          <Photo className="lista__photo" photo={PHOTOS.birthday} label={tr('Foto de ambiente · cumpleaños con mesa', 'Atmosphere photo · birthday with a table')} />
        </div>
        <form className="form" ref={ref} onSubmit={submit} noValidate>
          <Field id="ls-name" label={tr('Nombre', 'Name')} error={e('name')}>
            <input id="ls-name" name="name" autoComplete="given-name" value={form.name} onChange={set('name')} {...aria('ls-name', e('name'))} />
          </Field>
          <Field id="ls-email" label={tr('Correo electrónico', 'Email')} error={e('email')}>
            <input id="ls-email" name="email" type="email" autoComplete="email" value={form.email} onChange={set('email')} {...aria('ls-email', e('email'))} />
          </Field>
          <Field id="ls-birth" label={tr('Cumpleaños', 'Birthday')} error={e('birth')}>
            <input id="ls-birth" name="birth" type="date" autoComplete="bday" value={form.birth} onChange={set('birth')} {...aria('ls-birth', e('birth'))} />
          </Field>
          <fieldset className={`field${errors.room ? ' field--bad' : ''}`}>
            <legend>{tr('¿Qué sala es más tuya?', 'Which room is more you?')}</legend>
            <div className="radios">
              <label><input type="radio" name="room" value="first" checked={form.room === 'first'} onChange={set('room')} /> <span>First Floor · {tr('reguetón y comercial', 'reggaeton and commercial')}</span></label>
              <label><input type="radio" name="room" value="petit" checked={form.room === 'petit'} onChange={set('room')} /> <span>Petit · hip-hop {tr('y', 'and')} R&amp;B</span></label>
            </div>
            {errors.room ? <p className="field__err" role="alert">{tr('Elige una sala.', 'Pick a room.')}</p> : null}
          </fieldset>
          <div className={`check${errors.consent ? ' field--bad' : ''}`}>
            <input id="ls-consent" name="consent" type="checkbox" checked={form.consent} onChange={set('consent')} {...aria('ls-consent', e('consent'))} />
            <label htmlFor="ls-consent">{tr('Quiero recibir mensajes del club y acepto el uso de mis datos para ello.', 'I want to receive messages from the club and agree to my data being used for that.')}</label>
            {errors.consent ? <p className="field__err" id="ls-consent-err" role="alert">{e('consent')}</p> : null}
          </div>
          <div className="hp" aria-hidden="true"><label>Website<input type="text" name="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} /></label></div>
          <button className="btn btn--acc btn--big" type="submit" disabled={sending}><span>{tr('Entrar en la lista', 'Join the list')}</span></button>
          {sendErr ? <p className="field__err" role="alert">{sendErr}</p> : null}
          {done ? <div className="form__done" role="status"><b>{tr('Todo correcto. Esto es una maqueta: no se ha guardado ningún dato.', 'All good. This is a mock-up: no data was saved.')}</b></div> : null}
        </form>
      </div>
    </section>
  );
}
