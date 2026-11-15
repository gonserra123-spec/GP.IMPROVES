import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

// Misma política que public/_headers: mantener ambas iguales.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React y three fijan estilos en línea
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self'",
  "worker-src 'self'",
  "manifest-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const BASE = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// full=true añade CSP y HSTS (solo con el build y bajo HTTPS; en dev la CSP rompería el HMR).
export function securityHeaders({ full }) {
  return full ? { ...BASE, 'Content-Security-Policy': CSP, 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : BASE;
}
export function headersMiddleware({ full }) {
  const h = securityHeaders({ full });
  return (_req, res, next) => { for (const [k, v] of Object.entries(h)) res.setHeader(k, v); next(); };
}

// Ventana fija por clave. `peek` no consume; `hit` consume un intento.
export function createLimiter({ windowMs, max }) {
  const hits = new Map();
  const fresh = (key, now) => {
    const e = hits.get(key);
    if (!e || now - e.start >= windowMs) return null;
    return e;
  };
  return {
    hit(key, now = Date.now()) {
      let e = fresh(key, now);
      if (!e) { e = { start: now, n: 0 }; hits.set(key, e); }
      e.n += 1;
      if (hits.size > 5000) for (const [k, v] of hits) if (now - v.start >= windowMs) hits.delete(k);
      return { ok: e.n <= max, retryAfter: Math.ceil((e.start + windowMs - now) / 1000) };
    },
    blocked(key, now = Date.now()) { const e = fresh(key, now); return !!e && e.n >= max; },
    retryAfter(key, now = Date.now()) { const e = fresh(key, now); return e ? Math.ceil((e.start + windowMs - now) / 1000) : 0; },
    clear(key) { hits.delete(key); },
    reset() { hits.clear(); },
  };
}

export function hashPin(pin) {
  const salt = randomBytes(16);
  return `scrypt$${salt.toString('base64')}$${scryptSync(pin, salt, 32).toString('base64')}`;
}
export function verifyPin(pin, stored) {
  const [, salt, hash] = String(stored).split('$');
  if (!salt || !hash) return false;
  // Un hash mal formado cuenta como credencial incorrecta, no como error del servidor.
  try {
    const expected = Buffer.from(hash, 'base64');
    if (expected.length !== 32) return false;
    return timingSafeEqual(scryptSync(String(pin), Buffer.from(salt, 'base64'), 32), expected);
  } catch { return false; }
}

const SECRET = process.env.SESSION_SECRET ? Buffer.from(process.env.SESSION_SECRET) : randomBytes(32);
const b64 = (buf) => Buffer.from(buf).toString('base64url');

// Token firmado de corta vida para refrescar la consulta sin volver a escribir la matrícula.
export function signToken(payload, ttlMs) {
  const body = b64(JSON.stringify({ ...payload, exp: Date.now() + ttlMs }));
  return `${body}.${b64(createHmac('sha256', SECRET).update(body).digest())}`;
}
export function readToken(token) {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(body).digest();
  const got = Buffer.from(sig, 'base64url');
  if (got.length !== expected.length || !timingSafeEqual(got, expected)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

const SESSION_TTL = 12 * 60 * 60 * 1000;
const sessions = new Map();
export const COOKIE = 'tg_session';

const MAX_SESSIONS = 300;
export function createSession(data) {
  const token = randomBytes(32).toString('base64url');
  // Tope de sesiones vivas: se retiran las caducadas y, si hace falta, la más antigua.
  if (sessions.size >= MAX_SESSIONS) {
    const now = Date.now();
    for (const [k, v] of sessions) if (v.exp < now) sessions.delete(k);
    if (sessions.size >= MAX_SESSIONS) sessions.delete(sessions.keys().next().value);
  }
  sessions.set(token, { ...data, sid: randomBytes(6).toString('hex'), exp: Date.now() + SESSION_TTL });
  return token;
}
export function getSession(req) {
  const m = /(?:^|;\s*)tg_session=([A-Za-z0-9_-]{20,})/.exec(req.headers.cookie || '');
  if (!m) return null;
  const s = sessions.get(m[1]);
  if (!s) return null;
  if (s.exp < Date.now()) { sessions.delete(m[1]); return null; }
  return { ...s, token: m[1] };
}
export const destroySession = (token) => sessions.delete(token);
export const resetSessions = () => sessions.clear();
export function sessionCookie(token, { secure, clear = false } = {}) {
  return `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; SameSite=Strict${secure ? '; Secure' : ''}; Max-Age=${clear ? 0 : SESSION_TTL / 1000}`;
}

export function clientIp(req) {
  if (process.env.TRUST_PROXY === '1') {
    const xf = String(req.headers['cf-connecting-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim();
    if (xf) return xf;
  }
  return req.socket.remoteAddress || 'unknown';
}
export const isLoopback = (req) => /^(::1|127\.|::ffff:127\.)/.test(req.socket.remoteAddress || '');
