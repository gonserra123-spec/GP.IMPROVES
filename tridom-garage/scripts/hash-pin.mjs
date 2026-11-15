// Genera el hash de un PIN para la tabla workshops de Supabase (formato pbkdf2$iteraciones$sal$hash).
//   node scripts/hash-pin.mjs        (pide el PIN por teclado; no queda en el historial de la terminal)
import { pbkdf2Sync, randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const rl = createInterface({ input: process.stdin, output: process.stderr });
const pin = (await rl.question('PIN (4-8 cifras): ')).trim();
rl.close();
if (!/^\d{4,8}$/.test(pin)) { console.error('El PIN debe tener entre 4 y 8 cifras.'); process.exit(1); }
const ITER = 210_000;
const salt = randomBytes(16);
const hash = pbkdf2Sync(pin, salt, ITER, 32, 'sha256');
console.log(['pbkdf2', ITER, salt.toString('base64url'), hash.toString('base64url')].join('$'));
