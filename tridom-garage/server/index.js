// Servidor de la demo: sirve dist/ con cabeceras de seguridad y atiende /api/*.
//   npm run build && npm start     (PORT, TRUST_PROXY, SESSION_SECRET, DEMO_PIN por entorno)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { handleApi } from './api.js';
import { securityHeaders } from './security.js';

const ROOT = resolve(fileURLToPath(new URL('../dist', import.meta.url)));
const PORT = Number(process.env.PORT) || 8080;
const HEADERS = securityHeaders({ full: true });
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml',
  '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.woff2': 'font/woff2', '.woff': 'font/woff', '.png': 'image/png',
  '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8',
};

const file = async (path) => ((await stat(path).catch(() => null))?.isFile() ? path : null);

createServer(async (req, res) => {
  for (const [k, v] of Object.entries(HEADERS)) res.setHeader(k, v);
  if (process.env.TRUST_PROXY === '1' && req.headers['x-forwarded-proto'] === 'http' && /^[a-z0-9.-]+(:\d+)?$/i.test(req.headers.host || '')) {
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
  if (/(^|[\\/])(\.|_headers)/.test(rel)) { res.writeHead(404); return res.end(); }

  // Rutas de la app (sin extensión) caen en index.html; un fichero que no existe es 404.
  const found = (await file(target)) || (extname(rel) ? null : await file(join(ROOT, 'index.html')));
  if (!found) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); return res.end('No encontrado'); }
  const hashed = found.startsWith(join(ROOT, 'assets') + sep);
  res.writeHead(200, { 'Content-Type': TYPES[extname(found)] || 'application/octet-stream', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-cache' });
  if (req.method === 'HEAD') return res.end();
  res.end(await readFile(found));
}).listen(PORT, () => console.log(`Tridom Automotive (demo) en http://localhost:${PORT}`));
