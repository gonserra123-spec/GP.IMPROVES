// Capa de datos. Toda la app habla con esta interfaz; hay dos implementaciones:
//   - MockAdapter (por defecto, modo demo): API local de server/ con fixtures ficticios.
//   - SupabaseAdapter: Postgres + RLS + Edge Functions + Realtime (ver docs/deploy-supabase.md).
//
// DataAdapter:
//   config()                               -> { demo, demoPin, workshopCode }
//   login({ code, pin, operator, website }) / logout() / session()
//   listVehicles() / createVehicle(input) / patchVehicle(id, patch) / deleteVehicle(id)
//   addPart(id, part) / patchPart(id, partId, patch) / removePart(id, partId)
//   exportVehicle(id) / runRetention() / setRetention(days)
//   subscribe(onEvent)                     -> función para cancelar (tiempo real)
//   publicWorkshop(code) / publicLookup({ code, plate, website }) / publicRefresh(token) / publicVerify({ token, last4 })
//   contact(input)
// Todas devuelven { ok, status, ...datos } y lanzan NetworkError si no hay conexión.
import { createMockAdapter } from './mockAdapter.js';

export class NetworkError extends Error {}

let adapter = null;
export async function getAdapter() {
  if (adapter) return adapter;
  if (import.meta.env.VITE_DATA_ADAPTER === 'supabase') {
    const { createSupabaseAdapter } = await import('./supabaseAdapter.js');
    adapter = createSupabaseAdapter();
  } else adapter = createMockAdapter();
  return adapter;
}
