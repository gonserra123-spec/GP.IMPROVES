// Llamadas a la API. Un fallo de red lanza NetworkError (el cambio se queda en la cola); el resto devuelve { ok, status, ... }.
export class NetworkError extends Error {}

export async function api(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-Requested-With': 'tridom-taller', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new NetworkError('offline'); }
  const data = await res.json().catch(() => null);
  if (!data && res.status >= 500) throw new NetworkError('server'); // proxy caído: se trata como falta de conexión
  return { status: res.status, ...(data || { ok: res.ok }) };
}
export const get = (p) => api('GET', p);
export const post = (p, b = {}) => api('POST', p, b);
export const patch = (p, b) => api('PATCH', p, b);

export const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, (c) => (c ^ (crypto.getRandomValues(new Uint8Array(1))[0] & (15 >> (c / 4)))).toString(16)));

// Texto de los errores que ve el mecánico (siempre en lenguaje claro).
export const ERR = {
  plate_format: 'Revisa la matrícula: 4 cifras y 3 letras (1234 BCD) o formato antiguo.', email_format: 'Revisa el correo electrónico.',
  required: 'Este dato es obligatorio.', plate_active: 'Ese coche ya está en el taller.', bad_transition: 'Ese paso ya no se puede hacer.',
  too_late: 'Ya salió el correo: no se puede deshacer.', ambiguous: 'Ese correo tiene varios coches. Escribe la matrícula.', not_found: 'No se encuentra.',
  bad_key: 'La clave no es correcta.', paused: 'Este taller está pausado. Habla con Tridom.', locked: 'Demasiados intentos. Espera unos minutos.',
  rate_limited: 'Demasiadas peticiones. Espera un momento.', forbidden: 'No tienes permiso.', owner_only: 'Solo para el dueño del taller.',
  validation: 'Revisa los campos marcados.', server: 'Algo ha fallado. Inténtalo de nuevo.', invalid: 'El dato no es válido.',
};
export const errText = (e) => ERR[e] || ERR.server;
