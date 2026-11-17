// Edge Function `consulta`: consulta pública por matrícula. Devuelve solo el DTO mínimo de ese coche.
// Mismas reglas que server/api.js (modo demo): respuesta única para «no existe» y «dato incorrecto»,
// suelo de tiempo, honeypot y límite de intentos por IP y por matrícula.
import { allowed, clientIp, db, json, open, readView, signView, sleep } from '../_shared/http.ts';
import { classifyPlate, normalizePlate } from '../_shared/plates.js';
import { isVehicleCode } from '../_shared/validate.js';

const FLOOR_MS = 420;
const NOT_AVAILABLE = { ok: false };
const VIEW_TTL = 15 * 60_000;

type Row = Record<string, any>;

async function dto(sb: ReturnType<typeof db>, v: Row) {
  const [{ data: parts }, { data: others }] = await Promise.all([
    sb.from('parts').select('description, state, eta_at').eq('vehicle_id', v.id).neq('state', 'arrived'),
    sb.from('vehicles').select('location, slot').eq('workshop_id', v.workshop_id).neq('id', v.id).not('location', 'is', null),
  ]);
  return {
    vehicle: {
      plate: v.plate, make: v.make, model: v.model, bodyType: v.body_type, dims: v.dims, state: v.state, location: v.location, slot: v.slot, etaAt: v.eta_at,
      parts: (parts ?? []).map((p: Row) => ({ description: p.description, state: p.state, etaAt: p.eta_at })),
      canVerify: !!v.phone,
    },
    others: (others ?? []).map((o: Row) => ({ location: o.location, slot: o.slot })),
  };
}

Deno.serve(async (req) => {
  const started = Date.now();
  const o = await open(req);
  if (o instanceof Response) return o;
  const { h, body } = o;
  const sb = db();
  const ip = clientIp(req);
  const reply = async (b: unknown, status = 200) => { await sleep(started + FLOOR_MS + Math.random() * 60 - Date.now()); return json(b, status, h); };
  const limited = () => json({ ok: false, error: 'rate_limited' }, 429, h);

  if (body.action === 'workshop') {
    if (typeof body.code !== 'string' || !/^[A-Za-z0-9]{4,12}$/.test(body.code)) return json({ ok: false }, 404, h);
    const { data: w } = await sb.from('workshops').select('name, code, logo_url, brand_color, template').eq('code', body.code.toUpperCase()).maybeSingle();
    return w ? json({ ok: true, workshop: { name: w.name, code: w.code, logo: w.logo_url, brandColor: w.brand_color, template: w.template } }, 200, h) : json({ ok: false }, 404, h);
  }

  if (body.action === 'lookup') {
    if (!(await allowed(sb, 'lookup-ip', ip, 60, 10))) return limited();
    if (body.website) return reply(NOT_AVAILABLE);
    // Entrada por el QR del albarán: código corto del coche (mismo límite por IP que la matrícula).
    if (body.vehicleCode !== undefined) {
      if (!isVehicleCode(body.vehicleCode)) return reply(NOT_AVAILABLE);
      const wcode = typeof body.code === 'string' ? body.code.toUpperCase() : '';
      const { data: ws } = await sb.from('workshops').select('id').eq('code', wcode).maybeSingle();
      const { data: cv } = ws ? await sb.from('vehicles').select('*').eq('workshop_id', ws.id).eq('public_code', String(body.vehicleCode).toUpperCase()).maybeSingle() : { data: null };
      if (!cv) return reply(NOT_AVAILABLE);
      return reply({ ok: true, token: await signView({ v: cv.id, w: ws!.id }, VIEW_TTL), ...(await dto(sb, cv)) });
    }
    const plate = normalizePlate(body.plate);
    if (!classifyPlate(plate)) return reply(NOT_AVAILABLE);
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    if (!(await allowed(sb, 'lookup-plate', `${code}:${plate}`, 600, 6))) return limited();
    const { data: w } = await sb.from('workshops').select('id').eq('code', code).maybeSingle();
    if (!w) return reply(NOT_AVAILABLE);
    const { data: rows } = await sb.from('vehicles').select('*').eq('workshop_id', w.id).eq('plate', plate).order('entered_at', { ascending: false }).limit(5);
    const v = (rows ?? []).find((r: Row) => r.state !== 'delivered') ?? (rows ?? [])[0];
    if (!v) return reply(NOT_AVAILABLE);
    return reply({ ok: true, token: await signView({ v: v.id, w: w.id }, VIEW_TTL), ...(await dto(sb, v)) });
  }

  if (body.action === 'refresh' || body.action === 'verify') {
    const t = await readView(body.token);
    if (body.action === 'refresh') {
      if (!(await allowed(sb, 'refresh-ip', ip, 60, 30))) return limited();
      const { data: v } = t ? await sb.from('vehicles').select('*').eq('id', t.v).eq('workshop_id', t.w).maybeSingle() : { data: null };
      return json(v ? { ok: true, ...(await dto(sb, v)) } : NOT_AVAILABLE, 200, h);
    }
    if (!(await allowed(sb, 'verify-ip', ip, 600, 10))) return limited();
    if (t && (!(await allowed(sb, 'verify-vehicle', t.v, 900, 5)) || !(await allowed(sb, 'verify-vehicle-day', t.v, 86400, 15)))) return limited();
    const { data: v } = t ? await sb.from('vehicles').select('phone, cost_estimate, cost_final').eq('id', t.v).eq('workshop_id', t.w).maybeSingle() : { data: null };
    const last4 = typeof body.last4 === 'string' && /^\d{4}$/.test(body.last4) ? body.last4 : null;
    if (!v || !v.phone || !last4 || v.phone.slice(-4) !== last4) return reply(NOT_AVAILABLE);
    return reply({ ok: true, cost: { estimate: v.cost_estimate, final: v.cost_final } });
  }
  return json({ ok: false, error: 'not_found' }, 404, h);
});
