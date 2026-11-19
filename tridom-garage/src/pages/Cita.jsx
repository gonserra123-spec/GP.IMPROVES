import { useEffect, useRef, useState } from 'react';
import catalog from '../../shared/models.json';
import { BODY_TYPES } from '../../shared/domain.js';
import { MAX_BOOK_DAYS, SLOTS, addDaysIso, todayIso, validateBooking } from '../../shared/customers.js';
import { plateError } from '../../shared/validate.js';
import { normalizePlate } from '../../shared/plates.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Field, Link, Plate, Wordmark } from '../components/ui.jsx';
import { getAdapter, NetworkError } from '../data/adapter.js';

const EMPTY = { plate: '', email: '', phone: '', date: '', slot: '', reason: '', modelId: '', make: '', model: '', bodyType: '', consent: false, website: '' };

// Reserva de cita del cliente: da de alta matrícula y correo desde el primer paso.
// Si el taller ya conoce el coche (cliente habitual importado), no hay que repetir marca y modelo.
export default function Cita({ code }) {
  const { t, date } = useT();
  const [workshop, setWorkshop] = useState(undefined);
  const [v, setV] = useState(EMPTY);
  const [known, setKnown] = useState(null); // null = aún no comprobado | { known, make, model }
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(null);
  const form = useRef(null);

  useEffect(() => {
    let off = false;
    getAdapter().then((a) => a.publicWorkshop(code)).then((r) => { if (!off) setWorkshop(r.ok ? r.workshop : null); }).catch(() => { if (!off) setWorkshop(null); });
    return () => { off = true; };
  }, [code]);

  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const today = todayIso();
  const fail = (err) => setStatus(err instanceof NetworkError ? 'network' : 'generic');

  const check = async (e) => {
    e.preventDefault(); setStatus(null);
    const pe = plateError(v.plate, { allowGeneric: true });
    if (pe) { setErrors({ plate: pe }); return; }
    setErrors({}); setBusy(true);
    try {
      const api = await getAdapter();
      const r = await api.publicCustomerCheck({ code, plate: v.plate, website: v.website });
      if (r.ok) setKnown({ known: !!r.known, make: r.make, model: r.model });
      else setStatus(r.error === 'rate_limited' ? 'rate_limited' : 'generic');
    } catch (err) { fail(err); }
    setBusy(false);
  };

  const submit = async (e) => {
    e.preventDefault(); setStatus(null);
    const r = validateBooking(v, catalog, { known: known?.known, today });
    setErrors(r.errors);
    if (!r.ok) { requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setBusy(true);
    try {
      const api = await getAdapter();
      const res = await api.publicBook({ code, ...v, bodyType: v.bodyType || undefined });
      if (res.ok) setDone({ date: res.date, slot: res.slot, known: res.known });
      else if (res.errors) setErrors(res.errors);
      else setStatus(res.error === 'rate_limited' ? 'rate_limited' : 'generic');
    } catch (err) { fail(err); }
    setBusy(false);
  };

  const reset = () => { setKnown(null); setErrors({}); setV((s) => ({ ...EMPTY, plate: s.plate })); };

  if (workshop === undefined) return <p className="scene-loading" role="status">{t('common.loading')}</p>;
  if (workshop === null) return <main className="login"><div className="login-card"><Wordmark /><p className="notice notice--error">{t('consulta.unknownWorkshop')}</p></div></main>;

  return (
    <main className="cita">
      <div className="cita-card">
        <div className="login-top"><Wordmark /><LangSwitch /></div>
        <div className="cita-head">
          <p className="hint">{workshop.name}</p>
          <h1>{t('cita.title')}</h1>
          <p className="lead">{t('cita.lead')}</p>
        </div>

        {done ? (
          <section className="cita-done" aria-live="polite">
            <p className="notice notice--ok"><strong>{t('cita.done.title')}</strong><br />{t('cita.done.when', { date: date(done.date, { weekday: 'long', day: 'numeric', month: 'long' }), slot: t(`cita.slots.${done.slot}`).toLowerCase() })}</p>
            <p>{t(done.known ? 'cita.done.known' : 'cita.done.new')}</p>
            <p className="hint">{t('cita.done.mail')}</p>
            <div className="part-actions"><Btn to={`/consulta/${code}`} variant="ghost">{t('cita.done.track')}</Btn><Btn variant="ghost" onClick={() => { setDone(null); reset(); setV(EMPTY); }}>{t('cita.done.another')}</Btn></div>
          </section>
        ) : !known ? (
          <form className="form" onSubmit={check} noValidate>
            <Field label={t('cita.plate')} hint={t('cita.plateHint')} error={errors.plate}>
              {(a) => <input className="input input--plate" autoCapitalize="characters" autoComplete="off" spellCheck="false" maxLength={12} value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value.toUpperCase() })} {...a} />}
            </Field>
            <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label></div>
            <div aria-live="polite">{status && <p className="notice notice--error">{t(`errors.${status}`)}</p>}</div>
            <Btn type="submit" disabled={busy}>{busy ? t('common.loading') : t('cita.next')}</Btn>
          </form>
        ) : (
          <form className="form" onSubmit={submit} noValidate ref={form}>
            <div className="cita-car">
              <Plate value={normalizePlate(v.plate)} />
              {known.known
                ? <p className="notice notice--ok"><strong>{t('cita.known', { car: `${known.make} ${known.model}` })}</strong><br />{t('cita.knownNote')}</p>
                : <p className="hint">{t('cita.unknownNote')}</p>}
              <button type="button" className="linklike" onClick={reset}>{t('cita.notMine')}</button>
            </div>
            {!known.known && (
              <>
                <Field label={t('panel.form.model')} error={errors.modelId}>
                  {(a) => (
                    <select className="input" value={v.modelId} onChange={set('modelId')} {...a}>
                      <option value="">—</option>
                      {catalog.map((c) => <option key={c.id} value={c.id}>{c.make} {c.model}</option>)}
                      <option value="other">{t('panel.form.other')}</option>
                    </select>
                  )}
                </Field>
                {v.modelId === 'other' && (
                  <div className="form-row">
                    <Field label={t('panel.form.make')} error={errors.make}>{(a) => <input className="input" value={v.make} onChange={set('make')} maxLength={40} {...a} />}</Field>
                    <Field label={t('panel.form.modelName')} error={errors.model}>{(a) => <input className="input" value={v.model} onChange={set('model')} maxLength={40} {...a} />}</Field>
                    <Field label={t('panel.form.body')} error={errors.bodyType}>
                      {(a) => <select className="input" value={v.bodyType} onChange={set('bodyType')} {...a}><option value="">—</option>{BODY_TYPES.map((b) => <option key={b} value={b}>{t(`bodies.${b}`)}</option>)}</select>}
                    </Field>
                  </div>
                )}
              </>
            )}
            <div className="form-row">
              <Field label={t('landing.contact.email')} error={errors.email}>{(a) => <input className="input" type="email" inputMode="email" autoComplete="email" value={v.email} onChange={set('email')} maxLength={254} {...a} />}</Field>
              <Field label={t('landing.contact.phone')} optional error={errors.phone}>{(a) => <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} maxLength={20} {...a} />}</Field>
            </div>
            <div className="form-row">
              <Field label={t('cita.date')} error={errors.date}>{(a) => <input className="input" type="date" min={today} max={addDaysIso(today, MAX_BOOK_DAYS)} value={v.date} onChange={set('date')} {...a} />}</Field>
              <div className="field">
                <span className="label" id="slot-l">{t('cita.slot')}</span>
                <div className="seg seg--2" role="group" aria-labelledby="slot-l">
                  {SLOTS.map((s) => <button key={s} type="button" className="choice" aria-pressed={v.slot === s} onClick={() => setV((x) => ({ ...x, slot: s }))}>{t(`cita.slots.${s}`)}</button>)}
                </div>
                {errors.slot && <p className="err" role="alert">{t(`errors.${errors.slot}`)}</p>}
              </div>
            </div>
            <Field label={t('cita.reason')} hint={t('cita.reasonHint')} error={errors.reason}>{(a) => <textarea className="input" value={v.reason} onChange={set('reason')} maxLength={300} {...a} />}</Field>
            <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label></div>
            <div className="field">
              <label className="check"><input type="checkbox" checked={v.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} /><span>{t('cita.consent', { shop: workshop.name })} <Link to="/privacidad">{t('landing.footer.legal')}</Link></span></label>
              {errors.consent && <p className="err" role="alert">{t('errors.required')}</p>}
            </div>
            <div aria-live="polite">{status && <p className="notice notice--error">{t(`errors.${status}`)}</p>}</div>
            <Btn type="submit" disabled={busy}>{busy ? t('common.loading') : t('cita.submit')}</Btn>
          </form>
        )}
      </div>
    </main>
  );
}
