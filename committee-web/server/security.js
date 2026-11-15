// Cabeceras de seguridad. Se usan en el servidor de producción (server/index.js) y en
// `vite preview`. Si se despliega como estático (Cloudflare Pages / Netlify) la misma
// política está en public/_headers: mantener ambas iguales.
export const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'", // React y Leaflet fijan estilos en línea
  "img-src 'self' data: https://tile.openstreetmap.org", // teselas del mapa
  "font-src 'self' data:",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "object-src 'none'",
  'upgrade-insecure-requests',
].join('; ');

const BASE = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  'Cross-Origin-Opener-Policy': 'same-origin',
};

// full=true añade CSP y HSTS (solo tienen sentido con el build y bajo HTTPS).
export function securityHeaders({ full }) {
  return full ? { ...BASE, 'Content-Security-Policy': CSP, 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains' } : BASE;
}

export function headersMiddleware({ full }) {
  const h = securityHeaders({ full });
  return (_req, res, next) => { for (const [k, v] of Object.entries(h)) res.setHeader(k, v); next(); };
}
