// Hoja de Google Sheets por taller y descarga en Excel. La base de datos manda: la hoja es una copia
// que se reescribe entera, así que si alguien borra filas no se pierde nada (se vuelven a escribir).
import { createSign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import ExcelJS from 'exceljs';
import { GOOGLE } from './config.js';
import { getSettings, setSettings, workshopDb } from './db.js';
import { COLUMNS, TIMES_COLUMNS, carRows, timesRows } from './report.js';

function credentials() {
  try {
    const raw = GOOGLE.json || (GOOGLE.file ? readFileSync(GOOGLE.file, 'utf8') : '');
    if (!raw) return null;
    const c = JSON.parse(raw);
    return c.client_email && c.private_key ? c : null;
  } catch { return null; }
}
export const sheetsConfigured = () => !!credentials();
export const serviceAccountEmail = () => credentials()?.client_email || null;

let token = { value: '', exp: 0 };
async function accessToken() {
  if (token.value && token.exp > Date.now() + 60_000) return token.value;
  const c = credentials();
  if (!c) throw new Error('Sin credenciales de Google');
  const b = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
  const iat = Math.floor(Date.now() / 1000);
  const unsigned = `${b({ alg: 'RS256', typ: 'JWT' })}.${b({ iss: c.client_email, scope: 'https://www.googleapis.com/auth/spreadsheets', aud: 'https://oauth2.googleapis.com/token', iat, exp: iat + 3600 })}`;
  const sig = createSign('RSA-SHA256').update(unsigned).sign(c.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', signal: AbortSignal.timeout(15_000), headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${unsigned}.${sig}` }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok || !d.access_token) throw new Error(`Google rechazó las credenciales (${res.status})`);
  token = { value: d.access_token, exp: Date.now() + (d.expires_in || 3600) * 1000 };
  return token.value;
}
async function g(method, path, body) {
  const res = await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${path}`, {
    method, signal: AbortSignal.timeout(20_000),
    headers: { Authorization: `Bearer ${await accessToken()}`, 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined,
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(res.status === 404 ? 'No encuentro la hoja: revisa el identificador' : res.status === 403 ? 'La hoja no está compartida con la cuenta de servicio' : `Google respondió ${res.status}`);
  return d;
}

export async function syncSheet(wid) {
  const db = workshopDb(wid);
  const id = getSettings(db).sheetId;
  if (!id) return { status: 'off' };
  if (!sheetsConfigured()) { setSettings(db, { sheetStatus: 'no_credentials' }); return { status: 'no_credentials' }; }
  try {
    const meta = await g('GET', `${id}?fields=sheets.properties.title`);
    const have = new Set((meta.sheets || []).map((s) => s.properties.title));
    const add = ['Coches', 'Tiempos'].filter((t) => !have.has(t)).map((title) => ({ addSheet: { properties: { title } } }));
    if (add.length) await g('POST', `${id}:batchUpdate`, { requests: add });
    await g('POST', `${id}/values:batchClear`, { ranges: ['Coches', 'Tiempos'] });
    await g('POST', `${id}/values:batchUpdate`, {
      valueInputOption: 'RAW',
      data: [{ range: 'Coches!A1', values: [COLUMNS, ...carRows(wid)] }, { range: 'Tiempos!A1', values: [TIMES_COLUMNS, ...timesRows(wid)] }],
    });
    setSettings(db, { sheetStatus: 'ok', sheetSyncedAt: new Date().toISOString(), sheetError: '' });
    return { status: 'ok' };
  } catch (e) {
    const msg = String(e.message || e).slice(0, 160);
    setSettings(db, { sheetStatus: 'error', sheetError: msg });
    return { status: 'error', error: msg };
  }
}

// Cada cambio pide una sincronización; se agrupan en 3 s para no gastar cuota de Google con cada toque.
const timers = new Map();
let hook = null; // las pruebas lo sustituyen
export const setSyncHook = (fn) => { hook = fn; };
export function scheduleSync(wid) {
  if (hook) { hook(wid); return; }
  if (timers.has(wid) || !sheetsConfigured()) return;
  timers.set(wid, setTimeout(() => { timers.delete(wid); syncSheet(wid).catch(() => {}); }, 3000).unref());
}

// ---------- Excel ----------
export async function exportXlsx(wid, workshopName) {
  const wb = new ExcelJS.Workbook();
  wb.creator = workshopName; wb.created = new Date();
  const add = (name, cols, rows, widths) => {
    const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
    ws.addRow(cols);
    ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0B2A5B' } };
    rows.forEach((r) => ws.addRow(r));
    widths.forEach((w, i) => { ws.getColumn(i + 1).width = w; });
    ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: cols.length } };
  };
  add('Coches', COLUMNS, carRows(wid), [12, 30, 22, 14, 18, 18, 18, 16, 18, 16]);
  add('Tiempos', TIMES_COLUMNS, timesRows(wid), [12, 10, 12, 22, 22]);
  return Buffer.from(await wb.xlsx.writeBuffer());
}
