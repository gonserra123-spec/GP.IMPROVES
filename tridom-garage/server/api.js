// API del modo demo. La misma se monta en `vite dev`, `vite preview` y server/index.js.
import { setTimeout as sleep } from 'node:timers/promises';
import { classifyPlate, normalizePlate } from '../shared/plates.js';
import { OPERATORS } from '../shared/domain.js';
import { isPin, isUuid, isVehicleCode, validateContact, validateNewVehicle, validatePart, validatePatch, validateWorkshopSettings } from '../shared/validate.js';
import { MAX_IMPORT_ROWS, validateBooking, validateImportRow } from '../shared/customers.js';
import * as store from './store.js';
import {
  clientIp, createLimiter, createSession, destroySession, getSession, isLoopback, readToken, resetSessions,
  sessionCookie, signToken, verifyPin,
} from './security.js';

const DEMO = store.DEMO;
const MIN = 60_000;
const limits = {
  lookupIp: createLimiter({ windowMs: MIN, max: 10 }),
  lookupPlate: createLimiter({ windowMs: 10 * MIN, max: 6 }),
  refreshIp: createLimiter({ windowMs: MIN, max: 30 }),
  verifyVehicle: createLimiter({ windowMs: 15 * MIN, max: 5 }),
  verifyVehicleDay: createLimiter({ windowMs: 24 * 60 * MIN, max: 15 }), // 4 cifras = 10.000 combinaciones: tope diario por coche
  verifyIp: createLimiter({ windowMs: 10 * MIN, max: 10 }),
  loginIp: createLimiter({ windowMs: 5 * MIN, max: 5 }),
  loginWorkshop: createLimiter({ windowMs: 15 * MIN, max: 20 }),
  contactIp: createLimiter({ windowMs: 10 * MIN, max: 3 }),
  checkIp: createLimiter({ windowMs: MIN, max: 10 }),
  checkPlate: createLimiter({ windowMs: 10 * MIN, max: 6 }),
  bookIp: createLimiter({ windowMs: 10 * MIN, max: 5 }),
  panelIp: createLimiter({ windowMs: MIN, max: 240 }),
};
const seenOps = new Map(); // idempotencia de la cola offline: opId -> respuesta

const VIEW_TTL = 15 * MIN;
const PUBLIC_FLOOR_MS = 420;

function send(res, status, body, headers = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...headers });
  res.end(body === undefined ? '' : JSON.stringify(body));
}

async function readJson(req, max = 16_384) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) return null;
  let size = 0; const chunks = [];
  for await (const c of req) {
    size += c.length;
    if (size > max) return null;
    chunks.push(c);
  }
  try {
    const v = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch { return null; }
}

// Peticiones que cambian algo: mismo origen y cabecera propia (los formularios de otros sitios no pueden ponerla).
function sameOrigin(req) {
  // Los navegadores envían siempre Origin en POST/PATCH/DELETE: si falta o no coincide, se rechaza.
  const origin = req.headers.origin;
  if (!origin) return false;
  try { if (new URL(origin).host !== req.headers.host) return false; } catch { return false; }
  return req.headers['x-requested-with'] === 'tridom-garage';
}

const isSecure = (req) => !!req.socket.encrypted || (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'https');

// Respuesta única para «no existe» y «dato incorrecto», con el mismo suelo de tiempo.
async function publicReply(res, started, body, status = 200) {
  const wait = started + PUBLIC_FLOOR_MS + Math.random() * 60 - Date.now();
  if (wait > 0) await sleep(wait);
  send(res, status, body);
}
const NOT_AVAILABLE = { ok: false };

async function publicLookup(req, res, body) {
  const started = Date.now();
  const ip = clientIp(req);
  if (!limits.lookupIp.hit(ip).ok) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': String(limits.lookupIp.retryAfter(ip)) });
  if (body.website) return publicReply(res, started, NOT_AVAILABLE);
  const workshop = typeof body.code === 'string' ? store.findWorkshopByCode(body.code) : null;
  let v = null;
  if (body.vehicleCode !== undefined) {
    // Entrada por el QR del albarán: código corto del coche, con el mismo límite de intentos por IP.
    if (!isVehicleCode(body.vehicleCode)) return publicReply(res, started, NOT_AVAILABLE);
    v = workshop ? store.findByCode(workshop.id, body.vehicleCode) : null;
  } else {
    const plate = normalizePlate(body.plate);
    if (!classifyPlate(plate)) return publicReply(res, started, NOT_AVAILABLE);
    const key = `${workshop?.id || 'none'}:${plate}`;
    if (!limits.lookupPlate.hit(key).ok) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': String(limits.lookupPlate.retryAfter(key)) });
    v = workshop ? store.findByPlate(workshop.id, plate) : null;
  }
  if (!v) return publicReply(res, started, NOT_AVAILABLE);
  return publicReply(res, started, { ok: true, token: signToken({ v: v.id, w: workshop.id }, VIEW_TTL), ...store.publicDto(v) });
}

// Cita: ¿el taller ya conoce este coche? Responde solo marca y modelo, con el mismo suelo de tiempo y límite de intentos.
async function publicCustomerCheck(req, res, body) {
  const started = Date.now();
  const ip = clientIp(req);
  if (!limits.checkIp.hit(ip).ok) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': String(limits.checkIp.retryAfter(ip)) });
  const workshop = typeof body.code === 'string' ? store.findWorkshopByCode(body.code) : null;
  const plate = normalizePlate(body.plate);
  if (body.website || !workshop || !classifyPlate(plate)) return publicReply(res, started, { ok: true, known: false });
  const key = `${workshop.id}:${plate}`;
  if (!limits.checkPlate.hit(key).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
  const c = store.findCustomer(workshop.id, plate);
  return publicReply(res, started, c ? { ok: true, known: true, make: c.make, model: c.model } : { ok: true, known: false });
}

async function publicBook(req, res, body) {
  const started = Date.now();
  const ip = clientIp(req);
  if (!limits.bookIp.hit(ip).ok) return send(res, 429, { ok: false, error: 'rate_limited' }, { 'Retry-After': String(limits.bookIp.retryAfter(ip)) });
  const workshop = typeof body.code === 'string' ? store.findWorkshopByCode(body.code) : null;
  if (body.website) return publicReply(res, started, { ok: true });
  if (!workshop) return publicReply(res, started, { ok: false, error: 'not_found' }, 404);
  const known = !!store.findCustomer(workshop.id, normalizePlate(body.plate));
  const v = validateBooking(body, store.CATALOG, { known });
  if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
  const r = store.createAppointment(workshop.id, { plate: v.plate, plateKind: classifyPlate(v.plate), email: v.email, phone: v.phone, vehicle: v.vehicle, date: body.date, slot: body.slot, reason: v.reason });
  if (r.error) return send(res, r.status, { ok: false, error: r.error });
  return publicReply(res, started, { ok: true, date: r.appointment.date, slot: r.appointment.slot, known: r.known }, 201);
}

async function publicRefresh(req, res, body) {
  const ip = clientIp(req);
  if (!limits.refreshIp.hit(ip).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
  const t = readToken(body.token);
  const v = t ? store.getOwn(t.w, t.v) : null;
  if (!v) return send(res, 200, NOT_AVAILABLE);
  return send(res, 200, { ok: true, ...store.publicDto(v) });
}

async function publicVerify(req, res, body) {
  const started = Date.now();
  const ip = clientIp(req);
  const t = readToken(body.token);
  if (!limits.verifyIp.hit(ip).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
  if (t && (!limits.verifyVehicle.hit(t.v).ok || !limits.verifyVehicleDay.hit(t.v).ok)) return send(res, 429, { ok: false, error: 'rate_limited' });
  const v = t ? store.getOwn(t.w, t.v) : null;
  const last4 = typeof body.last4 === 'string' && /^\d{4}$/.test(body.last4) ? body.last4 : null;
  if (!v || !v.phone || !last4 || v.phone.slice(-4) !== last4) return publicReply(res, started, NOT_AVAILABLE);
  return publicReply(res, started, { ok: true, cost: store.publicCost(v) });
}

async function login(req, res, body) {
  const started = Date.now();
  const ip = clientIp(req);
  const workshop = typeof body.code === 'string' ? store.findWorkshopByCode(body.code) : null;
  const wkey = workshop?.id || 'none';
  if (limits.loginIp.blocked(ip) || limits.loginWorkshop.blocked(wkey)) {
    const retry = Math.max(limits.loginIp.retryAfter(ip), limits.loginWorkshop.retryAfter(wkey));
    return send(res, 429, { ok: false, error: 'locked', retryAfter: retry }, { 'Retry-After': String(retry) });
  }
  const valid = !body.website && workshop && isPin(body.pin) && OPERATORS.includes(body.operator) && verifyPin(body.pin, workshop.pinHash);
  if (!valid) {
    limits.loginIp.hit(ip); limits.loginWorkshop.hit(wkey);
    return publicReply(res, started, { ok: false, error: 'bad_credentials' }, 401);
  }
  limits.loginIp.clear(ip);
  const token = createSession({ workshopId: workshop.id, operator: body.operator });
  res.setHeader('Set-Cookie', sessionCookie(token, { secure: isSecure(req) }));
  return send(res, 200, { ok: true, workshop: store.workshopPanel(workshop), operator: body.operator });
}

const streams = new Map(); // conexiones de tiempo real abiertas por taller
function eventsStream(req, res, session) {
  const open = streams.get(session.workshopId) || 0;
  if (open >= 40) return send(res, 429, { ok: false, error: 'rate_limited' });
  streams.set(session.workshopId, open + 1);
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write(`event: hello\ndata: ${JSON.stringify({ sid: session.sid })}\n\n`);
  const onChange = (e) => {
    if (e.wid !== session.workshopId) return;
    const { wid, ...payload } = e;
    res.write(`event: change\ndata: ${JSON.stringify(payload)}\n\n`);
  };
  const ping = setInterval(() => res.write(': ping\n\n'), 25_000);
  store.events.on('change', onChange);
  req.on('close', () => { clearInterval(ping); store.events.off('change', onChange); streams.set(session.workshopId, Math.max(0, (streams.get(session.workshopId) || 1) - 1)); });
}

async function panel(req, res, path, method) {
  const session = getSession(req);
  // Preguntar si hay sesión no es un error: sin ella responde 200 con ok:false.
  if (!session && path === '/session' && method === 'GET') return send(res, 200, { ok: false });
  if (!session) return send(res, 401, { ok: false, error: 'unauthorized' });
  if (!limits.panelIp.hit(clientIp(req)).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
  const wid = session.workshopId;
  const reply = (r, okStatus = 200) => (r.error ? send(res, r.status, { ok: false, error: r.error }) : send(res, okStatus, { ok: true, ...r }));

  if (method === 'GET') {
    if (path === '/session') return send(res, 200, { ok: true, workshop: store.workshopPanel(store.getWorkshop(wid)), operator: session.operator, sid: session.sid });
    if (path === '/vehicles') return send(res, 200, { ok: true, vehicles: store.listVehicles(wid) });
    if (path === '/events') return eventsStream(req, res, session);
    if (path === '/customers/summary') return send(res, 200, { ok: true, ...store.customerSummary(wid) });
    if (path === '/appointments') return send(res, 200, { ok: true, appointments: store.listAppointments(wid) });
    const ex = /^\/vehicles\/([^/]+)\/export$/.exec(path);
    if (ex && isUuid(ex[1])) {
      const data = store.exportVehicle(wid, ex[1]);
      return data ? send(res, 200, data, { 'Content-Disposition': 'attachment; filename="export.json"' }) : send(res, 404, { ok: false, error: 'not_found' });
    }
    return send(res, 404, { ok: false, error: 'not_found' });
  }

  if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
  if (path === '/logout' && method === 'POST') {
    destroySession(session.token);
    res.setHeader('Set-Cookie', sessionCookie('', { secure: isSecure(req), clear: true }));
    return send(res, 200, { ok: true });
  }
  const body = method === 'DELETE' ? {} : await readJson(req, path === '/customers/import' ? 400_000 : 16_384);
  if (!body) return send(res, 400, { ok: false, error: 'invalid' });

  const opKey = typeof body.opId === 'string' && isUuid(body.opId) ? `${wid}:${body.opId}` : null;
  if (opKey && seenOps.has(opKey)) return send(res, 200, seenOps.get(opKey));
  const remember = (r, okStatus) => {
    if (opKey && !r.error) {
      seenOps.set(opKey, { ok: true, ...r });
      if (seenOps.size > 500) seenOps.delete(seenOps.keys().next().value);
    }
    return reply(r, okStatus);
  };

  if (path === '/vehicles' && method === 'POST') {
    const v = validateNewVehicle(body, store.CATALOG);
    if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
    return remember(store.createVehicle(wid, session, {
      id: body.id, plate: v.plate, plateKind: classifyPlate(v.plate), model: v.model, make: body.make, modelName: body.model, bodyType: body.bodyType, phone: v.phone,
    }), 201);
  }
  if (path === '/customers/import' && method === 'POST') {
    if (!Array.isArray(body.rows) || !body.rows.length || body.rows.length > MAX_IMPORT_ROWS) return send(res, 422, { ok: false, error: 'validation', errors: { rows: 'invalid' } });
    const good = []; const bad = [];
    body.rows.forEach((raw, i) => {
      const r = validateImportRow(raw && typeof raw === 'object' ? raw : {}, store.CATALOG);
      if (r.ok) good.push(r.row); else bad.push({ line: Number.isInteger(raw?.line) ? raw.line : i + 2, errors: r.errors });
    });
    const done = store.importCustomers(wid, good);
    return send(res, 200, { ok: true, ...done, rejected: bad.length, rejectedRows: bad.slice(0, 30), ...store.customerSummary(wid) });
  }
  const ap = /^\/appointments\/([^/]+)\/(arrive|cancel)$/.exec(path);
  if (ap && method === 'POST' && isUuid(ap[1])) return reply(ap[2] === 'arrive' ? store.arriveAppointment(wid, session, ap[1]) : store.cancelAppointment(wid, session, ap[1]));
  if (path === '/retention/run' && method === 'POST') return send(res, 200, { ok: true, deleted: store.runRetention() });
  if (path === '/workshop' && method === 'PATCH') {
    const v = validateWorkshopSettings(body);
    if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
    return send(res, 200, { ok: true, workshop: store.setWorkshopSettings(wid, body) });
  }

  const m = /^\/vehicles\/([^/]+)(?:\/parts(?:\/([^/]+))?)?$/.exec(path);
  if (!m || !isUuid(m[1]) || (m[2] && !isUuid(m[2]))) return send(res, 404, { ok: false, error: 'not_found' });
  const [, id, pid] = m;
  const isParts = path.includes('/parts');
  if (!isParts && method === 'PATCH') {
    const v = validatePatch(body);
    if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
    return remember(store.patchVehicle(wid, session, id, body));
  }
  if (!isParts && method === 'DELETE') return reply(store.deleteVehicle(wid, session, id));
  if (isParts && !pid && method === 'POST') {
    const v = validatePart(body);
    if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
    return remember(store.addPart(wid, session, id, body), 201);
  }
  if (isParts && pid && method === 'PATCH') {
    const v = validatePart(body, { partial: true });
    if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
    return remember(store.patchPart(wid, session, id, pid, body));
  }
  if (isParts && pid && method === 'DELETE') return reply(store.removePart(wid, session, id, pid));
  return send(res, 405, { ok: false, error: 'method' });
}

export async function handleApi(req, res) {
  let path;
  try { path = new URL(req.url, 'http://localhost').pathname.replace(/^\/api/, ''); } catch { return send(res, 400, { ok: false }); }
  const method = req.method;
  try {
    if (path === '/config' && method === 'GET') {
      return send(res, 200, { demo: DEMO, demoPin: DEMO ? store.DEMO_PIN : null, workshopCode: DEMO ? 'DEMO01' : null });
    }
    if (path.startsWith('/panel/')) {
      if (path === '/panel/login') {
        if (method !== 'POST') return send(res, 405, { ok: false });
        if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
        const body = await readJson(req);
        return body ? login(req, res, body) : send(res, 400, { ok: false, error: 'invalid' });
      }
      return panel(req, res, path.slice('/panel'.length), method);
    }
    const ws = /^\/public\/workshop\/([A-Za-z0-9]{4,12})$/.exec(path);
    if (ws && method === 'GET') {
      const w = store.findWorkshopByCode(ws[1]);
      return w ? send(res, 200, { ok: true, workshop: store.workshopPublic(w) }) : send(res, 404, { ok: false });
    }
    if (method === 'POST' && ['/public/lookup', '/public/refresh', '/public/verify', '/public/customer-check', '/public/book', '/contact', '/demo/reset'].includes(path)) {
      if (!sameOrigin(req)) return send(res, 403, { ok: false, error: 'forbidden' });
      const body = await readJson(req);
      if (!body) return send(res, 400, { ok: false, error: 'invalid' });
      if (path === '/public/lookup') return publicLookup(req, res, body);
      if (path === '/public/refresh') return publicRefresh(req, res, body);
      if (path === '/public/verify') return publicVerify(req, res, body);
      if (path === '/public/customer-check') return publicCustomerCheck(req, res, body);
      if (path === '/public/book') return publicBook(req, res, body);
      if (path === '/contact') {
        const ip = clientIp(req);
        if (!limits.contactIp.hit(ip).ok) return send(res, 429, { ok: false, error: 'rate_limited' });
        if (body.website) return send(res, 200, { ok: true });
        const v = validateContact(body);
        if (!v.ok) return send(res, 422, { ok: false, error: 'validation', errors: v.errors });
        // FALTA: destino del formulario (correo o CRM de Tridom). Hasta entonces no se guarda ni se reenvía nada.
        return send(res, 200, { ok: true, delivered: false });
      }
      // Solo en demo y desde la propia máquina: deja los fixtures y los límites como al arrancar.
      if (path === '/demo/reset') {
        // Detrás de un proxy todas las peticiones llegan desde la propia máquina: ahí no se ofrece.
        if (!DEMO || process.env.TRUST_PROXY === '1' || !isLoopback(req)) return send(res, 404, { ok: false });
        store.seed(); resetSessions(); seenOps.clear();
        for (const l of Object.values(limits)) l.reset();
        store.events.emit('change', { wid: 'w-demo', kind: 'reset', sid: null });
        return send(res, 200, { ok: true });
      }
    }
    return send(res, 404, { ok: false, error: 'not_found' });
  } catch (err) {
    console.error('api error:', err?.message); // sin cuerpo ni datos personales
    if (!res.headersSent) send(res, 500, { ok: false, error: 'server' });
    else res.end();
  }
}

export function apiMiddleware(req, res, next) {
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  return next();
}

// Borrado por retención: al arrancar y cada hora.
store.runRetention.scheduled ??= setInterval(() => store.runRetention(), 3_600_000).unref();
