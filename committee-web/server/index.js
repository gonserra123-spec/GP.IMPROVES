// Servidor de producción: sirve dist/ con cabeceras de seguridad y atiende /api/*.
//   npm run build && npm start        (PORT, TRUST_PROXY y los webhooks, por entorno)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi, fromTrustedProxy } from './api.js';
import { securityHeaders } from './security.js';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const HEADERS = securityHeaders({ full: true });
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

async function file(path) {
  const s = await stat(path).catch(() => null);
  return s?.isFile() ? path : null;
}

createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  if (fromTrustedProxy(req) && req.headers['x-forwarded-proto'] === 'http' && /^[a-z0-9.-]+(:\d+)?$/i.test(req.headers.host || '')) {
    res.writeHead(308, { Location: `https://${req.headers.host}${req.url}` });
    return res.end();
  }
  if (req.url.startsWith('/api/')) return handleApi(req, res);
  if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405, { Allow: 'GET, HEAD' }); return res.end(); }

  let rel;
  try { rel = decodeURIComponent(new URL(req.url, 'http://localhost').pathname); } catch { res.writeHead(400); return res.end(); }
  if (rel.includes('\0')) { res.writeHead(400); return res.end(); }
  const target = normalize(join(ROOT, rel));
  if (target !== ROOT && !target.startsWith(ROOT + sep)) { res.writeHead(403); return res.end(); }

  if (/(^|[\/])(\.|_headers)/.test(rel)) { res.writeHead(404); return res.end(); }
  const found = (await file(target)) || (extname(rel) ? null : await file(join(ROOT, 'index.html')));
  if (!found) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
  const hashed = found.startsWith(join(ROOT, 'assets') + sep);
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] || 'application/octet-stream', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  res.end(await readFile(found));
}).listen(PORT, () => console.log(`Committee web en http://localhost:${PORT}`));
