// Estado de la app del mecánico: lista del taller, cola sin conexión y el «deshacer» de 10 segundos.
// Todo toque se guarda primero en el dispositivo (cola) y se envía en cuanto hay red; el servidor ignora repeticiones (opId).
import { useSyncExternalStore } from 'react';
import { NetworkError, errText, get, post, uuid } from './api.js';
import { STATE_LABEL, etaDate } from '../../shared/rules.js';

const QKEY = 'tt_queue_v1';
const load = () => { try { const q = JSON.parse(localStorage.getItem(QKEY) || '[]'); return Array.isArray(q) ? q : []; } catch { return []; } };
const persist = (queue) => {
  try { localStorage.setItem(QKEY, JSON.stringify(queue)); } catch {
    // Sin sitio (una foto grande): se guarda sin las fotos antes que perder los toques.
    try { localStorage.setItem(QKEY, JSON.stringify(queue.map((q) => (q.photo ? { ...q, photo: undefined } : q)))); } catch { /* sin almacenamiento */ }
  }
};

let state = { status: 'boot', role: null, workshop: null, undoSeconds: 10, server: [], queue: load(), online: true, undo: null, toast: null, loaded: false };
const subs = new Set();
const set = (patch) => { state = { ...state, ...patch }; subs.forEach((f) => f()); };
const subscribe = (f) => { subs.add(f); return () => subs.delete(f); };
export const useStore = () => useSyncExternalStore(subscribe, () => state);
export const getState = () => state;

// Lo que ve el mecánico: lo último del servidor con los toques pendientes encima.
export function applyQueue(list, queue) {
  let out = list.map((v) => ({ ...v }));
  for (const q of queue) {
    if (q.type === 'create') {
      if (!out.some((v) => v.id === q.visitId)) out.unshift({ id: q.visitId, plate: q.plate, email: q.known ? '' : q.email || '', make: q.make || null, model: q.model || null, state: 'received', eta: etaDate(q.eta), receivedAt: q.at, mail: null, pending: true, photo: !!q.photo });
    } else if (q.type === 'state') out = out.map((v) => (v.id === q.visitId ? { ...v, state: q.state, pending: true } : v));
    else if (q.type === 'eta') out = out.map((v) => (v.id === q.visitId ? { ...v, eta: etaDate(q.eta), pending: true } : v));
  }
  return out;
}

let flushing = false;
let pollTimer = null;
const toast = (kind, text, ms = 6000) => { const id = uuid(); set({ toast: { id, kind, text } }); setTimeout(() => { if (state.toast?.id === id) set({ toast: null }); }, ms); };
export const clearToast = () => set({ toast: null });

export async function refresh() {
  try {
    const r = await get('/visits');
    if (r.status === 401) { set({ status: 'login', role: null }); return; }
    if (r.ok) set({ server: r.visits, online: true, loaded: true });
  } catch (e) { if (e instanceof NetworkError) set({ online: false }); }
}

export async function flush() {
  if (flushing) return;
  flushing = true;
  try {
    while (state.queue.length) {
      const q = state.queue[0];
      let r;
      try {
        if (q.type === 'create') r = await post('/visits', { id: q.visitId, opId: q.opId, plate: q.plate, email: q.email, make: q.make, model: q.model, eta: q.eta, photo: q.photo });
        else if (q.type === 'state') r = await post(`/visits/${q.visitId}/state`, { state: q.state, opId: q.opId });
        else r = await post(`/visits/${q.visitId}/eta`, { eta: q.eta });
      } catch (e) { if (e instanceof NetworkError) { set({ online: false }); return; } throw e; }
      if (r.status === 401) { set({ status: 'login', role: null }); return; }
      const rest = state.queue.slice(1); persist(rest); set({ queue: rest, online: true });
      if (!r.ok) {
        // Un error de reglas (coche ya en el taller, paso imposible…) no se reintenta: se avisa y se descarta.
        toast('error', `${q.label || 'Un cambio'}: ${errText(r.errors ? Object.values(r.errors)[0] : r.error)}`);
        if (state.undo?.opId === q.opId) set({ undo: null });
      }
    }
  } finally { flushing = false; }
  await refresh();
}

function enqueue(item) {
  const queue = [...state.queue, { opId: uuid(), at: new Date().toISOString(), ...item }];
  persist(queue); set({ queue });
  flush();
  return queue[queue.length - 1];
}

const armUndo = (op, label, plate) => set({ undo: { opId: op.opId, visitId: op.visitId, label, plate, until: Date.now() + state.undoSeconds * 1000, kind: 'ok' } });

export function createVisit(input) {
  const visitId = uuid();
  const op = enqueue({ type: 'create', visitId, ...input, label: 'Alta del coche' });
  armUndo(op, 'Coche dado de alta y avisado', input.plate);
}
export function tap(visit, to) {
  const op = enqueue({ type: 'state', visitId: visit.id, state: to, label: STATE_LABEL[to] });
  armUndo(op, `Marcado «${STATE_LABEL[to]}»`, visit.plate);
}
export function setEta(visit, eta) { enqueue({ type: 'eta', visitId: visit.id, eta }); }

// Deshacer: si el toque aún no salió del dispositivo se quita de la cola; si ya salió, el servidor cancela el correo pendiente.
export async function undoLast() {
  const u = state.undo;
  if (!u) return;
  const inQueue = state.queue.some((q) => q.opId === u.opId);
  if (inQueue) {
    const undone = state.queue.find((q) => q.opId === u.opId);
    // Deshacer un alta que aún no salió quita también los toques posteriores sobre ese coche.
    const queue = state.queue.filter((q) => q.opId !== u.opId && !(undone.type === 'create' && q.visitId === u.visitId));
    persist(queue); set({ queue, undo: null });
    return;
  }
  try {
    const r = await post(`/visits/${u.visitId}/undo`, {});
    if (r.ok) { set({ undo: null }); await refresh(); toast('ok', 'Deshecho. No se ha enviado ningún correo.', 3500); } else { set({ undo: { ...u, kind: 'error', label: errText(r.error), until: Date.now() + 5000 } }); }
  } catch (e) { toast('error', e instanceof NetworkError ? 'Sin conexión: no se pudo deshacer.' : 'No se pudo deshacer.'); }
}
export const dismissUndo = () => set({ undo: null });

// ---------- Sesión ----------
export async function boot() {
  try {
    const r = await get('/session');
    if (r.ok && r.role && r.role !== 'admin') {
      set({ status: 'ready', role: r.role, workshop: r.workshop, undoSeconds: r.undoSeconds || 10 });
      await flush(); await refresh();
      if (!pollTimer) {
        pollTimer = setInterval(() => { if (state.status === 'ready') { state.queue.length ? flush() : refresh(); } }, 10_000);
        window.addEventListener('online', () => { set({ online: true }); flush(); });
        window.addEventListener('offline', () => set({ online: false }));
        document.addEventListener('visibilitychange', () => { if (!document.hidden && state.status === 'ready') refresh(); });
      }
    } else set({ status: 'login' });
  } catch (e) { set({ status: e instanceof NetworkError && state.role ? 'ready' : 'login', online: false }); }
}
export async function login(key) {
  const r = await post('/login', { key });
  if (r.ok && r.role) { await boot(); }
  return r;
}
export async function logout() {
  try { await post('/logout', {}); } catch { /* sin red: la cookie caduca sola */ }
  set({ status: 'login', role: null, workshop: null, server: [], undo: null });
}
