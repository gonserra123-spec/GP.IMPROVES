// Claves de acceso por taller, sesiones firmadas y límite de intentos.
import { createHmac, randomBytes, randomInt, randomUUID, timingSafeEqual } from 'node:crypto';
import { ADMIN_KEY, PROD, SECRET } from './config.js';
import { masterDb } from './db.js';

// Alfabeto sin I, O, 0 ni 1. 12 caracteres = 60 bits: no se adivina y es cómoda de teclear (XXXX-XXXX-XXXX).
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const newKey = () => { let k = ''; for (let i = 0; i < 12; i += 1) k += ALPHABET[randomInt(ALPHABET.length)]; return `${k.slice(0, 4)}-${k.slice(4, 8)}-${k.slice(8)}`; };
export const normKey = (v) => String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
export const isKeyShape = (v) => /^[A-HJ-NP-Z2-9]{12}$/.test(normKey(v));
export const hashKey = (key) => createHmac('sha256', SECRET).update(`key:${normKey(key)}`).digest('hex');

const safeEq = (a, b) => { const x = Buffer.from(String(a)); const y = Buffer.from(String(b)); return x.length === y.length && timingSafeEqual(x, y); };

// ---------- Talleres (base maestra) ----------
export function createWorkshop(name) {
  const db = masterDb();
  const id = randomBytes(8).toString('hex');
  const mech = newKey(); const owner = newKey();
  db.prepare('INSERT INTO workshops (id, name, status, mech_hash, owner_hash, mech_ver, owner_ver, created_at) VALUES (?, ?, ?, ?, ?, 1, 1, ?)')
    .run(id, String(name).trim().slice(0, 80), 'active', hashKey(mech), hashKey(owner), new Date().toISOString());
  return { id, mechanicKey: mech, ownerKey: owner };
}
export const getWorkshop = (id) => masterDb().prepare('SELECT id, name, status, mech_ver AS mechVer, owner_ver AS ownerVer, created_at AS createdAt FROM workshops WHERE id = ?').get(id) || null;
export const listWorkshops = () => masterDb().prepare('SELECT id, name, status, created_at AS createdAt FROM workshops ORDER BY created_at').all();
export function setStatus(id, status) {
  return masterDb().prepare('UPDATE workshops SET status = ? WHERE id = ?').run(status, id).changes > 0;
}
export function renameWorkshop(id, name) { return masterDb().prepare('UPDATE workshops SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 80), id).changes > 0; }
// Cambiar una clave invalida solo las sesiones abiertas con esa clave (sube la versión de ese rol).
export function regenerateKey(id, role) {
  const key = newKey();
  const [col, ver] = role === 'owner' ? ['owner_hash', 'owner_ver'] : ['mech_hash', 'mech_ver'];
  const r = masterDb().prepare(`UPDATE workshops SET ${col} = ?, ${ver} = ${ver} + 1 WHERE id = ?`).run(hashKey(key), id);
  return r.changes ? key : null;
}
// La clave identifica a la vez el taller y el rol: no hace falta teclear nada más.
export function findByKey(key) {
  if (!isKeyShape(key)) return null;
  const h = hashKey(key);
  const w = masterDb().prepare('SELECT id, name, status, mech_ver, owner_ver, mech_hash, owner_hash FROM workshops WHERE mech_hash = ? OR owner_hash = ?').get(h, h);
  if (!w) return null;
  const owner = w.owner_hash === h;
  return { workshop: { id: w.id, name: w.name, status: w.status, keyVer: owner ? w.owner_ver : w.mech_ver }, role: owner ? 'owner' : 'mechanic' };
}
export const adminKeyOk = (k) => !!ADMIN_KEY && typeof k === 'string' && safeEq(k, ADMIN_KEY);

// ---------- Sesión: cookie firmada ----------
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sign = (p) => createHmac('sha256', SECRET).update(`session:${p}`).digest('base64url');
const TTL = { mechanic: 12 * 3600_000, owner: 12 * 3600_000, admin: 2 * 3600_000 };
export function makeSession({ w, r, kv }) {
  const p = b64({ w, r, kv, exp: Date.now() + TTL[r], sid: randomUUID() });
  return `${p}.${sign(p)}`;
}
export function readSession(req) {
  const m = /(?:^|;\s*)tt_session=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [p, s] = m[1].split('.');
  if (!p || !s || !safeEq(sign(p), s)) return null;
  let d; try { d = JSON.parse(Buffer.from(p, 'base64url').toString('utf8')); } catch { return null; }
  if (!d || d.exp < Date.now()) return null;
  if (d.r === 'admin') return d;
  const w = getWorkshop(d.w);
  // Taller pausado o clave cambiada: la sesión deja de valer al instante.
  if (!w || w.status !== 'active' || (d.r === 'owner' ? w.ownerVer : w.mechVer) !== d.kv) return null;
  return { ...d, workshopName: w.name };
}
export function cookie(value, { secure, clear = false } = {}) {
  return `tt_session=${clear ? '' : value}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${clear ? 0 : 12 * 3600}${secure || PROD ? '; Secure' : ''}`;
}

// ---------- Límite de intentos ----------
export function createLimiter({ windowMs, max, lockMs = 0 }) {
  const hits = new Map(); const locks = new Map();
  return {
    hit(k, now = Date.now()) {
      if ((locks.get(k) || 0) > now) return { ok: false, retry: Math.ceil((locks.get(k) - now) / 1000) };
      const arr = (hits.get(k) || []).filter((t) => now - t < windowMs); arr.push(now); hits.set(k, arr);
      if (arr.length > max) { if (lockMs) locks.set(k, now + lockMs); return { ok: false, retry: Math.ceil((lockMs || windowMs) / 1000) }; }
      return { ok: true };
    },
    blocked(k, now = Date.now()) { return (locks.get(k) || 0) > now; },
    retryAfter(k, now = Date.now()) { return Math.max(0, Math.ceil(((locks.get(k) || 0) - now) / 1000)); },
    clear(k) { hits.delete(k); locks.delete(k); },
    reset() { hits.clear(); locks.clear(); },
  };
}
export const clientIp = (req) => (process.env.TRUST_PROXY === '1' ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || 'unknown';
