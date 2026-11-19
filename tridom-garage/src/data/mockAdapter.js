import { NetworkError } from './adapter.js';

async function call(method, path, body) {
  let res;
  try {
    res = await fetch(`/api${path}`, {
      method, credentials: 'same-origin', cache: 'no-store',
      headers: { 'X-Requested-With': 'tridom-garage', ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw new NetworkError('offline'); }
  // Un 5xx sin JSON (proxy caído, túnel cortado) se trata como falta de conexión para no perder cambios.
  const data = await res.json().catch(() => null);
  if (!data && res.status >= 500) throw new NetworkError('server');
  return { status: res.status, ...(data || { ok: res.ok }) };
}

export function createMockAdapter() {
  return {
    kind: 'mock',
    config: () => call('GET', '/config'),
    login: (input) => call('POST', '/panel/login', input),
    logout: () => call('POST', '/panel/logout', {}),
    session: () => call('GET', '/panel/session'),
    listVehicles: () => call('GET', '/panel/vehicles'),
    createVehicle: (input) => call('POST', '/panel/vehicles', input),
    patchVehicle: (id, patch) => call('PATCH', `/panel/vehicles/${id}`, patch),
    deleteVehicle: (id) => call('DELETE', `/panel/vehicles/${id}`),
    addPart: (id, part) => call('POST', `/panel/vehicles/${id}/parts`, part),
    patchPart: (id, pid, patch) => call('PATCH', `/panel/vehicles/${id}/parts/${pid}`, patch),
    removePart: (id, pid) => call('DELETE', `/panel/vehicles/${id}/parts/${pid}`),
    exportVehicle: (id) => call('GET', `/panel/vehicles/${id}/export`),
    runRetention: () => call('POST', '/panel/retention/run', {}),
    setRetention: (retentionDays) => call('PATCH', '/panel/workshop', { retentionDays }),
    setWorkshopSettings: (patch) => call('PATCH', '/panel/workshop', patch),
    subscribe(onEvent) {
      const es = new EventSource('/api/panel/events');
      es.addEventListener('hello', (e) => onEvent({ kind: 'hello', ...JSON.parse(e.data) }));
      es.addEventListener('change', (e) => onEvent(JSON.parse(e.data)));
      es.onerror = () => onEvent({ kind: 'down' });
      es.onopen = () => onEvent({ kind: 'up' });
      return () => es.close();
    },
    publicWorkshop: (code) => call('GET', `/public/workshop/${encodeURIComponent(code)}`),
    publicLookup: (input) => call('POST', '/public/lookup', input),
    publicRefresh: (token) => call('POST', '/public/refresh', { token }),
    publicVerify: (input) => call('POST', '/public/verify', input),
    contact: (input) => call('POST', '/contact', input),
    // Clientes habituales y citas
    customersSummary: () => call('GET', '/panel/customers/summary'),
    importCustomers: (rows) => call('POST', '/panel/customers/import', { rows }),
    listAppointments: () => call('GET', '/panel/appointments'),
    arriveAppointment: (id) => call('POST', `/panel/appointments/${id}/arrive`, {}),
    cancelAppointment: (id) => call('POST', `/panel/appointments/${id}/cancel`, {}),
    publicCustomerCheck: (input) => call('POST', '/public/customer-check', input),
    publicBook: (input) => call('POST', '/public/book', input),
  };
}
