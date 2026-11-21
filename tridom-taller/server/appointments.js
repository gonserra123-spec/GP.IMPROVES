// Citas que pide el cliente desde la web del taller (app aparte: tridom-citas). Aquí solo se guardan y se convierten en coche cuando llega.
import { randomUUID } from 'node:crypto';
import { workshopDb } from './db.js';
import { queueAppointmentMail } from './mail.js';
import { createVisit, visitById } from './visits.js';
import { cleanText, isEmail, maskEmail, normEmail, parseQuery } from '../shared/rules.js';

const iso = (ms) => new Date(ms).toISOString();
const fail = (error, status = 400, extra = {}) => ({ error, status, ...extra });
const DAY = 86_400_000;
export const MIN_FILL_MS = 1500; // un formulario relleno en menos de esto lo ha hecho un programa

export function validateBooking(input) {
  const errors = {};
  const name = cleanText(input.name, 80);
  if (name.length < 2) errors.name = 'required';
  const q = parseQuery(input.plate);
  if (q.kind !== 'plate') errors.plate = 'plate_format';
  const email = normEmail(input.email);
  if (!isEmail(email)) errors.email = 'email_format';
  const phone = cleanText(input.phone, 24);
  if (phone && !/^[+\d\s().-]{6,24}$/.test(phone)) errors.phone = 'phone_format';
  const problem = cleanText(input.problem, 600);
  if (problem.length < 5) errors.problem = 'problem_short';
  if (input.consent !== true) errors.consent = 'required';
  if (Object.keys(errors).length) return { errors };
  return { data: { name, plate: q.plate, email, phone, problem } };
}

// Entrada pública. Responde igual aunque descarte el envío de un programa, para no dar pistas.
export function submitBooking(wid, input, now = Date.now()) {
  if ((typeof input.website === 'string' && input.website.trim()) || !(Number(input.elapsed) >= MIN_FILL_MS)) return { ok: true, ignored: true };
  const v = validateBooking(input);
  if (v.errors) return fail('validation', 422, { errors: v.errors });
  const { name, plate, email, phone, problem } = v.data;
  const db = workshopDb(wid);
  const since = iso(now - DAY);
  if (db.prepare('SELECT COUNT(*) AS c FROM appointments WHERE email = ? AND created_at > ?').get(email, since).c >= 3) return fail('too_many', 429);
  if (db.prepare('SELECT COUNT(*) AS c FROM appointments WHERE created_at > ?').get(since).c >= 100) return fail('busy', 429);
  const at = iso(now);
  const same = db.prepare("SELECT id FROM appointments WHERE status = 'requested' AND plate = ? AND email = ?").get(plate, email);
  if (same) { // la misma persona corrige su solicitud: se actualiza, no se duplica ni se vuelve a escribir
    db.prepare('UPDATE appointments SET name = ?, phone = ?, problem = ?, updated_at = ? WHERE id = ?').run(name, phone || null, problem, at, same.id);
    return { ok: true, duplicate: true };
  }
  const id = randomUUID();
  db.prepare('INSERT INTO appointments (id, name, plate, email, phone, problem, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, name, plate, email, phone || null, problem, 'requested', at, at);
  queueAppointmentMail(wid, { id, name, plate, email, problem }, now);
  return { ok: true };
}

export function listAppointments(wid) {
  return workshopDb(wid).prepare("SELECT * FROM appointments WHERE status = 'requested' ORDER BY created_at").all()
    .map((a) => ({ id: a.id, name: a.name, plate: a.plate, email: maskEmail(a.email), phone: a.phone || '', problem: a.problem, createdAt: a.created_at }));
}

// «Ha llegado»: la cita pasa a ser un coche en el taller (con su aviso de entrada) y el motivo viaja con él.
export function arriveAppointment(wid, session, id, now = Date.now()) {
  const db = workshopDb(wid);
  const a = db.prepare("SELECT * FROM appointments WHERE id = ? AND status = 'requested'").get(id);
  if (!a) return fail('not_found', 404);
  const r = createVisit(wid, session, { plate: a.plate, email: a.email }, now);
  if (r.error) return r;
  db.prepare('UPDATE visits SET problem = ?, customer_name = ?, phone = ? WHERE id = ?').run(a.problem, a.name, a.phone, r.visit.id);
  db.prepare("UPDATE appointments SET status = 'arrived', visit_id = ?, updated_at = ? WHERE id = ?").run(r.visit.id, iso(now), id);
  return { visit: visitById(wid, r.visit.id), eventId: r.eventId, appointmentId: id };
}

export function dismissAppointment(wid, id, now = Date.now()) {
  const done = workshopDb(wid).prepare("UPDATE appointments SET status = 'dismissed', updated_at = ? WHERE id = ? AND status = 'requested'").run(iso(now), id).changes;
  return done ? { dismissed: true } : fail('not_found', 404);
}
