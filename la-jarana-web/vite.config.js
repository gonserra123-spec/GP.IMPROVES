import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Cabeceras de seguridad (Regla 8). En producción las sirve vercel.json / public/_headers;
// aquí se replican en `vite preview` (CSP completa) y en dev (sin CSP: rompería el HMR).
// Orígenes externos permitidos, y por qué:
//  · tiles.openfreemap.org → estilo, teselas vectoriales, sprites y fuentes del mapa (sin clave)
//  · s3.amazonaws.com → teselas de relieve "terrarium" (AWS Open Data, sin clave)
//  · *.workers.dev → Worker propio que genera los comunicados (la clave de Gemini vive solo allí)
const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // Motion y MapLibre escriben estilos inline
  "img-src 'self' data: blob: https://tiles.openfreemap.org https://s3.amazonaws.com",
  "font-src 'self'",
  "connect-src 'self' https://tiles.openfreemap.org https://s3.amazonaws.com https://*.workers.dev",
  "worker-src 'self' blob:", // MapLibre usa web workers en blob:
  "child-src blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

const headers = (full) => (_req, res, next) => {
  for (const [k, v] of Object.entries(SECURITY)) res.setHeader(k, v);
  if (full) res.setHeader('Content-Security-Policy', CSP);
  next();
};

// Canonical y JSON-LD: el dominio aún no existe → solo se emite canonical/og:url si hay SITE_URL.
const seo = () => ({
  name: 'jarana-seo',
  transformIndexHtml() {
    const site = (process.env.SITE_URL || '').replace(/\/$/, '');
    const tags = [];
    if (site) {
      tags.push({ tag: 'link', attrs: { rel: 'canonical', href: site + '/' }, injectTo: 'head' });
      tags.push({ tag: 'meta', attrs: { property: 'og:url', content: site + '/' }, injectTo: 'head' });
    }
    const ld = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: 'La Jarana',
      slogan: 'Make Rubielos Great Again',
      description: 'Peña de Rubielos de Mora (Teruel).',
      sameAs: ['https://www.instagram.com/_lajarana/'],
      address: { '@type': 'PostalAddress', addressLocality: 'Rubielos de Mora', addressRegion: 'Teruel', addressCountry: 'ES' },
      ...(site ? { url: site + '/' } : {}),
    };
    tags.push({ tag: 'script', attrs: { type: 'application/ld+json' }, children: JSON.stringify(ld), injectTo: 'head' });
    return tags;
  },
});

const sec = () => ({
  name: 'jarana-headers',
  configureServer(s) { s.middlewares.use(headers(false)); },
  configurePreviewServer(s) { s.middlewares.use(headers(true)); },
});

export { CSP };

export default defineConfig({
  plugins: [react(), seo(), sec()],
  server: { port: 5210, strictPort: true },
  build: { target: 'es2022', chunkSizeWarningLimit: 1100 },
});
