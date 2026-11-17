// Piezas del panel: ayuda de una sola vez, hora estimada, etiquetas rápidas, albarán con QR,
// resumen del día y ajustes (historial, etiquetas, aviso de coches parados).
import { useCallback, useEffect, useMemo, useState } from 'react';
import qrcode from 'qrcode-generator';
import { dateError, tagError, NOTE_TAGS_MAX, TAGS_PER_VEHICLE } from '../../shared/validate.js';
import { useT } from '../i18n/index.jsx';
import { Btn, Field, Plate } from '../components/ui.jsx';
import { usePanel } from '../data/panelStore.js';
import { getAdapter } from '../data/adapter.js';
import { addDays, dayOf, daysSince, today } from '../lib/days.js';

/* ---------- Pista que se enseña una sola vez ---------- */
export function useOnceFlag(key, ms = 9000) {
  const [show, setShow] = useState(() => { try { return !localStorage.getItem(key); } catch { return true; } });
  const hide = useCallback(() => { setShow(false); try { localStorage.setItem(key, '1'); } catch { /* sin almacenamiento */ } }, [key]);
  useEffect(() => {
    if (!show) return undefined;
    const id = setTimeout(hide, ms);
    return () => clearTimeout(id);
  }, [show, hide, ms]);
  return [show, hide];
}

/* ---------- Quién eres: se recuerda en este dispositivo ---------- */
const LOGIN_KEY = 'tg_login_v1';
export function recalledLogin() { try { return JSON.parse(localStorage.getItem(LOGIN_KEY)) || {}; } catch { return {}; } }
export function rememberLogin({ code, operator }) { try { localStorage.setItem(LOGIN_KEY, JSON.stringify({ code, operator })); } catch { /* sin almacenamiento */ } }

/* ---------- Hora estimada de entrega ---------- */
export function EtaBlock({ v, run }) {
  const { t, date } = useT();
  const [val, setVal] = useState(v.etaAt || '');
  const [err, setErr] = useState(null);
  useEffect(() => { setVal(v.etaAt || ''); setErr(null); }, [v.id, v.etaAt]);
  if (v.state === 'delivered') return null;
  const ask = !v.etaAt && ['awaiting_approval', 'awaiting_part', 'in_repair'].includes(v.state);
  const set = (d) => run({ type: 'patch', id: v.id, patch: { etaAt: d } });
  const onDate = (e) => {
    const d = e.target.value; setVal(d);
    const de = dateError(d); setErr(de);
    if (!de && d !== (v.etaAt || '')) set(d);
  };
  const quick = [['etaToday', 0], ['etaTomorrow', 1], ['etaPlus2', 2], ['etaWeek', 7]];
  return (
    <section className={`block ${ask ? 'eta-ask' : ''}`} aria-labelledby="h-eta">
      <h3 id="h-eta">{t('panel.detail.etaTitle')}</h3>
      {ask && <p className="hint" role="note">{t('panel.detail.etaAsk')}</p>}
      <div className="choices quick" role="group" aria-labelledby="h-eta">
        {quick.map(([k, n]) => <button key={k} type="button" className="choice" aria-pressed={v.etaAt === addDays(n)} onClick={() => set(addDays(n))}>{t(`panel.detail.${k}`)}</button>)}
      </div>
      <Field label={t('panel.detail.eta')} optional error={err}>{(a) => <input className="input" type="date" value={val} onChange={onDate} {...a} />}</Field>
      {v.etaAt
        ? <div className="part-actions"><span className="hint">{date(v.etaAt, { weekday: 'long', day: 'numeric', month: 'long' })}</span><Btn variant="ghost sm" onClick={() => set('')}>{t('panel.detail.etaClear')}</Btn></div>
        : !ask && <p className="hint">{t('panel.detail.etaNone')}</p>}
    </section>
  );
}

/* ---------- Etiquetas rápidas por coche ---------- */
export function useNoteTags() {
  const { t } = useT();
  const workshop = usePanel((s) => s.workshop);
  const defaults = t('panel.tags.defaults');
  return useMemo(() => (Array.isArray(workshop?.noteTags) ? workshop.noteTags : (Array.isArray(defaults) ? defaults : [])), [workshop?.noteTags, defaults]);
}

export function TagsBlock({ v, run }) {
  const { t } = useT();
  const list = useNoteTags();
  const mine = v.tags || [];
  const all = [...list, ...mine.filter((x) => !list.includes(x))];
  const toggle = (tag) => {
    const next = mine.includes(tag) ? mine.filter((x) => x !== tag) : [...mine, tag];
    if (next.length > TAGS_PER_VEHICLE) return;
    run({ type: 'patch', id: v.id, patch: { tags: next } });
  };
  return (
    <section className="block" aria-labelledby="h-tags">
      <h3 id="h-tags">{t('panel.detail.tagsTitle')}</h3>
      <p className="hint">{t('panel.detail.tagsHint')}</p>
      <div className="tags" role="group" aria-labelledby="h-tags">
        {all.map((tag) => <button key={tag} type="button" className="tag-btn" aria-pressed={mine.includes(tag)} onClick={() => toggle(tag)}>{tag}</button>)}
      </div>
    </section>
  );
}

/* ---------- QR ---------- */
export function QR({ text, color = '#0B2A5B' }) {
  const d = useMemo(() => {
    const q = qrcode(0, 'M'); q.addData(text); q.make();
    const n = q.getModuleCount(); let path = '';
    for (let r = 0; r < n; r += 1) for (let c = 0; c < n; c += 1) if (q.isDark(r, c)) path += `M${c} ${r}h1v1h-1z`;
    return { n, path };
  }, [text]);
  return <svg viewBox={`0 0 ${d.n} ${d.n}`} role="img" aria-label="QR" shapeRendering="crispEdges"><path d={d.path} fill={color} /></svg>;
}

/* ---------- Albarán de recepción (solo se ve al imprimir) ---------- */
export function AlbaranBlock({ v, workshop }) {
  const { t } = useT();
  return (
    <section className="block no-print" aria-labelledby="h-alb">
      <h3 id="h-alb">{t('panel.albaran.title')}</h3>
      {v.publicCode ? (
        <>
          <p className="hint">{t('panel.albaran.hint')}</p>
          <div className="part-actions"><Btn variant="ghost sm" onClick={() => window.print()}>{t('panel.albaran.print')}</Btn></div>
          <Albaran v={v} workshop={workshop} />
        </>
      ) : <p className="hint">{t('panel.albaran.pending')}</p>}
    </section>
  );
}

function Albaran({ v, workshop }) {
  const { t, date } = useT();
  const url = `${window.location.origin}/consulta/${workshop.code}?c=${v.publicCode}`;
  return (
    <div className="albaran" aria-hidden="true">
      <p className="alb-shop">{workshop.name}</p>
      <h2>{t('panel.albaran.receipt')}</h2>
      <div className="alb-car"><Plate value={v.plate} /><p>{v.make} {v.model}</p><p>{t('panel.albaran.entered', { date: date(v.enteredAt) })}</p></div>
      <div className="alb-qr"><QR text={url} color="#000000" /></div>
      <p className="alb-scan">{t('panel.albaran.scan')}</p>
      <p className="alb-code">{t('panel.albaran.code')}: <b>{v.publicCode}</b></p>
      <p className="alb-url">{url}</p>
    </div>
  );
}

/* ---------- Resumen del día (oficina) ---------- */
export function summaryOf(vehicles, staleDays) {
  const td = today();
  const active = vehicles.filter((v) => v.state !== 'delivered');
  return {
    in: vehicles.filter((v) => dayOf(v.enteredAt) === td),
    out: vehicles.filter((v) => v.state === 'delivered' && dayOf(v.deliveredAt) === td),
    stale: active.filter((v) => daysSince(v.enteredAt) >= staleDays),
  };
}

export function DaySummary({ sum, staleDays, stat, onPick }) {
  const { t } = useT();
  return (
    <div className="stats" role="group" aria-label={t('panel.stats.title')}>
      {['in', 'out', 'stale'].map((k) => (
        <button key={k} type="button" className="stat" aria-pressed={stat === k} data-hot={k === 'stale' && sum.stale.length > 0} onClick={() => onPick(stat === k ? null : k)}>
          <b>{sum[k].length}</b><span>{t(`panel.stats.${k}`, { n: String(staleDays) })}</span>
        </button>
      ))}
    </div>
  );
}

/* ---------- Ajustes ---------- */
export function Settings({ onBack, onOpen }) {
  const { t, date } = useT();
  const { workshop, toast, reload, vehicles } = usePanel();
  const defaults = t('panel.tags.defaults');
  const [days, setDays] = useState(String(workshop.retentionDays));
  const [stale, setStale] = useState(String(workshop.staleDays ?? 5));
  const [err, setErr] = useState(null);
  const [tags, setTags] = useState(Array.isArray(workshop.noteTags) ? workshop.noteTags : defaults);
  const [newTag, setNewTag] = useState('');
  const [tagErr, setTagErr] = useState(null);
  const [q, setQ] = useState('');
  const url = `${window.location.origin}/consulta/${workshop.code}`;

  const apply = async (patch, errSet) => {
    try {
      const api = await getAdapter(); const r = await api.setWorkshopSettings(patch);
      if (r.ok) { usePanel.setState({ workshop: r.workshop }); toast('ok', 'panel.detail.saved'); return true; }
      errSet(r.errors ? 'invalid' : 'generic');
    } catch { errSet('network'); }
    return false;
  };
  const save = async (e) => {
    e.preventDefault();
    const n = Number(days); const s = Number(stale);
    if (!Number.isInteger(n) || n < 1 || n > 365 || !Number.isInteger(s) || s < 1 || s > 60) { setErr('invalid'); return; }
    setErr(null);
    await apply({ retentionDays: n, staleDays: s }, setErr);
  };
  const run = async () => {
    try { const api = await getAdapter(); const r = await api.runRetention(); if (r.ok) { toast('ok', 'panel.settings.deleted', { n: String(r.deleted) }); reload(); } } catch { setErr('network'); }
  };
  const addTag = (e) => {
    e.preventDefault();
    const te = tagError(newTag); if (te) { setTagErr(te); return; }
    const c = newTag.replace(/\s+/g, ' ').trim();
    if (tags.includes(c)) { setNewTag(''); return; }
    if (tags.length >= NOTE_TAGS_MAX) { setTagErr('invalid'); return; }
    setTags([...tags, c]); setNewTag(''); setTagErr(null);
  };
  const saveTags = () => apply({ noteTags: tags }, setTagErr);
  const resetTags = async () => { if (await apply({ noteTags: null }, setTagErr)) setTags(Array.isArray(defaults) ? defaults : []); };

  const delivered = useMemo(() => {
    const f = q.toUpperCase().replace(/[\s-]/g, '');
    return vehicles.filter((v) => v.state === 'delivered' && (!f || v.plate.includes(f))).sort((a, b) => (b.deliveredAt || '').localeCompare(a.deliveredAt || ''));
  }, [vehicles, q]);

  return (
    <section className="panel-card" aria-labelledby="h-set">
      <div className="detail-head"><Btn variant="ghost sm" onClick={onBack} aria-label={t('common.back')}>←</Btn><h2 className="grow" id="h-set">{t('panel.settings.title')}</h2></div>

      <section className="block" aria-labelledby="h-hist2">
        <h3 id="h-hist2">{t('panel.settings.history')}</h3>
        <p className="hint">{t('panel.settings.historyHint', { n: String(workshop.retentionDays) })}</p>
        <Field label={t('panel.settings.historySearch')}>{(a) => <input className="input input--plate" autoCapitalize="characters" autoComplete="off" value={q} onChange={(e) => setQ(e.target.value)} {...a} />}</Field>
        {!delivered.length ? <p className="empty">{t('panel.settings.historyEmpty')}</p> : (
          <ul className="car-list">
            {delivered.map((v) => (
              <li key={v.id}>
                <button type="button" className="car-row" onClick={() => onOpen(v.id)}>
                  <Plate value={v.plate} /><span className="when">{t('panel.settings.deliveredOn', { date: date(v.deliveredAt) })}</span>
                  <span className="sub"><span>{v.make} {v.model}</span></span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <form className="block" onSubmit={save} noValidate>
        <Field label={t('panel.settings.retention')} hint={t('panel.settings.retentionHint')} error={err}>{(a) => <input className="input" inputMode="numeric" maxLength={3} value={days} onChange={(e) => setDays(e.target.value.replace(/\D/g, ''))} {...a} />}</Field>
        <Field label={t('panel.settings.stale')} hint={t('panel.settings.staleHint')}>{(a) => <input className="input" inputMode="numeric" maxLength={2} value={stale} onChange={(e) => setStale(e.target.value.replace(/\D/g, ''))} {...a} />}</Field>
        <div className="part-actions"><Btn type="submit" variant="ghost sm">{t('common.save')}</Btn><Btn variant="ghost sm" onClick={run}>{t('panel.settings.run')}</Btn></div>
      </form>

      <section className="block" aria-labelledby="h-tagset">
        <h3 id="h-tagset">{t('panel.settings.tagsTitle')}</h3>
        <p className="hint">{t('panel.settings.tagsHint', { n: String(NOTE_TAGS_MAX) })}</p>
        <div className="tags">
          {tags.map((tag) => <button key={tag} type="button" className="tag-btn tag-btn--rm" aria-label={t('panel.settings.tagRemove', { tag })} onClick={() => setTags(tags.filter((x) => x !== tag))}>{tag} <span aria-hidden="true">×</span></button>)}
        </div>
        <form onSubmit={addTag} noValidate className="tag-add">
          <Field label={t('panel.settings.tagNew')} error={tagErr ? t(`errors.${tagErr === 'too_short_tag' ? 'too_short_tag' : tagErr}`) : null}>{(a) => <input className="input" maxLength={40} value={newTag} onChange={(e) => setNewTag(e.target.value)} {...a} />}</Field>
          <Btn type="submit" variant="ghost sm">{t('common.add')}</Btn>
        </form>
        <div className="part-actions"><Btn variant="ghost sm" onClick={saveTags}>{t('panel.settings.tagsSave')}</Btn><Btn variant="ghost sm" onClick={resetTags}>{t('panel.settings.tagsReset')}</Btn></div>
      </section>

      <div className="block">
        <h3>{t('panel.settings.qr')}</h3>
        <div className="qr"><QR text={url} /><div><p className="hint">{t('panel.settings.qrHint')}</p><p><a href={`/consulta/${workshop.code}`} target="_blank" rel="noopener">{t('panel.settings.open')}</a></p></div></div>
      </div>
    </section>
  );
}
