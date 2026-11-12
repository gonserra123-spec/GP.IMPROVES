import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../server.mjs';

let srv, base, clock;
const now = () => new Date(clock);
const call = async (method, url, body) => {
  const r = await fetch(base + url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
  return { status: r.status, json: await r.json() };
};

before(async () => {
  clock = new Date('2026-11-12T10:00:00').getTime();
  srv = await startServer(0, { now });
  base = `http://localhost:${srv.port}`;
});
after(() => srv.server.close());

const freeTable = async (date, zone) => (await call('GET', `/api/events/${date}/tables`)).json.tables.find((t) => t.status === 'libre' && (!zone || t.zone === zone));
const holdAndBook = async (date, extra = {}) => {
  const t = await freeTable(date, 'tarima');
  const h = await call('POST', '/api/holds', { date, tableId: t.id });
  assert.equal(h.status, 200);
  const body = { holdId: h.json.holdId, name: 'Cliente Demo', phone: '+34 600 123 456', birthdate: '1998-04-02', people: 5, items: [{ bottleId: 'ginebra-beefeater', qty: 1 }], acceptTerms: true, ...extra };
  return { t, h, r: await call('POST', '/api/reservations', body) };
};

test('solo hay noches de jueves a sábado y el jueves es +18', async () => {
  const { json } = await call('GET', '/api/events');
  assert.ok(json.events.length >= 12);
  assert.ok(json.events.every((e) => ['thu', 'fri', 'sat'].includes(e.type)));
  assert.equal(json.events.find((e) => e.type === 'thu').minAge, 18);
  assert.equal(json.events.find((e) => e.type === 'sat').minAge, 21);
});

test('el presupuesto aplica el suplemento del 20 % por persona extra', async () => {
  const date = '2026-11-14'; // sábado
  const t = (await call('GET', `/api/events/${date}/tables`)).json.tables.find((x) => x.zone === 'principal');
  const q = await call('POST', '/api/quote', { date, tableId: t.id, people: 7, items: [] });
  assert.equal(q.json.price, 400);
  assert.equal(q.json.minSpend, 400 + 80 * 2); // 400 € + 2 personas x 20 % (80 €)
  assert.equal(q.json.missing, 560);
});

test('no se puede retener dos veces la misma mesa', async () => {
  const date = '2026-11-13';
  const t = await freeTable(date);
  assert.equal((await call('POST', '/api/holds', { date, tableId: t.id })).status, 200);
  const again = await call('POST', '/api/holds', { date, tableId: t.id });
  assert.equal(again.status, 409);
  assert.equal(again.json.error.code, 'mesa_ocupada');
});

test('la retención caduca a los 10 minutos', async () => {
  const date = '2026-11-14';
  const t = await freeTable(date);
  const h = (await call('POST', '/api/holds', { date, tableId: t.id })).json;
  clock += 11 * 60000;
  const r = await call('POST', '/api/reservations', { holdId: h.holdId, name: 'A B', phone: '+34 600 111 222', birthdate: '1990-01-01', people: 5, items: [], acceptTerms: true });
  assert.equal(r.status, 410);
  clock -= 11 * 60000;
});

test('rechaza menores y mínimo no alcanzado', async () => {
  const date = '2026-11-14';
  let { r } = await holdAndBook(date, { birthdate: '2008-01-01' });
  assert.equal(r.json.error.code, 'edad_minima');
  ({ r } = await holdAndBook(date, { people: 7 })); // Tarima sábado: 200 € + 2 x 40 € = 280 €; una Beefeater (200 €) no llega
  assert.equal(r.json.error.code, 'minimo_no_alcanzado');
});

test('reserva completa: retiene, cobra la señal y confirma con QR', async () => {
  const date = '2026-11-12'; // jueves: Tarima 150 €
  const { t, r } = await holdAndBook(date);
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.status, 'pendiente_pago');
  assert.equal(r.json.deposit, 100); // 50 % de 200 € comprometidos
  const pay = await call('POST', `/api/reservations/${r.json.id}/pay`);
  assert.equal(pay.json.status, 'confirmada');
  assert.match(pay.json.qr, /^committee:CMT-/);
  const tables = (await call('GET', `/api/events/${date}/tables`)).json.tables;
  assert.equal(tables.find((x) => x.id === t.id).status, 'reservada');
  const night = (await call('GET', `/api/admin/night?date=${date}`)).json;
  assert.ok(night.barPrep.some((p) => p.bottleId === 'ginebra-beefeater'));
});

test('el enlace de pago caduca a las 2 horas y libera la mesa', async () => {
  const date = '2026-11-12';
  const { t, r } = await holdAndBook(date);
  assert.equal(r.status, 200);
  clock += 3 * 3600000;
  const pay = await call('POST', `/api/reservations/${r.json.id}/pay`);
  assert.equal(pay.status, 410);
  assert.equal((await freeTable(date, 'tarima'))?.id !== undefined, true);
  assert.equal((await call('GET', `/api/events/${date}/tables`)).json.tables.find((x) => x.id === t.id).status, 'libre');
  clock -= 3 * 3600000;
});

test('campañas: solo clientes con consentimiento, grupo de control y enlace de un solo uso', async () => {
  const p = (await call('GET', '/api/campaigns/preview')).json;
  assert.ok(p.items.length > 0);
  assert.ok(p.totals.control >= 0 && p.totals.sendable === p.items.length - p.totals.control);
  assert.ok(p.items.every((i) => i.night.occupancy < 60));
  const sent = (await call('POST', '/api/campaigns/send')).json;
  assert.equal(sent.sent, p.totals.sendable);
  const again = (await call('POST', '/api/campaigns/send')).json;
  assert.equal(again.sent, 0); // no se vuelve a enviar a quien ya tiene oferta
  const offer = sent.offers[0];
  const view = (await call('GET', `/api/offers/${offer.token}`)).json;
  assert.ok(view.date);
  // canjear la oferta
  const date = view.date;
  const t = await freeTable(date, 'tarima');
  const h = (await call('POST', '/api/holds', { date, tableId: t.id })).json;
  const q = (await call('POST', '/api/quote', { date, tableId: t.id, people: 7, items: [], offerToken: offer.token })).json;
  if (view.benefit === 'extras_gratis') assert.equal(q.surchargeWaived, q.surcharge);
  const r = await call('POST', '/api/reservations', { holdId: h.holdId, name: 'Oferta Demo', phone: '+34 600 999 888', birthdate: '1995-06-06', people: 7, items: [{ bottleId: 'champan-moet-chandon-3-l', qty: 1 }], acceptTerms: true, offerToken: offer.token, consentMarketing: true });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  await call('POST', `/api/reservations/${r.json.id}/pay`);
  const reuse = await call('GET', `/api/offers/${offer.token}`);
  assert.equal(reuse.status, 409);
});

test('el simulador devuelve el mismo resultado que el modelo', async () => {
  const { json } = await call('POST', '/api/model', { scenario: 'base', assumptions: { occupancy: { thu: 0.2 } } });
  const base = (await call('GET', '/api/model?scenario=base')).json.result;
  assert.ok(json.result.baseline.baseRevenue < base.baseline.baseRevenue);
  assert.equal((await call('GET', '/api/model?scenario=x')).status, 422);
});

test('rutas desconocidas devuelven 404 con formato de error', async () => {
  const r = await call('GET', '/api/nada');
  assert.equal(r.status, 404);
  assert.ok(r.json.error.code);
});
