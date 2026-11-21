// Resumen diario por correo al dueño: coches recogidos, finalizados y pendientes.
import { getSettings, setSettings, workshopDb } from './db.js';
import { getWorkshop, listWorkshops } from './auth.js';
import { queueSummary } from './mail.js';
import { localDay, localHour, stats } from './report.js';
import { formatPlate } from '../shared/plates.js';

export function summaryText(wid, now = new Date()) {
  const w = getWorkshop(wid);
  const s = stats(wid, now);
  const open = workshopDb(wid).prepare("SELECT plate, state FROM visits WHERE state != 'finished' ORDER BY received_at").all();
  const lines = [
    `Resumen de hoy en ${w.name}`, '',
    `Coches que han entrado: ${s.today.received}`,
    `Coches finalizados: ${s.today.finished}`,
    `Siguen en el taller: ${s.pending} (${s.inProgress} en curso)`,
  ];
  if (open.length) { lines.push('', 'Pendientes:'); for (const v of open.slice(0, 30)) lines.push(`- ${formatPlate(v.plate)} · ${v.state === 'in_progress' ? 'en curso' : 'en el taller'}`); }
  if (s.avgTotalMin !== null) lines.push('', `Tiempo medio en el taller (histórico): ${s.avgTotalMin} min`);
  return { subject: `Resumen del día · ${w.name}`, body: lines.join('\n') };
}

// Se llama cada minuto: envía una sola vez al día, a partir de la hora elegida por el dueño.
export function runDailySummaries(now = new Date()) {
  let queued = 0;
  for (const w of listWorkshops()) {
    if (w.status !== 'active') continue;
    const db = workshopDb(w.id);
    const s = getSettings(db);
    if (!s.summaryOn || !s.ownerEmail) continue;
    const today = localDay(now.toISOString());
    if (s.lastSummary === today || localHour(now) < (s.summaryHour ?? 19)) continue;
    const { subject, body } = summaryText(w.id, now);
    queueSummary(w.id, s.ownerEmail, subject, body, now.getTime());
    setSettings(db, { lastSummary: today });
    queued += 1;
  }
  return queued;
}
