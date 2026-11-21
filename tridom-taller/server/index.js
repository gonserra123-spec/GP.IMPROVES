// Servidor de producción: sirve dist/ y atiende /api/*. Datos en DATA_DIR (un archivo SQLite por taller).
//   npm run build && npm start   (PORT, SESSION_SECRET, ADMIN_KEY, PUBLIC_URL, RESEND_API_KEY, MAIL_FROM... ver docs/despliegue.md)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { MAIL } from './config.js';
import { securityHeaders } from './security.js';
import { startWorkers } from './workers.js';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 8090;
const HEADERS = securityHeaders({ full: true });
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.ico': 'image/x-icon',
};
const file = async (p) => ((await stat(p).catch(() => null))?.isFile() ? p : null);

createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  if (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'http' && /^[a-z0-9.-]+(:\d+)?$/i.test(req.headers.host || '')) {
    res.writeHead(308, { Location: `https://${req.headers.host}${req.url}` });
    return res.end();
  }
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }
  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://x').pathname); } catch { res.writeHead(400); return res.end(); }
  const target = normalize(join(ROOT, rel));
  if (rel.includes('\0') || (target !== ROOT && !target.startsWith(ROOT + sep))) { res.writeHead(403); return res.end(); }
  const found = (await file(target)) || (extname(rel) ? null : await file(join(ROOT, 'index.html')));
  if (!found) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
  const hashed = found.startsWith(join(ROOT, 'assets') + sep);
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] || 'application/octet-stream', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  res.end(await readFile(found));
}).listen(PORT, () => console.log(`Tridom Automotive · Taller en http://localhost:${PORT} · correo: ${MAIL.provider}`));
startWorkers();
