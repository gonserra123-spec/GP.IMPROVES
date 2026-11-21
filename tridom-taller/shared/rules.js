// Reglas comunes a servidor y navegador: estados, validación y plantillas de correo por defecto.
import { classifyPlate, normalizePlate } from './plates.js';

export const STATES = ['received', 'in_progress', 'finished'];
export const STATE_LABEL = { received: 'En el taller', in_progress: 'En curso', finished: 'Finalizado' };
export const ETA_CHOICES = ['today', 'tomorrow', 'plus2'];

export const cleanText = (v, max = 200) => String(v ?? '').replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);
export const normEmail = (v) => cleanText(v, 254).toLowerCase();

// Lo que escribe el mecánico en un solo campo: matrícula o correo.
export function parseQuery(raw) {
  const s = cleanText(raw, 254);
  if (!s) return { kind: null };
  if (s.includes('@')) { const email = s.toLowerCase(); return isEmail(email) ? { kind: 'email', email } : { kind: 'email_invalid' }; }
  const plate = normalizePlate(s);
  return classifyPlate(plate) ? { kind: 'plate', plate } : { kind: 'plate_invalid' };
}

export const maskEmail = (e) => { const [u, d] = String(e).split('@'); return d ? `${u.slice(0, 1)}***@${d}` : ''; };

export function etaDate(choice, from = new Date()) {
  const add = choice === 'today' ? 0 : choice === 'tomorrow' ? 1 : choice === 'plus2' ? 2 : null;
  if (add === null) return null;
  const d = new Date(from.getTime() + add * 86_400_000);
  return d.toISOString().slice(0, 10);
}

export const DEFAULT_TEMPLATES = {
  received: {
    subject: 'Tu coche ya está en {taller}',
    body: 'Hola,\n\nTu coche {matricula}{modelo} ya está en {taller}.\n{entrega}\nTe avisaremos en cuanto empecemos a trabajar en él.',
  },
  in_progress: {
    subject: 'Estamos trabajando en tu coche ({matricula})',
    body: 'Hola,\n\nEn {taller} ya estamos trabajando en tu coche {matricula}{modelo}.\n{entrega}\nTe escribiremos de nuevo cuando esté listo.',
  },
  finished: {
    subject: 'Tu coche está listo, puedes pasar a recogerlo ({matricula})',
    body: 'Hola,\n\nTu coche {matricula}{modelo} está listo, puedes pasar a recogerlo por {taller}.\n{horario}\nGracias por confiar en nosotros.',
  },
};
export const PLACEHOLDERS = ['{taller}', '{matricula}', '{modelo}', '{entrega}', '{telefono}', '{horario}'];

const LONG_DATE = new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
// Rellena la plantilla. Las líneas con un dato vacío (entrega, horario) desaparecen en vez de dejar un hueco.
export function renderTemplate(tpl, ctx) {
  const vars = {
    taller: ctx.workshop,
    matricula: ctx.plateText,
    modelo: ctx.model ? ` (${ctx.model})` : '',
    entrega: ctx.eta ? `Entrega prevista: ${LONG_DATE.format(new Date(`${ctx.eta}T12:00:00Z`))}.` : '',
    telefono: ctx.phone ? `Teléfono: ${ctx.phone}` : '',
    horario: ctx.hours ? `Horario: ${ctx.hours}` : '',
  };
  const fill = (s) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
  const subject = fill(tpl.subject).replace(/\s+/g, ' ').trim();
  const lines = String(tpl.body).split('\n').map((l) => ({ raw: l, out: fill(l) }));
  const body = lines.filter((l) => !(l.out.trim() === '' && /\{(entrega|horario|telefono)\}/.test(l.raw))).map((l) => l.out).join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return { subject, body };
}

export function validateTemplates(input) {
  const errors = {};
  for (const k of STATES) {
    const t = input?.[k];
    if (!t || typeof t.subject !== 'string' || typeof t.body !== 'string') { errors[k] = 'invalid'; continue; }
    if (cleanText(t.subject, 200).length < 5) errors[k] = 'subject_short';
    else if (t.body.trim().length < 15 || t.body.length > 2000) errors[k] = 'body_length';
  }
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateSettings(input) {
  const errors = {};
  if (input.phone !== undefined && !/^[+\d\s().-]{0,24}$/.test(input.phone)) errors.phone = 'invalid';
  if (input.hours !== undefined && cleanText(input.hours, 200).length > 120) errors.hours = 'too_long';
  for (const k of ['replyTo', 'ownerEmail']) if (input[k] !== undefined && input[k] !== '' && !isEmail(normEmail(input[k]))) errors[k] = 'email_format';
  if (input.summaryHour !== undefined && !(Number.isInteger(input.summaryHour) && input.summaryHour >= 0 && input.summaryHour <= 23)) errors.summaryHour = 'invalid';
  if (input.summaryOn !== undefined && typeof input.summaryOn !== 'boolean') errors.summaryOn = 'invalid';
  if (input.weeklyOn !== undefined && typeof input.weeklyOn !== 'boolean') errors.weeklyOn = 'invalid';
  if (input.weeklyDay !== undefined && !(Number.isInteger(input.weeklyDay) && input.weeklyDay >= 1 && input.weeklyDay <= 7)) errors.weeklyDay = 'invalid';
  if (input.weeklyHour !== undefined && !(Number.isInteger(input.weeklyHour) && input.weeklyHour >= 0 && input.weeklyHour <= 23)) errors.weeklyHour = 'invalid';
  if (input.staleDays !== undefined && !(Number.isInteger(input.staleDays) && input.staleDays >= 2 && input.staleDays <= 60)) errors.staleDays = 'invalid';
  if (input.sheetId !== undefined && input.sheetId !== '' && !/^[A-Za-z0-9_-]{20,80}$/.test(input.sheetId)) errors.sheetId = 'invalid';
  if (input.templates !== undefined) { const v = validateTemplates(input.templates); if (!v.ok) errors.templates = v.errors; }
  return { ok: Object.keys(errors).length === 0, errors };
}
