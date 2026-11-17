// Edge Function `panel`: acceso por PIN y operaciones del taller. Usa la clave de servicio y filtra
// SIEMPRE por el taller de la sesión; el navegador no toca las tablas.
// La cookie de sesión es httpOnly. Como la función vive en otro dominio que la app, va con
// SameSite=None; Secure: lo recomendable es poner la función detrás del mismo dominio (proxy /api) y
// cambiar COOKIE_SAMESITE a Strict. Ver docs/deploy-supabase.md.
import { SignJWT } from 'npm:jose@5';
import { allowed, clientIp, db, json, open, randomToken, sha256, sleep, verifyPin } from '../_shared/http.ts';
import { capacities, locationsFor, OPERATORS, pickSlot, preferredLocations } from '../_shared/domain.js';
import { classifyPlate } from '../_shared/plates.js';
import { NOTE_TAGS_MAX, TAGS_PER_VEHICLE, cleanTags, cleanText, isPin, isUuid, normalizePhone, parseCost, validateNewVehicle, validatePart, validatePatch, validateWorkshopSettings } from '../_shared/validate.js';
import catalog from '../_shared/models.json' with { type: 'json' };

const COOKIE = 'tg_session';
const TTL_S = 12 * 3600;
const SAMESITE = Deno.env.get('COOKIE_SAMESITE') ?? 'None';
type Row = Record<string, any>;
type Sb = ReturnType<typeof db>;

const cookie = (token: string, clear = false) => `${COOKIE}=${clear ? '' : token}; Path=/; HttpOnly; Secure; SameSite=${SAMESITE}; Max-Age=${clear ? 0 : TTL_S}`;

async function session(sb: Sb, req: Request) {
  const m = /(?:^|;\s*)tg_session=([A-Za-z0-9_-]{20,})/.exec(req.headers.get('cookie') ?? '');
  if (!m) return null;
  const { data } = await sb.from('panel_sessions').select('workshop_id, operator, sid, expires_at').eq('token_hash', await sha256(m[1])).maybeSingle();
  if (!data || new Date(data.expires_at).getTime() < Date.now()) return null;
  return { ...data, token: m[1] };
}

// Fila de BD -> lo que ve el panel (nunca el teléfono completo).
async function panelDto(sb: Sb, v: Row) {
  const [{ data: parts }, { data: hist }] = await Promise.all([
    sb.from('parts').select('id, description, state, eta_at').eq('vehicle_id', v.id).order('created_at'),
    sb.from('history').select('at, by, type, from_value, to_value').eq('vehicle_id', v.id).order('at').limit(200),
  ]);
  return {
    id: v.id, plate: v.plate, plateKind: v.plate_kind, modelId: v.model_id, make: v.make, model: v.model, bodyType: v.body_type, dims: v.dims,
    state: v.state, location: v.location, slot: v.slot, notes: v.notes, costEstimate: v.cost_estimate, costFinal: v.cost_final,
    enteredAt: v.entered_at, etaAt: v.eta_at, deliveredAt: v.delivered_at, rev: v.rev, updatedAt: v.updated_at, lastBy: v.last_by,
    hasPhone: !!v.phone, phoneLast4: v.phone ? v.phone.slice(-4) : null, publicCode: v.public_code, tags: v.tags ?? [],
    parts: (parts ?? []).map((p: Row) => ({ id: p.id, description: p.description, state: p.state, etaAt: p.eta_at })),
    history: (hist ?? []).map((x: Row) => ({ at: x.at, by: x.by, type: x.type, from: x.from_value, to: x.to_value })),
  };
}

async function taken(sb: Sb, wid: string, except?: string) {
  const { data } = await sb.from('vehicles').select('id, location, slot').eq('workshop_id', wid).not('location', 'is', null);
  return new Set((data ?? []).filter((r: Row) => r.id !== except).map((r: Row) => `${r.location}:${r.slot}`));
}

// Aviso «algo cambió» al canal privado del taller (Broadcast). Sin datos del coche.
async function notify(wid: string) {
  await fetch(`${Deno.env.get('SUPABASE_URL')}/realtime/v1/api/broadcast`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}` },
    body: JSON.stringify({ messages: [{ topic: `workshop:${wid}`, event: 'change', payload: {}, private: true }] }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  const started = Date.now();
  const o = await open(req);
  if (o instanceof Response) return o;
  const { h, body } = o;
  const sb = db();
  const ip = clientIp(req);
  const out = (b: unknown, status = 200, extra: Record<string, string> = {}) => json(b, status, { ...h, ...extra });
  const fail = (error: string, status: number) => out({ ok: false, error }, status);

  if (body.action === 'login') {
    const code = typeof body.code === 'string' ? body.code.toUpperCase() : '';
    const { data: w } = await sb.from('workshops').select('*').eq('code', code).maybeSingle();
    // El contador de fallos se consume antes de comprobar: 5 por IP cada 5 min, 20 por taller cada 15 min.
    const okIp = await allowed(sb, 'login-ip', ip, 300, 5);
    const okW = await allowed(sb, 'login-workshop', w?.id ?? 'none', 900, 20);
    if (!okIp || !okW) return out({ ok: false, error: 'locked', retryAfter: 300 }, 429);
    const valid = !body.website && w && isPin(body.pin) && OPERATORS.includes(body.operator as string) && (await verifyPin(body.pin as string, w.pin_hash));
    if (!valid) { await sleep(started + 420 - Date.now()); return fail('bad_credentials', 401); }
    const token = randomToken(); const sid = randomToken().slice(0, 12);
    await sb.from('panel_sessions').insert({ token_hash: await sha256(token), workshop_id: w.id, operator: body.operator, sid, expires_at: new Date(Date.now() + TTL_S * 1000).toISOString() });
    return out({ ok: true, operator: body.operator, sid, workshop: { id: w.id, name: w.name, code: w.code, logo: w.logo_url, brandColor: w.brand_color, template: w.template, timezone: w.timezone, retentionDays: w.retention_days, staleDays: w.stale_days, noteTags: w.note_tags } }, 200, { 'Set-Cookie': cookie(token) });
  }

  const s = await session(sb, req);
  if (body.action === 'session' && !s) return out({ ok: false });
  if (!s) return fail('unauthorized', 401);
  if (!(await allowed(sb, 'panel-ip', ip, 60, 240))) return fail('rate_limited', 429);
  const wid = s.workshop_id as string;
  const { data: w } = await sb.from('workshops').select('*').eq('id', wid).single();
  const tpl = w.template;
  const own = async (id: unknown) => (isUuid(id) ? (await sb.from('vehicles').select('*').eq('id', id).eq('workshop_id', wid).maybeSingle()).data : null);
  const done = async (v: Row, extra: Record<string, unknown> = {}, status = 200) => { await notify(wid); return out({ ok: true, vehicle: await panelDto(sb, v), ...extra }, status); };
  const touch = { last_session: s.sid, last_by: s.operator, updated_at: new Date().toISOString() };
  const log = (vehicle_id: string, type: string, from_value: string | null, to_value: string | null) => sb.from('history').insert({ vehicle_id, by: s.operator, type, from_value, to_value });

  // Idempotencia: si esta operación (opId) ya se aplicó, se devuelve la misma respuesta sin repetirla.
  const rawOp = (body.input as Row)?.opId ?? (body.patch as Row)?.opId ?? (body.part as Row)?.opId ?? body.opId;
  const opId = isUuid(rawOp) ? (rawOp as string) : null;
  if (opId) {
    const { data: seen } = await sb.from('panel_ops').select('result').eq('workshop_id', wid).eq('op_id', opId).maybeSingle();
    if (seen) return out(seen.result);
  }
  const remember = async (res: Response) => {
    if (opId && res.ok) await sb.from('panel_ops').upsert({ workshop_id: wid, op_id: opId, result: await res.clone().json() }, { onConflict: 'workshop_id,op_id', ignoreDuplicates: true });
    return res;
  };

  switch (body.action) {
    case 'session':
      return out({ ok: true, operator: s.operator, sid: s.sid, workshop: { id: w.id, name: w.name, code: w.code, logo: w.logo_url, brandColor: w.brand_color, template: tpl, timezone: w.timezone, retentionDays: w.retention_days, staleDays: w.stale_days, noteTags: w.note_tags } });
    case 'logout':
      await sb.from('panel_sessions').delete().eq('token_hash', await sha256(s.token));
      return out({ ok: true }, 200, { 'Set-Cookie': cookie('', true) });
    case 'list': {
      const { data } = await sb.from('vehicles').select('*').eq('workshop_id', wid).order('entered_at');
      return out({ ok: true, vehicles: await Promise.all((data ?? []).map((v: Row) => panelDto(sb, v))) });
    }
    case 'realtime_token': {
      const token = await new SignJWT({ role: 'authenticated', workshop_id: wid }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h')
        .sign(new TextEncoder().encode(Deno.env.get('JWT_SECRET')!));
      return out({ ok: true, token, sid: s.sid, workshopId: wid });
    }
    case 'create': {
      const input = (body.input ?? {}) as Row;
      const val = validateNewVehicle(input, catalog);
      if (!val.ok) return out({ ok: false, error: 'validation', errors: val.errors }, 422);
      if (input.id && (await sb.from('vehicles').select('id').eq('id', input.id).maybeSingle()).data) { const v = await own(input.id); return v ? done(v) : fail('invalid', 400); }
      const m = val.model as Row | null;
      // Si otro dispositivo ocupa la plaza entre la lectura y la escritura, el índice único la rechaza y se busca otra.
      for (let attempt = 0; attempt < 3; attempt += 1) {
        const place = pickSlot(await taken(sb, wid), tpl, preferredLocations('received', tpl, null));
        if (!place) return fail('workshop_full', 409);
        const { data: v, error } = await sb.from('vehicles').insert({
          ...(input.id ? { id: input.id } : {}), workshop_id: wid, plate: val.plate, plate_kind: classifyPlate(val.plate), model_id: m?.id ?? null,
          make: m ? m.make : cleanText(input.make), model: m ? m.model : cleanText(input.model), body_type: m ? m.body : input.bodyType, dims: m ? { l: m.l, w: m.w, h: m.h } : null,
          phone: val.phone, ...place, ...touch,
        }).select().single();
        if (!error) { await log(v.id, 'created', null, 'received'); return remember(await done(v, {}, 201)); }
        if (error.code !== '23505') return fail('invalid', 400);
        if (String(error.message).includes('vehicles_active_plate')) return fail('plate_exists', 409);
      }
      return fail('workshop_full', 409);
    }
    case 'patch': {
      const v = await own(body.id); const p = (body.patch ?? {}) as Row;
      if (!v) return fail('not_found', 404);
      const val = validatePatch(p);
      if (!val.ok) return out({ ok: false, error: 'validation', errors: val.errors }, 422);
      const conflict = Number.isInteger(p.baseRev) && p.baseRev < v.rev && v.last_session && v.last_session !== s.sid ? { by: v.last_by ?? 'office', at: v.updated_at } : null;
      const state = p.state ?? v.state;
      let place: { location: string | null; slot: number | null } = { location: v.location, slot: v.slot };
      if (state === 'delivered') place = { location: null, slot: null };
      else if (p.location !== undefined && p.location !== v.location) {
        if (!locationsFor(tpl).includes(p.location) || !capacities(tpl)[p.location]) return fail('invalid', 400);
        const f = pickSlot(await taken(sb, wid, v.id), tpl, [p.location]);
        if (!f) return fail('location_full', 409);
        place = f;
      } else if (state !== v.state) {
        const prefs = preferredLocations(state, tpl, v.location);
        if (!prefs.includes(v.location)) {
          const f = pickSlot(await taken(sb, wid, v.id), tpl, [...prefs, 'parking', 'waiting', 'reception']);
          if (!f) return fail('workshop_full', 409);
          place = f;
        }
      }
      const upd: Row = { ...place, state, rev: v.rev + 1, ...touch, delivered_at: state === 'delivered' ? (v.delivered_at ?? touch.updated_at) : null };
      if (p.notes !== undefined) upd.notes = cleanText(p.notes);
      if (p.costEstimate !== undefined) upd.cost_estimate = parseCost(p.costEstimate);
      if (p.costFinal !== undefined) upd.cost_final = parseCost(p.costFinal);
      if (p.etaAt !== undefined) upd.eta_at = p.etaAt || null;
      if (p.tags !== undefined) upd.tags = cleanTags(p.tags, TAGS_PER_VEHICLE);
      if (p.phone !== undefined) upd.phone = normalizePhone(p.phone) || null;
      // El índice único de plazas rechaza la escritura si otro dispositivo ocupó la plaza entre medias.
      // Control optimista: solo se escribe si nadie cambió la fila desde que se leyó (misma rev).
      const { data: nv, error } = await sb.from('vehicles').update(upd).eq('id', v.id).eq('workshop_id', wid).eq('rev', v.rev).select().maybeSingle();
      if (error) return fail(error.code === '23505' ? 'location_full' : 'invalid', 409);
      if (!nv) return fail('conflict', 409);
      if (state !== v.state) await log(v.id, 'state', v.state, state);
      if (place.location && place.location !== v.location) await log(v.id, 'location', v.location, place.location);
      return remember(await done(nv, { conflict }));
    }
    case 'delete': {
      const v = await own(body.id);
      if (!v) return fail('not_found', 404);
      await sb.from('vehicles').delete().eq('id', v.id).eq('workshop_id', wid);
      await notify(wid);
      return out({ ok: true });
    }
    case 'part_add': case 'part_patch': case 'part_remove': {
      const v = await own(body.id);
      if (!v) return fail('not_found', 404);
      if (body.action === 'part_add') {
        const part = (body.part ?? {}) as Row; const val = validatePart(part);
        if (!val.ok) return out({ ok: false, error: 'validation', errors: val.errors }, 422);
        await sb.from('parts').upsert({ ...(part.id ? { id: part.id } : {}), vehicle_id: v.id, description: cleanText(part.description), eta_at: part.etaAt || null }, { onConflict: 'id', ignoreDuplicates: true });
        await log(v.id, 'part', null, 'needed');
      } else if (!isUuid(body.pid)) return fail('not_found', 404);
      else if (body.action === 'part_patch') {
        const patch = (body.patch ?? {}) as Row; const val = validatePart(patch, { partial: true });
        if (!val.ok) return out({ ok: false, error: 'validation', errors: val.errors }, 422);
        const upd: Row = {};
        if (patch.state !== undefined) upd.state = patch.state;
        if (patch.etaAt !== undefined) upd.eta_at = patch.etaAt || null;
        await sb.from('parts').update(upd).eq('id', body.pid).eq('vehicle_id', v.id);
        if (patch.state !== undefined) await log(v.id, 'part', null, patch.state);
      } else await sb.from('parts').delete().eq('id', body.pid).eq('vehicle_id', v.id);
      const { data: nv } = await sb.from('vehicles').update({ rev: v.rev + 1, ...touch }).eq('id', v.id).eq('workshop_id', wid).select().single();
      return remember(await done(nv));
    }
    case 'export': {
      const v = await own(body.id);
      if (!v) return fail('not_found', 404);
      const d = await panelDto(sb, v);
      return out({ exportedAt: new Date().toISOString(), workshop: w.name, vehicle: { ...d, phone: v.phone } });
    }
    case 'retention_run': {
      const { data } = await sb.rpc('run_retention', { p_workshop: wid });
      await notify(wid);
      return out({ ok: true, deleted: data ?? 0 });
    }
    case 'retention_set': {
      const d = body.retentionDays;
      if (!Number.isInteger(d) || (d as number) < 1 || (d as number) > 365) return out({ ok: false, error: 'validation', errors: { retentionDays: 'invalid' } }, 422);
      await sb.from('workshops').update({ retention_days: d }).eq('id', wid);
      return out({ ok: true, workshop: { id: w.id, name: w.name, code: w.code, logo: w.logo_url, brandColor: w.brand_color, template: tpl, timezone: w.timezone, retentionDays: d } });
    }
    case 'workshop_set': {
      const p = (body.patch ?? {}) as Row;
      const val = validateWorkshopSettings(p);
      if (!val.ok) return out({ ok: false, error: 'validation', errors: val.errors }, 422);
      const upd: Row = {};
      if (p.retentionDays !== undefined) upd.retention_days = p.retentionDays;
      if (p.staleDays !== undefined) upd.stale_days = p.staleDays;
      if (p.noteTags !== undefined) upd.note_tags = p.noteTags === null ? null : cleanTags(p.noteTags, NOTE_TAGS_MAX);
      const { data: nw } = await sb.from('workshops').update(upd).eq('id', wid).select().single();
      return out({ ok: true, workshop: { id: nw.id, name: nw.name, code: nw.code, logo: nw.logo_url, brandColor: nw.brand_color, template: tpl, timezone: nw.timezone, retentionDays: nw.retention_days, staleDays: nw.stale_days, noteTags: nw.note_tags } });
    }
    default: return fail('not_found', 404);
  }
});
