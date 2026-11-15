import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiMiddleware } from './server/api.js';
import { headersMiddleware } from './server/security.js';
import { existsSync } from 'node:fs';
import { extname, join } from 'node:path';

// Como en server/index.js: un fichero con extensión que no existe es 404, no la carcasa de la app.
const missingFile = (req, res, next) => {
  let path;
  try { path = decodeURIComponent(req.url.split('?')[0]); } catch { res.statusCode = 400; res.end(); return; }
  if (!path.startsWith('/api/') && extname(path) && !existsSync(join(import.meta.dirname, 'dist', path))) { res.statusCode = 404; res.end('No encontrado'); return; }
  next();
};

// La API de demo (server/api.js) se monta también en dev y en preview, así el panel y la consulta
// pasan siempre por servidor. La CSP completa solo va con el build (en dev rompería el HMR).
const demoApi = () => ({
  name: 'tridom-garage-api',
  configureServer(server) { server.middlewares.use(headersMiddleware({ full: false })); server.middlewares.use(apiMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(headersMiddleware({ full: true })); server.middlewares.use(missingFile); server.middlewares.use(apiMiddleware); },
});

export default defineConfig({
  plugins: [react(), demoApi()],
  server: { port: 5200, strictPort: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1100, // three va entero en el chunk diferido de la escena
  },
});
