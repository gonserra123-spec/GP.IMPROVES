// Configuración por entorno. Nada de claves en el código: todo llega por variables de entorno.
import { randomBytes } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = fileURLToPath(new URL('..', import.meta.url));
// .env local (si existe): no pisa las variables que ya vengan del entorno.
try { process.loadEnvFile(join(here, '.env')); } catch { /* sin .env */ }
export const PROD = process.env.NODE_ENV === 'production';
export const DATA_DIR = resolve(process.env.DATA_DIR || join(here, 'data'));
mkdirSync(join(DATA_DIR, 'w'), { recursive: true });

// Secreto del servidor: firma las sesiones y resume las claves de acceso. Si cambia, todas las claves dejan de valer.
function loadSecret() {
  if (process.env.SESSION_SECRET && process.env.SESSION_SECRET.length >= 32) return process.env.SESSION_SECRET;
  if (PROD) throw new Error('Falta SESSION_SECRET (mínimo 32 caracteres) y no debe cambiar nunca: invalidaría todas las claves.');
  const file = join(DATA_DIR, '.secret');
  if (!existsSync(file)) writeFileSync(file, randomBytes(48).toString('hex'), { mode: 0o600 });
  return readFileSync(file, 'utf8').trim();
}
export const SECRET = loadSecret();

export const ADMIN_KEY = process.env.ADMIN_KEY || (PROD ? '' : 'admin-dev-local');
export const PUBLIC_URL = (process.env.PUBLIC_URL || 'http://localhost:5300').replace(/\/$/, '');
export const UNDO_SECONDS = Number(process.env.UNDO_SECONDS) || 10;
export const DEDUPE_MINUTES = Number(process.env.DEDUPE_MINUTES) || 10;
export const TIMEZONE = process.env.TIMEZONE || 'Europe/Madrid';

export const MAIL = {
  provider: process.env.RESEND_API_KEY ? 'resend' : 'dev', // dev: no envía nada, deja el correo en data/outbox-dev
  resendKey: process.env.RESEND_API_KEY || '',
  from: process.env.MAIL_FROM || 'avisos@example.invalid', // dirección verificada en el servicio de correo (un único remitente)
  webhookSecret: process.env.RESEND_WEBHOOK_SECRET || '',
};

export const GOOGLE = {
  json: process.env.GOOGLE_SERVICE_ACCOUNT_JSON || '',
  file: process.env.GOOGLE_SERVICE_ACCOUNT_FILE || '',
};
