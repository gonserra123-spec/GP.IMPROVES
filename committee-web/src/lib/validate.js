// Validación compartida: la usa la interfaz (para avisar al momento) y el servidor
// (server/api.js), que es quien manda. Módulo puro: sin DOM ni React.
import { TABLES, BOTTLES, RULES, nightType } from '../content/data.js';

export const MIN_TEXT = 10;
export const MAX_TEXT = 600;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function ageOn(birth, dateISO) {
  const b = new Date(`${birth}T12:00:00`); const d = new Date(`${dateISO}T12:00:00`);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a -= 1;
  return a;
}

// Devuelven un código que la interfaz traduce; null si el valor es válido.
export const CHECK = {
  name: (v) => { const s = String(v ?? '').trim(); return !s ? 'required' : s.length < 2 ? 'name' : s.length > 120 ? 'maxLen' : null; },
  email: (v) => { const s = String(v ?? '').trim(); return !s ? 'required' : s.length > 254 || !EMAIL_RE.test(s) ? 'email' : null; },
  phone: (v) => { const s = String(v ?? '').replace(/[\s.\-()]/g, ''); return !s ? 'required' : !/^\+?\d{9,15}$/.test(s) ? 'phone' : null; },
  birth: (v) => {
    if (!v) return 'required';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return 'birth';
    const d = new Date(`${v}T12:00:00`);
    return Number.isNaN(d.getTime()) || d > new Date() || d.getFullYear() < 1900 ? 'birth' : null;
  },
  text: (v) => { const s = String(v ?? '').trim(); return !s ? 'required' : s.length < MIN_TEXT ? 'minLen' : s.length > MAX_TEXT ? 'maxLen' : null; },
  consent: (v) => (v === true ? null : 'consent'),
};

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const ISO = /^\d{4}-\d{2}-\d{2}$/;

// Reserva de mesa. Devuelve { errors, clean }; `clean` solo contiene campos conocidos y ya
// recortados: es lo único que el servidor reenvía.
export function validateBooking(body) {
  const errors = {};
  if (!isObj(body)) return { errors: { body: 'invalid' }, clean: null };
  for (const k of ['name', 'phone', 'email', 'birth', 'text', 'consent']) { const c = CHECK[k](body[k]); if (c) errors[k] = c; }

  const table = TABLES.find((t) => t.id === body.tableId);
  if (!table) errors.table = 'table';

  const type = typeof body.date === 'string' && ISO.test(body.date) ? nightType(body.date) : null;
  if (!type) errors.date = 'date';

  const guests = Number(body.guests);
  if (!Number.isInteger(guests) || guests < 1 || guests > RULES.baseGuests + RULES.maxExtra) errors.guests = 'guests';

  const cart = {};
  if (body.cart != null) {
    if (!isObj(body.cart) || Object.keys(body.cart).length > 40) errors.cart = 'cart';
    else {
      for (const [id, qty] of Object.entries(body.cart)) {
        if (!BOTTLES.some((b) => b.id === id) || !Number.isInteger(qty) || qty < 1 || qty > 9) { errors.cart = 'cart'; break; }
        cart[id] = qty;
      }
    }
  }

  if (!errors.birth && type && ageOn(body.birth, body.date) < RULES.minAge[type]) errors.birth = 'age';
  if (Object.keys(errors).length) return { errors, clean: null };

  return {
    errors: {},
    clean: {
      kind: 'booking', date: body.date, night: type, tableId: table.id, guests, cart,
      name: body.name.trim(), phone: body.phone.replace(/[\s.\-()]/g, ''), email: body.email.trim(),
      birth: body.birth, text: body.text.trim(),
    },
  };
}

// Apuntarse a la lista de cumpleaños.
export function validateLista(body) {
  const errors = {};
  if (!isObj(body)) return { errors: { body: 'invalid' }, clean: null };
  for (const k of ['name', 'email', 'birth', 'consent']) { const c = CHECK[k](body[k]); if (c) errors[k] = c; }
  if (!['first', 'petit'].includes(body.room)) errors.room = 'required';
  if (Object.keys(errors).length) return { errors, clean: null };
  return { errors: {}, clean: { kind: 'lista', name: body.name.trim(), email: body.email.trim(), birth: body.birth, room: body.room } };
}
