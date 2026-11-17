// Fechas en la hora local del dispositivo (el taller trabaja en su zona horaria).
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => dayKey();
export const addDays = (n, from = new Date()) => { const d = new Date(from); d.setDate(d.getDate() + n); return dayKey(d); };
export const dayOf = (iso) => (iso ? dayKey(new Date(iso)) : '');
export const daysSince = (iso, now = Date.now()) => Math.floor((now - Date.parse(iso)) / 86_400_000);
// Salida estimada ya pasada y el coche sigue sin estar listo.
export const isOverdue = (v) => !!v.etaAt && !['ready', 'delivered'].includes(v.state) && v.etaAt < today();
