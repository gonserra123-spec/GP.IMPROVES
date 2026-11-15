// Utilidades comunes de las Edge Functions (Deno). Sin probar contra un proyecto real: ver docs/deploy-supabase.md.
import { createClient } from 'npm:@supabase/supabase-js@2';

export const db = () => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

// CORS: solo los orígenes de ALLOWED_ORIGINS (lista separada por comas). Nunca «*»: se usan cookies.
const ORIGINS = (Deno.env.get('ALLOWED_ORIGINS') ?? '').split(',').map((s) => s.trim()).filter(Boolean);
export function cors(req: Request): Record<string, string> | null {
  const origin = req.headers.get('origin');
  if (!origin || !ORIGINS.includes(origin)) return null;
  return {
    'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Credentials': 'true', Vary: 'Origin',
    'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-requested-with', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
}

export const json = (body: unknown, status: number, headers: Record<string, string>) =>
  new Response(JSON.stringify(body), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' } });

// Entrada común: preflight, origen permitido, cabecera propia y cuerpo JSON pequeño.
export async function open(req: Request): Promise<{ h: Record<string, string>; body: Record<string, unknown> } | Response> {
  const h = cors(req);
  if (!h) return new Response(null, { status: 403 });
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: h });
  if (req.method !== 'POST' || req.headers.get('x-requested-with') !== 'tridom-garage') return json({ ok: false, error: 'forbidden' }, 403, h);
  const text = await req.text();
  if (text.length > 16384) return json({ ok: false, error: 'invalid' }, 400, h);
  try {
    const body = JSON.parse(text || '{}');
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('shape');
    return { h, body };
  } catch { return json({ ok: false, error: 'invalid' }, 400, h); }
}

const enc = new TextEncoder();
const b64u = (buf: ArrayBuffer | Uint8Array) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64u = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));

export async function sha256(text: string) { return b64u(await crypto.subtle.digest('SHA-256', enc.encode(text))); }
export const randomToken = () => b64u(crypto.getRandomValues(new Uint8Array(32)));

export const clientIp = (req: Request) => (req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown').split(',')[0].trim();
// La clave del límite es un hash: en la tabla no quedan IP ni matrículas en claro.
export async function allowed(sb: ReturnType<typeof db>, scope: string, value: string, windowSeconds: number, max: number) {
  const { data, error } = await sb.rpc('hit_rate_limit', { p_key: await sha256(`${scope}:${value}`), p_window_seconds: windowSeconds, p_max: max });
  return !error && data === true;
}

function timingSafeEqual(a: Uint8Array, b: Uint8Array) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i += 1) d |= a[i] ^ b[i];
  return d === 0;
}

// PIN: pbkdf2$iteraciones$sal$hash (el mismo formato que genera scripts/hash-pin.mjs).
export async function verifyPin(pin: string, stored: string) {
  const [kind, iter, salt, hash] = stored.split('$');
  if (kind !== 'pbkdf2' || !iter || !salt || !hash) return false;
  const key = await crypto.subtle.importKey('raw', enc.encode(pin), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromB64u(salt), iterations: Number(iter) }, key, 256);
  return timingSafeEqual(new Uint8Array(bits), fromB64u(hash));
}

async function hmac(data: string) {
  const key = await crypto.subtle.importKey('raw', enc.encode(Deno.env.get('VIEW_TOKEN_SECRET')!), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, enc.encode(data)));
}
export async function signView(payload: Record<string, unknown>, ttlMs: number) {
  const body = b64u(enc.encode(JSON.stringify({ ...payload, exp: Date.now() + ttlMs })));
  return `${body}.${b64u(await hmac(body))}`;
}
export async function readView(token: unknown): Promise<{ v: string; w: string } | null> {
  if (typeof token !== 'string' || token.length > 600) return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  try {
    if (!timingSafeEqual(await hmac(body), fromB64u(sig))) return null;
    const p = JSON.parse(new TextDecoder().decode(fromB64u(body)));
    return p.exp > Date.now() ? p : null;
  } catch { return null; }
}

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, Math.max(0, ms)));
