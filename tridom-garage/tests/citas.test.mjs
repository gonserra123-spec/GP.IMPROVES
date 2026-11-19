// Clientes habituales (importación CSV), reconocimiento por matrícula y citas.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleApi } from '../server/api.js';
import { parseCsv } from '../shared/csv.js';
import { matchModel, validateBooking, validateImportRow, addDaysIso, todayIso } from '../shared/customers.js';
import catalog from '../shared/models.json' with { type: 'json' };

let server; let base;
const H = () => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'tridom-garage', Origin: base });
before(async () => {
  server = createServer(handleApi);
  await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.closeAllConnections(); server.close(); });
const post = (path, body, headers = H()) => fetch(`${base}/api${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
const reset = () => post('/demo/reset', {});
async function login() {
  const r = await post('/panel/login', { code: 'DEMO01', pin: '2468', operator: 'office' });
  return r.headers.get('set-cookie').split(';')[0];
}
const withCookie = (c) => ({ ...H(), Cookie: c });
const tomorrow = () => addDaysIso(todayIso(), 1);

test('csv: detecta ; y cabeceras en español, comillas y BOM', () => {
  const r = parseCsv('﻿Matrícula;Marca;Modelo;Teléfono;Correo electrónico\n1234BCD;Seat;"León, 1.6 TDI";600123456;a@b.es\n\n5678FGH;Renault;Clio;;\n');
  assert.equal(r.error, undefined);
  assert.deepEqual(r.columns, ['plate', 'make', 'model', 'phone', 'email']);
  assert.equal(r.rows.length, 2);
  assert.equal(r.rows[0].model, 'León, 1.6 TDI');
  assert.equal(r.rows[1].line, 4);
});

test('csv: sin columna de matrícula o vacío da error claro', () => {
  assert.equal(parseCsv('nombre;marca\nJuan;Seat').error, 'no_plate_column');
  assert.equal(parseCsv('').error, 'empty');
  assert.equal(parseCsv('matricula;marca\n').error, 'empty');
});

test('importar: reconoce el modelo del catálogo desde un campo «vehículo» suelto', () => {
  assert.equal(matchModel(catalog, '', '', 'Seat León 1.6 TDI')?.id, 'seat-leon');
  assert.equal(matchModel(catalog, 'VW', 'Golf')?.id, 'volkswagen-golf');
  assert.equal(matchModel(catalog, 'Lada', 'Niva'), null);
  const ok = validateImportRow({ plate: '1234 bcd', vehicle: 'Seat León', phone: '600 12 34 56', email: 'A@B.ES' }, catalog);
  assert.equal(ok.ok, true);
  assert.equal(ok.row.plate, '1234BCD'); assert.equal(ok.row.modelId, 'seat-leon'); assert.equal(ok.row.email, 'a@b.es');
  const bad = validateImportRow({ plate: '12', make: 'X', model: '', email: 'no' }, catalog);
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.plate && bad.errors.vehicle && bad.errors.email);
});

test('cita: validación de fecha, franja, motivo y consentimiento', () => {
  const base = { plate: '1234BCD', email: 'a@b.es', date: tomorrow(), slot: 'morning', reason: 'Cambio de aceite', consent: true, modelId: 'seat-leon' };
  assert.equal(validateBooking(base, catalog).ok, true);
  assert.equal(validateBooking({ ...base, date: '2020-01-01' }, catalog).errors.date, 'date_range');
  assert.equal(validateBooking({ ...base, date: addDaysIso(todayIso(), 90) }, catalog).errors.date, 'date_range');
  assert.equal(validateBooking({ ...base, consent: false }, catalog).errors.consent, 'required');
  assert.equal(validateBooking({ ...base, email: 'x' }, catalog).errors.email, 'email_format');
  assert.equal(validateBooking({ ...base, modelId: '' }, catalog).ok, false);
  assert.equal(validateBooking({ ...base, modelId: '' }, catalog, { known: true }).ok, true);
});

test('reconocimiento: matrícula conocida devuelve solo marca y modelo; la desconocida, nada', async () => {
  await reset();
  const known = await (await post('/public/customer-check', { code: 'DEMO01', plate: '0147 LMN' })).json();
  assert.deepEqual(known, { ok: true, known: true, make: 'Seat', model: 'Ibiza' });
  const unknown = await (await post('/public/customer-check', { code: 'DEMO01', plate: '1111BBB' })).json();
  assert.deepEqual(unknown, { ok: true, known: false });
  const other = await (await post('/public/customer-check', { code: 'NOPE99', plate: '0147LMN' })).json();
  assert.deepEqual(other, { ok: true, known: false });
});

test('cita de un cliente habitual: sin pedir el coche y sin pisar sus datos de contacto', async () => {
  await reset();
  const body = { code: 'DEMO01', plate: '0147LMN', email: 'otra.persona@example.com', phone: '', date: addDaysIso(todayIso(), 3), slot: 'afternoon', reason: 'Revisión antes de viajar', consent: true };
  const r = await post('/public/book', body);
  assert.equal(r.status, 201);
  const j = await r.json();
  assert.equal(j.known, true);
  const cookie = await login();
  const list = await (await fetch(`${base}/api/panel/appointments`, { headers: { Cookie: cookie } })).json();
  const mine = list.appointments.find((a) => a.plate === '0147LMN' && a.reason === 'Revisión antes de viajar');
  assert.ok(mine);
  assert.equal(mine.make, 'Seat'); assert.equal(mine.model, 'Ibiza');
  assert.equal(JSON.stringify(list).includes('otra.persona@example.com'), false); // el panel solo ve el correo enmascarado
  assert.match(mine.emailMasked, /^o\*\*\*@example\.com$/);
});

test('cita de un coche nuevo: exige modelo y lo da de alta como cliente', async () => {
  await reset();
  const body = { code: 'DEMO01', plate: '7777KKK', email: 'nuevo@example.com', date: tomorrow(), slot: 'morning', reason: 'Ruido en la suspensión', consent: true };
  assert.equal((await post('/public/book', body)).status, 422);
  assert.equal((await post('/public/book', { ...body, modelId: 'seat-leon' })).status, 201);
  const again = await (await post('/public/customer-check', { code: 'DEMO01', plate: '7777KKK' })).json();
  assert.equal(again.known, true);
});

test('cita: honeypot, taller inexistente y reserva repetida (idempotente)', async () => {
  await reset();
  const base = { code: 'DEMO01', plate: '9930TVW', email: 'a@example.com', date: tomorrow(), slot: 'morning', reason: 'Cambio de neumáticos', consent: true };
  assert.equal((await (await post('/public/book', { ...base, website: 'spam' })).json()).ok, true);
  assert.equal((await post('/public/book', { ...base, code: 'NOPE99' })).status, 404);
  assert.equal((await post('/public/book', base)).status, 201);
  assert.equal((await post('/public/book', base)).status, 201);
  const cookie = await login();
  const list = await (await fetch(`${base.code ? '' : ''}${'' || ''}${'http://127.0.0.1:' + server.address().port}/api/panel/appointments`, { headers: { Cookie: cookie } })).json();
  assert.equal(list.appointments.filter((a) => a.plate === '9930TVW').length, 1);
});

test('citas: «ha llegado» da de alta el coche y cierra la cita', async () => {
  await reset();
  const cookie = await login();
  const list = await (await fetch(`${base}/api/panel/appointments`, { headers: { Cookie: cookie } })).json();
  const a = list.appointments[0];
  const r = await post(`/panel/appointments/${a.id}/arrive`, {}, withCookie(cookie));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.vehicle.plate, a.plate); assert.equal(j.vehicle.state, 'received');
  const after = await (await fetch(`${base}/api/panel/appointments`, { headers: { Cookie: cookie } })).json();
  assert.equal(after.appointments.some((x) => x.id === a.id), false);
  assert.equal((await post(`/panel/appointments/${a.id}/arrive`, {}, withCookie(cookie))).status, 404);
});

test('importar por la API: crea, actualiza y rechaza filas, y exige sesión', async () => {
  await reset();
  assert.equal((await post('/panel/customers/import', { rows: [] })).status, 401);
  const cookie = await login();
  const rows = [
    { line: 2, plate: '2024BBB', vehicle: 'Toyota Yaris', email: 'a@example.com' },
    { line: 3, plate: '0147LMN', vehicle: 'Seat Ibiza', phone: '655000111' },
    { line: 4, plate: 'xx', vehicle: 'Seat Ibiza' },
  ];
  const r = await post('/panel/customers/import', { rows }, withCookie(cookie));
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.created, 1); assert.equal(j.updated, 1); assert.equal(j.rejected, 1);
  assert.equal(j.rejectedRows[0].line, 4);
  const big = await post('/panel/customers/import', { rows: Array.from({ length: 2001 }, () => ({ plate: '1234BCD' })) }, withCookie(cookie));
  assert.equal(big.status, 422);
  const check = await (await post('/public/customer-check', { code: 'DEMO01', plate: '2024BBB' })).json();
  assert.equal(check.known, true);
});

test('importar: otro taller no ve los clientes (aislamiento por taller)', async () => {
  await reset();
  const other = await (await post('/public/customer-check', { code: 'OTRO01', plate: '0147LMN' })).json();
  assert.equal(other.known, false);
});
