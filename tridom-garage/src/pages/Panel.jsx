import { useEffect, useMemo, useRef, useState } from 'react';
import catalog from '../../shared/models.json';
import fullTemplate from '../../shared/template.json';
import { BODY_TYPES, OPERATORS, STATES, capacities, locationsFor } from '../../shared/domain.js';
import { costError, dateError, freeTextError, isPin, parseCost, validateNewVehicle } from '../../shared/validate.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Field, Plate, SceneHost, StateChip, Wordmark } from '../components/ui.jsx';
import { usePanel } from '../data/panelStore.js';
import { getAdapter, NetworkError } from '../data/adapter.js';
import { useScene } from '../scene/store.js';
import { isOverdue } from '../lib/days.js';
import { Appointments, Customers } from './panelCitas.jsx';
import { AlbaranBlock, DaySummary, EtaBlock, Settings, TagsBlock, recalledLogin, rememberLogin, summaryOf, useOnceFlag } from './panelParts.jsx';

const fold = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function Login() {
  const { t } = useT();
  const { config, login, online } = usePanel();
  const rem = useMemo(() => recalledLogin(), []);
  const known = OPERATORS.includes(rem.operator);
  const [v, setV] = useState({ code: rem.code || '', pin: '', operator: known ? rem.operator : 'office', website: '' });
  const [pickOp, setPickOp] = useState(!known); // solo se pregunta quién eres la primera vez
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (config?.workshopCode) setV((s) => (s.code ? s : { ...s, code: config.workshopCode })); }, [config]);
  const submit = async (e) => {
    e.preventDefault();
    if (!isPin(v.pin) || !/^[A-Za-z0-9]{4,12}$/.test(v.code)) { setError({ key: !isPin(v.pin) ? 'pin_format' : 'required' }); return; }
    setBusy(true); setError(null);
    try {
      const r = await login(v);
      if (r.ok) rememberLogin(v);
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
        {pickOp ? (
          <div className="field">
            <span className="label" id="op-label">{t('panel.login.operator')}</span>
            <div className="seg" role="group" aria-labelledby="op-label">
              {OPERATORS.map((o) => <button key={o} type="button" className="choice" aria-pressed={v.operator === o} onClick={() => setV({ ...v, operator: o })}>{t(`operators.${o}`)}</button>)}
            </div>
          </div>
        ) : (
          <p className="who-line">{t('panel.login.asOperator', { who: t(`operators.${v.operator}`) })} <button type="button" className="linklike" onClick={() => setPickOp(true)}>{t('panel.login.change')}</button></p>
        )}
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
  const [extra, setExtra] = useState({ notes: v.notes || '', costEstimate: v.costEstimate ?? '', costFinal: v.costFinal ?? '' });
  const [extraErr, setExtraErr] = useState({});
  const [saved, setSaved] = useState(false);
  const [fail, setFail] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => { setExtra({ notes: v.notes || '', costEstimate: v.costEstimate ?? '', costFinal: v.costFinal ?? '' }); setConfirm(false); setFail(null); }, [v.id]);

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
    setExtraErr(errs);
    if (Object.keys(errs).length) return;
    const r = await run({ type: 'patch', id: v.id, patch: { notes: extra.notes.trim(), costEstimate: parseCost(extra.costEstimate), costFinal: parseCost(extra.costFinal) } });
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

      <EtaBlock v={v} run={run} />

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

      <TagsBlock v={v} run={run} />

      <form className="block" onSubmit={saveExtra} noValidate aria-labelledby="h-notes">
        <h3 id="h-notes">{t('panel.detail.notes')} · {t('panel.detail.cost')}</h3>
        <Field label={t('panel.detail.notes')} optional hint={t('panel.detail.notesHint')} error={extraErr.notes}>{(a) => <textarea className="input" maxLength={500} value={extra.notes} onChange={(e) => setExtra({ ...extra, notes: e.target.value })} {...a} />}</Field>
        <div className="row2">
          <Field label={t('panel.detail.costEstimate')} optional error={extraErr.costEstimate}>{(a) => <input className="input" inputMode="decimal" maxLength={10} value={extra.costEstimate} onChange={(e) => setExtra({ ...extra, costEstimate: e.target.value })} {...a} />}</Field>
          <Field label={t('panel.detail.costFinal')} optional error={extraErr.costFinal}>{(a) => <input className="input" inputMode="decimal" maxLength={10} value={extra.costFinal} onChange={(e) => setExtra({ ...extra, costFinal: e.target.value })} {...a} />}</Field>
        </div>
        <Btn type="submit" variant="ghost">{t('panel.detail.saveNotes')}</Btn>
        <div aria-live="polite">{saved && <p className="notice notice--ok">{t('panel.detail.saved')}</p>}</div>
      </form>

      <section className="block" aria-labelledby="h-hist">
        <h3 id="h-hist">{t('panel.detail.history')}</h3>
        <ol className="history">
          {[...v.history].reverse().slice(0, 10).map((h, i) => <li key={i}><time dateTime={h.at}>{date(h.at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</time><span><b>{hist(h)}</b> · {t(`operators.${h.by}`)}</span></li>)}
        </ol>
      </section>

      <AlbaranBlock v={v} workshop={workshop} />

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
  const { t, date } = useT();
  const { status, boot, vehicles, workshop, operator, online, queue, logout, config } = usePanel();
  const selectedId = useScene((s) => s.selectedId);
  const [view, setView] = useState('list'); // list | new | settings
  const [from, setFrom] = useState(null); // 'settings' si el coche se abrió desde el historial
  const [stat, setStat] = useState(null); // filtro del resumen del día: in | out | stale
  const [tab, setTab] = useState('list');
  const [hint, hideHint] = useOnceFlag('tg_hint_select_v1');

  useEffect(() => { boot(); return () => useScene.getState().reset(); }, []);
  useEffect(() => { if (status === 'ready') useScene.getState().setData(vehicles); }, [vehicles, status]);

  const select = (id, origin = null) => {
    useScene.getState().select(id);
    if (id) {
      hideHint(); setView('list'); setTab('list'); setFrom(origin);
      // Los coches entregados ya no están en la escena: solo se abre su ficha.
      if (usePanel.getState().vehicles.find((x) => x.id === id)?.state !== 'delivered') useScene.getState().focusOn(id);
    } else if (from === 'settings') { setFrom(null); setView('settings'); }
  };
  const template = useMemo(() => (workshop ? { ...fullTemplate, lifts: workshop.template.lifts, pit: workshop.template.pit } : null), [workshop]);
  if (status === 'boot') return <p className="scene-loading" role="status">{t('common.loading')}</p>;
  if (status === 'login') return <Login />;

  const selected = vehicles.find((v) => v.id === selectedId) || null;
  const active = vehicles.filter((v) => v.state !== 'delivered');
  const staleDays = workshop.staleDays ?? 5;
  const sum = summaryOf(vehicles, staleDays);
  const shown = stat ? sum[stat] : active;
  return (
    <div className="app">
      <header className="app-bar">
        <Wordmark />
        <span className="who"><strong>{workshop.name}</strong> · {t(`operators.${operator}`)}</span>
        {config?.demo && <span className="demo-tag" title={t('common.demoNote')}>{t('common.demo')}</span>}
        <span className="grow" />
        <span className="net" data-off={!online || queue.length > 0} role="status">{online && !queue.length ? t('panel.online') : `${t('panel.offline')}${queue.length ? ` · ${t('panel.offlineQueue', { n: String(queue.length) })}` : ''}`}</span>
        <LangSwitch />
        <Btn variant="ghost sm" onClick={() => { useScene.getState().select(null); setFrom(null); setView('customers'); setTab('list'); }}>{t('panel.customers.nav')}</Btn>
        <Btn variant="ghost sm" onClick={() => { useScene.getState().select(null); setFrom(null); setView('settings'); setTab('list'); }}>{t('panel.settings.title')}</Btn>
        <Btn variant="ghost sm" onClick={() => { useScene.getState().select(null); setStat(null); setFrom(null); setView('list'); logout(); }}>{t('panel.logout')}</Btn>
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
                : view === 'customers' ? <Customers onBack={() => setView('list')} />
                : view === 'settings' ? <Settings onBack={() => setView('list')} onOpen={(id) => select(id, 'settings')} />
                  : (
                    <>
                      <div className="side-head"><Btn onClick={() => setView('new')}>+ {t('panel.newCar')}</Btn></div>
                      <Appointments onOpen={(id) => select(id)} />
                      {operator === 'office' && <DaySummary sum={sum} staleDays={staleDays} stat={stat} onPick={setStat} />}
                      {!shown.length ? <p className="empty">{stat ? t('panel.stats.none') : t('panel.empty')}</p> : (
                        <ul className="car-list" aria-label={t('scene.listTitle')}>
                          {shown.map((v) => (
                            <li key={v.id}>
                              <button type="button" className="car-row" onClick={() => select(v.id)}>
                                <Plate value={v.plate} /><StateChip state={v.state} />
                                <span className="sub">
                                  <span>{v.make} {v.model}</span><span>· {t(`locations.${v.location || 'none'}`)}</span>
                                  {v.etaAt && v.state !== 'delivered' && <span>· {t('panel.etaShort', { date: date(v.etaAt, { day: 'numeric', month: 'short' }) })}</span>}
                                  {isOverdue(v) && <span className="late">{t('panel.late')}</span>}
                                  {v.pending && <span className="pend">{t('panel.pendingSync')}</span>}
                                </span>
                                {v.tags?.length > 0 && <span className="sub row-tags">{v.tags.slice(0, 2).map((x) => <span className="mini-tag" key={x}>{x}</span>)}{v.tags.length > 2 && <span className="mini-tag">+{v.tags.length - 2}</span>}</span>}
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}
                      {hint && !stat && <p className="hint" role="note">{t('panel.selectHint')}</p>}
                    </>
                  )}
          </div>
        </main>
      </div>
      <Toasts />
    </div>
  );
}
