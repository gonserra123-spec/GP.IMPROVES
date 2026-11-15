// Almacén en memoria del modo demo. Todos los datos son ficticios (fixtures) y se pierden al reiniciar.
// Cada operación recibe el id del taller de la sesión: nunca se cruza un taller con otro.
import { EventEmitter } from 'node:events';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { capacities, locationsFor, preferredLocations } from '../shared/domain.js';
import { parseCost, cleanText, normalizePhone } from '../shared/validate.js';
import { hashPin } from './security.js';

const load = (f) => JSON.parse(readFileSync(new URL(`../shared/${f}`, import.meta.url), 'utf8'));
export const CATALOG = load('models.json');
export const TEMPLATE = load('template.json');
export const DEMO_PIN = process.env.DEMO_PIN || '2468';
export const events = new EventEmitter();
events.setMaxListeners(200);

const DAY = 86_400_000;
const MAX_VEHICLES = 300; // por taller, contando entregados pendientes de retención
const workshops = new Map();
const vehicles = new Map();

const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);

function seedVehicle(wid, now, spec) {
  const m = CATALOG.find((c) => c.id === spec.model);
  const entered = now - spec.daysAgo * DAY;
  const v = {
    id: randomUUID(), workshopId: wid, plate: spec.plate, plateKind: 'es_current',
    modelId: m.id, make: m.make, model: m.model, bodyType: m.body, dims: { l: m.l, w: m.w, h: m.h },
    phone: spec.phone || null, state: spec.state, location: spec.location ?? null, slot: spec.slot ?? null,
    notes: spec.notes || '', costEstimate: spec.est ?? null, costFinal: spec.final ?? null,
    enteredAt: new Date(entered).toISOString(), etaAt: spec.eta !== undefined ? isoDay(now + spec.eta * DAY) : null,
    deliveredAt: spec.deliveredDaysAgo !== undefined ? new Date(now - spec.deliveredDaysAgo * DAY).toISOString() : null,
    parts: (spec.parts || []).map((p) => ({ id: randomUUID(), description: p.d, state: p.s, etaAt: p.eta !== undefined ? isoDay(now + p.eta * DAY) : null })),
    history: [{ at: new Date(entered).toISOString(), by: 'office', type: 'created', to: 'received' }],
    rev: 1, updatedAt: new Date(entered).toISOString(), lastSession: null,
  };
  if (spec.state !== 'received') v.history.push({ at: new Date(entered + 3_600_000).toISOString(), by: 'mechanic1', type: 'state', from: 'received', to: spec.state });
  vehicles.set(v.id, v);
}

export function seed(now = Date.now()) {
  workshops.clear(); vehicles.clear();
  const w = {
    id: 'w-demo', name: 'Taller Demo', code: 'DEMO01', logo: null, brandColor: '#2F6FED',
    template: { id: TEMPLATE.id, lifts: TEMPLATE.lifts, pit: TEMPLATE.pit }, timezone: 'Europe/Madrid', retentionDays: 30,
    pinHash: hashPin(DEMO_PIN),
  };
  workshops.set(w.id, w);
  const F = [
    { plate: '1234BCD', model: 'seat-leon', state: 'in_repair', location: 'lift1', slot: 0, phone: '+34600000101', est: 320, eta: 1, daysAgo: 2, notes: 'Cambio de embrague. Cliente avisado del plazo.' },
    { plate: '5678FGH', model: 'renault-clio', state: 'awaiting_part', location: 'waiting', slot: 0, phone: '+34600000102', est: 540, eta: 4, daysAgo: 3, parts: [{ d: 'Bomba de agua y kit de distribución', s: 'ordered', eta: 3 }] },
    { plate: '9012JKL', model: 'toyota-rav4', state: 'diagnosis', location: 'diagnosis_bay', slot: 0, daysAgo: 0 },
    { plate: '3456MNP', model: 'volkswagen-golf', state: 'ready', location: 'pickup', slot: 0, phone: '+34600000103', est: 180, final: 185.5, daysAgo: 4 },
    { plate: '7890RST', model: 'ford-transit-custom', state: 'received', location: 'reception', slot: 0, daysAgo: 0 },
    { plate: '2468VWX', model: 'peugeot-3008', state: 'awaiting_approval', location: 'waiting', slot: 1, phone: '+34600000104', est: 890, daysAgo: 1 },
    { plate: '1357YZB', model: 'fiat-500', state: 'in_repair', location: 'pit', slot: 0, daysAgo: 1, eta: 0 },
    { plate: '8024CDF', model: 'opel-corsa', state: 'delivered', daysAgo: 52, deliveredDaysAgo: 45, phone: '+34600000105', final: 240 },
    { plate: '4680GHJ', model: 'kia-sportage', state: 'delivered', daysAgo: 6, deliveredDaysAgo: 2, final: 410 },
  ];
  for (const f of F) seedVehicle(w.id, now, f);
}
seed();

export const getWorkshop = (id) => workshops.get(id) || null;
export const findWorkshopByCode = (code) => [...workshops.values()].find((w) => w.code === String(code).toUpperCase()) || null;
export const workshopPublic = (w) => ({ name: w.name, code: w.code, logo: w.logo, brandColor: w.brandColor, template: w.template });
export const workshopPanel = (w) => ({ ...workshopPublic(w), id: w.id, timezone: w.timezone, retentionDays: w.retentionDays });

const ofWorkshop = (wid) => [...vehicles.values()].filter((v) => v.workshopId === wid);
const own = (wid, id) => { const v = vehicles.get(id); return v && v.workshopId === wid ? v : null; };

function freeSlot(wid, location, exceptId) {
  const cap = capacities(getWorkshop(wid).template)[location];
  if (!cap) return null;
  const used = new Set(ofWorkshop(wid).filter((v) => v.id !== exceptId && v.location === location).map((v) => v.slot));
  for (let i = 0; i < cap; i += 1) if (!used.has(i)) return i;
  return null;
}

// Lo que ve el panel: nunca el teléfono completo.
export function panelDto(v) {
  const { phone, workshopId, lastSession, ...rest } = v;
  return { ...rest, hasPhone: !!phone, phoneLast4: phone ? phone.slice(-4) : null };
}
export const listVehicles = (wid) => ofWorkshop(wid).sort((a, b) => a.enteredAt.localeCompare(b.enteredAt)).map(panelDto);

function emit(wid, payload) { events.emit('change', { wid, ...payload }); }
function touch(v, session) { v.rev += 1; v.updatedAt = new Date().toISOString(); v.lastSession = session.sid; v.lastBy = session.operator; }

export function createVehicle(wid, session, data) {
  if (data.id && vehicles.has(data.id)) return own(wid, data.id) ? { vehicle: panelDto(vehicles.get(data.id)) } : { error: 'invalid', status: 400 };
  if (ofWorkshop(wid).some((v) => v.plate === data.plate && v.state !== 'delivered')) return { error: 'plate_exists', status: 409 };
  if (ofWorkshop(wid).length >= MAX_VEHICLES) return { error: 'workshop_full', status: 409 };
  const tpl = getWorkshop(wid).template;
  let location = null; let slot = null;
  for (const loc of preferredLocations('received', tpl, null)) { const s = freeSlot(wid, loc); if (s !== null) { location = loc; slot = s; break; } }
  if (location === null) return { error: 'workshop_full', status: 409 };
  const now = new Date().toISOString();
  const m = data.model;
  const v = {
    id: data.id || randomUUID(), workshopId: wid, plate: data.plate, plateKind: data.plateKind,
    modelId: m ? m.id : null, make: m ? m.make : cleanText(data.make), model: m ? m.model : cleanText(data.modelName),
    bodyType: m ? m.body : data.bodyType, dims: m ? { l: m.l, w: m.w, h: m.h } : null,
    phone: data.phone, state: 'received', location, slot, notes: '', costEstimate: null, costFinal: null,
    enteredAt: now, etaAt: null, deliveredAt: null, parts: [],
    history: [{ at: now, by: session.operator, type: 'created', to: 'received' }],
    rev: 1, updatedAt: now, lastSession: session.sid, lastBy: session.operator,
  };
  vehicles.set(v.id, v);
  emit(wid, { kind: 'vehicle', vehicle: panelDto(v), sid: session.sid });
  return { vehicle: panelDto(v) };
}

export function patchVehicle(wid, session, id, patch) {
  const v = own(wid, id);
  if (!v) return { error: 'not_found', status: 404 };
  const tpl = getWorkshop(wid).template;
  const now = new Date().toISOString();
  // Gana el último cambio; si la base del cliente era antigua y el anterior fue de otro dispositivo, se avisa.
  const conflict = Number.isInteger(patch.baseRev) && patch.baseRev < v.rev && v.lastSession && v.lastSession !== session.sid
    ? { by: v.lastBy || 'office', at: v.updatedAt } : null;

  let location = v.location; let slot = v.slot; let state = v.state;
  if (patch.state !== undefined && patch.state !== v.state) state = patch.state;
  if (state === 'delivered') { location = null; slot = null; }
  else if (patch.location !== undefined && patch.location !== v.location) {
    if (!locationsFor(tpl).includes(patch.location)) return { error: 'invalid', status: 400 };
    const s = freeSlot(wid, patch.location, v.id);
    if (s === null) return { error: 'location_full', status: 409 };
    location = patch.location; slot = s;
  } else if (state !== v.state) {
    const prefs = preferredLocations(state, tpl, v.location);
    if (!prefs.includes(v.location) || v.location === null) {
      for (const loc of [...prefs, 'parking', 'waiting', 'reception']) { const s = freeSlot(wid, loc, v.id); if (s !== null) { location = loc; slot = s; break; } }
      if (location === null) return { error: 'workshop_full', status: 409 };
    }
  }
  if (state !== v.state) {
    v.history.push({ at: now, by: session.operator, type: 'state', from: v.state, to: state });
    v.deliveredAt = state === 'delivered' ? now : null;
    v.state = state;
  }
  if (location !== v.location) {
    if (location) v.history.push({ at: now, by: session.operator, type: 'location', from: v.location, to: location });
    v.location = location;
  }
  v.slot = slot;
  if (patch.notes !== undefined) v.notes = cleanText(patch.notes);
  if (patch.costEstimate !== undefined) v.costEstimate = parseCost(patch.costEstimate);
  if (patch.costFinal !== undefined) v.costFinal = parseCost(patch.costFinal);
  if (patch.etaAt !== undefined) v.etaAt = patch.etaAt || null;
  if (patch.phone !== undefined) v.phone = normalizePhone(patch.phone) || null;
  if (v.history.length > 200) v.history.splice(0, v.history.length - 200);
  touch(v, session);
  emit(wid, { kind: 'vehicle', vehicle: panelDto(v), sid: session.sid, conflict });
  return { vehicle: panelDto(v), conflict };
}

export function addPart(wid, session, id, data) {
  const v = own(wid, id);
  if (!v) return { error: 'not_found', status: 404 };
  if (data.id && v.parts.some((p) => p.id === data.id)) return { vehicle: panelDto(v) };
  if (v.parts.length >= 30) return { error: 'invalid', status: 400 };
  v.parts.push({ id: data.id || randomUUID(), description: cleanText(data.description), state: 'needed', etaAt: data.etaAt || null });
  v.history.push({ at: new Date().toISOString(), by: session.operator, type: 'part', to: 'needed' });
  touch(v, session);
  emit(wid, { kind: 'vehicle', vehicle: panelDto(v), sid: session.sid });
  return { vehicle: panelDto(v) };
}

export function patchPart(wid, session, id, pid, data) {
  const v = own(wid, id);
  const p = v?.parts.find((x) => x.id === pid);
  if (!p) return { error: 'not_found', status: 404 };
  if (data.state !== undefined && data.state !== p.state) {
    v.history.push({ at: new Date().toISOString(), by: session.operator, type: 'part', from: p.state, to: data.state });
    p.state = data.state;
  }
  if (data.etaAt !== undefined) p.etaAt = data.etaAt || null;
  touch(v, session);
  emit(wid, { kind: 'vehicle', vehicle: panelDto(v), sid: session.sid });
  return { vehicle: panelDto(v) };
}

export function removePart(wid, session, id, pid) {
  const v = own(wid, id);
  if (!v || !v.parts.some((x) => x.id === pid)) return { error: 'not_found', status: 404 };
  v.parts = v.parts.filter((x) => x.id !== pid);
  touch(v, session);
  emit(wid, { kind: 'vehicle', vehicle: panelDto(v), sid: session.sid });
  return { vehicle: panelDto(v) };
}

export function deleteVehicle(wid, session, id) {
  if (!own(wid, id)) return { error: 'not_found', status: 404 };
  vehicles.delete(id);
  emit(wid, { kind: 'delete', id, sid: session?.sid });
  return { ok: true };
}

// Exportación RGPD: todo lo que se guarda de ese coche y su cliente.
export function exportVehicle(wid, id) {
  const v = own(wid, id);
  if (!v) return null;
  const { workshopId, lastSession, lastBy, rev, slot, ...data } = v;
  return { exportedAt: new Date().toISOString(), workshop: getWorkshop(wid).name, vehicle: data };
}

export function setRetention(wid, days) { getWorkshop(wid).retentionDays = days; return workshopPanel(getWorkshop(wid)); }

export function runRetention(now = Date.now()) {
  let deleted = 0;
  for (const v of [...vehicles.values()]) {
    const w = getWorkshop(v.workshopId);
    if (v.state === 'delivered' && v.deliveredAt && Date.parse(v.deliveredAt) + w.retentionDays * DAY < now) {
      vehicles.delete(v.id); deleted += 1;
      emit(w.id, { kind: 'delete', id: v.id, sid: null });
    }
  }
  return deleted;
}

export const findByPlate = (wid, plate) => {
  const all = ofWorkshop(wid).filter((v) => v.plate === plate);
  return all.find((v) => v.state !== 'delivered') || all.sort((a, b) => b.enteredAt.localeCompare(a.enteredAt))[0] || null;
};
export const getOwn = own;

// DTO mínimo de la consulta: solo ese coche; de los demás, únicamente qué plaza ocupan.
export function publicDto(v) {
  return {
    vehicle: {
      plate: v.plate, make: v.make, model: v.model, bodyType: v.bodyType, dims: v.dims,
      state: v.state, location: v.location, slot: v.slot, etaAt: v.etaAt,
      parts: v.parts.filter((p) => p.state !== 'arrived').map((p) => ({ description: p.description, state: p.state, etaAt: p.etaAt })),
      canVerify: !!v.phone,
    },
    others: ofWorkshop(v.workshopId).filter((o) => o.id !== v.id && o.location).map((o) => ({ location: o.location, slot: o.slot })),
  };
}
export const publicCost = (v) => ({ estimate: v.costEstimate, final: v.costFinal });
