// Cabeceras de seguridad. La CSP completa solo va con el build (en dev rompería el HMR de Vite).
export function securityHeaders({ full = true } = {}) {
  const h = {
    'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY',
    'Permissions-Policy': 'camera=(self), microphone=(), geolocation=()',
  };
  if (full) {
    h['Content-Security-Policy'] = "default-src 'self'; img-src 'self' data: blob:; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'";
    h['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';
  }
  return h;
}
export const headersMiddleware = (opts) => {
  const h = securityHeaders(opts);
  return (req, res, next) => { for (const [k, v] of Object.entries(h)) res.setHeader(k, v); next(); };
};
