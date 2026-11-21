import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// En desarrollo la API y los envíos de correo corren dentro de Vite, igual que en producción.
// El servidor se carga solo al arrancar el modo dev: el build no necesita secretos ni base de datos.
const api = () => ({
  name: 'tridom-taller-api',
  async configureServer(server) {
    const [{ apiMiddleware }, { headersMiddleware }, { startWorkers }] = await Promise.all([import('./server/api.js'), import('./server/security.js'), import('./server/workers.js')]);
    startWorkers();
    server.middlewares.use(headersMiddleware({ full: false }));
    server.middlewares.use(apiMiddleware);
  },
});

export default defineConfig({ plugins: [react(), api()], server: { port: 5300, strictPort: true }, build: { target: 'es2022' } });
