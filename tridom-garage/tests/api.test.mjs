// Pruebas de la API de demo contra fixtures locales (nunca contra producción).
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { handleApi } from '../server/api.js';

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
async function login(operator = 'office') {
  const r = await post('/panel/login', { code: 'DEMO01', pin: '2468', operator });
  assert.equal(r.status, 200);
  return r.headers.get('set-cookie').split(';')[0];
}

test('sesión: sin cookie no hay datos y la cookie es httpOnly y SameSite=Strict', async () => {
  await reset();
  assert.equal((await fetch(`${base}/api/panel/vehicles`)).status, 401);
  const r = await post('/panel/login', { code: 'DEMO01', pin: '2468', operator: 'office' });
  assert.match(r.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  const body = await r.json();
  assert.equal(body.workshop.pinHash, undefined);
});

test('CSRF: sin Origin o sin la cabecera propia se rechaza', async () => {
  await reset();
  const cookie = await login();
  const noHeader = await fetch(`${base}/api/panel/vehicles`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: cookie }, body: '{}' });
  assert.equal(noHeader.status, 403);
  const noOrigin = await fetch(`${base}/api/panel/vehicles`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'tridom-garage', Cookie: cookie }, body: '{}' });
  assert.equal(noOrigin.status, 403);
  const otherOrigin = await fetch(`${base}/api/panel/vehicles`, { method: 'POST', headers: { ...H(), Origin: 'https://otro.example', Cookie: cookie }, body: '{}' });
  assert.equal(otherOrigin.status, 403);
});

test('PIN: bloqueo tras 5 intentos fallidos, también con el PIN correcto', async () => {
  await reset();
  for (let i = 0; i < 5; i += 1) assert.equal((await post('/panel/login', { code: 'DEMO01', pin: '0000', operator: 'office' })).status, 401);
  const locked = await post('/panel/login', { code: 'DEMO01', pin: '2468', operator: 'office' });
  assert.equal(locked.status, 429);
  assert.equal((await locked.json()).error, 'locked');
});

test('panel: nunca devuelve el teléfono completo; la exportación sí', async () => {
  await reset();
  const cookie = await login();
  const list = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  assert.ok(list.vehicles.length >= 7);
  assert.ok(list.vehicles.every((v) => v.phone === undefined && v.workshopId === undefined));
  const withPhone = list.vehicles.find((v) => v.hasPhone);
  assert.match(withPhone.phoneLast4, /^\d{4}$/);
  const exp = await (await fetch(`${base}/api/panel/vehicles/${withPhone.id}/export`, { headers: { Cookie: cookie } })).json();
  assert.match(exp.vehicle.phone, /^\+34/);
});

test('panel: plaza ocupada, idempotencia por opId y último cambio gana', async () => {
  await reset();
  const cookie = await login(); const other = await login('mechanic1');
  const hdr = (c) => ({ ...H(), Cookie: c });
  const list = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  const van = list.vehicles.find((v) => v.plate === '7890RST');
  const full = await fetch(`${base}/api/panel/vehicles/${van.id}`, { method: 'PATCH', headers: hdr(cookie), body: JSON.stringify({ location: 'lift1' }) });
  assert.equal(full.status, 409);
  const opId = crypto.randomUUID();
  const a = await (await fetch(`${base}/api/panel/vehicles/${van.id}`, { method: 'PATCH', headers: hdr(cookie), body: JSON.stringify({ state: 'in_repair', opId, baseRev: van.rev }) })).json();
  const b = await (await fetch(`${base}/api/panel/vehicles/${van.id}`, { method: 'PATCH', headers: hdr(cookie), body: JSON.stringify({ state: 'in_repair', opId, baseRev: van.rev }) })).json();
  assert.equal(a.vehicle.location, 'lift2');
  assert.equal(b.vehicle.rev, a.vehicle.rev); // el reenvío no se aplica dos veces
  const late = await (await fetch(`${base}/api/panel/vehicles/${van.id}`, { method: 'PATCH', headers: hdr(other), body: JSON.stringify({ state: 'ready', baseRev: van.rev }) })).json();
  assert.equal(late.vehicle.state, 'ready');
  assert.equal(late.conflict.by, 'office');
});

test('consulta: misma respuesta y tiempo parecido para «no existe» y «verificación errónea»; DTO mínimo', async () => {
  await reset();
  const t0 = Date.now(); const missing = await post('/public/lookup', { code: 'DEMO01', plate: '1111BBB' }); const tMissing = Date.now() - t0;
  const t1 = Date.now(); const found = await post('/public/lookup', { code: 'DEMO01', plate: '1234 bcd' }); const tFound = Date.now() - t1;
  const missingBody = await missing.text(); const data = await found.json();
  assert.equal(missing.status, found.status);
  assert.equal(missingBody, '{"ok":false}');
  assert.ok(tMissing >= 400 && tFound >= 400 && Math.abs(tMissing - tFound) < 150, `${tMissing} / ${tFound}`);
  assert.deepEqual(Object.keys(data.vehicle).sort(), ['bodyType', 'canVerify', 'dims', 'etaAt', 'location', 'make', 'model', 'parts', 'plate', 'slot', 'state']);
  assert.ok(data.others.every((o) => Object.keys(o).sort().join() === 'location,slot'));
  const raw = JSON.stringify(data);
  for (const leak of ['5678FGH', '600000', 'notes', 'costEstimate', 'Cliente avisado']) assert.ok(!raw.includes(leak), leak);
  const wrong = await post('/public/verify', { token: data.token, last4: '0000' });
  assert.equal(await wrong.text(), missingBody);
  const right = await (await post('/public/verify', { token: data.token, last4: '0101' })).json();
  assert.deepEqual(right.cost, { estimate: 320, final: null });
  const forged = await post('/public/verify', { token: `${data.token.split('.')[0]}.AAAA`, last4: '0101' });
  assert.equal(await forged.text(), missingBody);
});

test('consulta: el límite por matrícula salta y no depende de que exista', async () => {
  await reset();
  const codes = [];
  for (let i = 0; i < 8; i += 1) codes.push((await post('/public/lookup', { code: 'DEMO01', plate: '2222CCC' })).status);
  assert.deepEqual(codes, [200, 200, 200, 200, 200, 200, 429, 429]);
});

test('retención: borra solo lo entregado hace más de los días configurados', async () => {
  await reset();
  const cookie = await login();
  const before = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  const run = await (await fetch(`${base}/api/panel/retention/run`, { method: 'POST', headers: { ...H(), Cookie: cookie }, body: '{}' })).json();
  const afterList = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  assert.equal(run.deleted, 1);
  assert.equal(afterList.vehicles.length, before.vehicles.length - 1);
  assert.ok(!afterList.vehicles.some((v) => v.plate === '8024CDF'));
  assert.ok(afterList.vehicles.some((v) => v.plate === '4680GHJ'));
});

test('QR del albarán: cada coche tiene un código corto único y la consulta entra con él', async () => {
  await reset();
  const cookie = await login();
  const list = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  const codes = list.vehicles.map((v) => v.publicCode);
  assert.ok(codes.every((c) => /^[A-HJ-NP-Z2-9]{6}$/.test(c)));
  assert.equal(new Set(codes).size, codes.length);
  const car = list.vehicles.find((v) => v.plate === '1234BCD');
  const ok = await (await post('/public/lookup', { code: 'DEMO01', vehicleCode: car.publicCode.toLowerCase() })).json();
  assert.equal(ok.ok, true);
  assert.equal(ok.vehicle.plate, '1234BCD');
  assert.ok(!JSON.stringify(ok).includes(car.publicCode)); // el código no viaja de vuelta en la respuesta pública
  const bad = await post('/public/lookup', { code: 'DEMO01', vehicleCode: 'AAAAAA' });
  const malformed = await post('/public/lookup', { code: 'DEMO01', vehicleCode: 'ab' });
  assert.equal(await bad.text(), '{"ok":false}');
  assert.equal(await malformed.text(), '{"ok":false}');
  const otherShop = await post('/public/lookup', { code: 'NOEXISTE', vehicleCode: car.publicCode });
  assert.equal(await otherShop.text(), '{"ok":false}');
});

test('QR del albarán: un coche nuevo recibe su propio código', async () => {
  await reset();
  const cookie = await login();
  const res = await (await fetch(`${base}/api/panel/vehicles`, { method: 'POST', headers: { ...H(), Cookie: cookie }, body: JSON.stringify({ id: crypto.randomUUID(), plate: '5555DDD', modelId: 'seat-leon' }) })).json();
  assert.equal(res.ok, true);
  assert.match(res.vehicle.publicCode, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.deepEqual(res.vehicle.tags, []);
});

test('etiquetas rápidas del coche: se guardan limpias y se validan', async () => {
  await reset();
  const cookie = await login();
  const list = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  const car = list.vehicles.find((v) => v.plate === '9012JKL');
  const patch = (body) => fetch(`${base}/api/panel/vehicles/${car.id}`, { method: 'PATCH', headers: { ...H(), Cookie: cookie }, body: JSON.stringify(body) });
  const ok = await (await patch({ tags: ['Pastillas delanteras', '  Pastillas   delanteras ', 'Neumáticos'] })).json();
  assert.deepEqual(ok.vehicle.tags, ['Pastillas delanteras', 'Neumáticos']);
  assert.equal((await patch({ tags: ['ab'] })).status, 422);
  assert.equal((await patch({ tags: Array.from({ length: 9 }, (_, i) => `Etiqueta ${i}`) })).status, 422);
  assert.equal((await patch({ tags: 'Frenos' })).status, 422);
});

test('ajustes del taller: aviso de coches parados y etiquetas propias, con valores límite', async () => {
  await reset();
  const cookie = await login();
  const send = (body) => fetch(`${base}/api/panel/workshop`, { method: 'PATCH', headers: { ...H(), Cookie: cookie }, body: JSON.stringify(body) });
  const a = await (await send({ staleDays: 7, noteTags: ['Frenos delanteros', 'Aceite'] })).json();
  assert.equal(a.workshop.staleDays, 7);
  assert.deepEqual(a.workshop.noteTags, ['Frenos delanteros', 'Aceite']);
  assert.equal(a.workshop.retentionDays, 30); // lo que no se manda no cambia
  const back = await (await send({ noteTags: null })).json();
  assert.equal(back.workshop.noteTags, null);
  assert.equal((await send({ staleDays: 0 })).status, 422);
  assert.equal((await send({ staleDays: 61 })).status, 422);
  assert.equal((await send({ noteTags: ['no'] })).status, 422);
  assert.equal((await send({ noteTags: Array.from({ length: 13 }, (_, i) => `Etiqueta ${i}`) })).status, 422);
  assert.equal((await send({})).status, 422);
});

test('hora estimada: se puede poner y quitar, y la consulta la muestra', async () => {
  await reset();
  const cookie = await login();
  const list = await (await fetch(`${base}/api/panel/vehicles`, { headers: { Cookie: cookie } })).json();
  const car = list.vehicles.find((v) => v.plate === '2468VWX');
  assert.equal(car.etaAt, null);
  const patch = (body) => fetch(`${base}/api/panel/vehicles/${car.id}`, { method: 'PATCH', headers: { ...H(), Cookie: cookie }, body: JSON.stringify(body) });
  assert.equal((await (await patch({ etaAt: '2030-05-04' })).json()).vehicle.etaAt, '2030-05-04');
  assert.equal((await patch({ etaAt: '04/05/2030' })).status, 422);
  const seen = await (await post('/public/lookup', { code: 'DEMO01', vehicleCode: car.publicCode })).json();
  assert.equal(seen.vehicle.etaAt, '2030-05-04');
  assert.equal((await (await patch({ etaAt: '' })).json()).vehicle.etaAt, null);
});

test('modo sin demo: no hay Taller Demo ni PIN conocido; el taller sale del entorno', async () => {
  const { execFileSync } = await import('node:child_process');
  const script = "import('./server/store.js').then((s) => console.log(JSON.stringify({ demo: s.DEMO, demoWorkshop: !!s.findWorkshopByCode('DEMO01'), main: s.findWorkshopByCode('TALLER1')?.name || null, vehicles: s.listVehicles('w-main').length })))";
  const run = (env) => JSON.parse(execFileSync(process.execPath, ['--input-type=module', '-e', script], { env: { ...process.env, ...env }, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
  const prod = run({ DEMO_MODE: '0', WORKSHOP_CODE: 'taller1', WORKSHOP_PIN: '4321', WORKSHOP_NAME: 'Taller Prueba' });
  assert.deepEqual(prod, { demo: false, demoWorkshop: false, main: 'Taller Prueba', vehicles: 0 });
  const nothing = run({ DEMO_MODE: '0', WORKSHOP_CODE: '', WORKSHOP_PIN: '' });
  assert.deepEqual(nothing, { demo: false, demoWorkshop: false, main: null, vehicles: 0 });
  assert.equal(run({ DEMO_MODE: '1' }).demoWorkshop, true);
});
