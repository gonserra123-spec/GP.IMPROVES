// Lector de CSV para importar los clientes del taller (exportación de su programa de gestión).
// Acepta ; , o tabulador, comillas, BOM y cabeceras habituales en español e inglés. Sin dependencias.
const fold = (s) => String(s ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const HEADERS = {
  plate: ['matricula', 'matr', 'placa', 'plate', 'license plate', 'registro'],
  make: ['marca', 'make', 'fabricante'],
  model: ['modelo', 'model'],
  vehicle: ['vehiculo', 'coche', 'vehicle', 'auto', 'automovil', 'marca modelo', 'marca y modelo'],
  phone: ['telefono', 'tel', 'telf', 'movil', 'phone', 'mobile', 'celular', 'telefono movil'],
  email: ['email', 'e mail', 'correo', 'mail', 'correo electronico'],
};
const lookup = {};
for (const [k, list] of Object.entries(HEADERS)) for (const h of list) lookup[h] = k;

function detectDelimiter(line) {
  const count = (c) => { let n = 0; let q = false; for (const ch of line) { if (ch === '"') q = !q; else if (!q && ch === c) n += 1; } return n; };
  const best = [';', ',', '\t'].map((c) => [c, count(c)]).sort((a, b) => b[1] - a[1])[0];
  return best[1] > 0 ? best[0] : ',';
}

function split(text, delim) {
  const rows = []; const lines = []; let row = []; let cell = ''; let q = false; let line = 1; let start = 1;
  const push = () => { row.push(cell); cell = ''; if (row.some((c) => c.trim())) { rows.push(row); lines.push(start); } row = []; };
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i += 1; } else q = false; } else { if (ch === '\n') line += 1; cell += ch; }
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1;
      push(); line += 1; start = line;
    } else cell += ch;
  }
  push();
  return { rows, lines };
}

// -> { rows: [{ plate, make, model, vehicle, phone, email, line }], columns: ['plate', ...], error?: 'empty' | 'no_plate_column' | 'too_many' }
export function parseCsv(input, { max = 2000 } = {}) {
  const text = String(input ?? '').replace(/^﻿/, '');
  const first = text.split(/\r?\n/, 1)[0] || '';
  if (!first.trim()) return { rows: [], columns: [], error: 'empty' };
  const { rows: table, lines } = split(text, detectDelimiter(first));
  if (table.length < 2) return { rows: [], columns: [], error: 'empty' };
  const map = table[0].map((h) => lookup[fold(h)] || null);
  const columns = [...new Set(map.filter(Boolean))];
  if (!columns.includes('plate')) return { rows: [], columns, error: 'no_plate_column' };
  if (table.length - 1 > max) return { rows: [], columns, error: 'too_many' };
  const rows = table.slice(1).map((cells, i) => {
    const r = { line: lines[i + 1] };
    map.forEach((k, c) => { if (k && !r[k]) r[k] = (cells[c] ?? '').trim(); });
    return r;
  });
  return { rows, columns };
}
