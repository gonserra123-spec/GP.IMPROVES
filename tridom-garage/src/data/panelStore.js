// Estado del panel: lista de coches, sesión, tiempo real y cola de cambios sin conexión.
// Cada cambio se aplica primero en local (la escena se anima al instante). Si no hay red, se guarda
// en una cola en localStorage y se reenvía en orden al volver; el servidor ignora los repetidos (opId).
import { create } from 'zustand';
import { getAdapter, NetworkError } from './adapter.js';
import { capacities, locationsFor, pickSlot, preferredLocations } from '../../shared/domain.js';

const QUEUE_KEY = 'tg_queue_v1';
const SNAP_KEY = 'tg_snapshot_v1';
const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const save = (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch { /* sin almacenamiento */ } };
const uuid = () => crypto.randomUUID();

let unsubscribe = null;
let flushing = false;
let retryTimer = null;

// Misma regla de plazas que el servidor, para que el cambio se vea ya en la escena.
function applyLocal(vehicles, workshop, op, operator) {
  const tpl = workshop.template;
  const taken = (except) => new Set(vehicles.filter((v) => v.id !== except && v.location).map((v) => `${v.location}:${v.slot}`));
  const now = new Date().toISOString();
  const edit = (id, fn) => vehicles.map((v) => (v.id === id ? fn({ ...v, parts: [...v.parts], history: [...v.history] }) : v));
  switch (op.type) {
    case 'create': {
      const place = pickSlot(taken(), tpl, preferredLocations('received', tpl, null));
      if (!place) return null;
      return [...vehicles, { ...op.local, ...place, state: 'received', notes: '', tags: [], publicCode: null, costEstimate: null, costFinal: null, enteredAt: now, etaAt: null, deliveredAt: null, parts: [], history: [{ at: now, by: operator, type: 'created', to: 'received' }], rev: 0, updatedAt: now, pending: true }];
    }
    case 'patch': return edit(op.id, (v) => {
      const p = op.patch;
      if (p.state !== undefined && p.state !== v.state) {
        v.history.push({ at: now, by: operator, type: 'state', from: v.state, to: p.state });
        if (p.state === 'delivered') { v.location = null; v.slot = null; v.deliveredAt = now; }
        else if (p.location === undefined) {
          const prefs = preferredLocations(p.state, tpl, v.location);
          if (!prefs.includes(v.location)) { const place = pickSlot(taken(v.id), tpl, [...prefs, 'parking', 'waiting', 'reception']); if (place) Object.assign(v, place); }
          v.deliveredAt = null;
        }
        v.state = p.state;
      }
      if (p.location !== undefined && p.location !== v.location && v.state !== 'delivered') {
        const place = pickSlot(taken(v.id), tpl, [p.location]);
        if (place) { v.history.push({ at: now, by: operator, type: 'location', from: v.location, to: p.location }); Object.assign(v, place); }
      }
      for (const k of ['notes', 'costEstimate', 'costFinal', 'etaAt']) if (p[k] !== undefined) v[k] = p[k] === '' ? null : p[k];
      if (p.notes !== undefined) v.notes = p.notes;
      if (p.tags !== undefined) v.tags = p.tags;
      v.updatedAt = now; v.pending = true;
      return v;
    });
    case 'part_add': return edit(op.id, (v) => { v.parts.push({ id: op.part.id, description: op.part.description, state: 'needed', etaAt: op.part.etaAt || null }); v.pending = true; return v; });
    case 'part_patch': return edit(op.id, (v) => { v.parts = v.parts.map((x) => (x.id === op.pid ? { ...x, ...op.patch } : x)); v.pending = true; return v; });
    case 'part_remove': return edit(op.id, (v) => { v.parts = v.parts.filter((x) => x.id !== op.pid); v.pending = true; return v; });
    case 'delete': return vehicles.filter((v) => v.id !== op.id);
    default: return vehicles;
  }
}

async function send(api, op) {
  switch (op.type) {
    case 'create': return api.createVehicle({ ...op.input, opId: op.opId });
    case 'patch': return api.patchVehicle(op.id, { ...op.patch, baseRev: op.baseRev, opId: op.opId });
    case 'part_add': return api.addPart(op.id, { ...op.part, opId: op.opId });
    case 'part_patch': return api.patchPart(op.id, op.pid, { ...op.patch, opId: op.opId });
    case 'part_remove': return api.removePart(op.id, op.pid);
    case 'delete': return api.deleteVehicle(op.id);
    default: return { ok: true };
  }
}

export const usePanel = create((set, get) => ({
  status: 'boot', // boot | login | ready
  config: null, workshop: null, operator: null, sid: null,
  vehicles: [], queue: load(QUEUE_KEY, []), online: true, live: false, toasts: [], apptTick: 0,

  toast(kind, text, vars) {
    const id = uuid();
    set((s) => ({ toasts: [...s.toasts.slice(-3), { id, kind, text, vars }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 6000);
  },
  dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),

  async boot() {
    const api = await getAdapter();
    try {
      const [config, session] = await Promise.all([api.config(), api.session()]);
      set({ config, online: true });
      if (session.ok) await get().enter(session);
      else set({ status: 'login' });
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e;
      // Sin red al abrir: si este dispositivo ya tenía sesión, se trabaja con la última copia.
      const snap = load(SNAP_KEY, null);
      if (snap) { set({ status: 'ready', online: false, workshop: snap.workshop, operator: snap.operator, vehicles: snap.vehicles }); get().scheduleRetry(); }
      else set({ status: 'login', online: false });
    }
  },

  async enter(session) {
    set({ workshop: session.workshop, operator: session.operator, sid: session.sid || null, status: 'ready' });
    await get().flush();
    await get().reload();
    const api = await getAdapter();
    unsubscribe?.();
    unsubscribe = api.subscribe((e) => get().onEvent(e));
  },

  async login(input) {
    const api = await getAdapter();
    const r = await api.login(input);
    if (r.ok) { const s = await api.session(); await get().enter(s.ok ? s : r); }
    return r;
  },

  async logout() {
    const api = await getAdapter();
    unsubscribe?.(); unsubscribe = null;
    try { await api.logout(); } catch { /* sin red: la cookie caduca sola */ }
    save(SNAP_KEY, null); save(QUEUE_KEY, null);
    set({ status: 'login', workshop: null, operator: null, vehicles: [], queue: [], live: false });
  },

  persist() { const s = get(); if (s.workshop) save(SNAP_KEY, { workshop: s.workshop, operator: s.operator, vehicles: s.vehicles }); save(QUEUE_KEY, s.queue.length ? s.queue : null); },

  async reload() {
    const api = await getAdapter();
    try {
      const r = await api.listVehicles();
      if (r.status === 401) { set({ status: 'login' }); return; }
      if (r.ok) {
        // Si quedan cambios en cola, se vuelven a aplicar encima de lo que diga el servidor.
        let vehicles = r.vehicles;
        for (const op of get().queue) vehicles = applyLocal(vehicles, get().workshop, op, get().operator) || vehicles;
        set({ vehicles, online: true }); get().persist();
      }
    } catch (e) { if (e instanceof NetworkError) { set({ online: false }); get().scheduleRetry(); } else throw e; }
  },

  onEvent(e) {
    if (e.kind === 'hello') { set({ sid: e.sid, live: true }); return; }
    if (e.kind === 'up') { set({ live: true }); if (!get().online || get().queue.length) get().flush().then(() => get().reload()); return; }
    if (e.kind === 'down') { set({ live: false }); return; }
    if (e.kind === 'reset') { get().reload(); set((s) => ({ apptTick: s.apptTick + 1 })); return; }
    if (e.kind === 'appointments') { set((s) => ({ apptTick: s.apptTick + 1 })); return; }
    const busy = new Set(get().queue.map((q) => q.id));
    if (e.kind === 'delete') { set((s) => ({ vehicles: s.vehicles.filter((v) => v.id !== e.id) })); get().persist(); return; }
    if (e.kind === 'vehicle') {
      if (busy.has(e.vehicle.id)) return;
      set((s) => ({ vehicles: s.vehicles.some((v) => v.id === e.vehicle.id) ? s.vehicles.map((v) => (v.id === e.vehicle.id ? e.vehicle : v)) : [...s.vehicles, e.vehicle] }));
      if (e.conflict && e.sid !== get().sid) get().toast('warn', 'panel.conflictOther', { plate: e.vehicle.plate });
      get().persist();
    }
  },

  // Aplica un cambio en local y lo envía; devuelve { ok, error?, errors? }.
  async mutate(op) {
    const s = get();
    const full = { ...op, opId: uuid() };
    if (op.type === 'patch') full.baseRev = s.vehicles.find((v) => v.id === op.id)?.rev;
    const next = applyLocal(s.vehicles, s.workshop, full, s.operator);
    if (!next) return { ok: false, error: 'workshop_full' };
    const before = s.vehicles;
    set({ vehicles: next });
    if (s.queue.length || !s.online) return get().enqueue(full);
    const api = await getAdapter();
    try {
      const r = await send(api, full);
      if (r.status === 401) { set({ vehicles: before, status: 'login' }); return r; }
      if (!r.ok) { set({ vehicles: before }); return r; }
      if (r.vehicle) set((st) => ({ vehicles: st.vehicles.map((v) => (v.id === r.vehicle.id ? r.vehicle : v)) }));
      if (r.conflict) get().toast('warn', 'panel.conflictMine', { who: r.conflict.by });
      get().persist();
      return r;
    } catch (e) {
      if (!(e instanceof NetworkError)) { set({ vehicles: before }); throw e; }
      return get().enqueue(full);
    }
  },

  enqueue(op) {
    set((s) => ({ queue: [...s.queue, op], online: false }));
    get().persist(); get().scheduleRetry();
    return { ok: true, queued: true };
  },

  scheduleRetry() {
    if (retryTimer) return;
    retryTimer = setInterval(async () => {
      const s = get();
      if (s.status !== 'ready') return;
      await s.flush();
      if (get().online && !get().queue.length) { clearInterval(retryTimer); retryTimer = null; await get().reload(); if (!unsubscribe) { const api = await getAdapter(); unsubscribe = api.subscribe((e) => get().onEvent(e)); } }
    }, 4000);
  },

  async flush() {
    if (flushing) return;
    flushing = true;
    const api = await getAdapter();
    try {
      let synced = 0;
      while (get().queue.length) {
        const op = get().queue[0];
        const r = await send(api, op);
        if (r.status === 401) { set({ status: 'login' }); return; }
        // «conflict» = otro dispositivo escribió a la vez: se reintenta una vez sin revisión base.
        if (r.status === 409 && r.error === 'conflict' && !op.retried) { set((s) => ({ queue: [{ ...op, retried: true, baseRev: undefined }, ...s.queue.slice(1)] })); continue; }
        if (!r.ok && r.status !== 404) get().toast('error', 'panel.syncFailed');
        set((s) => ({ queue: s.queue.slice(1) })); synced += 1;
        get().persist();
      }
      if (!get().online) { set({ online: true }); if (synced) get().toast('ok', 'panel.synced', { n: String(synced) }); }
    } catch (e) {
      if (!(e instanceof NetworkError)) throw e;
      set({ online: false });
    } finally { flushing = false; }
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => { const s = usePanel.getState(); if (s.status === 'ready') s.flush().then(() => s.reload()); });
  window.addEventListener('offline', () => usePanel.setState({ online: false }));
}

export { capacities, locationsFor };
