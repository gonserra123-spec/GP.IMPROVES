// Clientes habituales (importación) y citas: reglas comunes a cliente y servidor.
import { BODY_TYPES } from './domain.js';
import { classifyPlate, normalizePlate } from './plates.js';
import { cleanText, freeTextError, isEmail, isPhone, normalizePhone } from './validate.js';

export const MAX_IMPORT_ROWS = 2000;
export const MAX_BOOK_DAYS = 60;
export const SLOTS = ['morning', 'afternoon'];

const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\bvw\b/g, 'volkswagen').replace(/[^a-z0-9]+/g, ' ').trim();

// Busca el modelo del catálogo en «marca», «modelo» o un campo «vehículo» suelto (p. ej. «Seat León 1.6 TDI»).
export function matchModel(catalog, make, model, vehicle) {
  const full = fold(vehicle || `${make || ''} ${model || ''}`);
  if (!full) return null;
  let best = null; let len = 0;
  for (const c of catalog) {
    const key = fold(`${c.make} ${c.model}`);
    if ((full === key || ` ${full} `.includes(` ${key} `)) && key.length > len) { best = c; len = key.length; }
  }
  return best;
}

// Una fila de la hoja del taller -> cliente listo para guardar (o errores por campo).
export function validateImportRow(raw, catalog) {
  const errors = {};
  const plate = normalizePlate(raw.plate);
  const kind = classifyPlate(plate);
  if (!plate) errors.plate = 'required'; else if (!kind) errors.plate = 'plate_format';
  const m = matchModel(catalog, raw.make, raw.model, raw.vehicle);
  let make = cleanText(raw.make); let model = cleanText(raw.model);
  if (!make && !model && raw.vehicle) { const p = cleanText(raw.vehicle).split(' '); make = p[0] || ''; model = p.slice(1).join(' '); }
  if (!m && (make.length < 2 || model.length < 1)) errors.vehicle = 'required';
  const phone = normalizePhone(raw.phone);
  if (phone && !isPhone(phone)) errors.phone = 'phone_format';
  const email = cleanText(raw.email).toLowerCase();
  if (email && !isEmail(email)) errors.email = 'email_format';
  return {
    ok: Object.keys(errors).length === 0, errors,
    row: { plate, plateKind: kind, modelId: m ? m.id : null, make: m ? m.make : make.slice(0, 40), model: m ? m.model : model.slice(0, 40), bodyType: m ? m.body : 'compact', phone: phone || null, email: email || null },
  };
}

const isoDay = (d) => d.toISOString().slice(0, 10);
export const todayIso = () => isoDay(new Date());
export const addDaysIso = (iso, n) => isoDay(new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000));

// Reserva de cita desde la web pública. `known`: el taller ya tiene ese coche, así que no se pide el modelo.
export function validateBooking(input, catalog, { known = false, today = todayIso() } = {}) {
  const errors = {};
  const plate = normalizePlate(input.plate);
  if (!plate) errors.plate = 'required'; else if (!classifyPlate(plate)) errors.plate = 'plate_format';
  const email = cleanText(input.email).toLowerCase();
  if (!email) errors.email = 'required'; else if (!isEmail(email)) errors.email = 'email_format';
  const phone = normalizePhone(input.phone);
  if (phone && !isPhone(phone)) errors.phone = 'phone_format';
  const d = String(input.date || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d) || Number.isNaN(Date.parse(d))) errors.date = 'required';
  else if (d < today || d > addDaysIso(today, MAX_BOOK_DAYS)) errors.date = 'date_range';
  if (!SLOTS.includes(input.slot)) errors.slot = 'required';
  const re = freeTextError(input.reason, { required: true, max: 300 }); if (re) errors.reason = re;
  if (input.consent !== true) errors.consent = 'required';
  let vehicle = null;
  if (!known) {
    if (input.modelId && input.modelId !== 'other') {
      const m = catalog.find((c) => c.id === input.modelId);
      if (!m) errors.modelId = 'required'; else vehicle = { modelId: m.id, make: m.make, model: m.model, bodyType: m.body };
    } else {
      const make = cleanText(input.make); const model = cleanText(input.model);
      if (make.length < 2 || make.length > 40) errors.make = 'required';
      if (model.length < 1 || model.length > 40) errors.model = 'required';
      if (!BODY_TYPES.includes(input.bodyType)) errors.bodyType = 'required';
      vehicle = { modelId: null, make, model, bodyType: input.bodyType };
    }
  }
  return { ok: Object.keys(errors).length === 0, errors, plate, email, phone: phone || null, vehicle, reason: cleanText(input.reason) };
}
