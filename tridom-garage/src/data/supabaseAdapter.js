// Adaptador de Supabase. Preparado y documentado, sin credenciales: ver docs/deploy-supabase.md.
// El navegador nunca lee tablas: todo pasa por dos Edge Functions que usan la clave de servicio.
//   - `panel`: login por PIN (hash en servidor), sesión en cookie httpOnly y operaciones del taller.
//   - `consulta`: consulta pública por matrícula con el DTO mínimo.
// Realtime: la función `panel` entrega un JWT corto con el id del taller; la política de realtime.messages
// solo deja escuchar el canal privado de ese taller, por el que viajan avisos sin datos.
import { NetworkError } from './adapter.js';

const URL_BASE = import.meta.env.VITE_SUPABASE_URL;
const ANON = import.meta.env.VITE_SUPABASE_ANON_KEY; // clave pública; sin permisos sobre las tablas (RLS)

async function fn(name, action, payload = {}) {
  if (!URL_BASE || !ANON) return { ok: false, status: 503, error: 'not_configured' };
  let res;
  try {
    res = await fetch(`${URL_BASE}/functions/v1/${name}`, {
      method: 'POST', credentials: 'include', cache: 'no-store',
      headers: { 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${ANON}`, 'X-Requested-With': 'tridom-garage' },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch { throw new NetworkError('offline'); }
  const data = await res.json().catch(() => null);
  if (!data && res.status >= 500) throw new NetworkError('server');
  return { status: res.status, ...(data || { ok: res.ok }) };
}

export function createSupabaseAdapter() {
  const panel = (action, payload) => fn('panel', action, payload);
  const consulta = (action, payload) => fn('consulta', action, payload);
  return {
    kind: 'supabase',
    config: async () => ({ ok: true, status: 200, demo: false, demoPin: null, workshopCode: null }),
    login: (input) => panel('login', input),
    logout: () => panel('logout'),
    session: () => panel('session'),
    listVehicles: () => panel('list'),
    createVehicle: (input) => panel('create', { input }),
    patchVehicle: (id, patch) => panel('patch', { id, patch }),
    deleteVehicle: (id) => panel('delete', { id }),
    addPart: (id, part) => panel('part_add', { id, part }),
    patchPart: (id, pid, patch) => panel('part_patch', { id, pid, patch }),
    removePart: (id, pid) => panel('part_remove', { id, pid }),
    exportVehicle: (id) => panel('export', { id }),
    runRetention: () => panel('retention_run'),
    setRetention: (retentionDays) => panel('retention_set', { retentionDays }),
    setWorkshopSettings: (patch) => panel('workshop_set', { patch }),
    subscribe(onEvent) {
      let channel = null; let client = null; let closed = false;
      (async () => {
        const [{ createClient }, tok] = await Promise.all([import('@supabase/supabase-js'), panel('realtime_token')]);
        if (closed || !tok.ok) { onEvent({ kind: 'down' }); return; }
        client = createClient(URL_BASE, ANON, { auth: { persistSession: false } });
        client.realtime.setAuth(tok.token);
        onEvent({ kind: 'hello', sid: tok.sid });
        // Canal privado de Broadcast: solo llega el aviso «algo cambió»; el detalle se vuelve a pedir a la función.
        channel = client.channel(`workshop:${tok.workshopId}`, { config: { private: true } })
          .on('broadcast', { event: 'change' }, () => onEvent({ kind: 'reset' }))
          .subscribe((status) => onEvent({ kind: status === 'SUBSCRIBED' ? 'up' : 'down' }));
      })().catch(() => onEvent({ kind: 'down' }));
      return () => { closed = true; if (channel && client) client.removeChannel(channel); };
    },
    publicWorkshop: (code) => consulta('workshop', { code }),
    publicLookup: (input) => consulta('lookup', input),
    publicRefresh: (token) => consulta('refresh', { token }),
    publicVerify: (input) => consulta('verify', input),
    contact: async () => ({ ok: false, status: 501, error: 'not_configured' }),
    // Clientes habituales y citas: acciones pendientes de implementar en las Edge Functions (ver docs/deploy-supabase.md).
    customersSummary: () => panel('customers_summary'),
    importCustomers: (rows) => panel('customers_import', { rows }),
    listAppointments: () => panel('appt_list'),
    arriveAppointment: (id) => panel('appt_arrive', { id }),
    cancelAppointment: (id) => panel('appt_cancel', { id }),
    publicCustomerCheck: (input) => consulta('customer_check', input),
    publicBook: (input) => consulta('book', input),
  };
}
