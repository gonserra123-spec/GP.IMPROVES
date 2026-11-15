import { useEffect, useMemo, useRef, useState } from 'react';
import qrcode from 'qrcode-generator';
import catalog from '../../shared/models.json';
import fullTemplate from '../../shared/template.json';
import { BODY_TYPES, OPERATORS, STATES, capacities, locationsFor } from '../../shared/domain.js';
import { costError, dateError, freeTextError, isPin, parseCost, validateNewVehicle } from '../../shared/validate.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Field, Plate, SceneHost, StateChip, Wordmark } from '../components/ui.jsx';
import { usePanel } from '../data/panelStore.js';
import { getAdapter, NetworkError } from '../data/adapter.js';
import { useScene } from '../scene/store.js';

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Login() {
  const { t } = useT();
  const { config, login, online } = usePanel();
  const [v, setV] = useState({ code: '', pin: '', operator: 'office', website: '' });
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (config?.workshopCode) setV((s) => (s.code ? s : { ...s, code: config.workshopCode })); }, [config]);
  const submit = async (e) => {
    e.preventDefault();
    if (!isPin(v.pin) || !/^[A-Za-z0-9]{4,12}$/.test(v.code)) { setError({ key: !isPin(v.pin) ? 'pin_format' : 'required' }); return; }
    setBusy(true); setError(null);
    try {
      const r = await login(v);
      if (!r.ok) setError(r.error === 'locked' ? { key: 'locked', vars: { min: String(Math.max(1, Math.ceil((r.retryAfter || 60) / 60))) } } : { key: r.error === 'bad_credentials' ? 'bad_credentials' : (r.error === 'rate_limited' ? 'rate_limited' : 'generic') });
    } catch (err) { setError({ key: err instanceof NetworkError ? 'network' : 'generic' }); }
    setBusy(false); setV((s) => ({ ...s, pin: '' }));
  };
  return (
    <main className="login">
      <form className="login-card" onSubmit={submit} noValidate>
        <div className="login-top"><Wordmark /><LangSwitch /></div>
        <h1>{t('panel.login.title')}</h1>
        {config?.demo && <p className="notice notice--warn"><span className="demo-tag">{t('common.demo')}</span> {t('panel.login.demo', { pin: config.demoPin, code: config.workshopCode })}</p>}
        <Field label={t('panel.login.code')}>{(a) => <input className="input" autoCapitalize="characters" autoComplete="off" spellCheck="false" maxLength={12} value={v.code} onChange={(e) => setV({ ...v, code: e.target.value.toUpperCase() })} {...a} />}</Field>
        <Field label={t('panel.login.pin')}>{(a) => <input className="input input--plate" type="password" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={8} value={v.pin} onChange={(e) => setV({ ...v, pin: e.target.value.replace(/\D/g, '') })} {...a} />}</Field>
        <div className="field">
          <span className="label" id="op-label">{t('panel.login.operator')}</span>
          <div className="seg" role="group" aria-labelledby="op-label">
            {OPERATORS.map((o) => <button key={o} type="button" className="choice" aria-pressed={v.operator === o} onClick={() => setV({ ...v, operator: o })}>{t(`operators.${o}`)}</button>)}
          </div>
        </div>
        <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={(e) => setV({ ...v, website: e.target.value })} /></label></div>
        <div aria-live="assertive">{error && <p className="notice notice--error">{t(`errors.${error.key}`, error.vars)}</p>}{!online && !error && <p className="notice notice--warn">{t('errors.network')}</p>}</div>
        <Btn type="submit" disabled={busy}>{t('panel.login.submit')}</Btn>
      </form>
    </main>
  );
}

function NewCar({ onDone }) {
  const { t } = useT();
  const mutate = usePanel((s) => s.mutate);
  const [v, setV] = useState({ plate: '', foreign: false, query: '', modelId: '', make: '', model: '', bodyType: '', phone: '' });
  const [errors, setErrors] = useState({});
  const [open, setOpen] = useState(false);
  const [fail, setFail] = useState(null);
  const form = useRef(null);
  const matches = useMemo(() => {
    const q = fold(v.query.trim());
    if (!q) return catalog.slice(0, 8);
    return catalog.filter((c) => fold(`${c.make} ${c.model}`).includes(q)).slice(0, 8);
  }, [v.query]);
  const pick = (m) => { setV((s) => ({ ...s, modelId: m ? m.id : 'other', query: m ? `${m.make} ${m.model}` : t('panel.form.other') })); setOpen(false); };
  const submit = async (e) => {
    e.preventDefault(); setFail(null);
    const input = { id: crypto.randomUUID(), plate: v.plate, foreign: v.foreign, phone: v.phone, ...(v.modelId && v.modelId !== 'other' ? { modelId: v.modelId } : { modelId: 'other', make: v.make, model: v.model, bodyType: v.bodyType }) };
    const r = validateNewVehicle(input, catalog);
    const errs = { ...r.errors };
    if (!v.modelId) errs.modelId = 'required';
    setErrors(errs);
    if (Object.keys(errs).length) { requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    const m = r.model;
    const local = { id: input.id, plate: r.plate, modelId: m ? m.id : null, make: m ? m.make : v.make.trim(), model: m ? m.model : v.model.trim(), bodyType: m ? m.body : v.bodyType, dims: m ? { l: m.l, w: m.w, h: m.h } : null, hasPhone: !!r.phone, phoneLast4: r.phone ? r.phone.slice(-4) : null };
    try {
      const res = await mutate({ type: 'create', id: input.id, input: { ...input, plate: r.plate, phone: r.phone || undefined }, local });
      if (res.ok) onDone(input.id);
      else if (res.errors) setErrors(res.errors);
      else setFail(['plate_exists', 'workshop_full', 'rate_limited'].includes(res.error) ? res.error : 'generic');
    } catch { setFail('generic'); }
  };
  return (
    <form className="panel-card" onSubmit={submit} noValidate ref={form}>
      <div className="detail-head"><h2 className="grow">{t('panel.form.title')}</h2><Btn variant="ghost sm" onClick={() => onDone(null)}>{t('common.cancel')}</Btn></div>
      <Field label={t('panel.form.plate')} hint={t('panel.form.plateHint')} error={errors.plate}>
        {(a) => <input className="input input--plate" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck="false" maxLength={12} value={v.plate} onChange={(e) => setV({ ...v, plate: e.target.value.toUpperCase() })} {...a} />}
      </Field>
      <label className="check"><input type="checkbox" checked={v.foreign} onChange={(e) => setV({ ...v, foreign: e.target.checked })} /><span>{t('panel.form.foreign')}</span></label>
      <Field label={t('panel.form.model')} hint={t('panel.form.modelHint')} error={errors.modelId}>
        {(a) => (
          <div className="combo">
            <input className="input" role="combobox" aria-expanded={open} aria-controls="model-list" aria-autocomplete="list" autoComplete="off" value={v.query}
              onChange={(e) => { setV({ ...v, query: e.target.value, modelId: '' }); setOpen(true); }} onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)}
              onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); if (e.key === 'Enter' && open && matches[0]) { e.preventDefault(); pick(matches[0]); } }} {...a} />
            {open && (
              <ul className="combo-list" id="model-list" role="listbox">
                {matches.map((m) => <li key={m.id} role="option" aria-selected={v.modelId === m.id} onPointerDown={(e) => { e.preventDefault(); pick(m); }}><span>{m.make} {m.model}</span><small>{t(`bodies.${m.body}`)}</small></li>)}
                {!matches.length && <li aria-disabled="true"><small>{t('panel.form.noMatch')}</small></li>}
                <li role="option" aria-selected={v.modelId === 'other'} onPointerDown={(e) => { e.preventDefault(); pick(null); }}><span>{t('panel.form.other')}</span></li>
              </ul>
            )}
          </div>
        )}
      </Field>
      {v.modelId === 'other' && (
        <>
          <div className="row2">
            <Field label={t('panel.form.make')} error={errors.make}>{(a) => <input className="input" maxLength={40} value={v.make} onChange={(e) => setV({ ...v, make: e.target.value })} {...a} />}</Field>
            <Field label={t('panel.form.modelName')} error={errors.model}>{(a) => <input className="input" maxLength={40} value={v.model} onChange={(e) => setV({ ...v, model: e.target.value })} {...a} />}</Field>
          </div>
          <Field label={t('panel.form.body')} error={errors.bodyType}>
            {(a) => <select className="input" value={v.bodyType} onChange={(e) => setV({ ...v, bodyType: e.target.value })} {...a}><option value="">—</option>{BODY_TYPES.map((b) => <option key={b} value={b}>{t(`bodies.${b}`)}</option>)}</select>}
          </Field>
        </>
      )}
      <Field label={t('panel.form.phone')} optional hint={t('panel.form.phoneHint')} error={errors.phone}>
        {(a) => <input className="input" type="tel" inputMode="tel" autoComplete="off" maxLength={20} value={v.phone} onChange={(e) => setV({ ...v, phone: e.target.value })} {...a} />}
      </Field>
      {fail && <p className="notice notice--error" role="alert">{t(`errors.${fail}`)}</p>}
      <Btn type="submit" variant="block">{t('panel.form.submit')}</Btn>
    </form>
  );
}

function Detail({ v, onBack }) {
  const { t, date } = useT();
  const { mutate, vehicles, workshop } = usePanel();
  const [part, setPart] = useState({ description: '', etaAt: '' });
  const [partErr, setPartErr] = useState({});
  const [extra, setExtra] = useState({ notes: v.notes || '', costEstimate: v.costEstimate ?? '', costFinal: v.costFinal ?? '', etaAt: v.etaAt || '' });
  const [extraErr, setExtraErr] = useState({});
  const [saved, setSaved] = useState(false);
  const [fail, setFail] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setExtra({ notes: v.notes || '', costEstimate: v.costEstimate ?? '', costFinal: v.costFinal ?? '', etaAt: v.etaAt || '' }); setConfirm(false); setFail(null); }, [v.id]);

  const cap = capacities(workshop.template);
  const used = {};
  for (const o of vehicles) if (o.id !== v.id && o.location) used[o.location] = (used[o.location] || 0) + 1;
  const run = async (op) => {
    setFail(null);
    try { const r = await mutate(op); if (!r.ok) setFail(['location_full', 'workshop_full', 'rate_limited'].includes(r.error) ? r.error : 'generic'); return r; } catch { setFail('generic'); return { ok: false }; }
  };
  const addPart = async (e) => {
    e.preventDefault();
    const errs = {};
    const de = freeTextError(part.description, { required: true, max: 200 }); if (de) errs.description = de;
    const ee = dateError(part.etaAt); if (ee) errs.etaAt = ee;
    setPartErr(errs);
    if (Object.keys(errs).length) return;
    const r = await run({ type: 'part_add', id: v.id, part: { id: crypto.randomUUID(), description: part.description.trim(), etaAt: part.etaAt || undefined } });
    if (r.ok) setPart({ description: '', etaAt: '' });
  };
  const saveExtra = async (e) => {
    e.preventDefault();
    const errs = {};
    const ne = freeTextError(extra.notes, { max: 500 }); if (ne) errs.notes = ne;
    for (const k of ['costEstimate', 'costFinal']) { const ce = costError(extra[k]); if (ce) errs[k] = ce; }
    const de = dateError(extra.etaAt); if (de) errs.etaAt = de;
    setExtraErr(errs);
    if (Object.keys(errs).length) return;
    const r = await run({ type: 'patch', id: v.id, patch: { notes: extra.notes.trim(), costEstimate: parseCost(extra.costEstimate), costFinal: parseCost(extra.costFinal), etaAt: extra.etaAt || '' } });
    if (r.ok) { setSaved(true); setTimeout(() => setSaved(false), 2500); }
  };
  const exportData = async () => {
    try {
      const api = await getAdapter();
      const data = await api.exportVehicle(v.id);
      const { status, ...json } = data;
      const url = URL.createObjectURL(new Blob([JSON.stringify(json, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a'); a.href = url; a.download = 'datos-vehiculo.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch { setFail('network'); }
  };
  const remove = async () => {
    if (!confirm) { setConfirm(true); return; }
    const r = await run({ type: 'delete', id: v.id });
    if (r.ok) onBack();
  };
  const hist = (h) => {
    if (h.type === 'created') return t('panel.detail.hist.created');
    if (h.type === 'state') return t('panel.detail.hist.state', { from: t(`states.${h.from}`), to: t(`states.${h.to}`) });
    if (h.type === 'location') return t('panel.detail.hist.location', { from: t(`locations.${h.from || 'none'}`), to: t(`locations.${h.to}`) });
    return t('panel.detail.hist.part', { to: t(`partStates.${h.to}`) });
  };
  return (
    <article className="panel-card" aria-label={v.plate}>
      <div className="detail-head">
        <Btn variant="ghost sm" onClick={onBack} aria-label={t('common.back')}>←</Btn>
        <div className="grow"><Plate value={v.plate} /><div className="model">{v.make} {v.model} · {t(`bodies.${v.bodyType}`)}</div></div>
        <StateChip state={v.state} />
      </div>
      {v.pending && <p className="notice notice--warn">{t('panel.pendingSync')}</p>}
      {fail && <p className="notice notice--error" role="alert">{t(`errors.${fail}`)}</p>}

      <section className="block" aria-labelledby="h-state">
        <h3 id="h-state">{t('panel.detail.state')}</h3>
        <div className="choices" role="group" aria-labelledby="h-state">
          {STATES.map((s) => <button key={s} type="button" className="choice" aria-pressed={v.state === s} onClick={() => v.state !== s && run({ type: 'patch', id: v.id, patch: { state: s } })}>{t(`states.${s}`)}</button>)}
        </div>
      </section>

      {v.state !== 'delivered' && (
        <section className="block" aria-labelledby="h-loc">
          <h3 id="h-loc">{t('panel.detail.location')}</h3>
          <div className="choices" role="group" aria-labelledby="h-loc">
            {locationsFor(workshop.template).map((l) => {
              const full = (used[l] || 0) >= cap[l] && v.location !== l;
              return <button key={l} type="button" className="choice" aria-pressed={v.location === l} disabled={full} onClick={() => v.location !== l && run({ type: 'patch', id: v.id, patch: { location: l } })}>{t(`locations.${l}`)}{full && <small>{t('panel.detail.occupied')}</small>}</button>;
            })}
          </div>
        </section>
      )}

      <section className="block" aria-labelledby="h-parts">
        <h3 id="h-parts">{t('panel.detail.parts')}</h3>
        {!v.parts.length && <p className="hint">{t('panel.detail.noParts')}</p>}
        {v.parts.map((p) => (
          <div className="part" key={p.id}>
            <div className="part-top"><strong>{p.description}</strong><span className="chip" data-state={p.state === 'arrived' ? 'ready' : (p.state === 'ordered' ? 'in_repair' : 'awaiting_part')}>{t(`partStates.${p.state}`)}</span></div>
            {p.etaAt && <span className="hint">{t('panel.detail.partEta')}: {date(p.etaAt)}</span>}
            <div className="part-actions">
              {p.state === 'needed' && <Btn variant="ghost sm" onClick={() => run({ type: 'part_patch', id: v.id, pid: p.id, patch: { state: 'ordered' } })}>{t('panel.detail.markOrdered')}</Btn>}
              {p.state !== 'arrived' && <Btn variant="ghost sm" onClick={() => run({ type: 'part_patch', id: v.id, pid: p.id, patch: { state: 'arrived' } })}>{t('panel.detail.markArrived')}</Btn>}
              <Btn variant="danger sm" onClick={() => run({ type: 'part_remove', id: v.id, pid: p.id })}>{t('panel.detail.removePart')}</Btn>
            </div>
          </div>
        ))}
        <form className="part" onSubmit={addPart} noValidate>
          <Field label={t('panel.detail.partDesc')} error={partErr.description}>{(a) => <input className="input" maxLength={200} value={part.description} onChange={(e) => setPart({ ...part, description: e.target.value })} {...a} />}</Field>
          <Field label={t('panel.detail.partEta')} optional error={partErr.etaAt}>{(a) => <input className="input" type="date" value={part.etaAt} onChange={(e) => setPart({ ...part, etaAt: e.target.value })} {...a} />}</Field>
          <Btn type="submit" variant="ghost">{t('panel.detail.addPart')}</Btn>
        </form>
      </section>

      <form className="block" onSubmit={saveExtra} noValidate aria-labelledby="h-notes">
        <h3 id="h-notes">{t('panel.detail.notes')} · {t('panel.detail.cost')}</h3>
        <Field label={t('panel.detail.notes')} optional hint={t('panel.detail.notesHint')} error={extraErr.notes}>{(a) => <textarea className="input" maxLength={500} value={extra.notes} onChange={(e) => setExtra({ ...extra, notes: e.target.value })} {...a} />}</Field>
        <div className="row2">
          <Field label={t('panel.detail.costEstimate')} optional error={extraErr.costEstimate}>{(a) => <input className="input" inputMode="decimal" maxLength={10} value={extra.costEstimate} onChange={(e) => setExtra({ ...extra, costEstimate: e.target.value })} {...a} />}</Field>
          <Field label={t('panel.detail.costFinal')} optional error={extraErr.costFinal}>{(a) => <input className="input" inputMode="decimal" maxLength={10} value={extra.costFinal} onChange={(e) => setExtra({ ...extra, costFinal: e.target.value })} {...a} />}</Field>
        </div>
        <Field label={t('panel.detail.eta')} optional error={extraErr.etaAt}>{(a) => <input className="input" type="date" value={extra.etaAt} onChange={(e) => setExtra({ ...extra, etaAt: e.target.value })} {...a} />}</Field>
        <Btn type="submit" variant="ghost">{t('panel.detail.saveNotes')}</Btn>
        <div aria-live="polite">{saved && <p className="notice notice--ok">{t('panel.detail.saved')}</p>}</div>
      </form>

      <section className="block" aria-labelledby="h-hist">
        <h3 id="h-hist">{t('panel.detail.history')}</h3>
        <ol className="history">
          {[...v.history].reverse().slice(0, 10).map((h, i) => <li key={i}><time dateTime={h.at}>{date(h.at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><span><b>{hist(h)}</b> · {t(`operators.${h.by}`)}</span></li>)}
        </ol>
      </section>

      <section className="block" aria-labelledby="h-data">
        <h3 id="h-data">{t('panel.detail.data')}</h3>
        <p className="hint">{v.hasPhone ? `${t('panel.detail.phone')}: ${t('panel.detail.phoneMasked', { last4: v.phoneLast4 })}` : t('panel.detail.noPhone')}</p>
        <div className="part-actions">
          <Btn variant="ghost sm" onClick={exportData}>{t('panel.detail.export')}</Btn>
          <Btn variant="danger sm" onClick={remove}>{confirm ? t('panel.detail.removeConfirm') : t('panel.detail.remove')}</Btn>
        </div>
      </section>
    </article>
  );
}

function QR({ text }) {
  const d = useMemo(() => {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let path = '';
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { n, path };
  }, [text]);
  return <svg viewBox={`0 0 ${d.n} ${d.n}`} role="img" aria-label="QR" shapeRendering="crispEdges"><path d={d.path} fill="#0B2A5B" /></svg>;
}

function Settings({ onBack }) {
  const { t } = useT();
  const { workshop, toast, reload } = usePanel();
  const [days, setDays] = useState(String(workshop.retentionDays));
  const [err, setErr] = useState(null);
  const url = `${window.location.origin}/consulta/${workshop.code}`;
  const save = async (e) => {
    e.preventDefault();
    const n = Number(days);
    if (!Number.isInteger(n) || n < 1 || n > 365) { setErr('invalid'); return; }
    setErr(null);
    try { const api = await getAdapter(); const r = await api.setRetention(n); if (r.ok) { usePanel.setState({ workshop: r.workshop }); toast('ok', 'panel.detail.saved'); } else setErr('generic'); } catch { setErr('network'); }
  };
  const run = async () => {
    try { const api = await getAdapter(); const r = await api.runRetention(); if (r.ok) { toast('ok', 'panel.settings.deleted', { n: String(r.deleted) }); reload(); } } catch { setErr('network'); }
  };
  return (
    <section className="panel-card" aria-labelledby="h-set">
      <div className="detail-head"><Btn variant="ghost sm" onClick={onBack} aria-label={t('common.back')}>←</Btn><h2 className="grow" id="h-set">{t('panel.settings.title')}</h2></div>
      <form className="block" onSubmit={save} noValidate>
        <Field label={t('panel.settings.retention')} hint={t('panel.settings.retentionHint')} error={err}>{(a) => <input className="input" inputMode="numeric" maxLength={3} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} {...a} />}</Field>
        <div className="part-actions"><Btn type="submit" variant="ghost sm">{t('common.save')}</Btn><Btn variant="ghost sm" onClick={run}>{t('panel.settings.run')}</Btn></div>
      </form>
      <div className="block">
        <h3>{t('panel.settings.qr')}</h3>
        <div className="qr"><QR text={url} /><div><p className="hint">{t('panel.settings.qrHint')}</p><p><a href={`/consulta/${workshop.code}`} target="_blank" rel="noopener">{t('panel.settings.open')}</a></p></div></div>
      </div>
    </section>
  );
}

function Toasts() {
  const { t } = useT();
  const { toasts, dismissToast } = usePanel();
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((x) => <div className="toast" key={x.id} data-kind={x.kind}><span>{t(x.text, x.vars && { ...x.vars, who: x.vars.who ? t(`operators.${x.vars.who}`) : undefined })}</span><button type="button" onClick={() => dismissToast(x.id)} aria-label={t('common.close')}>×</button></div>)}
    </div>
  );
}

export default function Panel() {
  const { t } = useT();
  const { status, boot, vehicles, workshop, operator, online, queue, logout, config } = usePanel();
  const selectedId = useScene((s) => s.selectedId);
  const [view, setView] = useState('list'); // list | new | settings
  const [filter, setFilter] = useState('active');
  const [tab, setTab] = useState('list');

  useEffect(() => { boot(); return () => useScene.getState().reset(); }, []);
  useEffect(() => { if (status === 'ready') useScene.getState().setData(vehicles); }, [vehicles, status]);

  const select = (id) => {
    useScene.getState().select(id);
    if (id) { setView('list'); useScene.getState().focusOn(id); setTab('list'); }
  };
  const template = useMemo(() => (workshop ? { ...fullTemplate, lifts: workshop.template.lifts, pit: workshop.template.pit } : null), [workshop]);
  if (status === 'boot') return <p className="scene-loading" role="status">{t('common.loading')}</p>;
  if (status === 'login') return <Login />;

  const selected = vehicles.find((v) => v.id === selectedId) || null;
  const active = vehicles.filter((v) => v.state !== 'delivered');
  const shown = filter === 'active' ? active : vehicles.filter((v) => v.state === 'delivered');
  return (
    <div className="app">
      <header className="app-bar">
        <Wordmark />
        <span className="who"><strong>{workshop.name}</strong> · {t(`operators.${operator}`)}</span>
        {config?.demo && <span className="demo-tag" title={t('common.demoNote')}>{t('common.demo')}</span>}
        <span className="grow" />
        <span className="net" data-off={!online || queue.length > 0} role="status">{online && !queue.length ? t('panel.online') : `${t('panel.offline')}${queue.length ? ` · ${t('panel.offlineQueue', { n: String(queue.length) })}` : ''}`}</span>
        <LangSwitch />
        <Btn variant="ghost sm" onClick={() => { useScene.getState().select(null); setView('settings'); setTab('list'); }}>{t('panel.settings.title')}</Btn>
        <Btn variant="ghost sm" onClick={logout}>{t('panel.logout')}</Btn>
      </header>
      <div>
        <div className="tabs" role="tablist">
          <button type="button" role="tab" className="tab" aria-selected={tab === 'scene'} onClick={() => setTab('scene')}>{t('panel.tabs.scene')}</button>
          <button type="button" role="tab" className="tab" aria-selected={tab === 'list'} onClick={() => setTab('list')}>{t('panel.tabs.list')}</button>
        </div>
        <main className="board" data-tab={tab}>
          <div className="board-scene">
            <SceneHost template={template} name={workshop.name} brandColor={workshop.brandColor} mode="panel" interactive="full" onSelect={select} listVehicles={active} selectedId={selectedId} />
          </div>
          <div className="board-side">
            {selected ? <Detail v={selected} onBack={() => select(null)} />
              : view === 'new' ? <NewCar onDone={(id) => { setView('list'); if (id) select(id); }} />
                : view === 'settings' ? <Settings onBack={() => setView('list')} />
                  : (
                    <>
                      <div className="side-head"><Btn onClick={() => setView('new')}>+ {t('panel.newCar')}</Btn></div>
                      <div className="filters" role="group" aria-label={t('panel.search')}>
                        <button type="button" className="filter" aria-pressed={filter === 'active'} onClick={() => setFilter('active')}>{t('panel.active')} ({active.length})</button>
                        <button type="button" className="filter" aria-pressed={filter === 'delivered'} onClick={() => setFilter('delivered')}>{t('panel.deliveredTab')} ({vehicles.length - active.length})</button>
                      </div>
                      {!shown.length ? <p className="empty">{filter === 'active' ? t('panel.empty') : t('scene.empty')}</p> : (
                        <ul className="car-list" aria-label={t('scene.listTitle')}>
                          {shown.map((v) => (
                            <li key={v.id}>
                              <button type="button" className="car-row" onClick={() => select(v.id)}>
                                <Plate value={v.plate} /><StateChip state={v.state} />
                                <span className="sub"><span>{v.make} {v.model}</span><span>· {t(`locations.${v.location || 'none'}`)}</span>{v.pending && <span className="pend">{t('panel.pendingSync')}</span>}</span>
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      <p className="hint">{t('panel.selectHint')}</p>
                    </>
                  )}
          </div>
        </main>
      </div>
      <Toasts />
    </div>
  );
}
