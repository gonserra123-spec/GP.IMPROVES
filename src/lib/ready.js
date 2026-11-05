// Bandera «ready»: el velo de carga la activa cuando empieza a subir la cortina; los reveals del hero
// esperan a ella. Si no hay velo (movimiento reducido, ?noloader), App la activa al montar.
let ready = false;

export const isReady = () => ready;

export function setReady() {
  if (ready) return;
  ready = true;
  if (typeof document !== 'undefined') document.documentElement.classList.add('is-ready');
}
