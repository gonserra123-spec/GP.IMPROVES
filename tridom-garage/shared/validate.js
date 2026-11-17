// Validadores compartidos: el cliente los usa para avisar pronto y el servidor para decidir.
import { BODY_TYPES, PART_STATES, STATES } from './domain.js';
import { classifyPlate, normalizePlate } from './plates.js';

export const MIN_TEXT = 10;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CONTROL = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/;

export const isUuid = (v) => typeof v === 'string' && UUID.test(v);
export const cleanText = (v) => String(v ?? '').replace(/\s+/g, ' ').trim();
export const normalizePhone = (v) => String(v ?? '').replace(/[\s\-().]/g, '');
export const isPhone = (v) => /^\+?\d{9,15}$/.test(v);
export const isPin = (v) => typeof v === 'string' && /^\d{4,8}$/.test(v);
export const isEmail = (v) => typeof v === 'string' && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v);

// Texto libre: si se rellena exige el mínimo; devuelve código de error o null.
export function freeTextError(value, { required = false, min = MIN_TEXT, max = 500 } = {}) {
  const v = cleanText(value);
  if (!v) return required ? 'required' : null;
  if (CONTROL.test(String(value))) return 'invalid';
  if (v.length < min) return 'too_short';
  if (v.length > max) return 'too_long';
  return null;
}

export function plateError(raw, { allowGeneric = false } = {}) {
  const plate = normalizePlate(raw);
  if (!plate) return 'required';
  const kind = classifyPlate(plate);
  if (!kind) return 'plate_format';
  if (kind === 'generic' && !allowGeneric) return 'plate_format';
  return null;
}

export function costError(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'));
  if (!Number.isFinite(n) || n < 0 || n > 1_000_000) return 'cost_format';
  return null;
}
export const parseCost = (v) => (v === null || v === undefined || v === '' ? null : Math.round(Number(String(v).replace(',', '.')) * 100) / 100);

export function dateError(v) {
  if (v === null || v === undefined || v === '') return null;
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v)) ? null : 'date_format';
}

// Alta de coche. `catalog` es la lista de modelos (shared/models.json).
export function validateNewVehicle(input, catalog) {
  const errors = {};
  const foreign = input.foreign === true;
  const pe = plateError(input.plate, { allowGeneric: foreign });
  if (pe) errors.plate = pe;
  let model = null;
  if (input.modelId && input.modelId !== 'other') {
    model = catalog.find((m) => m.id === input.modelId) || null;
    if (!model) errors.modelId = 'required';
  } else {
    const make = cleanText(input.make); const name = cleanText(input.model);
    if (make.length < 2 || make.length > 40) errors.make = 'required';
    if (name.length < 1 || name.length > 40) errors.model = 'required';
    if (!BODY_TYPES.includes(input.bodyType)) errors.bodyType = 'required';
  }
  const phone = normalizePhone(input.phone);
  if (phone && !isPhone(phone)) errors.phone = 'phone_format';
  if (input.id !== undefined && !isUuid(input.id)) errors.id = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors, model, phone: phone || null, plate: normalizePlate(input.plate) };
}

export function validatePatch(input) {
  const errors = {};
  if (input.state !== undefined && !STATES.includes(input.state)) errors.state = 'invalid';
  if (input.location !== undefined && typeof input.location !== 'string') errors.location = 'invalid';
  if (input.notes !== undefined) { const e = freeTextError(input.notes, { max: 500 }); if (e) errors.notes = e; }
  for (const k of ['costEstimate', 'costFinal']) if (input[k] !== undefined) { const e = costError(input[k]); if (e) errors[k] = e; }
  if (input.etaAt !== undefined) { const e = dateError(input.etaAt); if (e) errors.etaAt = e; }
  if (input.phone !== undefined) { const p = normalizePhone(input.phone); if (p && !isPhone(p)) errors.phone = 'phone_format'; }
  if (input.tags !== undefined && (!Array.isArray(input.tags) || input.tags.length > TAGS_PER_VEHICLE || input.tags.some((x) => tagError(x)))) errors.tags = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
}

// Etiquetas rápidas: texto corto que se toca en vez de escribirse (no aplica el mínimo de 10 de las notas).
export const TAG_MIN = 3; export const TAG_MAX_LEN = 40; export const TAGS_PER_VEHICLE = 8; export const NOTE_TAGS_MAX = 12;
export const tagError = (v) => {
  if (typeof v !== 'string') return 'invalid';
  const c = cleanText(v);
  if (CONTROL.test(v)) return 'invalid';
  if (c.length < TAG_MIN) return 'too_short_tag';
  if (c.length > TAG_MAX_LEN) return 'too_long';
  return null;
};
export const cleanTags = (list, max) => [...new Set((Array.isArray(list) ? list : []).map(cleanText).filter(Boolean))].slice(0, max);

// Código corto por coche para el QR del albarán: sin I, O, 0 ni 1 para que no se confundan al leerlo.
export const VEHICLE_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const isVehicleCode = (v) => typeof v === 'string' && /^[A-HJ-NP-Z2-9]{6}$/.test(v.toUpperCase());

// Ajustes del taller: cualquiera de ellos por separado. noteTags: null = volver a las etiquetas por defecto.
export function validateWorkshopSettings(input) {
  const errors = {};
  if (input.retentionDays !== undefined && (!Number.isInteger(input.retentionDays) || input.retentionDays < 1 || input.retentionDays > 365)) errors.retentionDays = 'invalid';
  if (input.staleDays !== undefined && (!Number.isInteger(input.staleDays) || input.staleDays < 1 || input.staleDays > 60)) errors.staleDays = 'invalid';
  if (input.noteTags !== undefined && input.noteTags !== null) {
    if (!Array.isArray(input.noteTags) || input.noteTags.length > NOTE_TAGS_MAX) errors.noteTags = 'invalid';
    else if (input.noteTags.some((x) => tagError(x))) errors.noteTags = 'invalid';
  }
  const any = ['retentionDays', 'staleDays', 'noteTags'].some((k) => input[k] !== undefined);
  return { ok: any && Object.keys(errors).length === 0, errors: any ? errors : { settings: 'invalid' } };
}

export function validatePart(input, { partial = false } = {}) {
  const errors = {};
  if (!partial || input.description !== undefined) { const e = freeTextError(input.description, { required: true, max: 200 }); if (e) errors.description = e; }
  if (input.state !== undefined && !PART_STATES.includes(input.state)) errors.state = 'invalid';
  if (input.etaAt !== undefined) { const e = dateError(input.etaAt); if (e) errors.etaAt = e; }
  if (input.id !== undefined && !isUuid(input.id)) errors.id = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
}

export function validateContact(input) {
  const errors = {};
  const name = cleanText(input.name); const workshop = cleanText(input.workshop);
  if (name.length < 2 || name.length > 80) errors.name = name ? 'too_short' : 'required';
  if (workshop.length < 2 || workshop.length > 80) errors.workshop = workshop ? 'too_short' : 'required';
  if (!isEmail(cleanText(input.email))) errors.email = cleanText(input.email) ? 'email_format' : 'required';
  const phone = normalizePhone(input.phone);
  if (phone && !isPhone(phone)) errors.phone = 'phone_format';
  const me = freeTextError(input.message, { required: true, max: 1500 }); if (me) errors.message = me;
  if (input.consent !== true) errors.consent = 'required';
  return { ok: Object.keys(errors).length === 0, errors };
}
