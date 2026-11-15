import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { apiMiddleware } from './server/api.js';
import { headersMiddleware } from './server/security.js';

// En desarrollo y en `vite preview` se monta la misma API que en producción (server/api.js),
// así los formularios se validan en el servidor también aquí. La CSP completa solo va con el
// build (en dev rompería el HMR).
const serverApi = () => ({
  name: 'committee-api',
  configureServer(server) { server.middlewares.use(headersMiddleware({ full: false })); server.middlewares.use(apiMiddleware); },
  configurePreviewServer(server) { server.middlewares.use(headersMiddleware({ full: true })); server.middlewares.use(apiMiddleware); },
});

export default defineConfig({
  plugins: [react(), serverApi()],
  server: { port: 5190, strictPort: true },
  build: { target: 'es2022' },
});
