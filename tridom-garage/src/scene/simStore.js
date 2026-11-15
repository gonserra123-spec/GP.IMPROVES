// Mini-almacén local para el modo «Simulación»: mismos estados y reglas de plaza que el servidor,
// con coches de demostración. No sale del navegador y no toca ningún dato del taller.
import catalog from '../../shared/models.json';
import { pickSlot, preferredLocations } from '../../shared/domain.js';

const PLATES = ['1234BCD', '5678FGH', '9012JKL', '3456MNP', '7890RST', '2468VWX', '1357YZB', '8024CDF', '4680GHJ', '6802KLM', '3579NPR', '9753STV'];
const MODELS = ['seat-leon', 'renault-clio', 'toyota-rav4', 'volkswagen-golf', 'ford-transit-custom', 'peugeot-3008', 'fiat-500', 'skoda-octavia-combi', 'toyota-hilux', 'bmw-serie-4-coupe', 'dacia-duster', 'volkswagen-touran'];
const JOURNEYS = [
  [['diagnosis', 7], ['awaiting_approval', 6], ['in_repair', 11], ['ready', 8], ['delivered', 0]],
  [['diagnosis', 6], ['in_repair', 8], ['awaiting_part', 7], ['in_repair', 9], ['ready', 8], ['delivered', 0]],
  [['in_repair', 12], ['ready', 7], ['delivered', 0]],
];

export function createSim(template) {
  let vehicles = [];
  let n = 0;
  const subs = new Set();
  const emit = () => { const list = vehicles.map((v) => ({ ...v })); for (const fn of subs) fn(list); };
  const taken = (except) => new Set(vehicles.filter((v) => v.id !== except && v.location).map((v) => `${v.location}:${v.slot}`));

  const sim = {
    get vehicles() { return vehicles; },
    subscribe(fn) { subs.add(fn); fn(vehicles.map((v) => ({ ...v }))); return () => subs.delete(fn); },
    add(state = 'received') {
      const i = n; n += 1;
      const m = catalog.find((c) => c.id === MODELS[i % MODELS.length]);
      const place = pickSlot(taken(), template, preferredLocations('received', template, null));
      if (!place) { n -= 1; return null; }
      const v = {
        id: `sim-${i}`, plate: PLATES[i % PLATES.length], make: m.make, model: m.model, bodyType: m.body, dims: { l: m.l, w: m.w, h: m.h },
        state: 'received', ...place, parts: [], journey: JOURNEYS[i % JOURNEYS.length], step: 0, wait: 5 + (i % 3),
      };
      vehicles.push(v);
      if (state !== 'received') sim.setState(v.id, state); else emit();
      return v;
    },
    // Devuelve false si no hay plaza libre para ese estado (el coche se queda como está).
    setState(id, state) {
      const v = vehicles.find((x) => x.id === id);
      if (!v) return false;
      if (state === 'delivered') { v.state = state; v.location = null; v.slot = null; }
      else {
        const prefs = preferredLocations(state, template, v.location);
        if (!prefs.includes(v.location)) {
          const place = pickSlot(taken(id), template, [...prefs, 'parking', 'waiting', 'reception']);
          if (!place) return false;
          Object.assign(v, place);
        }
        v.state = state;
      }
      emit();
      return true;
    },
    remove(id) { vehicles = vehicles.filter((v) => v.id !== id); emit(); },
    clear() { vehicles = []; n = 0; sim.respawn = undefined; emit(); },
    seed() {
      sim.clear();
      for (const s of ['in_repair', 'awaiting_part', 'diagnosis', 'ready', 'received', 'awaiting_approval']) sim.add(s);
      vehicles.forEach((v, i) => { v.step = v.journey.findIndex(([s]) => s === v.state) + 1; v.wait = 4 + i * 2.5; });
    },
    // Jornada automática: cada coche avanza por su recorrido cuando la escena ha terminado de moverlo.
    tick(dt, engine) {
      for (const v of [...vehicles]) {
        if (v.state === 'delivered') { if (!engine.cars.has(v.id)) { sim.remove(v.id); sim.respawn = 5; } continue; }
        if (!engine.carSettled(v.id)) continue;
        v.wait -= dt;
        if (v.wait > 0) continue;
        const next = v.journey[v.step];
        if (!next) { v.step = 0; v.wait = 5; continue; }
        if (sim.setState(v.id, next[0])) { v.step += 1; v.wait = next[1]; } else v.wait = 2.5;
      }
      if (sim.respawn !== undefined) {
        sim.respawn -= dt;
        if (sim.respawn <= 0) { sim.respawn = vehicles.length < 7 && sim.add() ? undefined : 4; }
      }
    },
  };
  return sim;
}
