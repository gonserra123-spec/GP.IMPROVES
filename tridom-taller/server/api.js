// API. Un mecánico solo toca coches y botones; el dueño ve además envíos, tiempos y ajustes;
// el administrador (nosotros) da de alta talleres. Cada petición trabaja solo con la base de su taller.
import { setTimeout as sleep } from 'node:timers/promises';
import { ADMIN_KEY, CITAS_URL, MAIL } from './config.js';
import { getSettings, setSettings, workshopDb } from './db.js';
import {
  adminKeyOk, clientIp, cookie, createLimiter, createWorkshop, findByKey, getWorkshop, listWorkshops, makeSession, needsRenewal, readSession,
  regenerateKey, renameWorkshop, setStatus,
} from './auth.js';
import { arriveAppointment, dismissAppointment, listAppointments, submitBooking } from './appointments.js';
import { applyWebhookEvent, readTrackToken, readUnsubToken, recentMail, sendTest, unsubscribe, verifyWebhook } from './mail.js';
import { periodStats, stats } from './report.js';
import { exportXlsx, serviceAccountEmail, sheetsConfigured, syncSheet } from './sheets.js';
import { runDailySummaries, summaryText } from './summary.js';
import { WEEKLY_DEFAULTS, sendWeeklyNow, weeklyText } from './weekly.js';
import { counts, createVisit, listVisits, lookup, photoPath, setEta, setState, trackInfo, undo } from './visits.js';
import { DEFAULT_TEMPLATES, cleanText, maskEmail, normEmail, validateSettings } from '../shared/rules.js';
import { readFileSync } from 'node:fs';

const MIN = 60_000;
const limits = {
  loginIp: createLimiter({ windowMs: 5 * MIN, max: 4, lockMs: 15 * MIN }), // al 5.º fallo seguido se bloquea
  apiIp: createLimiter({ windowMs: MIN, max: 600 }),
  publicIp: createLimiter({ windowMs: MIN, max: 30 }),
  mailTest: createLimiter({ windowMs: 10 * MIN, max: 5 }),
  booking: createLimiter({ windowMs: 10 * MIN, max: 5 }), // citas pedidas desde una misma conexión
};
export const resetLimits = () => Object.values(limits).forEach((l) => l.reset());

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}
async function readBody(req, max = 16_384) {
  let size = 0; const chunks = [];
  for await (const c of req) { size += c.length; if (size > max) return { error: 'too_big' }; chunks.push(c); }
  const raw = Buffer.concat(chunks).toString('utf8');
  const type = req.headers['content-type'] || '';
  if (/^application\/json\b/i.test(type)) { try { const v = JSON.parse(raw || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? { json: v, raw } : { error: 'invalid' }; } catch { return { error: 'invalid' }; } }
  if (/^application\/x-www-form-urlencoded\b/i.test(type)) return { json: Object.fromEntries(new URLSearchParams(raw)), raw };
  return { error: 'invalid' };
}
// Peticiones que cambian algo: mismo origen y cabecera propia.
function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  try { if (new URL(origin).host !== req.headers.host) return false; } catch { return false; }
  return req.headers['x-requested-with'] === 'tridom-taller';
}
const isSecure = (req) => !!req.socket.encrypted || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https');
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

// Idempotencia de la cola sin conexión: la misma operación repetida devuelve la misma respuesta.
function withOp(wid, body, fn) {
  const db = workshopDb(wid);
  const opId = typeof body.opId === 'string' && UUID.test(body.opId) ? body.opId : null;
  if (opId) { const seen = db.prepare('SELECT result FROM ops WHERE op_id = ?').get(opId); if (seen) return { ...JSON.parse(seen.result), replay: true }; }
  const r = fn();
  if (opId && !r.error) {
    db.prepare('INSERT OR IGNORE INTO ops (op_id, result, at) VALUES (?, ?, ?)').run(opId, JSON.stringify(r), new Date().toISOString());
    db.prepare("DELETE FROM ops WHERE at < ?").run(new Date(Date.now() - 7 * 86_400_000).toISOString());
  }
  return r;
}
const reply = (res, r, okStatus = 200) => (r.error ? send(res, r.status || 400, { ok: false, error: r.error, ...(r.errors ? { errors: r.errors } : {}) }) : send(res, okStatus, { ok: true, ...r }));

function ownerSettings(wid) {
  const s = getSettings(workshopDb(wid));
  return {
    phone: s.phone || '', hours: s.hours || '', replyTo: s.replyTo || '', ownerEmail: s.ownerEmail || '', summaryOn: !!s.summaryOn, summaryHour: s.summaryHour ?? 19,
    weeklyOn: s.weeklyOn ?? WEEKLY_DEFAULTS.weeklyOn, weeklyDay: s.weeklyDay ?? WEEKLY_DEFAULTS.weeklyDay, weeklyHour: s.weeklyHour ?? WEEKLY_DEFAULTS.weeklyHour, staleDays: s.staleDays ?? WEEKLY_DEFAULTS.staleDays,
    bookingUrl: `${CITAS_URL}/?taller=${wid}`,
    sheetId: s.sheetId || '', sheetStatus: s.sheetStatus || (s.sheetId ? 'pending' : 'off'), sheetSyncedAt: s.sheetSyncedAt || null, sheetError: s.sheetError || '',
    templates: { ...DEFAULT_TEMPLATES, ...(s.templates || {}) },
  };
}

// ---------- Acceso ----------
async function login(req, res, body) {
  const ip = clientIp(req);
  if (limits.loginIp.blocked(ip)) return send(res, 429, { ok: false, error: 'locked', retryAfter: limits.loginIp.retryAfter(ip) });
  const started = Date.now();
  const found = typeof body.key === 'string' ? findByKey(body.key) : null;
  const okShop = found && found.workshop.status === 'active';
  if (!okShop) {
    limits.loginIp.hit(ip);
    const wait = started + 350 - Date.now(); if (wait > 0) await sleep(wait);
    return send(res, found ? 403 : 401, { ok: false, error: found ? 'paused' : 'bad_key' });
  }
  limits.loginIp.clear(ip);
  res.setHeader('Set-Cookie', cookie(makeSession({ w: found.workshop.id, r: found.role, kv: found.workshop.keyVer }), { secure: isSecure(req), role: found.role }));
  return send(res, 200, { ok: true, role: found.role, workshop: { name: found.workshop.name } });
}
async function adminLogin(req, res, body) {
  const ip = clientIp(req);
  if (!ADMIN_KEY) return send(res, 404, { ok: false });
  if (limits.loginIp.blocked(ip)) return send(res, 429, { ok: false, error: 'locked', retryAfter: limits.loginIp.retryAfter(ip) });
  if (!adminKeyOk(body.key)) { limits.loginIp.hit(ip); await sleep(350); return send(res, 401, { ok: false, error: 'bad_key' }); }
  limits.loginIp.clear(ip);
  res.setHeader('Set-Cookie', cookie(makeSession({ w: '-', r: 'admin', kv: 0 }), { secure: isSecure(req) }));
  return send(res, 200, { ok: true, role: 'admin' });
}

// ---------- Administración (nosotros) ----------
async function admin(req, res, path, method, body) {
  const wk = (id) => (typeof id === 'string' && getWorkshop(id) ? id : null);
  if (path === '/admin/workshops' && method === 'GET') return send(res, 200, { ok: true, workshops: listWorkshops().map((w) => ({ ...w, visits: counts(w.id).visits })), mail: MAIL.provider, sheets: sheetsConfigured() });
  if (path === '/admin/mail-test' && method === 'POST') {
    const to = normEmail(body.to);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) return send(res, 422, { ok: false, error: 'validation', errors: { to: 'email_format' } });
    if (!limits.mailTest.hit('admin').ok) return send(res, 429, { ok: false, error: 'rate_limited' });
    return send(res, 200, await sendTest(to));
  }
  if (path === '/admin/workshops' && method === 'POST') {
    const name = cleanText(body.name, 80);
    if (name.length < 2) return send(res, 422, { ok: false, error: 'validation', errors: { name: 'required' } });
    const patch = {};
    if (body.replyTo) { const e = normEmail(body.replyTo); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return send(res, 422, { ok: false, error: 'validation', errors: { replyTo: 'email_format' } }); patch.replyTo = e; }
    if (body.ownerEmail) { const e = normEmail(body.ownerEmail); if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(e)) return send(res, 422, { ok: false, error: 'validation', errors: { ownerEmail: 'email_format' } }); patch.ownerEmail = e; patch.summaryOn = true; }
    if (body.sheetId) { if (!validateSettings({ sheetId: body.sheetId }).ok) return send(res, 422, { ok: false, error: 'validation', errors: { sheetId: 'invalid' } }); patch.sheetId = body.sheetId; }
    const w = createWorkshop(name);
    setSettings(workshopDb(w.id), patch);
    return send(res, 201, { ok: true, workshop: { id: w.id, name }, mechanicKey: w.mechanicKey, ownerKey: w.ownerKey });
  }
  const m = /^\/admin\/workshops\/([0-9a-f]{16})\/(pause|activate|regenerate|rename)$/.exec(path);
  if (m && method === 'POST' && wk(m[1])) {
    const [, id, action] = m;
    if (action === 'pause' || action === 'activate') { setStatus(id, action === 'pause' ? 'paused' : 'active'); return send(res, 200, { ok: true }); }
    if (action === 'rename') { if (cleanText(body.name, 80).length < 2) return send(res, 422, { ok: false, error: 'validation' }); renameWorkshop(id, cleanText(body.name, 80)); return send(res, 200, { ok: true }); }
    if (!['mechanic', 'owner'].includes(body.role)) return send(res, 400, { ok: false, error: 'invalid' });
    return send(res, 200, { ok: true, key: regenerateKey(id, body.role), role: body.role });
  }
  return send(res, 404, { ok: false, error: 'not_found' });
}

// ---------- Panel del taller ----------
async function shop(req, res, session, path, method, body) {
  const wid = session.w; const owner = session.r === 'owner';
  if (method === 'GET') {
    if (path === '/session') return send(res, 200, { ok: true, role: session.r, workshop: { name: session.workshopName }, undoSeconds: Number(process.env.UNDO_SECONDS) || 10 });
    if (path === '/visits') return send(res, 200, { ok: true, visits: listVisits(wid) });
    if (path === '/appointments') return send(res, 200, { ok: true, appointments: listAppointments(wid) });
    if (path === '/lookup') return send(res, 200, { ok: true, ...lookup(wid, new URL(req.url, 'http://x').searchParams.get('q')) });
    const ph = /^\/visits\/([0-9a-f-]{36})\/photo$/.exec(path);
    if (ph) { const f = photoPath(wid, ph[1]); if (!f) return send(res, 404, { ok: false }); res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=600' }); return res.end(readFileSync(f)); }
    if (!owner) return send(res, 403, { ok: false, error: 'owner_only' });
    if (path === '/owner/stats') return send(res, 200, { ok: true, ...stats(wid) });
    if (path === '/owner/period') return send(res, 200, { ok: true, ...periodStats(wid, new URL(req.url, 'http://x').searchParams.get('p')) });
    if (path === '/owner/mail') return send(res, 200, { ok: true, mail: recentMail(wid).map((m) => ({ ...m, toEmail: maskEmail(m.toEmail) })), provider: MAIL.provider });
    if (path === '/owner/settings') return send(res, 200, { ok: true, settings: ownerSettings(wid), service: { configured: sheetsConfigured(), email: serviceAccountEmail() }, mailProvider: MAIL.provider });
    if (path === '/owner/summary-preview') return send(res, 200, { ok: true, ...summaryText(wid) });
    if (path === '/owner/weekly-preview') { const { subject, body: text } = weeklyText(wid); return send(res, 200, { ok: true, subject, body: text }); }
    if (path === '/owner/export.xlsx') {
      const buf = await exportXlsx(wid, session.workshopName);
      res.writeHead(200, { 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': 'attachment; filename="coches.xlsx"', 'Cache-Control': 'no-store' });
      return res.end(buf);
    }
    return send(res, 404, { ok: false, error: 'not_found' });
  }

  if (path === '/visits' && method === 'POST') return reply(res, withOp(wid, body, () => createVisit(wid, session, body)), 201);
  const ap = /^\/appointments\/([0-9a-f-]{36})\/(arrive|dismiss)$/.exec(path);
  if (ap && method === 'POST') return reply(res, ap[2] === 'arrive' ? arriveAppointment(wid, session, ap[1]) : dismissAppointment(wid, ap[1]));
  const m = /^\/visits\/([0-9a-f-]{36})\/(state|undo|eta)$/.exec(path);
  if (m && method === 'POST') {
    const [, id, action] = m;
    if (action === 'state') return reply(res, withOp(wid, body, () => setState(wid, session, id, body.state)));
    if (action === 'undo') return reply(res, undo(wid, session, id));
    return reply(res, setEta(wid, id, body.eta ?? null));
  }

  if (!owner) return send(res, 403, { ok: false, error: 'owner_only' });
  if (path === '/owner/settings' && method === 'PATCH') {
    const v = validateSettings(body);
    if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
    const patch = {};
    for (const k of ['phone', 'hours']) if (body[k] !== undefined) patch[k] = cleanText(body[k], 120);
    for (const k of ['replyTo', 'ownerEmail']) if (body[k] !== undefined) patch[k] = body[k] === '' ? '' : normEmail(body[k]);
    for (const k of ['summaryOn', 'summaryHour', 'weeklyOn', 'weeklyDay', 'weeklyHour', 'staleDays', 'sheetId', 'templates']) if (body[k] !== undefined) patch[k] = body[k];
    setSettings(workshopDb(wid), patch);
    return send(res, 200, { ok: true, settings: ownerSettings(wid) });
  }
  if (path === '/owner/weekly/send' && method === 'POST') {
    if (!limits.mailTest.hit(`weekly:${wid}`).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
    return reply(res, sendWeeklyNow(wid));
  }
  if (path === '/owner/sheet/sync' && method === 'POST') return send(res, 200, { ok: true, ...(await syncSheet(wid)), settings: ownerSettings(wid) });
  if (path === '/owner/keys/mechanic' && method === 'POST') return send(res, 200, { ok: true, key: regenerateKey(wid, 'mechanic') });
  return send(res, 404, { ok: false, error: 'not_found' });
}

export async function handleApi(req, res) {
  let path; try { path = new URL(req.url, 'http://x').pathname.replace(/^\/api/, ''); } catch { return send(res, 400, { ok: false }); }
  const method = req.method;
  try {
    if (!limits.apiIp.hit(clientIp(req)).ok) return send(res, 429, { ok: false, error: 'rate_limited' });

    // Públicas: baja de correos y rebotes del proveedor.
    if (path.startsWith('/public/unsub/')) {
      const info = readUnsubToken(decodeURIComponent(path.slice('/public/unsub/'.length)));
      if (!info || !getWorkshop(info.wid)) return send(res, 404, { ok: false });
      if (method === 'GET') return send(res, 200, { ok: true, workshop: getWorkshop(info.wid).name, email: maskEmail(info.email) });
      if (method === 'POST') { if (!limits.publicIp.hit(clientIp(req)).ok) return send(res, 429, { ok: false }); unsubscribe(info.wid, info.email); return send(res, 200, { ok: true }); }
    }
    if (path.startsWith('/public/track/') && method === 'GET') {
      if (!limits.publicIp.hit(clientIp(req)).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
      let t; try { t = decodeURIComponent(path.slice('/public/track/'.length)); } catch { t = ''; }
      const info = readTrackToken(t);
      const w = info && getWorkshop(info.wid);
      const data = w && w.status === 'active' ? trackInfo(info.wid, info.visitId) : null;
      return data ? send(res, 200, { ok: true, workshop: w.name, ...data }, { 'X-Robots-Tag': 'noindex' }) : send(res, 404, { ok: false });
    }
    // Citas del cliente: pública y desde otra web (la del taller), sin cookies; por eso se permite cualquier origen y solo estas rutas.
    if (path.startsWith('/public/booking/')) {
      const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '86400', 'X-Robots-Tag': 'noindex' };
      if (method === 'OPTIONS') { res.writeHead(204, cors); return res.end(); }
      const wid = path.slice('/public/booking/'.length);
      const w = /^[a-z0-9]{6,32}$/.test(wid) ? getWorkshop(wid) : null;
      if (!w || w.status !== 'active') return send(res, 404, { ok: false }, cors);
      if (method === 'GET') { const s = getSettings(workshopDb(wid)); return send(res, 200, { ok: true, workshop: w.name, phone: s.phone || '', hours: s.hours || '' }, cors); }
      if (method === 'POST') {
        const ip = clientIp(req);
        if (!limits.booking.hit(ip).ok) return send(res, 429, { ok: false, error: 'too_many' }, cors);
        const b = await readBody(req, 8_192);
        if (b.error) return send(res, 400, { ok: false, error: b.error }, cors);
        const r = submitBooking(wid, b.json);
        return r.error ? send(res, r.status || 400, { ok: false, error: r.error, ...(r.errors ? { errors: r.errors } : {}) }, cors) : send(res, 201, { ok: true }, cors);
      }
      return send(res, 405, { ok: false }, cors);
    }
    if (path === '/webhooks/resend' && method === 'POST') {
      const b = await readBody(req, 64_000);
      const parsed = b.error ? null : (() => { try { return JSON.parse(b.raw); } catch { return null; } })();
      if (!parsed || !verifyWebhook(req.headers, b.raw)) return send(res, 401, { ok: false });
      return send(res, 200, { ok: true, applied: applyWebhookEvent(parsed) });
    }

    if (path === '/login' || path === '/admin/login' || path === '/logout') {
      if (method !== 'POST') return send(res, 405, { ok: false });
      if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
      if (path === '/logout') { res.setHeader('Set-Cookie', cookie('', { secure: isSecure(req), clear: true })); return send(res, 200, { ok: true }); }
      const b = await readBody(req);
      if (b.error) return send(res, 400, { ok: false, error: b.error });
      return path === '/login' ? login(req, res, b.json) : adminLogin(req, res, b.json);
    }

    const session = readSession(req);
    if (path === '/session' && !session) return send(res, 200, { ok: false });
    if (!session) return send(res, 401, { ok: false, error: 'unauthorized' });
    if (needsRenewal(session)) res.setHeader('Set-Cookie', cookie(makeSession(session), { secure: isSecure(req), role: session.r }));
    if (path === '/session' && session.r === 'admin') return send(res, 200, { ok: true, role: 'admin' });
    let body = {};
    if (method !== 'GET') {
      if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
      const b = await readBody(req, path === '/visits' ? 1_300_000 : 64_000);
      if (b.error) return send(res, 400, { ok: false, error: b.error });
      body = b.json;
    }
    if (path.startsWith('/admin/')) return session.r === 'admin' ? admin(req, res, path, method, body) : send(res, 403, { ok: false, error: 'forbidden' });
    if (session.r === 'admin') return send(res, 403, { ok: false, error: 'forbidden' });
    return shop(req, res, session, path, method, body);
  } catch (err) {
    console.error('api error:', err?.message); // sin cuerpos ni correos
    if (!res.headersSent) send(res, 500, { ok: false, error: 'server' }); else res.end();
  }
}
export function apiMiddleware(req, res, next) { return req.url.startsWith('/api/') ? handleApi(req, res) : next(); }
export { runDailySummaries };
