import { useCallback, useEffect, useMemo, useState } from 'react';
import catalog from '../../shared/models.json';
import { MAX_IMPORT_ROWS, validateImportRow } from '../../shared/customers.js';
import { parseCsv } from '../../shared/csv.js';
import { useT } from '../i18n/index.jsx';
import { Btn, Plate } from '../components/ui.jsx';
import { usePanel } from '../data/panelStore.js';
import { getAdapter } from '../data/adapter.js';

// Citas que han reservado los clientes desde la web. «Ha llegado» da de alta el coche con un toque.
export function Appointments({ onOpen }) {
  const { t, date } = useT();
  const tick = usePanel((s) => s.apptTick);
  const [list, setList] = useState([]);
  const [busy, setBusy] = useState(null);
  const load = useCallback(async () => {
    try { const r = await (await getAdapter()).listAppointments(); if (r.ok) setList(r.appointments); } catch { /* sin conexión: se mantiene la lista */ }
  }, []);
  useEffect(() => { load(); }, [load, tick]);

  const act = async (a, kind) => {
    setBusy(a.id);
    try {
      const api = await getAdapter();
      const r = await (kind === 'arrive' ? api.arriveAppointment(a.id) : api.cancelAppointment(a.id));
      if (r.ok) {
        usePanel.getState().toast('ok', kind === 'arrive' ? 'panel.appts.arrived' : 'panel.appts.cancelled', { plate: a.plate });
        if (kind === 'arrive') { await usePanel.getState().reload(); if (r.vehicle) onOpen(r.vehicle.id); }
      } else usePanel.getState().toast('error', `errors.${r.error === 'plate_exists' ? 'plate_exists' : r.error === 'workshop_full' ? 'workshop_full' : 'generic'}`);
    } catch { usePanel.getState().toast('error', 'errors.network'); }
    setBusy(null); load();
  };

  if (!list.length) return null;
  return (
    <section className="panel-card appts" aria-labelledby="h-appts">
      <h2 id="h-appts">{t('panel.appts.title')} <span className="mini-tag">{list.length}</span></h2>
      <ul className="appt-list">
        {list.map((a) => (
          <li key={a.id} className="appt">
            <div className="appt-top"><Plate value={a.plate} /><span className="when">{date(a.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {t(`cita.slots.${a.slot}`)}</span></div>
            <p className="appt-car">{a.make} {a.model}</p>
            <p className="appt-reason">{a.reason}</p>
            <p className="hint">{a.emailMasked || t('panel.appts.noEmail')}{a.hasPhone ? ` · ${t('panel.detail.phoneMasked', { last4: a.phoneLast4 })}` : ''}</p>
            <div className="part-actions">
              <Btn variant="sm" disabled={busy === a.id} onClick={() => act(a, 'arrive')}>{t('panel.appts.arrive')}</Btn>
              <Btn variant="ghost sm" disabled={busy === a.id} onClick={() => act(a, 'cancel')}>{t('panel.appts.cancel')}</Btn>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

const TEMPLATE_CSV = 'matricula;marca;modelo;telefono;email\n1234BCD;Seat;León;600123456;cliente@ejemplo.com\n5678FGH;Renault;Clio;;\n';

// Clientes habituales del taller: se sube la exportación de su programa de gestión y la app los reconoce por matrícula.
export function Customers({ onBack }) {
  const { t } = useT();
  const workshop = usePanel((s) => s.workshop);
  const [sum, setSum] = useState(null);
  const [parsed, setParsed] = useState(null); // { name, rows, columns, error }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/cita/${workshop.code}`;

  useEffect(() => { getAdapter().then((a) => a.customersSummary()).then((r) => { if (r.ok) setSum(r); }).catch(() => {}); }, [result]);

  const checked = useMemo(() => {
    if (!parsed || parsed.error) return null;
    const ok = []; const bad = [];
    for (const raw of parsed.rows) { const r = validateImportRow(raw, catalog); (r.ok ? ok : bad).push({ raw, r }); }
    return { ok, bad };
  }, [parsed]);

  const pick = async (e) => {
    const f = e.target.files?.[0]; setResult(null); setParsed(null);
    if (!f) return;
    if (f.size > 350_000) { setParsed({ name: f.name, rows: [], columns: [], error: 'too_big' }); return; }
    setParsed({ name: f.name, ...parseCsv(await f.text(), { max: MAX_IMPORT_ROWS }) });
  };
  const run = async () => {
    setBusy(true);
    try {
      const r = await (await getAdapter()).importCustomers(checked.ok.map((x) => x.raw));
      setResult(r.ok ? r : { error: true });
      if (r.ok) setParsed(null);
    } catch { setResult({ error: true }); }
    setBusy(false);
  };
  const copy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* sin portapapeles */ } };
  const download = () => {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿', TEMPLATE_CSV], { type: 'text/csv' })); a.download = 'plantilla-clientes.csv'; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <article className="panel-card customers">
      <div className="detail-head"><button type="button" className="icon-btn" onClick={onBack} aria-label={t('common.back')}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6" /></svg></button><h2 className="grow">{t('panel.customers.title')}</h2></div>
      {sum && <div className="stats">
        <div className="stat"><b>{sum.count}</b><span>{t('panel.customers.count')}</span></div>
        <div className="stat"><b>{sum.withEmail}</b><span>{t('panel.customers.withEmail')}</span></div>
        <div className="stat"><b>{sum.withPhone}</b><span>{t('panel.customers.withPhone')}</span></div>
      </div>}

      <section className="block" aria-labelledby="h-link">
        <h3 id="h-link">{t('panel.customers.linkTitle')}</h3>
        <p className="hint">{t('panel.customers.linkHint')}</p>
        <code className="cita-link">{link}</code>
        <div className="part-actions"><Btn variant="ghost sm" onClick={copy}>{copied ? t('panel.customers.copied') : t('panel.customers.copy')}</Btn><Btn variant="ghost sm" to={`/cita/${workshop.code}`}>{t('panel.customers.open')}</Btn></div>
      </section>

      <section className="block" aria-labelledby="h-imp">
        <h3 id="h-imp">{t('panel.customers.importTitle')}</h3>
        <p className="hint">{t('panel.customers.importHint')}</p>
        <div className="part-actions"><Btn variant="ghost sm" onClick={download}>{t('panel.customers.template')}</Btn></div>
        <label className="file-pick">
          <span className="btn btn--sm">{t('panel.customers.choose')}</span>
          <input type="file" accept=".csv,.tsv,.txt,text/csv,text/plain" onChange={pick} />
          <span className="hint">{parsed?.name || t('panel.customers.noFile')}</span>
        </label>

        {parsed?.error && <p className="notice notice--error" role="alert">{t(`panel.customers.err.${parsed.error}`, { n: String(MAX_IMPORT_ROWS) })}</p>}
        {checked && (
          <div className="import-prev" aria-live="polite">
            <p><strong>{t('panel.customers.ready', { n: String(checked.ok.length) })}</strong>{checked.bad.length > 0 && <> · <span className="late">{t('panel.customers.problems', { n: String(checked.bad.length) })}</span></>}</p>
            <p className="hint">{t('panel.customers.columns', { list: parsed.columns.map((c) => t(`panel.customers.col.${c}`)).join(', ') })}</p>
            <table className="import-table">
              <thead><tr><th>{t('panel.customers.col.plate')}</th><th>{t('panel.customers.col.vehicle')}</th><th>{t('panel.customers.col.email')}</th></tr></thead>
              <tbody>{checked.ok.slice(0, 5).map(({ r }) => <tr key={r.row.plate}><td><Plate value={r.row.plate} /></td><td>{r.row.make} {r.row.model}</td><td>{r.row.email || '—'}</td></tr>)}</tbody>
            </table>
            {checked.bad.length > 0 && (
              <details className="import-bad"><summary>{t('panel.customers.seeProblems')}</summary>
                <ul>{checked.bad.slice(0, 20).map(({ raw, r }) => <li key={raw.line}>{t('panel.customers.line', { n: String(raw.line) })}: {Object.values(r.errors).map((e) => t(`errors.${e}`)).join(' ')}</li>)}</ul>
              </details>
            )}
            <Btn disabled={busy || !checked.ok.length} onClick={run}>{busy ? t('common.loading') : t('panel.customers.run', { n: String(checked.ok.length) })}</Btn>
          </div>
        )}
        {result && !result.error && <p className="notice notice--ok" role="status">{t('panel.customers.done', { c: String(result.created), u: String(result.updated), r: String(result.rejected || 0) })}</p>}
        {result?.error && <p className="notice notice--error" role="alert">{t('errors.generic')}</p>}
        <p className="hint">{t('panel.customers.legal')}</p>
      </section>
    </article>
  );
}
