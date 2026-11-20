// Coches del taller: alta con una sola matrícula o correo, los dos botones de progreso y «deshacer».
import { randomUUID } from 'node:crypto';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { UNDO_SECONDS } from './config.js';
import { getSettings, workshopDb, workshopDir } from './db.js';
import { cancelPending, queueVisitMail } from './mail.js';
import { localDay } from './report.js';
import { scheduleSync } from './sheets.js';
import { classifyPlate } from '../shared/plates.js';
import { cleanText, etaDate, isEmail, maskEmail, normEmail, parseQuery } from '../shared/rules.js';

const iso = (ms) => new Date(ms).toISOString();
const fail = (error, status = 409, extra = {}) => ({ error, status, ...extra });
const PHOTO_MAX = 900_000;

function lastMail(db, visitId) {
  return db.prepare("SELECT status FROM outbox WHERE visit_id = ? AND status != 'cancelled' ORDER BY created_at DESC LIMIT 1").get(visitId)?.status || null;
}
function dto(db, v) {
  const bad = db.prepare("SELECT 1 FROM outbox WHERE visit_id = ? AND status IN ('bounced','failed') LIMIT 1").get(v.id);
  return {
    id: v.id, plate: v.plate, email: maskEmail(v.email), make: v.make, model: v.model, state: v.state, eta: v.eta, photo: !!v.photo,
    receivedAt: v.received_at, inProgressAt: v.in_progress_at, finishedAt: v.finished_at, mail: lastMail(db, v.id), mailProblem: !!bad,
  };
}
const getVisit = (db, id) => db.prepare('SELECT * FROM visits WHERE id = ?').get(id);

// Lo que ve el cliente en su enlace: solo su coche, sin correo ni datos internos del taller.
export function trackInfo(wid, visitId) {
  const db = workshopDb(wid);
  const v = getVisit(db, visitId);
  if (!v) return null;
  const s = getSettings(db);
  return {
    plate: v.plate, make: v.make, model: v.model, state: v.state, eta: v.state === 'finished' ? null : v.eta,
    receivedAt: v.received_at, inProgressAt: v.in_progress_at, finishedAt: v.finished_at,
    phone: s.phone || '', hours: s.hours || '',
  };
}

// ---------- Búsqueda: matrícula o correo, con poner una sola cosa basta ----------
export function lookup(wid, raw) {
  const q = parseQuery(raw);
  const db = workshopDb(wid);
  if (q.kind === 'plate') {
    const c = db.prepare('SELECT plate, email, make, model FROM customers WHERE plate = ?').get(q.plate);
    return { kind: 'plate', plate: q.plate, matches: c ? [{ plate: c.plate, email: maskEmail(c.email), make: c.make, model: c.model }] : [] };
  }
  if (q.kind === 'email') {
    const rows = db.prepare('SELECT plate, email, make, model FROM customers WHERE email = ? ORDER BY updated_at DESC LIMIT 8').all(q.email);
    return { kind: 'email', email: q.email, matches: rows.map((c) => ({ plate: c.plate, email: maskEmail(c.email), make: c.make, model: c.model })) };
  }
  return { kind: q.kind, matches: [] };
}

function savePhoto(wid, visitId, dataUrl) {
  const m = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl || ''));
  if (!m) return false;
  const buf = Buffer.from(m[1], 'base64');
  if (!buf.length || buf.length > PHOTO_MAX || buf[0] !== 0xff || buf[1] !== 0xd8) return false; // solo JPEG real y pequeño
  const dir = join(workshopDir(wid), 'photos'); mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, `${visitId}.jpg`), buf);
  return true;
}
export const photoPath = (wid, visitId) => { const f = join(workshopDir(wid), 'photos', `${visitId}.jpg`); return /^[0-9a-f-]{36}$/.test(visitId) && existsSync(f) ? f : null; };

// ---------- Alta ----------
export function createVisit(wid, session, input, now = Date.now()) {
  const db = workshopDb(wid);
  const errors = {};
  let plate = null; let email = null; let make = cleanText(input.make, 40); let model = cleanText(input.model, 40);
  if (input.plate) { const q = parseQuery(input.plate); if (q.kind === 'plate') plate = q.plate; else errors.plate = 'plate_format'; }
  if (input.email) { const e = normEmail(input.email); if (isEmail(e)) email = e; else errors.email = 'email_format'; }
  if (Object.keys(errors).length) return fail('validation', 422, { errors });

  if (!plate && email) {
    const rows = db.prepare('SELECT plate, make, model FROM customers WHERE email = ?').all(email);
    if (rows.length > 1) return fail('ambiguous', 409);
    if (rows.length === 1) { plate = rows[0].plate; make = make || rows[0].make || ''; model = model || rows[0].model || ''; }
  }
  if (plate && !email) {
    const c = db.prepare('SELECT email, make, model FROM customers WHERE plate = ?').get(plate);
    if (c) { email = c.email; make = make || c.make; model = model || c.model; }
  }
  if (plate && !make && !model) { const c = db.prepare('SELECT make, model FROM customers WHERE plate = ?').get(plate); if (c) { make = c.make || ''; model = c.model || ''; } }
  if (!plate) errors.plate = 'required';
  if (!email) errors.email = 'required';
  if (Object.keys(errors).length) return fail('validation', 422, { errors });
  if (db.prepare("SELECT 1 FROM visits WHERE plate = ? AND state != 'finished'").get(plate)) return fail('plate_active', 409);

  const id = input.id && /^[0-9a-f-]{36}$/i.test(input.id) ? input.id : randomUUID();
  if (getVisit(db, id)) return { visit: dto(db, getVisit(db, id)), duplicate: true };
  const at = iso(now);
  const eta = ['today', 'tomorrow', 'plus2'].includes(input.eta) ? etaDate(input.eta, new Date(now)) : null;
  db.prepare('INSERT INTO visits (id, plate, email, make, model, state, eta, photo, received_at, created_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)')
    .run(id, plate, email, make || null, model || null, 'received', eta, 0, at, session.r);
  if (input.photo && savePhoto(wid, id, input.photo)) db.prepare('UPDATE visits SET photo = 1 WHERE id = ?').run(id);
  db.prepare('INSERT INTO customers (plate, email, make, model, updated_at) VALUES (?, ?, ?, ?, ?) ON CONFLICT(plate) DO UPDATE SET email = excluded.email, make = COALESCE(NULLIF(excluded.make, \'\'), make), model = COALESCE(NULLIF(excluded.model, \'\'), model), updated_at = excluded.updated_at')
    .run(plate, email, make || null, model || null, at);
  const ev = db.prepare('INSERT INTO events (visit_id, state, prev_state, at, by) VALUES (?, ?, NULL, ?, ?)').run(id, 'received', at, session.r);
  queueVisitMail(wid, getVisit(db, id), 'received', Number(ev.lastInsertRowid), now);
  scheduleSync(wid);
  return { visit: dto(db, getVisit(db, id)), eventId: Number(ev.lastInsertRowid) };
}

// ---------- Botones ----------
const NEXT = { received: ['in_progress', 'finished'], in_progress: ['finished'], finished: [] };
export function setState(wid, session, id, to, now = Date.now()) {
  const db = workshopDb(wid);
  const v = getVisit(db, id);
  if (!v) return fail('not_found', 404);
  if (!['in_progress', 'finished'].includes(to)) return fail('invalid', 400);
  if (v.state === to) return { visit: dto(db, v), unchanged: true };
  if (!NEXT[v.state].includes(to)) return fail('bad_transition', 409);
  const at = iso(now);
  db.prepare(`UPDATE visits SET state = ?, ${to}_at = ? WHERE id = ?`).run(to, at, id);
  const ev = db.prepare('INSERT INTO events (visit_id, state, prev_state, at, by) VALUES (?, ?, ?, ?, ?)').run(id, to, v.state, at, session.r);
  queueVisitMail(wid, getVisit(db, id), to, Number(ev.lastInsertRowid), now);
  scheduleSync(wid);
  return { visit: dto(db, getVisit(db, id)), eventId: Number(ev.lastInsertRowid) };
}

// Deshacer: solo mientras el correo de ese toque no haya salido (los segundos de margen).
export function undo(wid, session, id, now = Date.now()) {
  const db = workshopDb(wid);
  const v = getVisit(db, id);
  if (!v) return fail('not_found', 404);
  const ev = db.prepare('SELECT * FROM events WHERE visit_id = ? AND undone = 0 ORDER BY id DESC LIMIT 1').get(id);
  if (!ev) return fail('nothing_to_undo', 409);
  const mail = db.prepare("SELECT status FROM outbox WHERE event_id = ? AND status != 'cancelled'").get(ev.id);
  const inTime = now - Date.parse(ev.at) <= (UNDO_SECONDS + 5) * 1000;
  if (!inTime || (mail && !['pending', 'skipped_dup', 'skipped_unsub'].includes(mail.status))) return fail('too_late', 409);
  cancelPending(wid, 'event_id = ?', ev.id);
  if (ev.prev_state === null) {
    db.prepare("UPDATE outbox SET status = 'cancelled' WHERE visit_id = ? AND status IN ('pending')").run(id);
    db.prepare('DELETE FROM events WHERE visit_id = ?').run(id);
    db.prepare('DELETE FROM visits WHERE id = ?').run(id);
    const f = photoPath(wid, id); if (f) rmSync(f, { force: true });
    scheduleSync(wid);
    return { removed: true, id };
  }
  db.prepare(`UPDATE visits SET state = ?, ${ev.state}_at = NULL WHERE id = ?`).run(ev.prev_state, id);
  db.prepare('UPDATE events SET undone = 1 WHERE id = ?').run(ev.id);
  scheduleSync(wid);
  return { visit: dto(db, getVisit(db, id)) };
}

export function setEta(wid, id, choice) {
  const db = workshopDb(wid);
  const v = getVisit(db, id);
  if (!v) return fail('not_found', 404);
  if (choice !== null && !['today', 'tomorrow', 'plus2'].includes(choice)) return fail('invalid', 400);
  db.prepare('UPDATE visits SET eta = ? WHERE id = ?').run(choice ? etaDate(choice) : null, id);
  scheduleSync(wid);
  return { visit: dto(db, getVisit(db, id)) };
}

// Lista de hoy: lo que sigue abierto (aunque venga de ayer) y lo finalizado hoy.
export function listVisits(wid, now = Date.now()) {
  const db = workshopDb(wid);
  const today = localDay(iso(now));
  const rows = db.prepare('SELECT * FROM visits ORDER BY received_at DESC').all();
  return rows.filter((v) => v.state !== 'finished' || (v.finished_at && localDay(v.finished_at) === today)).map((v) => dto(db, v));
}

export const counts = (wid) => workshopDb(wid).prepare("SELECT COUNT(*) AS visits FROM visits").get();
export { classifyPlate };
