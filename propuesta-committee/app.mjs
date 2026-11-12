// API de la demo: reservas de mesa con plano y botellas, panel de la noche,
// campañas de cumpleaños y reactivación, y simulador económico.
// Todo vive en memoria y los datos de clientes son sintéticos.

import { randomUUID, createHash } from 'node:crypto';
import { CLUB, RULES, ZONES, TABLES, BOTTLES, MIXERS, MENU_CATEGORIES, nightType, priceFor } from './data.mjs';
import { runModel, SCENARIOS, ASSUMPTIONS } from './model.mjs';

const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const NIGHT_LABEL = { thu: 'Jueves', fri: 'Viernes', sat: 'Sábado' };
const OPEN = { thu: '00:30', fri: '23:59', sat: '23:59' };

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class ApiError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}
const bad = (code, msg, status = 422) => new ApiError(status, code, msg);

const FIRST = ['Lucía', 'Marcos', 'Paula', 'Hugo', 'Carla', 'Álvaro', 'Noa', 'Pablo', 'Irene', 'Adrián', 'Sara', 'Dani', 'Elena', 'Javier', 'Marta', 'Raúl', 'Claudia', 'Iván', 'Nerea', 'Sergio'];
const LAST = ['G.', 'M.', 'R.', 'S.', 'P.', 'L.', 'F.', 'B.', 'T.', 'C.'];
const PR_CODES = ['RP-ANA', 'RP-LUIS', 'RP-DIEGO', null];

export function createApp({ now = () => new Date(), seed = 7 } = {}) {
  const rng = mulberry32(seed);
  const state = { reservations: new Map(), holds: new Map(), blocks: new Map(), offers: new Map(), outbox: [], customers: [] };

  // ---------- utilidades ----------
  const tableById = (id) => TABLES.find((t) => t.id === id);
  const bottleById = (id) => BOTTLES.find((b) => b.id === id);
  const money = (n) => Math.round(n);

  function sweep() {
    const t = now().getTime();
    for (const [id, h] of state.holds) if (h.expiresAt <= t) state.holds.delete(id);
    for (const r of state.reservations.values()) {
      if (r.status === 'pendiente_pago' && r.expiresAt <= t) r.status = 'caducada';
    }
  }

  function upcomingNights(days = 28) {
    const out = [];
    const today = new Date(now()); today.setHours(0, 0, 0, 0);
    for (let i = 0; i <= days; i++) {
      const d = addDays(today, i);
      const date = iso(d);
      const type = nightType(date);
      if (type) out.push({ date, type });
    }
    return out;
  }

  function tableStatus(date, tableId) {
    const key = `${date}|${tableId}`;
    if (state.blocks.has(key)) return { status: 'bloqueada', block: state.blocks.get(key) };
    for (const r of state.reservations.values()) {
      if (r.date === date && r.tableId === tableId) {
        if (r.status === 'confirmada') return { status: 'reservada', reservation: r };
        if (r.status === 'pendiente_pago') return { status: 'retenida', reservation: r };
      }
    }
    for (const h of state.holds.values()) if (h.date === date && h.tableId === tableId) return { status: 'retenida', hold: h };
    return { status: 'libre' };
  }

  function nightSummary(date) {
    sweep();
    let free = 0, taken = 0;
    for (const t of TABLES) (tableStatus(date, t.id).status === 'libre' ? free++ : taken++);
    return { tablesTotal: TABLES.length, tablesFree: free, occupancy: taken / TABLES.length };
  }

  function computeQuote({ date, tableId, people, items = [], offer = null }) {
    const type = nightType(date);
    if (!type) throw bad('fecha_invalida', 'Committee solo abre jueves, viernes y sábado.');
    const table = tableById(tableId);
    if (!table) throw bad('mesa_invalida', 'La mesa no existe.', 404);
    const n = Number(people);
    if (!Number.isInteger(n) || n < 1 || n > RULES.baseGuests + RULES.maxExtra) throw bad('personas_invalidas', `Una mesa admite de 1 a ${RULES.baseGuests + RULES.maxExtra} personas.`);
    const price = priceFor(table, type);
    const extra = Math.max(0, n - RULES.baseGuests);
    const surcharge = money(price * RULES.extraSurcharge * extra);
    const waived = offer?.benefit === 'extras_gratis' ? surcharge : 0;
    const minSpend = price + surcharge - waived;
    const lines = [];
    let itemsTotal = 0, mixers = 0;
    for (const it of items) {
      const b = bottleById(it.bottleId);
      if (!b) throw bad('botella_invalida', `La botella ${it.bottleId} no existe.`);
      const qty = Number(it.qty);
      if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw bad('cantidad_invalida', 'La cantidad debe estar entre 1 y 10.');
      lines.push({ bottleId: b.id, name: b.name, category: b.category, qty, unit: b.price, subtotal: b.price * qty, mixers: b.mixers * qty });
      itemsTotal += b.price * qty;
      mixers += b.mixers * qty;
    }
    const committed = Math.max(minSpend, itemsTotal);
    const deposit = money(committed * RULES.depositPct);
    const bonus = offer?.benefit === 'botella_cortesia' ? [{ name: 'Moët & Chandon (cortesía)', value: 200 }] : [];
    return {
      date, night: type, table: { id: table.id, zone: table.zone }, people: n, extraPeople: extra,
      price, surcharge, surchargeWaived: waived, minSpend, items: lines, itemsTotal, missing: Math.max(0, minSpend - itemsTotal),
      committed, deposit, remaining: committed - deposit, mixers, bonus, meetsMinimum: itemsTotal >= minSpend,
    };
  }

  function offerView(o) {
    const night = o.date ? { date: o.date, label: NIGHT_LABEL[nightType(o.date)], ...nightSummary(o.date) } : null;
    return { token: o.token, type: o.type, benefit: o.benefit, benefitText: BENEFIT_TEXT[o.benefit], date: o.date, expiresAt: o.expiresAt, used: o.used, name: o.firstName, night };
  }
  const BENEFIT_TEXT = {
    botella_cortesia: 'Una botella de champán Moët & Chandon de cortesía',
    extras_gratis: 'Hasta 2 personas extra sin el suplemento del 20 %',
  };

  function resolveOffer(token, date) {
    if (!token) return null;
    const o = state.offers.get(token);
    if (!o) throw bad('oferta_invalida', 'El enlace de oferta no existe.', 404);
    if (o.used) throw bad('oferta_usada', 'Este enlace ya se ha utilizado.', 409);
    if (o.expiresAt <= now().getTime()) throw bad('oferta_caducada', 'Este enlace ha caducado.', 410);
    if (date && o.date && o.date !== date) throw bad('oferta_fecha', `Esta oferta solo vale para el ${o.date}.`);
    if (date && nightSummary(date).occupancy >= 0.6) throw bad('oferta_sin_hueco', 'Esa noche ya está muy completa para aplicar la oferta.');
    return o;
  }

  // ---------- semilla de datos ----------
  function seedData() {
    const today = new Date(now()); today.setHours(0, 0, 0, 0);
    // Clientes sintéticos
    for (let i = 0; i < 140; i++) {
      const first = FIRST[Math.floor(rng() * FIRST.length)];
      const last = LAST[Math.floor(rng() * LAST.length)];
      const bdOffset = i < 16 ? 3 + Math.floor(rng() * 12) : Math.floor(rng() * 365); // 16 cumpleaños cercanos
      const bd = addDays(today, bdOffset);
      const born = new Date(bd.getFullYear() - (22 + Math.floor(rng() * 12)), bd.getMonth(), bd.getDate());
      state.customers.push({
        id: `c${i}`,
        name: `${first} ${last}`, firstName: first,
        phone: `+34 600 ${100000 + i}`,
        birthdate: iso(born),
        lastVisit: iso(addDays(today, -(5 + Math.floor(rng() * 230)))),
        visits: 1 + Math.floor(rng() * 9),
        consent: rng() < 0.55,
        pr: PR_CODES[Math.floor(rng() * PR_CODES.length)],
        usualZone: ['tarima', 'principal', 'petit'][Math.floor(rng() * 3)],
        synthetic: true,
      });
    }
    // Reservas ya confirmadas con la ocupación de partida del modelo
    for (const { date, type } of upcomingNights(21)) {
      const target = Math.round(TABLES.length * ASSUMPTIONS.occupancy[type]);
      const order = [...TABLES].sort(() => rng() - 0.5).filter((t) => t.zone !== 'ghost' || rng() < 0.4);
      for (const t of order.slice(0, target)) {
        const c = state.customers[Math.floor(rng() * state.customers.length)];
        const people = 4 + Math.floor(rng() * 4);
        const price = priceFor(t, type);
        const min = price + Math.round(price * 0.2 * Math.max(0, people - 5));
        const items = [];
        let sum = 0;
        while (sum < min) {
          const pool = BOTTLES.filter((b) => b.price <= Math.max(200, min - sum) && b.price <= 400);
          const b = pool[Math.floor(rng() * pool.length)];
          items.push({ bottleId: b.id, qty: 1 }); sum += b.price;
        }
        const q = computeQuote({ date, tableId: t.id, people, items });
        const id = randomUUID();
        state.reservations.set(id, makeReservation({ id, q, customer: c, source: 'seed', status: 'confirmada' }));
      }
    }
  }

  function makeReservation({ id, q, customer, source, status, prCode = customer?.pr ?? null, offerToken = null, consent = false, email = '' }) {
    return {
      id, code: 'CMT-' + id.replace(/-/g, '').slice(0, 5).toUpperCase(), date: q.date, tableId: q.table.id, zone: q.table.zone,
      name: customer.name, phone: customer.phone, email, birthdate: customer.birthdate, people: q.people,
      items: q.items, itemsTotal: q.itemsTotal, minSpend: q.minSpend, committed: q.committed, deposit: q.deposit, remaining: q.remaining,
      bonus: q.bonus, status, prCode, offerToken, consentMarketing: consent, source,
      createdAt: now().getTime(), expiresAt: now().getTime() + RULES.depositWindowHours * 3600 * 1000,
    };
  }

  const pub = (r) => ({
    id: r.id, code: r.code, date: r.date, tableId: r.tableId, zone: r.zone, name: r.name, people: r.people, status: r.status,
    items: r.items, bonus: r.bonus, minSpend: r.minSpend, committed: r.committed, deposit: r.deposit, remaining: r.remaining,
    prCode: r.prCode, source: r.source, expiresAt: r.expiresAt, paymentLink: r.status === 'pendiente_pago' ? `/api/reservations/${r.id}/pay` : null,
    qr: r.status === 'confirmada' ? `committee:${r.code}:${r.date}:${r.tableId}` : null,
  });

  const maskPhone = (p) => p.replace(/\d(?=(?:\D*\d){3})/g, '•');

  // ---------- campañas ----------
  function campaignPreview({ threshold = 0.6 } = {}) {
    sweep();
    const today = new Date(now()); today.setHours(0, 0, 0, 0);
    const nights = upcomingNights(14).map((n) => ({ ...n, ...nightSummary(n.date) })).filter((n) => n.occupancy < threshold);
    const items = [];
    const excluded = { sinConsentimiento: 0, sinHueco: 0, grupoControl: 0 };
    const md = (s) => s.slice(5);
    for (const c of state.customers) {
      const reasons = [];
      // cumpleaños en los próximos 14 días
      for (let i = 3; i <= 14; i++) {
        if (md(iso(addDays(today, i))) === md(c.birthdate)) reasons.push({ type: 'cumpleanos', daysTo: i });
      }
      const idle = Math.round((today - new Date(`${c.lastVisit}T12:00:00`)) / 86400000);
      if (idle >= 60 && idle <= 120 && c.visits >= 2) reasons.push({ type: 'reactivacion', idle });
      for (const r of reasons) {
        if (!c.consent) { excluded.sinConsentimiento++; continue; }
        const night = r.type === 'cumpleanos'
          ? nights.find((n) => new Date(`${n.date}T12:00:00`) >= addDays(today, 3) && Math.abs((new Date(`${n.date}T12:00:00`) - addDays(today, r.daysTo)) / 86400000) <= 7)
          : nights.find((n) => n.type === 'thu') ?? nights[0];
        if (!night) { excluded.sinHueco++; continue; }
        const control = parseInt(createHash('sha1').update(c.id).digest('hex').slice(0, 4), 16) % 10 === 0; // 10 %
        if (control) { excluded.grupoControl++; }
        const benefit = r.type === 'cumpleanos' ? 'botella_cortesia' : 'extras_gratis';
        items.push({
          customerId: c.id, name: c.name, phone: maskPhone(c.phone), type: r.type, benefit, benefitText: BENEFIT_TEXT[benefit],
          reason: r.type === 'cumpleanos' ? `Cumple años en ${r.daysTo} días` : `Lleva ${r.idle} días sin volver`,
          night: { date: night.date, label: NIGHT_LABEL[night.type], occupancy: Math.round(night.occupancy * 100) },
          control, message: messageFor(c, r.type, benefit, night, '<enlace único>'),
        });
      }
    }
    const sendable = items.filter((i) => !i.control);
    return {
      threshold, generatedAt: now().toISOString(),
      totals: { customers: state.customers.length, withConsent: state.customers.filter((c) => c.consent).length, candidates: items.length + excluded.sinConsentimiento, sendable: sendable.length, control: items.length - sendable.length },
      excluded, nightsWithRoom: nights.map((n) => ({ date: n.date, label: NIGHT_LABEL[n.type], occupancy: Math.round(n.occupancy * 100), tablesFree: n.tablesFree })),
      items,
    };
  }

  function messageFor(c, type, benefit, night, link) {
    const when = `${NIGHT_LABEL[nightType(night.date)].toLowerCase()} ${night.date.slice(8)}/${night.date.slice(5, 7)}`;
    if (type === 'cumpleanos') return `Hola ${c.firstName}, se acerca tu cumpleaños 🎂. Reserva tu mesa en Committee el ${when} y te invitamos a una botella de Moët & Chandon. Solo con este enlace, válido 7 días: ${link}`;
    return `Hola ${c.firstName}, hace tiempo que no te vemos por Committee. El ${when}, trae hasta 7 personas a tu mesa sin suplemento. Enlace personal de un solo uso: ${link}`;
  }

  function sendCampaign(origin) {
    const preview = campaignPreview();
    const created = [];
    for (const it of preview.items.filter((i) => !i.control)) {
      const c = state.customers.find((x) => x.id === it.customerId);
      const already = [...state.offers.values()].find((o) => o.customerId === c.id && o.type === it.type && !o.used && o.expiresAt > now().getTime());
      if (already) continue;
      const token = randomUUID().replace(/-/g, '').slice(0, 12);
      const offer = { token, customerId: c.id, firstName: c.firstName, type: it.type, benefit: it.benefit, date: it.night.date, expiresAt: now().getTime() + 7 * 86400000, used: false };
      state.offers.set(token, offer);
      const link = `${origin}/?oferta=${token}`;
      state.outbox.push({ id: randomUUID(), at: now().toISOString(), channel: 'whatsapp (simulado)', to: maskPhone(c.phone), name: c.name, type: it.type, token, link, text: messageFor(c, it.type, it.benefit, it.night, link) });
      created.push({ token, link, name: c.name, type: it.type });
    }
    return { sent: created.length, skippedAlreadySent: preview.items.filter((i) => !i.control).length - created.length, controlGroup: preview.totals.control, offers: created };
  }

  // ---------- panel de la noche ----------
  function adminNight(date) {
    sweep();
    if (!nightType(date)) throw bad('fecha_invalida', 'Committee solo abre jueves, viernes y sábado.');
    const tables = TABLES.map((t) => {
      const s = tableStatus(date, t.id);
      const r = s.reservation;
      return { id: t.id, zone: t.zone, floor: t.floor, x: t.x, y: t.y, price: priceFor(t, nightType(date)), status: s.status, reservation: r ? { code: r.code, name: r.name, people: r.people, committed: r.committed, paid: r.status === 'confirmada', prCode: r.prCode } : null, block: s.block ?? null };
    });
    const confirmed = [...state.reservations.values()].filter((r) => r.date === date && r.status === 'confirmada');
    const prep = {};
    for (const r of confirmed) for (const l of r.items) {
      const p = (prep[l.bottleId] ??= { bottleId: l.bottleId, name: l.name, category: l.category, qty: 0, mixers: 0 });
      p.qty += l.qty; p.mixers += l.mixers;
    }
    const byPr = {};
    for (const r of confirmed) { const k = r.prCode ?? 'Sin RR. PP.'; byPr[k] = (byPr[k] ?? 0) + r.committed; }
    const count = (s) => tables.filter((t) => t.status === s).length;
    return {
      date, label: NIGHT_LABEL[nightType(date)], tables,
      kpis: {
        reservadas: count('reservada'), retenidas: count('retenida'), bloqueadas: count('bloqueada'), libres: count('libre'),
        ocupacion: Math.round(((TABLES.length - count('libre')) / TABLES.length) * 100),
        consumoComprometido: confirmed.reduce((a, r) => a + r.committed, 0),
        senalesCobradas: confirmed.reduce((a, r) => a + r.deposit, 0),
        pendienteEnSala: confirmed.reduce((a, r) => a + r.remaining, 0),
        personas: confirmed.reduce((a, r) => a + r.people, 0),
      },
      barPrep: Object.values(prep).sort((a, b) => b.qty - a.qty),
      mixersTotal: Object.values(prep).reduce((a, p) => a + p.mixers, 0),
      comisionPorRRPP: Object.entries(byPr).map(([code, committed]) => ({ code, committed })),
      reservations: confirmed.slice(-30).reverse().map(pub),
    };
  }

  // ---------- rutas ----------
  const routes = [];
  const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

  route('GET', '/api/health', () => ({ ok: true, now: now().toISOString(), demo: true }));
  route('GET', '/api/club', () => {
    const m = now().getMonth() + 1;
    return { club: { ...CLUB, sources: undefined }, rules: RULES, zones: ZONES, mixers: MIXERS, categories: MENU_CATEGORIES, seasonOpen: m >= 9 || m <= 5, today: iso(now()) };
  });
  route('GET', '/api/tables', () => ({ tables: TABLES.map(({ id, zone, floor, x, y, price, estimado }) => ({ id, zone, floor, x, y, priceWeekend: price[0], priceThursday: price[1], estimado: !!estimado })) }));
  route('GET', '/api/bottles', () => ({ bottles: BOTTLES }));
  route('GET', '/api/events', () => {
    sweep();
    return { events: upcomingNights().map(({ date, type }) => ({ date, type, label: NIGHT_LABEL[type], opens: OPEN[type], closes: '07:30', minAge: RULES.minAge[type], entryFrom: CLUB.entry.from, ...nightSummary(date) })) };
  });
  route('GET', '/api/events/:date/tables', ({ params }) => {
    sweep();
    const type = nightType(params.date);
    if (!type) throw bad('fecha_invalida', 'Committee solo abre jueves, viernes y sábado.');
    return {
      date: params.date, label: NIGHT_LABEL[type], minAge: RULES.minAge[type], ...nightSummary(params.date),
      tables: TABLES.map((t) => ({ id: t.id, zone: t.zone, floor: t.floor, x: t.x, y: t.y, price: priceFor(t, type), status: tableStatus(params.date, t.id).status })),
    };
  });
  route('POST', '/api/quote', ({ body }) => {
    const offer = resolveOffer(body.offerToken, body.date);
    return computeQuote({ ...body, offer });
  });
  route('POST', '/api/holds', ({ body }) => {
    sweep();
    const { date, tableId } = body;
    if (!nightType(date)) throw bad('fecha_invalida', 'Committee solo abre jueves, viernes y sábado.');
    if (!tableById(tableId)) throw bad('mesa_invalida', 'La mesa no existe.', 404);
    if (tableStatus(date, tableId).status !== 'libre') throw bad('mesa_ocupada', 'Esa mesa acaba de dejar de estar libre.', 409);
    const id = randomUUID();
    const hold = { id, date, tableId, expiresAt: now().getTime() + RULES.holdMinutes * 60000 };
    state.holds.set(id, hold);
    return { holdId: id, expiresAt: hold.expiresAt, minutes: RULES.holdMinutes };
  });
  route('DELETE', '/api/holds/:id', ({ params }) => ({ released: state.holds.delete(params.id) }));
  route('POST', '/api/reservations', ({ body }) => {
    sweep();
    const hold = state.holds.get(body.holdId);
    if (!hold) throw bad('retencion_caducada', 'La mesa ya no está retenida. Elige de nuevo.', 410);
    const name = String(body.name ?? '').trim();
    const phone = String(body.phone ?? '').trim();
    const email = String(body.email ?? '').trim();
    if (name.length < 2 || name.length > 80) throw bad('nombre_invalido', 'Escribe tu nombre.');
    if (!/^\+?[0-9 ]{9,16}$/.test(phone)) throw bad('telefono_invalido', 'Escribe un teléfono válido.');
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) throw bad('email_invalido', 'El correo no parece válido.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.birthdate ?? '')) throw bad('nacimiento_invalido', 'Indica tu fecha de nacimiento.');
    const minAge = RULES.minAge[nightType(hold.date)];
    const eventDay = new Date(`${hold.date}T12:00:00`), b = new Date(`${body.birthdate}T12:00:00`);
    let age = eventDay.getFullYear() - b.getFullYear();
    if (eventDay.getMonth() < b.getMonth() || (eventDay.getMonth() === b.getMonth() && eventDay.getDate() < b.getDate())) age--;
    if (!(age >= minAge)) throw bad('edad_minima', `Esa noche la edad mínima es ${minAge} años. Se comprobará con el documento en la puerta.`);
    if (body.acceptTerms !== true) throw bad('condiciones', 'Debes aceptar las condiciones de la reserva.');
    const offer = resolveOffer(body.offerToken, hold.date);
    const q = computeQuote({ date: hold.date, tableId: hold.tableId, people: body.people, items: body.items, offer });
    if (!q.meetsMinimum) throw bad('minimo_no_alcanzado', `Faltan ${q.missing} € para llegar al consumo mínimo de la mesa (${q.minSpend} €).`);
    const id = randomUUID();
    const prCode = /^RP-[A-Z]{2,10}$/.test(body.prCode ?? '') ? body.prCode : null;
    const customer = { name, phone, birthdate: body.birthdate };
    const r = makeReservation({ id, q, customer, source: offer ? `oferta:${offer.type}` : 'web', status: 'pendiente_pago', prCode, offerToken: offer?.token ?? null, consent: body.consentMarketing === true, email });
    state.reservations.set(id, r);
    state.holds.delete(hold.id);
    return pub(r);
  });
  route('GET', '/api/reservations/:id', ({ params }) => {
    sweep();
    const r = state.reservations.get(params.id);
    if (!r) throw bad('no_encontrada', 'No existe esa reserva.', 404);
    return pub(r);
  });
  route('POST', '/api/reservations/:id/pay', ({ params }) => {
    sweep();
    const r = state.reservations.get(params.id);
    if (!r) throw bad('no_encontrada', 'No existe esa reserva.', 404);
    if (r.status === 'caducada') throw bad('enlace_caducado', 'El enlace de pago ha caducado y la mesa se ha liberado.', 410);
    if (r.status === 'confirmada') return pub(r);
    r.status = 'confirmada';
    if (r.offerToken) { const o = state.offers.get(r.offerToken); if (o) o.used = true; }
    if (r.consentMarketing) {
      const known = state.customers.find((c) => c.phone === r.phone);
      if (known) { known.lastVisit = r.date; known.consent = true; }
      else state.customers.push({ id: `n${state.customers.length}`, name: r.name, firstName: r.name.split(' ')[0], phone: r.phone, birthdate: r.birthdate, lastVisit: r.date, visits: 1, consent: true, pr: r.prCode, usualZone: r.zone });
    }
    state.outbox.push({ id: randomUUID(), at: now().toISOString(), channel: 'whatsapp (simulado)', to: maskPhone(r.phone), name: r.name, type: 'confirmacion', text: `Reserva confirmada: mesa ${r.tableId}, ${r.date}. Código ${r.code}. Resto a pagar en sala: ${r.remaining} €. Enseña el QR en la puerta.` });
    state.outbox.push({ id: randomUUID(), at: now().toISOString(), channel: 'telegram encargados (simulado)', to: 'Grupo encargados', name: '', type: 'aviso_equipo', text: `Nueva reserva ${r.code}: mesa ${r.tableId} (${r.zone}), ${r.people} pax, ${r.committed} € comprometidos${r.prCode ? ', ' + r.prCode : ''}.` });
    return pub(r);
  });
  route('GET', '/api/admin/night', ({ query }) => adminNight(query.get('date')));
  route('POST', '/api/admin/block', ({ body }) => {
    if (!nightType(body.date) || !tableById(body.tableId)) throw bad('datos_invalidos', 'Fecha o mesa no válidas.');
    if (tableStatus(body.date, body.tableId).status !== 'libre') throw bad('mesa_ocupada', 'Solo se pueden bloquear mesas libres.', 409);
    state.blocks.set(`${body.date}|${body.tableId}`, { reason: String(body.reason ?? 'Bloqueo manual').slice(0, 80), at: now().toISOString() });
    return { blocked: true };
  });
  route('DELETE', '/api/admin/block', ({ query }) => ({ unblocked: state.blocks.delete(`${query.get('date')}|${query.get('tableId')}`) }));
  route('GET', '/api/campaigns/preview', ({ query }) => campaignPreview({ threshold: Number(query.get('threshold') ?? 0.6) }));
  route('POST', '/api/campaigns/send', ({ origin }) => sendCampaign(origin));
  route('GET', '/api/outbox', () => ({ messages: state.outbox.slice(-60).reverse() }));
  route('GET', '/api/offers/:token', ({ params }) => {
    const o = state.offers.get(params.token);
    if (!o) throw bad('oferta_invalida', 'El enlace de oferta no existe.', 404);
    if (o.used) throw bad('oferta_usada', 'Este enlace ya se ha utilizado.', 409);
    if (o.expiresAt <= now().getTime()) throw bad('oferta_caducada', 'Este enlace ha caducado.', 410);
    return offerView(o);
  });
  route('GET', '/api/model', ({ query }) => {
    const sc = query.get('scenario') ?? 'base';
    if (!SCENARIOS[sc]) throw bad('escenario_invalido', 'Escenarios: conservador, base, optimista.');
    return { scenarios: Object.keys(SCENARIOS), defaults: { assumptions: ASSUMPTIONS, levers: SCENARIOS }, result: runModel(sc) };
  });
  route('POST', '/api/model', ({ body }) => {
    const sc = body.scenario ?? 'base';
    if (!SCENARIOS[sc]) throw bad('escenario_invalido', 'Escenarios: conservador, base, optimista.');
    return { result: runModel(sc, { assumptions: body.assumptions, levers: body.levers }) };
  });
  route('POST', '/api/admin/reset', () => { state.reservations.clear(); state.holds.clear(); state.blocks.clear(); state.offers.clear(); state.outbox.length = 0; state.customers.length = 0; seedData(); return { reset: true }; });

  seedData();

  // ---------- manejador HTTP ----------
  async function handle(req, res, send) {
    const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);
    const origin = `http://${req.headers.host ?? 'localhost'}`;
    const match = routes.find((r) => r.method === req.method && r.re.test(url.pathname));
    if (!match) {
      if (!url.pathname.startsWith('/api/')) return false;
      send(404, { error: { code: 'ruta', message: `No existe ${req.method} ${url.pathname}` } });
      return true;
    }
    try {
      let body = {};
      if (req.method === 'POST') {
        const chunks = []; let size = 0;
        for await (const c of req) { size += c.length; if (size > 100_000) throw bad('demasiado_grande', 'Cuerpo demasiado grande.', 413); chunks.push(c); }
        const text = Buffer.concat(chunks).toString('utf8');
        if (text) { try { body = JSON.parse(text); } catch { throw bad('json_invalido', 'El cuerpo no es JSON válido.', 400); } }
      }
      const params = match.re.exec(url.pathname).groups ?? {};
      const out = match.fn({ params, query: url.searchParams, body, origin });
      send(200, out);
    } catch (e) {
      if (e instanceof ApiError) send(e.status, { error: { code: e.code, message: e.message } });
      else { console.error(e); send(500, { error: { code: 'interno', message: 'Error interno.' } }); }
    }
    return true;
  }

  return { handle, state, computeQuote };
}
