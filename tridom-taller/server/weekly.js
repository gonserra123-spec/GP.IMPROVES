// Informe semanal por correo al dueño: coches reparados, en curso y atascados, comparado con la semana anterior.
// Todo sale de la base de datos del taller; las semanas van de lunes a domingo en la hora del taller.
import { getSettings, setSettings, workshopDb } from './db.js';
import { getWorkshop, listWorkshops } from './auth.js';
import { queueSummary } from './mail.js';
import { localDay, localHour } from './report.js';
import { formatPlate } from '../shared/plates.js';

export const WEEKLY_DEFAULTS = { weeklyOn: true, weeklyDay: 5, weeklyHour: 19, staleDays: 7 }; // viernes a las 19:00, atascado = 7 días
const DAY_MS = 86_400_000;
const noon = (d) => Date.parse(`${d}T12:00:00Z`);
const addDays = (d, n) => new Date(noon(d) + n * DAY_MS).toISOString().slice(0, 10);
const isoWeekday = (d) => { const w = new Date(noon(d)).getUTCDay(); return w === 0 ? 7 : w; }; // lunes 1 … domingo 7
const mondayOf = (d) => addDays(d, 1 - isoWeekday(d));
const inRange = (iso, a, b) => { if (!iso) return false; const d = localDay(iso); return d >= a && d <= b; };
const daysBetween = (a, b) => Math.round((noon(b) - noon(a)) / DAY_MS);
const mins = (a, b) => (a && b ? Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000)) : null);
const avg = (xs) => { const v = xs.filter((x) => x !== null); return v.length ? Math.round(v.reduce((s, x) => s + x, 0) / v.length) : null; };

const dayFmt = new Intl.DateTimeFormat('es-ES', { day: 'numeric', month: 'long', timeZone: 'UTC' });
const weekdayFmt = new Intl.DateTimeFormat('es-ES', { weekday: 'long', timeZone: 'UTC' });
const long = (d) => dayFmt.format(new Date(noon(d)));
const short = (d) => `${d.slice(8, 10)}/${d.slice(5, 7)}`;
const weekday = (d) => weekdayFmt.format(new Date(noon(d)));

export function fmtDuration(m) {
  if (m === null || m === undefined) return 'sin datos';
  if (m < 60) return `${m} min`;
  if (m < 1440) return `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, '0')} min`;
  return `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
const carName = (v) => [v.make, v.model].filter(Boolean).join(' ');
const line = (v, extra) => `- ${[formatPlate(v.plate), carName(v), extra].filter(Boolean).join(' · ')}`;

export function weeklyData(wid, now = new Date()) {
  const db = workshopDb(wid);
  const s = { ...WEEKLY_DEFAULTS, ...getSettings(db) };
  const today = localDay(now.toISOString());
  const start = mondayOf(today);
  const prevStart = addDays(start, -7); const prevEnd = addDays(today, -7); // la semana pasada, hasta el mismo día
  const all = db.prepare('SELECT * FROM visits ORDER BY received_at').all();
  const span = (a, b) => {
    const fin = all.filter((v) => inRange(v.finished_at, a, b));
    return {
      received: all.filter((v) => inRange(v.received_at, a, b)).length, finished: fin.length,
      avgTotalMin: avg(fin.map((v) => mins(v.received_at, v.finished_at))), avgWorkMin: avg(fin.map((v) => mins(v.in_progress_at, v.finished_at))),
    };
  };
  const history = [3, 2, 1, 0].map((i) => { const a = addDays(start, -7 * i); const b = i === 0 ? today : addDays(a, 6); return { from: a, to: b, ...span(a, b) }; });
  const open = all.filter((v) => v.state !== 'finished');
  const age = (v) => daysBetween(localDay(v.received_at), today);
  return {
    name: getWorkshop(wid).name, today, start, staleDays: s.staleDays,
    cur: span(start, today), prev: span(prevStart, prevEnd), history,
    repaired: all.filter((v) => inRange(v.finished_at, start, today)).sort((a, b) => a.finished_at.localeCompare(b.finished_at)),
    inProgress: open.filter((v) => v.state === 'in_progress'), waiting: open.filter((v) => v.state === 'received'),
    stale: open.filter((v) => age(v) >= s.staleDays).sort((a, b) => a.received_at.localeCompare(b.received_at)).map((v) => ({ ...v, days: age(v) })),
    age,
  };
}

const delta = (cur, prev) => `${cur} · semana pasada, hasta el mismo día: ${prev}`;
const cap = (arr, n = 25) => ({ shown: arr.slice(0, n), more: Math.max(0, arr.length - n) });

export function weeklyText(wid, now = new Date()) {
  const d = weeklyData(wid, now);
  const L = [`Resumen de la semana en ${d.name}`, `Del ${weekday(d.start)} ${long(d.start)} al ${weekday(d.today)} ${long(d.today)}`, ''];
  L.push('ESTA SEMANA');
  L.push(`- Coches que han entrado: ${delta(d.cur.received, d.prev.received)}`);
  L.push(`- Coches reparados (finalizados): ${delta(d.cur.finished, d.prev.finished)}`);
  L.push(`- Tiempo medio en el taller: ${fmtDuration(d.cur.avgTotalMin)}${d.prev.avgTotalMin !== null ? ` (semana pasada: ${fmtDuration(d.prev.avgTotalMin)})` : ''}`);
  L.push(`- Tiempo medio de trabajo: ${fmtDuration(d.cur.avgWorkMin)}${d.prev.avgWorkMin !== null ? ` (semana pasada: ${fmtDuration(d.prev.avgWorkMin)})` : ''}`);
  L.push('', 'ÚLTIMAS SEMANAS (entradas / finalizados)');
  for (const h of d.history) L.push(`- Semana del ${short(h.from)}${h.to === d.today ? ' (esta, hasta hoy)' : ''}: ${h.received} / ${h.finished}`);

  const rep = cap(d.repaired);
  L.push('', `REPARADOS ESTA SEMANA (${d.repaired.length})`);
  if (!d.repaired.length) L.push('- Ninguno todavía.');
  for (const v of rep.shown) L.push(line(v, `entró el ${short(localDay(v.received_at))}, listo el ${short(localDay(v.finished_at))}`));
  if (rep.more) L.push(`- … y ${rep.more} más (están en el Excel).`);

  const ip = cap(d.inProgress);
  L.push('', `EN CURSO AHORA (${d.inProgress.length})`);
  if (!d.inProgress.length) L.push('- Ninguno.');
  for (const v of ip.shown) L.push(line(v, `en curso desde el ${short(localDay(v.in_progress_at || v.received_at))} (${plural(d.age(v), 'día', 'días')} en el taller)`));
  if (ip.more) L.push(`- … y ${ip.more} más.`);

  const wt = cap(d.waiting);
  L.push('', `EN EL TALLER, SIN EMPEZAR (${d.waiting.length})`);
  if (!d.waiting.length) L.push('- Ninguno.');
  for (const v of wt.shown) L.push(line(v, `entró el ${short(localDay(v.received_at))} (${plural(d.age(v), 'día', 'días')})`));
  if (wt.more) L.push(`- … y ${wt.more} más.`);

  const st = cap(d.stale);
  L.push('', `ATENCIÓN: LLEVAN ${d.staleDays} DÍAS O MÁS SIN TERMINAR (${d.stale.length})`);
  if (!d.stale.length) L.push(`- Ninguno. Todo lo abierto entró hace menos de ${d.staleDays} días.`);
  for (const v of st.shown) L.push(line(v, `entró el ${short(localDay(v.received_at))} (${plural(v.days, 'día', 'días')}) · ${v.state === 'in_progress' ? 'en curso' : 'sin empezar'}`));
  if (st.more) L.push(`- … y ${st.more} más.`);

  L.push('', 'Este informe se envía solo cada semana. Puedes cambiar el día, la hora y a partir de cuántos días un coche se considera atascado en Ajustes.');
  return { subject: `Resumen de la semana · ${d.name}`, body: L.join('\n'), empty: !d.cur.received && !d.cur.finished && !d.inProgress.length && !d.waiting.length };
}

// Se llama cada minuto: una vez por semana, a partir del día y la hora elegidos. Si el servidor estuvo apagado, sale al volver.
export function runWeeklyReports(now = new Date()) {
  let queued = 0;
  for (const w of listWorkshops()) {
    if (w.status !== 'active') continue;
    const db = workshopDb(w.id);
    const s = { ...WEEKLY_DEFAULTS, ...getSettings(db) };
    if (!s.weeklyOn || !s.ownerEmail) continue;
    const today = localDay(now.toISOString());
    const week = mondayOf(today);
    if (s.lastWeekly === week) continue;
    const wd = isoWeekday(today);
    if (wd < s.weeklyDay || (wd === s.weeklyDay && localHour(now) < s.weeklyHour)) continue;
    const { subject, body, empty } = weeklyText(w.id, now);
    setSettings(db, { lastWeekly: week });
    if (empty) continue; // semana sin ningún movimiento: no se manda un correo vacío
    queueSummary(w.id, s.ownerEmail, subject, body, now.getTime());
    queued += 1;
  }
  return queued;
}

// Envío manual desde Ajustes (para ver cómo queda sin esperar al viernes).
export function sendWeeklyNow(wid, now = new Date()) {
  const to = getSettings(workshopDb(wid)).ownerEmail;
  if (!to) return { error: 'no_owner_email', status: 422 };
  const { subject, body } = weeklyText(wid, now);
  queueSummary(wid, to, subject, body, now.getTime());
  return { queued: true };
}
