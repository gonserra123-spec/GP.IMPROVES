// Tareas en segundo plano: salida de correos (tras los segundos de «deshacer») y resumen diario.
import { processOutbox } from './mail.js';
import { runDailySummaries } from './summary.js';
import { runWeeklyReports } from './weekly.js';

let started = false;
export function startWorkers() {
  if (started) return;
  started = true;
  setInterval(() => processOutbox().catch((e) => console.error('outbox:', e?.message)), 2000).unref();
  setInterval(() => {
    try { runDailySummaries(); } catch (e) { console.error('resumen:', e?.message); }
    try { runWeeklyReports(); } catch (e) { console.error('informe semanal:', e?.message); }
  }, 60_000).unref();
}
