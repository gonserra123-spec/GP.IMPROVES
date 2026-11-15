const PROVINCES = new Set(('A AB AL AV B BA BI BU C CA CC CE CO CR CS CU GC GE GI GR GU H HU IB J L LE LO LU M MA ML MU NA O OR OU P PM PO S SA SE SG SH SO SS T TE TF TO V VA VI Z ZA').split(' '));

export const normalizePlate = (raw) => String(raw ?? '').toUpperCase().replace(/[\s\-.·]/g, '');

// 'es_current' (4 cifras + 3 consonantes sin vocales, Ñ ni Q), 'es_old' (provincia + cifras + letras),
// 'generic' (4-10 alfanuméricos, otros países) o null.
export function classifyPlate(plate) {
  if (/^\d{4}[BCDFGHJKLMNPRSTVWXYZ]{3}$/.test(plate)) return 'es_current';
  const old = /^([A-Z]{1,2})(\d{4}[A-Z]{1,2}|\d{1,6})$/.exec(plate);
  if (old && PROVINCES.has(old[1])) return 'es_old';
  if (/^[A-Z0-9]{4,10}$/.test(plate)) return 'generic';
  return null;
}

export function formatPlate(plate) {
  const m = /^(\d{4})([A-Z]{3})$/.exec(plate);
  if (m) return `${m[1]} ${m[2]}`;
  const o = /^([A-Z]{1,2})(\d{4})([A-Z]{1,2})$/.exec(plate);
  return o ? `${o[1]} ${o[2]} ${o[3]}` : plate;
}
