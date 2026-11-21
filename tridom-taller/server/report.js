// Datos para la hoja de cálculo, el Excel y el resumen: se calculan siempre desde la base (la hoja es solo una copia).
import { TIMEZONE } from './config.js';
import { workshopDb } from './db.js';
import { STATE_LABEL } from '../shared/rules.js';
import { formatPlate } from '../shared/plates.js';

const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: TIMEZONE, year: 'numeric', month: '2-digit', day: '2-digit' });
const timeFmt = new Intl.DateTimeFormat('es-ES', { timeZone: TIMEZONE, day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
export const localDay = (iso) => dayFmt.format(new Date(iso));
export const localTime = (iso) => (iso ? timeFmt.format(new Date(iso)) : '');
export const localHour = (d = new Date()) => Number(new Intl.DateTimeFormat('en-GB', { timeZone: TIMEZONE, hour: '2-digit', hour12: false }).format(d)) % 24;
const mins = (a, b) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);

export const COLUMNS = ['Matrícula', 'Correo del cliente', 'Modelo', 'Estado', 'Entrada', 'En curso', 'Finalizado', 'Minutos en taller', 'Minutos de trabajo', 'Entrega prevista'];

export function carRows(wid) {
  const rows = workshopDb(wid).prepare('SELECT * FROM visits ORDER BY received_at DESC').all();
  return rows.map((v) => [
    formatPlate(v.plate), v.email, [v.make, v.model].filter(Boolean).join(' '), STATE_LABEL[v.state],
    localTime(v.received_at), localTime(v.in_progress_at), localTime(v.finished_at),
    mins(v.received_at, v.finished_at) ?? '', mins(v.in_progress_at, v.finished_at) ?? '', v.eta || '',
  ]);
}

export function stats(wid, now = new Date()) {
  const db = workshopDb(wid);
  const all = db.prepare('SELECT state, received_at, in_progress_at, finished_at FROM visits').all();
  const today = localDay(now.toISOString());
  const avg = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : null);
  const fin = all.filter((v) => v.finished_at);
  const byDay = new Map();
  for (const v of all) {
    for (const [k, at] of [['received', v.received_at], ['finished', v.finished_at]]) {
      if (!at) continue;
      const d = localDay(at); const e = byDay.get(d) || { date: d, received: 0, finished: 0, totals: [], works: [] };
      e[k] += 1;
      if (k === 'finished') { const t = mins(v.received_at, v.finished_at); const w = mins(v.in_progress_at, v.finished_at); if (t !== null) e.totals.push(t); if (w !== null) e.works.push(w); }
      byDay.set(d, e);
    }
  }
  const days = [...byDay.values()].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14)
    .map((e) => ({ date: e.date, received: e.received, finished: e.finished, avgTotalMin: avg(e.totals), avgWorkMin: avg(e.works) }));
  return {
    today: { received: all.filter((v) => localDay(v.received_at) === today).length, finished: all.filter((v) => v.finished_at && localDay(v.finished_at) === today).length },
    pending: all.filter((v) => v.state !== 'finished').length,
    inProgress: all.filter((v) => v.state === 'in_progress').length,
    avgTotalMin: avg(fin.map((v) => mins(v.received_at, v.finished_at)).filter((x) => x !== null)),
    avgWorkMin: avg(fin.map((v) => mins(v.in_progress_at, v.finished_at)).filter((x) => x !== null)),
    finishedCount: fin.length, days,
  };
}

export const TIMES_COLUMNS = ['Día', 'Entradas', 'Finalizados', 'Media en taller (min)', 'Media de trabajo (min)'];
export const timesRows = (wid) => stats(wid).days.map((d) => [d.date, d.received, d.finished, d.avgTotalMin ?? '', d.avgWorkMin ?? '']);

// ---------- Por periodos: hoy, este mes y este año, cada uno comparado con el anterior hasta la misma altura ----------
export const PERIODS = ['day', 'month', 'year'];
const noon = (d) => Date.parse(`${d}T12:00:00Z`);
const addDays = (d, n) => new Date(noon(d) + n * 86_400_000).toISOString().slice(0, 10);
const lastDay = (y, m) => new Date(Date.UTC(y, m, 0)).getUTCDate(); // m = 1..12
const pad = (n) => String(n).padStart(2, '0');
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const longDay = (d) => `${Number(d.slice(8, 10))} de ${MONTHS[Number(d.slice(5, 7)) - 1]} de ${d.slice(0, 4)}`;

export function periodStats(wid, period, now = new Date()) {
  const p = PERIODS.includes(period) ? period : 'day';
  const today = localDay(now.toISOString());
  const y = Number(today.slice(0, 4)); const m = Number(today.slice(5, 7)); const dd = Number(today.slice(8, 10));
  let from; let prevFrom; let prevTo; let label; let prevLabel;
  if (p === 'day') { from = today; prevFrom = prevTo = addDays(today, -1); label = `Hoy, ${longDay(today)}`; prevLabel = 'ayer'; }
  else if (p === 'month') {
    from = `${y}-${pad(m)}-01`; const py = m === 1 ? y - 1 : y; const pm = m === 1 ? 12 : m - 1;
    prevFrom = `${py}-${pad(pm)}-01`; prevTo = `${py}-${pad(pm)}-${pad(Math.min(dd, lastDay(py, pm)))}`;
    label = `${MONTHS[m - 1][0].toUpperCase()}${MONTHS[m - 1].slice(1)} de ${y}`; prevLabel = `${MONTHS[pm - 1]} hasta el día ${Math.min(dd, lastDay(py, pm))}`;
  } else {
    from = `${y}-01-01`; prevFrom = `${y - 1}-01-01`; prevTo = `${y - 1}-${pad(m)}-${pad(Math.min(dd, lastDay(y - 1, m)))}`;
    label = `Año ${y}`; prevLabel = `${y - 1} hasta la misma fecha`;
  }
  const all = workshopDb(wid).prepare('SELECT * FROM visits').all();
  const avg = (xs) => { const v = xs.filter((x) => x !== null); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };
  const inR = (iso, a, b) => { if (!iso) return false; const d = localDay(iso); return d >= a && d <= b; };
  const span = (a, b) => {
    const fin = all.filter((v) => inR(v.finished_at, a, b));
    return { received: all.filter((v) => inR(v.received_at, a, b)).length, finished: fin.length, avgTotalMin: avg(fin.map((v) => mins(v.received_at, v.finished_at))), avgWorkMin: avg(fin.map((v) => mins(v.in_progress_at, v.finished_at))) };
  };
  // Desglose: por horas (hoy), por días (mes) o por meses (año).
  const key = { day: (iso) => String(localHour(new Date(iso))).padStart(2, '0'), month: (iso) => localDay(iso), year: (iso) => localDay(iso).slice(0, 7) }[p];
  const buckets = new Map();
  const bump = (iso, k) => { if (!iso || !inR(iso, from, today)) return; const b = key(iso); const e = buckets.get(b) || { received: 0, finished: 0 }; e[k] += 1; buckets.set(b, e); };
  for (const v of all) { bump(v.received_at, 'received'); bump(v.finished_at, 'finished'); }
  let rows;
  if (p === 'month') rows = [...buckets.keys()].sort().map((k) => [k, `${i2(k)} de ${MONTHS[m - 1]}`]); // solo los días con movimiento
  else if (p === 'year') rows = Array.from({ length: m }, (_, i) => `${y}-${pad(i + 1)}`).map((k) => [k, MONTHS[Number(k.slice(5, 7)) - 1]]);
  else rows = [...buckets.keys()].sort().map((k) => [k, `${k}:00`]);
  return {
    period: p, label, prevLabel, from, to: today, cur: span(from, today), prev: span(prevFrom, prevTo),
    open: { pending: all.filter((v) => v.state !== 'finished').length, inProgress: all.filter((v) => v.state === 'in_progress').length },
    buckets: rows.map(([k, name]) => ({ key: k, label: name, received: buckets.get(k)?.received || 0, finished: buckets.get(k)?.finished || 0 })),
  };
}
const i2 = (d) => String(Number(d.slice(8, 10)));
