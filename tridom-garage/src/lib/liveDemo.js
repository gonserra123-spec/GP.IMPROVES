// Jornada de demostración para la landing y la pantalla de sala de espera.
// Todo ficticio y local: matrículas de ejemplo, sin red y sin tocar datos de ningún taller.
import { useCallback, useEffect, useRef, useState } from 'react';
import { reducedMotion } from './ticker.js';

const PLATES = ['1234BCD', '5678FGH', '9012JKL', '3456MNP', '7890RST', '2468VWX', '1357YZB', '8024CDF', '4680GHJ', '6802KLM', '3579NPR', '9753STV'];
const MODELS = ['Seat León', 'Renault Clio', 'Toyota RAV4', 'Volkswagen Golf', 'Ford Transit Custom', 'Peugeot 3008', 'Fiat 500', 'Škoda Octavia Combi', 'Toyota Hilux', 'Dacia Duster', 'Opel Corsa', 'Kia Sportage'];
const KINDS = ['A', 'B', 'C'];

// Estado inicial: una foto variada del taller en plena jornada.
const SEED = [
  ['in_repair', 'A'], ['awaiting_part', 'B'], ['ready', 'C'], ['diagnosis', 'A'], ['awaiting_approval', 'A'], ['received', 'B'],
];

function nextState(c) {
  switch (c.state) {
    case 'received': return 'diagnosis';
    case 'diagnosis': return c.kind === 'A' ? 'awaiting_approval' : 'in_repair';
    case 'awaiting_approval': return 'in_repair';
    case 'in_repair': return c.kind === 'B' && !c.partDone ? 'awaiting_part' : 'ready';
    case 'awaiting_part': return 'in_repair';
    case 'ready': return 'delivered';
    default: return null;
  }
}

// Ubicación coherente con el estado (mismos nombres que `locations.*` en los diccionarios).
export function locationOf(c, i) {
  switch (c.state) {
    case 'received': return 'reception';
    case 'diagnosis': return 'diagnosis_bay';
    case 'awaiting_approval':
    case 'awaiting_part': return 'waiting';
    case 'in_repair': return i % 2 ? 'lift2' : 'lift1';
    case 'ready': return 'pickup';
    default: return 'none';
  }
}

const clock = () => new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });

export function useLiveCars({ auto = !reducedMotion, every = 3200 } = {}) {
  const counter = useRef(SEED.length);
  const [cars, setCars] = useState(() => SEED.map(([state, kind], i) => ({ id: `s${i}`, plate: PLATES[i], model: MODELS[i], state, kind, partDone: state === 'in_repair' && kind === 'B' })));
  const [log, setLog] = useState([]);
  const [selectedId, setSelectedId] = useState('s0');
  const [playing, setPlaying] = useState(auto);
  const pausedUntil = useRef(0);
  const cursor = useRef(0);
  const tick = useRef(0);

  const push = useCallback((c, state) => {
    tick.current += 1;
    setLog((l) => [{ key: tick.current, plate: c.plate, model: c.model, state, time: clock() }, ...l].slice(0, 6));
  }, []);

  const carsRef = useRef(cars);
  const commit = useCallback((next, changedCar, state) => { carsRef.current = next; setCars(next); push(changedCar, state); }, [push]);

  const advance = useCallback(() => {
    const list = carsRef.current;
    const i = cursor.current % list.length; cursor.current += 1;
    const c = list[i];
    let out; let state;
    if (c.state === 'delivered') {
      // Se va el coche entregado y entra uno nuevo en su sitio.
      const n = counter.current; counter.current += 1;
      state = 'received';
      out = { id: c.id, plate: PLATES[n % PLATES.length], model: MODELS[n % MODELS.length], state, kind: KINDS[n % 3], partDone: false };
    } else {
      state = nextState(c);
      out = { ...c, state, partDone: c.partDone || c.state === 'awaiting_part' };
    }
    commit(list.map((x, k) => (k === i ? out : x)), out, state);
  }, [commit]);

  useEffect(() => {
    if (!playing) return undefined;
    const id = setInterval(() => { if (Date.now() >= pausedUntil.current) advance(); }, every);
    return () => clearInterval(id);
  }, [playing, every, advance]);

  // Cambio manual: toca un coche y elige el estado. La jornada automática se calla unos segundos.
  const setState = useCallback((id, state) => {
    pausedUntil.current = Date.now() + 9000;
    const list = carsRef.current;
    const c = list.find((x) => x.id === id);
    if (!c || c.state === state) return;
    const out = { ...c, state, partDone: c.partDone || state === 'awaiting_part' };
    commit(list.map((x) => (x.id === id ? out : x)), out, state);
  }, [commit]);

  const select = useCallback((id) => { pausedUntil.current = Date.now() + 9000; setSelectedId(id); }, []);
  return { cars, log, selectedId, select, setState, playing, setPlaying };
}
