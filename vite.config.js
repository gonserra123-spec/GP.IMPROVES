import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { BUSINESS } from './src/data/business.js';
import es from './src/i18n/es.js';
import { buildJsonLd } from './src/lib/seo.js';

// Inyecta la URL del sitio y el JSON-LD (ES) en el HTML estático. La app lo actualiza al cambiar de idioma.
function headPlugin(siteUrl) {
  return {
    name: '2con2-head',
    transformIndexHtml(html) {
      const business = { ...BUSINESS, siteUrl };
      return html
        .replaceAll('%SITE_URL%', siteUrl)
        .replace('__JSONLD__', JSON.stringify(buildJsonLd('es', es, business)));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), 'VITE_');
  const siteUrl = (env.VITE_SITE_URL || BUSINESS.siteUrl).replace(/\/$/, '');
  return {
    plugins: [react(), headPlugin(siteUrl)],
    server: { port: 5173 },
    // SHARE=1 (scripts/make-share.mjs): un solo bundle, sin chunks dinámicos, para incrustarlo en un HTML.
    build: { target: 'es2022', rollupOptions: { output: { inlineDynamicImports: !!process.env.SHARE } } },
  };
});
