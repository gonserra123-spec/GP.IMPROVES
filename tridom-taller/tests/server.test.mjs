// Pruebas del servidor del mecánico: claves, aislamiento, botones, deshacer, correos y Excel.
import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

process.env.DATA_DIR = mkdtempSync(join(tmpdir(), 'tt-'));
process.env.ADMIN_KEY = 'admin-test-key';
const { handleApi, resetLimits } = await import('../server/api.js');
const { createWorkshop } = await import('../server/auth.js');
const { workshopDb, closeAll, setSettings } = await import('../server/db.js').then((m) => ({ ...m, setSettings: m.setSettings }));
const mail = await import('../server/mail.js');
const visits = await import('../server/visits.js');
const sheets = await import('../server/sheets.js');
const summary = await import('../server/summary.js');

let server; let base;
const sent = [];
before(async () => {
  server = createServer(handleApi);
  await new Promise((r) => { server.listen(0, '127.0.0.1', r); });
  base = `http://127.0.0.1:${server.address().port}`;
  mail.setSender(async (msg, row) => { sent.push({ ...msg, kind: row.kind }); return { id: `t-${row.id}` }; });
  sheets.setSyncHook(() => {});
});
after(() => { server.closeAllConnections(); server.close(); closeAll(); rmSync(process.env.DATA_DIR, { recursive: true, force: true }); });

const H = (cookie) => ({ 'Content-Type': 'application/json', 'X-Requested-With': 'tridom-taller', Origin: base, ...(cookie ? { Cookie: cookie } : {}) });
const call = (method, path, body, cookie) => fetch(`${base}/api${path}`, { method, headers: H(cookie), body: body ? JSON.stringify(body) : undefined });
const json = async (r) => r.json();
async function login(key) {
  const r = await call('POST', '/login', { key });
  return { status: r.status, cookie: r.headers.get('set-cookie')?.split(';')[0], body: await r.json() };
}
async function shop(name) {
  const w = createWorkshop(name);
  const mech = await login(w.mechanicKey); const owner = await login(w.ownerKey);
  return { ...w, mech: mech.cookie, owner: owner.cookie, session: { r: 'mechanic' } };
}
const uuid = () => crypto.randomUUID();
// Saca todo lo pendiente (de cualquier taller) y vacía lo enviado: cada prueba cuenta solo lo suyo.
const drain = async () => { await mail.processOutbox(Date.now() + 60_000); sent.length = 0; };

test('acceso: la clave basta, decide el rol y las erróneas se bloquean', async () => {
  resetLimits();
  const s = await shop('Taller Uno');
  const m = await login(s.mechanicKey); const o = await login(s.ownerKey);
  assert.equal(m.body.role, 'mechanic'); assert.equal(o.body.role, 'owner'); assert.equal(m.body.workshop.name, 'Taller Uno');
  assert.equal((await login(s.mechanicKey.toLowerCase().replace(/-/g, ' '))).status, 200); // tolera minúsculas y separadores
  const raw = await call('POST', '/login', { key: s.mechanicKey }); assert.match(raw.headers.get('set-cookie'), /HttpOnly; SameSite=Strict/);
  for (let i = 0; i < 5; i += 1) assert.equal((await login('AAAA-BBBB-CCCC')).status, 401);
  assert.equal((await login('AAAA-BBBB-CCCC')).status, 429);
  assert.equal((await login(s.mechanicKey)).status, 429); // bloqueada la IP, incluso con clave buena
  resetLimits();
});

test('CSRF y sesión: sin cookie no hay datos y sin cabecera propia se rechaza', async () => {
  resetLimits();
  const s = await shop('Taller CSRF');
  assert.equal((await call('GET', '/visits')).status, 401);
  const r = await fetch(`${base}/api/visits`, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base, Cookie: s.mech }, body: '{}' });
  assert.equal(r.status, 403);
});

test('aislamiento: cada taller solo ve sus coches y sus clientes', async () => {
  resetLimits();
  const a = await shop('Taller A'); const b = await shop('Taller B');
  assert.equal((await call('POST', '/visits', { plate: '1234BCD', email: 'a@example.com', make: 'Seat', model: 'León' }, a.mech)).status, 201);
  assert.equal((await json(await call('GET', '/visits', null, b.mech))).visits.length, 0);
  assert.equal((await json(await call('GET', '/lookup?q=1234BCD', null, b.mech))).matches.length, 0);
  assert.equal((await json(await call('GET', '/lookup?q=1234BCD', null, a.mech))).matches.length, 1);
  assert.notEqual(workshopDb(a.id), workshopDb(b.id));
});

test('roles: el mecánico no entra en ajustes, envíos ni tiempos; el dueño sí', async () => {
  resetLimits();
  const s = await shop('Taller Roles');
  for (const p of ['/owner/settings', '/owner/mail', '/owner/stats', '/owner/export.xlsx']) assert.equal((await call('GET', p, null, s.mech)).status, 403, p);
  assert.equal((await call('PATCH', '/owner/settings', { phone: '961000000' }, s.mech)).status, 403);
  for (const p of ['/owner/settings', '/owner/mail', '/owner/stats']) assert.equal((await call('GET', p, null, s.owner)).status, 200, p);
  assert.equal((await call('GET', '/admin/workshops', null, s.owner)).status, 403);
});

test('alta con una sola cosa: matrícula nueva pide correo; la conocida se rellena sola; el correo también', async () => {
  resetLimits();
  const s = await shop('Taller Alta');
  const no = await call('POST', '/visits', { plate: '0147LMN' }, s.mech);
  assert.equal(no.status, 422); assert.equal((await json(no)).errors.email, 'required');
  const noPlate = await call('POST', '/visits', { email: 'nuevo@example.com' }, s.mech);
  assert.equal(noPlate.status, 422); assert.equal((await json(noPlate)).errors.plate, 'required');
  assert.equal((await call('POST', '/visits', { plate: '0147 lmn', email: 'ana@example.com', make: 'Seat', model: 'Ibiza' }, s.mech)).status, 201);
  const id = (await json(await call('GET', '/visits', null, s.mech))).visits[0].id;
  await call('POST', `/visits/${id}/state`, { state: 'finished' }, s.mech);
  // Vuelve el mismo coche: solo la matrícula
  const again = await call('POST', '/visits', { plate: '0147LMN' }, s.mech);
  assert.equal(again.status, 201);
  const v = (await json(again)).visit;
  assert.equal(v.make, 'Seat'); assert.equal(v.email, 'a***@example.com');
  // Y por correo: encuentra la matrícula
  const f = (await json(await call('GET', `/lookup?q=${encodeURIComponent('ana@example.com')}`, null, s.mech)));
  assert.equal(f.matches[0].plate, '0147LMN'); assert.equal(f.matches[0].email, 'a***@example.com');
  assert.equal((await call('POST', '/visits', { plate: '0147LMN', email: 'x@example.com' }, s.mech)).status, 409); // ya está en el taller
});

test('alta por correo: si el correo tiene varios coches pide elegir', async () => {
  resetLimits();
  const s = await shop('Taller Dos Coches');
  for (const p of ['1111BBB', '2222CCC']) {
    const r = await json(await call('POST', '/visits', { plate: p, email: 'dos@example.com' }, s.mech));
    await call('POST', `/visits/${r.visit.id}/state`, { state: 'finished' }, s.mech);
  }
  const r = await call('POST', '/visits', { email: 'dos@example.com' }, s.mech);
  assert.equal(r.status, 409); assert.equal((await json(r)).error, 'ambiguous');
  assert.equal((await call('POST', '/visits', { email: 'dos@example.com', plate: '2222CCC' }, s.mech)).status, 201);
});

test('botones: solo hacia delante, y el correo sale tras los segundos de margen', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Botones');
  const t0 = Date.now();
  const c = await json(await call('POST', '/visits', { plate: '3333DDD', email: 'cli@example.com', make: 'Renault', model: 'Clio', eta: 'tomorrow' }, s.mech));
  const id = c.visit.id;
  assert.equal(await mail.processOutbox(t0 + 1000), 0); // aún dentro del margen de deshacer
  assert.equal(sent.length, 0);
  assert.equal(await mail.processOutbox(t0 + 15_000), 1);
  assert.match(sent[0].subject, /ya está en Taller Botones/); assert.match(sent[0].text, /Entrega prevista/); assert.match(sent[0].text, /Clio/);
  assert.match(sent[0].headers['List-Unsubscribe'], /\/baja\//); assert.match(sent[0].from, /^"Taller Botones" </);
  const r1 = await call('POST', `/visits/${id}/state`, { state: 'in_progress' }, s.mech);
  assert.equal((await json(r1)).visit.state, 'in_progress');
  assert.equal((await call('POST', `/visits/${id}/state`, { state: 'in_progress' }, s.mech)).status, 200); // repetir no cambia nada
  assert.equal((await call('POST', `/visits/${id}/state`, { state: 'finished' }, s.mech)).status, 200);
  assert.equal((await call('POST', `/visits/${id}/state`, { state: 'in_progress' }, s.mech)).status, 409); // no se vuelve atrás
  assert.equal((await call('POST', `/visits/${id}/state`, { state: 'received' }, s.mech)).status, 400);
  await mail.processOutbox(Date.now() + 15_000);
  assert.deepEqual(sent.map((m) => m.kind), ['received', 'in_progress', 'finished']);
  assert.match(sent[2].subject, /está listo/);
});

test('deshacer: antes de que salga el correo lo cancela; después ya no se puede', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Deshacer');
  const id = (await json(await call('POST', '/visits', { plate: '4444FFF', email: 'u@example.com' }, s.mech))).visit.id;
  await mail.processOutbox(Date.now() + 15_000); sent.length = 0;
  await call('POST', `/visits/${id}/state`, { state: 'in_progress' }, s.mech);
  const u = await call('POST', `/visits/${id}/undo`, {}, s.mech);
  assert.equal(u.status, 200); assert.equal((await json(u)).visit.state, 'received');
  await mail.processOutbox(Date.now() + 15_000);
  assert.equal(sent.length, 0); // el correo de «en curso» no salió
  await call('POST', `/visits/${id}/state`, { state: 'in_progress' }, s.mech); // se puede volver a pulsar
  await mail.processOutbox(Date.now() + 15_000);
  assert.equal(sent.length, 1);
  assert.equal((await call('POST', `/visits/${id}/undo`, {}, s.mech)).status, 409); // ya salió: tarde
});

test('deshacer el alta borra el coche y su correo', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Alta Mal');
  const id = (await json(await call('POST', '/visits', { plate: '5555GGG', email: 'mal@example.com' }, s.mech))).visit.id;
  const r = await json(await call('POST', `/visits/${id}/undo`, {}, s.mech));
  assert.equal(r.removed, true);
  assert.equal((await json(await call('GET', '/visits', null, s.mech))).visits.length, 0);
  await mail.processOutbox(Date.now() + 15_000);
  assert.equal(sent.length, 0);
});

test('sin conexión: la misma operación repetida no duplica coches ni correos', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Offline');
  const op = uuid(); const vid = uuid();
  const a = await json(await call('POST', '/visits', { id: vid, opId: op, plate: '6666HHH', email: 'o@example.com' }, s.mech));
  const b = await json(await call('POST', '/visits', { id: vid, opId: op, plate: '6666HHH', email: 'o@example.com' }, s.mech));
  assert.equal(b.replay, true); assert.equal(a.visit.id, b.visit.id);
  const op2 = uuid();
  await call('POST', `/visits/${vid}/state`, { opId: op2, state: 'in_progress' }, s.mech);
  await call('POST', `/visits/${vid}/state`, { opId: op2, state: 'in_progress' }, s.mech);
  assert.equal((await json(await call('GET', '/visits', null, s.mech))).visits.length, 1);
  await mail.processOutbox(Date.now() + 15_000);
  assert.equal(sent.length, 2);
});

test('anti-duplicados y baja: no repite el mismo aviso y respeta la baja', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Dup');
  const v = (await json(await call('POST', '/visits', { plate: '7777JJJ', email: 'dup@example.com' }, s.mech))).visit;
  const row = visits; // eslint-disable-line no-unused-vars
  const second = mail.queueVisitMail(s.id, { id: v.id, plate: '7777JJJ', email: 'dup@example.com', make: null, model: null, eta: null }, 'received', null);
  assert.equal(second.status, 'skipped_dup');
  const tok = mail.unsubToken(s.id, 'dup@example.com');
  assert.equal((await call('GET', `/public/unsub/${tok}`)).status, 200);
  assert.equal((await call('POST', `/public/unsub/${tok}`, {})).status, 200);
  assert.equal((await call('GET', `/public/unsub/${tok.slice(0, -2)}xx`)).status, 404);
  const x = await json(await call('POST', '/visits', { plate: '8888KKK', email: 'dup@example.com' }, s.mech));
  const log = (await json(await call('GET', '/owner/mail', null, s.owner))).mail;
  assert.equal(log.find((m) => m.visitId === x.visit.id).status, 'skipped_unsub');
});

test('seguimiento del cliente: el enlace del correo abre solo su coche y sigue los botones', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Seguimiento');
  const other = await shop('Taller Ajeno');
  await call('PATCH', '/owner/settings', { phone: '961 000 000', hours: 'L-V 9-18' }, s.owner);
  const v = (await json(await call('POST', '/visits', { plate: '1212MMM', email: 'seg@example.com', make: 'Seat', model: 'Ibiza', eta: 'today' }, s.mech))).visit;
  await mail.processOutbox(Date.now() + 15_000);
  const link = /\/coche\/(\S+)/.exec(sent[0].text)[1];
  assert.match(sent[0].html, /Ver cómo va mi coche/);
  const g = await json(await call('GET', `/public/track/${link}`));
  assert.equal(g.ok, true); assert.equal(g.workshop, 'Taller Seguimiento'); assert.equal(g.state, 'received');
  assert.equal(g.phone, '961 000 000'); assert.equal(g.plate, '1212MMM');
  assert.equal(JSON.stringify(g).includes('seg@example.com'), false); // nunca el correo
  await call('POST', `/visits/${v.id}/state`, { state: 'finished' }, s.mech);
  const f = await json(await call('GET', `/public/track/${link}`));
  assert.equal(f.state, 'finished'); assert.equal(f.eta, null); assert.ok(f.finishedAt);
  // Código manipulado, de otro taller o inventado: siempre 404.
  assert.equal((await call('GET', `/public/track/${link.slice(0, -2)}xx`)).status, 404);
  assert.equal((await call('GET', `/public/track/${other.id}.${v.id}.${link.split('.')[2]}`)).status, 404);
  assert.equal((await call('GET', `/public/track/${mail.trackToken(s.id, uuid())}`)).status, 404);
  assert.equal((await call('GET', '/public/track/basura')).status, 404);
  // Un coche deshecho deja de existir para el cliente.
  const gone = (await json(await call('POST', '/visits', { plate: '3434NNN', email: 'seg@example.com' }, s.mech))).visit;
  await call('POST', `/visits/${gone.id}/undo`, {}, s.mech);
  assert.equal((await call('GET', `/public/track/${mail.trackToken(s.id, gone.id)}`)).status, 404);
});

test('informe semanal: reparados, en curso, atascados y comparación; sale una vez por semana', async () => {
  resetLimits(); await drain();
  const weekly = await import('../server/weekly.js');
  const s = await shop('Taller Semanal');
  const db = workshopDb(s.id);
  const ins = db.prepare('INSERT INTO visits (id, plate, email, make, model, state, eta, photo, received_at, in_progress_at, finished_at, created_by) VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?, ?, ?, ?)');
  const add = (plate, model, state, rec, prog, fin) => ins.run(uuid(), plate, 'c@example.com', 'Seat', model, state, rec, prog, fin, 'mechanic');
  add('1111BCD', 'Ibiza', 'finished', '2026-11-17T09:00:00Z', '2026-11-17T10:00:00Z', '2026-11-18T10:00:00Z'); // reparado esta semana
  add('2222BCD', 'Leon', 'in_progress', '2026-11-18T09:00:00Z', '2026-11-19T09:00:00Z', null); // en curso
  add('3333BCD', 'Arona', 'received', '2026-11-19T09:00:00Z', null, null); // sin empezar
  add('4444BCD', 'Ateca', 'in_progress', '2026-11-05T09:00:00Z', '2026-11-06T09:00:00Z', null); // atascado: 15 días
  add('5555BCD', 'Toledo', 'finished', '2026-11-10T09:00:00Z', '2026-11-10T10:00:00Z', '2026-11-11T09:00:00Z'); // semana pasada
  const friday = new Date('2026-11-20T18:30:00Z'); // viernes 19:30 en Madrid
  const { subject, body } = weekly.weeklyText(s.id, friday);
  assert.match(subject, /Resumen de la semana · Taller Semanal/);
  assert.match(body, /Coches que han entrado: 3 · semana pasada, hasta el mismo día: 1/);
  assert.match(body, /Coches reparados \(finalizados\): 1 · semana pasada, hasta el mismo día: 1/);
  assert.match(body, /REPARADOS ESTA SEMANA \(1\)\n- 1111 BCD/);
  assert.match(body, /EN CURSO AHORA \(2\)/); assert.match(body, /EN EL TALLER, SIN EMPEZAR \(1\)\n- 3333 BCD/);
  assert.match(body, /ATENCIÓN: LLEVAN 7 DÍAS O MÁS SIN TERMINAR \(1\)\n- 4444 BCD · Seat Ateca · entró el 05\/11 \(15 días\) · en curso/);
  assert.equal(weekly.fmtDuration(150), '2 h 30 min'); assert.equal(weekly.fmtDuration(null), 'sin datos');
  // Programación: el jueves no toca, el viernes tarde sí y solo una vez; la semana siguiente vuelve a salir.
  setSettings(db, { ownerEmail: 'dueno@example.com' });
  const n = () => db.prepare("SELECT COUNT(*) AS c FROM outbox WHERE kind = 'summary'").get().c;
  weekly.runWeeklyReports(new Date('2026-11-19T12:00:00Z')); assert.equal(n(), 0);
  weekly.runWeeklyReports(new Date('2026-11-20T17:30:00Z')); assert.equal(n(), 0); // 18:30 en Madrid: aún no son las 19
  weekly.runWeeklyReports(friday); assert.equal(n(), 1);
  weekly.runWeeklyReports(new Date('2026-11-20T18:45:00Z')); weekly.runWeeklyReports(new Date('2026-11-21T10:00:00Z')); assert.equal(n(), 1);
  weekly.runWeeklyReports(new Date('2026-11-27T18:30:00Z')); assert.equal(n(), 2);
  const row = db.prepare("SELECT to_email, body FROM outbox WHERE kind = 'summary' ORDER BY created_at LIMIT 1").get();
  assert.equal(row.to_email, 'dueno@example.com'); assert.match(row.body, /REPARADOS ESTA SEMANA/);
  // Una semana sin ningún movimiento no manda correo vacío.
  const empty = await shop('Taller Vacio');
  setSettings(workshopDb(empty.id), { ownerEmail: 'vacio@example.com' });
  weekly.runWeeklyReports(friday);
  assert.equal(workshopDb(empty.id).prepare("SELECT COUNT(*) AS c FROM outbox WHERE kind = 'summary'").get().c, 0);
  // Ajustes, vista previa y envío manual: solo el dueño y con valores válidos.
  assert.equal((await call('PATCH', '/owner/settings', { weeklyDay: 9 }, s.owner)).status, 422);
  assert.equal((await call('PATCH', '/owner/settings', { staleDays: 1 }, s.owner)).status, 422);
  const ok = await json(await call('PATCH', '/owner/settings', { weeklyDay: 6, weeklyHour: 10, staleDays: 10, weeklyOn: true }, s.owner));
  assert.equal(ok.settings.weeklyDay, 6); assert.equal(ok.settings.staleDays, 10);
  assert.equal((await call('GET', '/owner/weekly-preview', null, s.mech)).status, 403);
  assert.equal((await call('GET', '/owner/weekly-preview', null, s.owner)).status, 200);
  assert.equal((await call('POST', '/owner/weekly/send', {}, s.owner)).status, 200);
  const noMail = await shop('Taller Sin Correo');
  assert.equal((await call('POST', '/owner/weekly/send', {}, noMail.owner)).status, 422); // sin correo del dueño
  await drain();
});

test('periodos: hoy, mensual y anual, cada uno comparado con el anterior hasta la misma altura', async () => {
  resetLimits(); await drain();
  const report = await import('../server/report.js');
  const s = await shop('Taller Periodos');
  const ins = workshopDb(s.id).prepare('INSERT INTO visits (id, plate, email, make, model, state, eta, photo, received_at, in_progress_at, finished_at, created_by) VALUES (?, ?, ?, NULL, NULL, ?, NULL, 0, ?, NULL, ?, ?)');
  const add = (plate, rec, fin) => ins.run(uuid(), plate, 'p@example.com', fin ? 'finished' : 'received', rec, fin, 'mechanic');
  add('1111BCD', '2026-11-20T09:00:00Z', '2026-11-20T11:00:00Z'); // hoy
  add('2222BCD', '2026-11-10T09:00:00Z', '2026-11-12T09:00:00Z'); // este mes
  add('3333BCD', '2026-10-05T09:00:00Z', '2026-10-06T09:00:00Z'); // mes anterior, antes del día 20
  add('4444BCD', '2025-06-01T09:00:00Z', '2025-06-02T09:00:00Z'); // año anterior
  add('5555BCD', '2026-03-01T09:00:00Z', null); // este año, sigue abierto
  const now = new Date('2026-11-20T18:30:00Z');
  const d = report.periodStats(s.id, 'day', now);
  assert.deepEqual([d.cur.received, d.cur.finished, d.prev.received], [1, 1, 0]); assert.equal(d.cur.avgTotalMin, 120);
  assert.deepEqual(d.buckets.map((b) => b.key), ['10', '12']); assert.match(d.label, /20 de noviembre de 2026/);
  const m = report.periodStats(s.id, 'month', now);
  assert.deepEqual([m.cur.received, m.cur.finished, m.prev.received, m.prev.finished], [2, 2, 1, 1]);
  assert.deepEqual(m.buckets.map((b) => b.key), ['2026-11-10', '2026-11-12', '2026-11-20']); assert.equal(m.buckets.find((b) => b.key === '2026-11-10').received, 1); assert.equal(m.label, 'Noviembre de 2026');
  const y = report.periodStats(s.id, 'year', now);
  assert.deepEqual([y.cur.received, y.cur.finished, y.prev.received, y.prev.finished], [4, 3, 1, 1]);
  assert.equal(y.buckets.length, 11); assert.equal(y.buckets.find((b) => b.key === '2026-03').received, 1); assert.equal(y.open.pending, 1);
  assert.equal(report.periodStats(s.id, 'basura', now).period, 'day'); // periodo desconocido: cae en «hoy»
  assert.equal((await call('GET', '/owner/period?p=month', null, s.owner)).status, 200);
  assert.equal((await call('GET', '/owner/period?p=month', null, s.mech)).status, 403);
});

test('sesión larga: el mecánico no pierde la entrada, se renueva con el uso y se puede cortar', async () => {
  resetLimits(); await drain();
  const auth = await import('../server/auth.js');
  const DAY = 86_400_000;
  const s = await shop('Taller Sesion');
  const raw = async (key) => (await call('POST', '/login', { key })).headers.get('set-cookie');
  assert.match(await raw(s.mechanicKey), /Max-Age=7776000/); // 90 días
  assert.match(await raw(s.ownerKey), /Max-Age=2592000/); // 30 días
  const adm = await call('POST', '/admin/login', { key: 'admin-test-key' });
  assert.match(adm.headers.get('set-cookie'), /Max-Age=7200/); // administración: 2 h
  // Sesión recién hecha: no se vuelve a emitir.
  assert.equal((await call('GET', '/visits', null, s.mech)).headers.get('set-cookie'), null);
  const payload = JSON.parse(Buffer.from(s.mech.split('=')[1].split('.')[0], 'base64url').toString());
  const at = (msAgo, extra = {}) => {
    const real = Date.now; Date.now = () => real() - msAgo;
    try { return 'tt_session=' + auth.makeSession({ w: payload.w, r: payload.r, kv: payload.kv, ...extra }); } finally { Date.now = real; }
  };
  // Con 2 días de antigüedad sigue valiendo y el servidor la renueva con el plazo completo.
  const r = await call('GET', '/visits', null, at(2 * DAY));
  assert.equal(r.status, 200);
  const fresh = r.headers.get('set-cookie'); assert.match(fresh, /Max-Age=7776000/);
  const np = JSON.parse(Buffer.from(fresh.split('=')[1].split(';')[0].split('.')[0], 'base64url').toString());
  assert.ok(np.exp - Date.now() > 89 * DAY); assert.ok(Date.now() - np.iat > 1.9 * DAY); // plazo nuevo, fecha de origen conservada
  // 89 días sin abrirla: sigue dentro. 91: pide la clave.
  assert.equal((await call('GET', '/visits', null, at(89 * DAY))).status, 200);
  assert.equal((await call('GET', '/visits', null, at(91 * DAY))).status, 401);
  // Tope de un año desde el primer acceso, aunque la usen cada día.
  assert.equal((await call('GET', '/visits', null, 'tt_session=' + auth.makeSession({ w: payload.w, r: payload.r, kv: payload.kv, iat: Date.now() - 366 * DAY }))).status, 401);
  // El dueño puede cortarla en cualquier momento cambiando la clave del mecánico (móvil perdido).
  assert.equal((await call('POST', '/owner/keys/mechanic', {}, s.owner)).status, 200);
  assert.equal((await call('GET', '/visits', null, s.mech)).status, 401);
});

test('plantillas y ajustes: el dueño cambia el texto, teléfono y horario', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Plantilla');
  const bad = await call('PATCH', '/owner/settings', { templates: { received: { subject: 'x', body: 'y' } } }, s.owner);
  assert.equal(bad.status, 422);
  const tpl = { received: { subject: 'Hola desde {taller}', body: 'Tu {matricula} está dentro.\n{telefono}\n{horario}' }, in_progress: { subject: 'En marcha {matricula}', body: 'Estamos con tu coche, {taller}.' }, finished: { subject: 'Listo {matricula}', body: 'Ya puedes venir a por él, gracias.' } };
  const ok = await call('PATCH', '/owner/settings', { phone: '961 00 00 00', hours: 'L-V 8:00-18:00', templates: tpl, replyTo: 'taller@example.com' }, s.owner);
  assert.equal(ok.status, 200);
  await call('POST', '/visits', { plate: '9999LLL', email: 'tpl@example.com' }, s.mech);
  await mail.processOutbox(Date.now() + 15_000);
  assert.equal(sent[0].subject, 'Hola desde Taller Plantilla');
  assert.match(sent[0].text, /Teléfono: 961 00 00 00/); assert.match(sent[0].text, /Horario: L-V/);
  assert.equal(sent[0].replyTo, 'taller@example.com');
});

test('resumen diario: una vez al día, a partir de la hora y solo si hay correo del dueño', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Resumen');
  await call('POST', '/visits', { plate: '1212MMM', email: 'r@example.com' }, s.mech);
  await call('PATCH', '/owner/settings', { ownerEmail: 'dueno@example.com', summaryOn: true, summaryHour: 0 }, s.owner);
  assert.equal(summary.runDailySummaries(new Date()), 1);
  assert.equal(summary.runDailySummaries(new Date()), 0);
  await mail.processOutbox(Date.now() + 15_000);
  const m = sent.find((x) => x.kind === 'summary');
  assert.ok(m); assert.equal(m.to, 'dueno@example.com'); assert.match(m.text, /Coches que han entrado: 1/);
});

test('tiempos y Excel: calcula minutos y genera un .xlsx', async () => {
  resetLimits();
  const s = await shop('Taller Tiempos');
  const t0 = Date.parse('2026-11-18T08:00:00Z');
  const v = visits.createVisit(s.id, s.session, { plate: '1313NNN', email: 't@example.com' }, t0).visit;
  visits.setState(s.id, s.session, v.id, 'in_progress', t0 + 30 * 60_000);
  visits.setState(s.id, s.session, v.id, 'finished', t0 + 150 * 60_000);
  const st = (await json(await call('GET', '/owner/stats', null, s.owner)));
  assert.equal(st.avgTotalMin, 150); assert.equal(st.avgWorkMin, 120); assert.equal(st.finishedCount, 1);
  const x = await call('GET', '/owner/export.xlsx', null, s.owner);
  assert.equal(x.status, 200); assert.match(x.headers.get('content-type'), /spreadsheetml/);
  const buf = Buffer.from(await x.arrayBuffer()); assert.equal(buf.subarray(0, 2).toString(), 'PK'); assert.ok(buf.length > 2000);
});

test('administración: crea talleres, pausa y cambia claves al instante', async () => {
  resetLimits();
  assert.equal((await call('POST', '/admin/login', { key: 'mala' })).status, 401);
  const r = await call('POST', '/admin/login', { key: 'admin-test-key' });
  assert.equal(r.status, 200); const ad = r.headers.get('set-cookie').split(';')[0];
  assert.equal((await call('POST', '/admin/workshops', { name: 'A' }, ad)).status, 422);
  const c = await json(await call('POST', '/admin/workshops', { name: 'Taller Nuevo', replyTo: 'a@example.com', ownerEmail: 'd@example.com' }, ad));
  assert.match(c.mechanicKey, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/);
  const mech = await login(c.mechanicKey); assert.equal(mech.status, 200);
  assert.equal((await call('GET', '/visits', null, mech.cookie)).status, 200);
  assert.equal((await call('POST', '/admin/workshops', { name: 'Otro' }, mech.cookie)).status, 403);
  // Pausar: la sesión abierta y la clave dejan de valer
  await call('POST', `/admin/workshops/${c.workshop.id}/pause`, {}, ad);
  assert.equal((await call('GET', '/visits', null, mech.cookie)).status, 401);
  assert.equal((await login(c.mechanicKey)).status, 403);
  await call('POST', `/admin/workshops/${c.workshop.id}/activate`, {}, ad);
  assert.equal((await login(c.mechanicKey)).status, 200);
  // Regenerar la clave del mecánico invalida la anterior y las sesiones abiertas
  const n = await json(await call('POST', `/admin/workshops/${c.workshop.id}/regenerate`, { role: 'mechanic' }, ad));
  assert.notEqual(n.key, c.mechanicKey);
  assert.equal((await login(c.mechanicKey)).status, 401); resetLimits();
  assert.equal((await login(n.key)).status, 200);
  assert.equal((await call('GET', '/visits', null, mech.cookie)).status, 401);
  assert.equal((await call('GET', '/admin/workshops', null, ad)).status, 200);
});

test('correo de prueba: solo el administrador, valida el destino y usa el mismo camino de envío', async () => {
  resetLimits(); await drain();
  const s = await shop('Taller Prueba Correo');
  assert.equal((await call('POST', '/admin/mail-test', { to: 'a@example.com' }, s.owner)).status, 403);
  const ad = (await call('POST', '/admin/login', { key: 'admin-test-key' })).headers.get('set-cookie').split(';')[0];
  assert.equal((await call('POST', '/admin/mail-test', { to: 'mal' }, ad)).status, 422);
  const r = await json(await call('POST', '/admin/mail-test', { to: 'prueba@example.com' }, ad));
  assert.equal(r.ok, true);
  assert.equal(sent.at(-1).to, 'prueba@example.com'); assert.match(sent.at(-1).subject, /Prueba de correo/);
});

test('el dueño puede cambiar la clave del mecánico sin tocar código', async () => {
  resetLimits();
  const s = await shop('Taller Cambia');
  const k = await json(await call('POST', '/owner/keys/mechanic', {}, s.owner));
  assert.equal((await login(s.mechanicKey)).status, 401); resetLimits();
  assert.equal((await login(k.key)).status, 200);
  assert.equal((await call('GET', '/visits', null, s.owner)).status, 200); // la clave del dueño sigue valiendo
});
