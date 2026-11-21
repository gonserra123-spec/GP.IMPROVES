// Una base SQLite maestra (talleres y claves) y una base propia por taller: los datos de un taller
// viven en su propio archivo y ninguna consulta puede cruzarse con los de otro.
import { DatabaseSync } from 'node:sqlite';
import { join } from 'node:path';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { DATA_DIR } from './config.js';

const open = (file) => { const d = new DatabaseSync(file); d.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON; PRAGMA busy_timeout = 5000;'); return d; };

let master = null;
export function masterDb() {
  if (master) return master;
  master = open(join(DATA_DIR, 'master.db'));
  master.exec(`
    CREATE TABLE IF NOT EXISTS workshops (
      id TEXT PRIMARY KEY, name TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'active',
      mech_hash TEXT NOT NULL UNIQUE, owner_hash TEXT NOT NULL UNIQUE, mech_ver INTEGER NOT NULL DEFAULT 1, owner_ver INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    );
  `);
  return master;
}

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS customers (
    plate TEXT PRIMARY KEY, email TEXT NOT NULL, make TEXT, model TEXT, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS customers_email ON customers (email);
  CREATE TABLE IF NOT EXISTS unsubs (email TEXT PRIMARY KEY, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS visits (
    id TEXT PRIMARY KEY, plate TEXT NOT NULL, email TEXT NOT NULL, make TEXT, model TEXT,
    state TEXT NOT NULL CHECK (state IN ('received','in_progress','finished')),
    eta TEXT, photo INTEGER NOT NULL DEFAULT 0,
    received_at TEXT NOT NULL, in_progress_at TEXT, finished_at TEXT, created_by TEXT,
    problem TEXT, customer_name TEXT, phone TEXT
  );
  CREATE INDEX IF NOT EXISTS visits_plate ON visits (plate);
  CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT, visit_id TEXT NOT NULL, state TEXT NOT NULL, prev_state TEXT,
    at TEXT NOT NULL, by TEXT, undone INTEGER NOT NULL DEFAULT 0
  );
  CREATE INDEX IF NOT EXISTS events_visit ON events (visit_id);
  CREATE TABLE IF NOT EXISTS outbox (
    id TEXT PRIMARY KEY, visit_id TEXT, event_id INTEGER, kind TEXT NOT NULL, to_email TEXT NOT NULL,
    subject TEXT NOT NULL, body TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
    provider_id TEXT, error TEXT, created_at TEXT NOT NULL, send_after TEXT NOT NULL, sent_at TEXT
  );
  CREATE INDEX IF NOT EXISTS outbox_status ON outbox (status, send_after);
  CREATE TABLE IF NOT EXISTS ops (op_id TEXT PRIMARY KEY, result TEXT NOT NULL, at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS appointments (
    id TEXT PRIMARY KEY, name TEXT NOT NULL, plate TEXT NOT NULL, email TEXT NOT NULL, phone TEXT, problem TEXT NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('requested','arrived','dismissed')), visit_id TEXT,
    created_at TEXT NOT NULL, updated_at TEXT NOT NULL
  );
  CREATE INDEX IF NOT EXISTS appointments_status ON appointments (status, created_at);
`;
// Bases creadas antes de las citas: se les añaden las columnas nuevas sin tocar lo que ya tienen.
function migrate(d) {
  const cols = new Set(d.prepare('PRAGMA table_info(visits)').all().map((c) => c.name));
  for (const c of ['problem', 'customer_name', 'phone']) if (!cols.has(c)) d.exec(`ALTER TABLE visits ADD COLUMN ${c} TEXT`);
}

const handles = new Map();
export const workshopDir = (id) => join(DATA_DIR, 'w', id);
export function workshopDb(id) {
  if (!/^[a-z0-9]{6,32}$/.test(id)) throw new Error('id de taller no válido');
  let d = handles.get(id);
  if (d) return d;
  mkdirSync(workshopDir(id), { recursive: true });
  d = open(join(workshopDir(id), 'data.db'));
  d.exec(SCHEMA);
  migrate(d);
  handles.set(id, d);
  return d;
}
export function closeAll() {
  for (const d of handles.values()) d.close();
  handles.clear();
  master?.close(); master = null;
}
export function dropWorkshopData(id) {
  handles.get(id)?.close(); handles.delete(id);
  if (existsSync(workshopDir(id))) rmSync(workshopDir(id), { recursive: true, force: true });
}

// Ajustes por taller (clave -> JSON).
export function getSettings(db) {
  const out = {};
  for (const r of db.prepare('SELECT key, value FROM settings').all()) { try { out[r.key] = JSON.parse(r.value); } catch { /* valor corrupto: se ignora */ } }
  return out;
}
export function setSettings(db, patch) {
  const st = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
  for (const [k, v] of Object.entries(patch)) st.run(k, JSON.stringify(v));
}
