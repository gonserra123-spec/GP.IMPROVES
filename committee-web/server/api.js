// API de formularios: POST /api/booking y POST /api/lista.
// El servidor es quien manda: vuelve a validar todo (src/lib/validate.js), limita el ritmo
// por IP, exige JSON y mismo origen, y limita el tamaño. Si no hay webhook configurado
// responde «mock» y no guarda nada. Los secretos solo se leen del entorno.
import { validateBooking, validateLista } from '../src/lib/validate.js';

const MAX_BODY = 8 * 1024;
const WINDOW_MS = 10 * 60 * 1000;
const MAX_HITS = 8; // peticiones por IP y ventana (todas las rutas de formulario)
const hits = new Map();

const ROUTES = {
  '/api/booking': { validate: validateBooking, hook: 'BOOKING_WEBHOOK_URL' },
  '/api/lista': { validate: validateLista, hook: 'LISTA_WEBHOOK_URL' },
};

// Las cabeceras de IP reenviada solo se creen si la conexión llega de un proxy de confianza
// (TRUSTED_PROXIES, lista de IP separadas por comas; por defecto solo bucle local). Un cliente
// que conecte directo no puede falsificarlas. Con Cloudflare, cierra el origen a sus rangos.
const norm = (ip) => String(ip || '').replace(/^::ffff:/, '');
export function fromTrustedProxy(req) {
  if (process.env.TRUST_PROXY !== '1') return false;
  const list = (process.env.TRUSTED_PROXIES || '127.0.0.1,::1').split(',').map((s) => norm(s.trim()));
  return list.includes(norm(req.socket.remoteAddress));
}

export function clientIp(req) {
  if (fromTrustedProxy(req)) {
    const fwd = req.headers['cf-connecting-ip'] || String(req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (fwd) return fwd;
  }
  return req.socket.remoteAddress || 'unknown';
}

function limited(ip, now = Date.now()) {
  if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start > WINDOW_MS) hits.delete(k);
  const h = hits.get(ip);
  if (!h || now - h.start > WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return 0; }
  h.n += 1;
  return h.n > MAX_HITS ? Math.ceil((h.start + WINDOW_MS - now) / 1000) : 0;
}

function send(res, status, body, extra = {}) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', ...extra });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; let over = false; const chunks = [];
    req.on('data', (c) => {
      if (over) return; // se descarta el resto sin guardarlo
      size += c.length;
      if (size > MAX_BODY) { over = true; chunks.length = 0; reject(Object.assign(new Error('too large'), { status: 413 })); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

async function forward(hookEnv, clean) {
  const url = process.env[hookEnv];
  if (!url) return { mock: true };
  if (!/^https:\/\//.test(url)) throw new Error(`${hookEnv} debe ser https`);
  const headers = { 'Content-Type': 'application/json' };
  if (process.env.WEBHOOK_SECRET) headers['X-Webhook-Secret'] = process.env.WEBHOOK_SECRET;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify(clean), signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`webhook ${r.status}`);
  return { mock: false };
}

export async function handleApi(req, res) {
  const path = new URL(req.url, 'http://localhost').pathname;
  const route = ROUTES[path];
  if (!route) return send(res, 404, { ok: false });
  if (req.method !== 'POST') return send(res, 405, { ok: false }, { Allow: 'POST' });

  // Mismo origen: un navegador siempre manda Origin en un POST de fetch.
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* origen mal formado */ }
    if (host !== req.headers.host) return send(res, 403, { ok: false });
  }
  if (!String(req.headers['content-type'] || '').toLowerCase().startsWith('application/json')) return send(res, 415, { ok: false });

  const wait = limited(clientIp(req));
  if (wait) return send(res, 429, { ok: false }, { 'Retry-After': String(wait) });

  let body;
  try { body = JSON.parse(await readBody(req)); } catch (err) { return send(res, err.status === 413 ? 413 : 400, { ok: false }, { Connection: 'close' }); }

  // Honeypot: un campo oculto que una persona nunca rellena. Se responde «ok» sin guardar nada.
  if (body && typeof body.website === 'string' && body.website.trim() !== '') return send(res, 200, { ok: true, mock: true });

  const { errors, clean } = route.validate(body);
  if (!clean) return send(res, 422, { ok: false, errors });

  try {
    const { mock } = await forward(route.hook, clean);
    return send(res, 200, { ok: true, mock });
  } catch (err) {
    console.error('[api]', route.hook, err.message); // sin datos personales en el log
    return send(res, 502, { ok: false });
  }
}

export const apiMiddleware = (req, res, next) => (req.url.startsWith('/api/') ? handleApi(req, res) : next());
