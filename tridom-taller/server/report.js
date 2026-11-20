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
