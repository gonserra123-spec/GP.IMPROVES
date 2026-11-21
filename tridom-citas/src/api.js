// Habla con la API pública de citas de tridom-taller. No usa cookies ni claves: cualquiera con el enlace del taller puede pedir cita.
export const API = (import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:5300/api' : '/api')).replace(/\/$/, '');

export async function getInfo(id) {
  try {
    const r = await fetch(`${API}/public/booking/${encodeURIComponent(id)}`);
    if (r.status === 404) return { notFound: true };
    const d = await r.json().catch(() => null);
    return d?.ok ? d : { error: true };
  } catch { return { offline: true }; }
}

export async function sendBooking(id, body) {
  try {
    const r = await fetch(`${API}/public/booking/${encodeURIComponent(id)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return { status: r.status, ...d };
  } catch { return { offline: true }; }
}
