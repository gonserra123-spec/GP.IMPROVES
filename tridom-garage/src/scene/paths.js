// Geometría del suelo: plazas, red de carriles y rutas con esquinas redondeadas.
// Convención: x al este, z al sur. Rumbo θ con el frente del coche en (cos θ, −sin θ).

export const headingOf = (dx, dz) => Math.atan2(-dz, dx);
export const angleDiff = (a, b) => { let d = (a - b) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };

export function buildLayout(tpl) {
  const slots = {};
  const add = (loc, i, x, z, footZ, dz, region) => {
    slots[`${loc}:${i}`] = { key: `${loc}:${i}`, loc, index: i, x, z, foot: { x, z: footZ }, heading: headingOf(0, dz), region };
  };
  for (const [loc, x] of Object.entries(tpl.bays)) {
    if (loc === 'pit' && !tpl.pit) continue;
    const n = /^lift(\d+)$/.exec(loc);
    if (n && Number(n[1]) > tpl.lifts) continue;
    add(loc, 0, x, tpl.bayZ, tpl.aisleZ, -1, 'in');
  }
  for (const [loc, xs] of Object.entries(tpl.south)) xs.forEach((x, i) => add(loc, i, x, tpl.southZ, tpl.aisleZ, 1, 'in'));
  for (const [loc, xs] of Object.entries(tpl.outside)) xs.forEach((x, i) => add(loc, i, x, tpl.outsideZ, tpl.laneZ, 1, 'out'));
  const nodes = {
    I1: { x: tpl.entryX, z: tpl.aisleZ }, I2: { x: tpl.exitX, z: tpl.aisleZ },
    L1: { x: tpl.entryX, z: tpl.laneZ }, L2: { x: tpl.exitX, z: tpl.laneZ },
    S: { x: tpl.spawnX, z: tpl.laneZ }, D: { x: tpl.despawnX, z: tpl.laneZ },
  };
  return { tpl, slots, nodes };
}

const TURN_R = 3;
const dist = (a, b) => Math.hypot(b.x - a.x, b.z - a.z);

// Polilínea con las esquinas sustituidas por arcos. Devuelve muestras densas con longitud acumulada,
// tangente interpolable y curvatura (para frenar en curva y girar las ruedas delanteras).
function filletPath(points, radius = TURN_R) {
  const pts = points.filter((p, i) => i === 0 || dist(p, points[i - 1]) > 1e-4);
  const out = [];
  const push = (x, z, k) => out.push({ x, z, k });
  const STEP = 0.12;
  const line = (a, b) => {
    const n = Math.max(1, Math.ceil(dist(a, b) / STEP));
    for (let i = out.length ? 1 : 0; i <= n; i += 1) push(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, 0);
  };
  let cursor = pts[0];
  for (let i = 1; i < pts.length - 1; i += 1) {
    const p = pts[i]; const prev = pts[i - 1]; const next = pts[i + 1];
    const l1 = dist(prev, p); const l2 = dist(p, next);
    const u1 = { x: (p.x - prev.x) / l1, z: (p.z - prev.z) / l1 };
    const u2 = { x: (next.x - p.x) / l2, z: (next.z - p.z) / l2 };
    const cross = u1.x * u2.z - u1.z * u2.x;
    const turn = Math.acos(Math.max(-1, Math.min(1, u1.x * u2.x + u1.z * u2.z)));
    if (turn < 0.02) continue;
    // Un tramo compartido con otra esquina reparte su longitud a medias.
    const room1 = i - 1 === 0 ? l1 : l1 / 2; const room2 = i + 1 === pts.length - 1 ? l2 : l2 / 2;
    const d = Math.min(radius * Math.tan(turn / 2), room1 * 0.98, room2 * 0.98);
    const r = d / Math.tan(turn / 2);
    const a = { x: p.x - u1.x * d, z: p.z - u1.z * d };
    const side = cross > 0 ? 1 : -1; // centro a la izquierda o a la derecha del avance
    const c = { x: a.x - u1.z * r * side, z: a.z + u1.x * r * side };
    line(cursor, a);
    const a0 = Math.atan2(a.z - c.z, a.x - c.x);
    const n = Math.max(2, Math.ceil((r * turn) / STEP));
    for (let j = 1; j <= n; j += 1) {
      const ang = a0 + side * turn * (j / n);
      push(c.x + Math.cos(ang) * r, c.z + Math.sin(ang) * r, side / r);
    }
    cursor = out[out.length - 1];
  }
  line(cursor, pts[pts.length - 1]);
  let s = 0;
  for (let i = 0; i < out.length; i += 1) {
    if (i) s += dist(out[i - 1], out[i]);
    out[i].s = s;
  }
  for (let i = 0; i < out.length; i += 1) {
    const a = out[Math.max(0, i - 1)]; const b = out[Math.min(out.length - 1, i + 1)];
    out[i].h = headingOf(b.x - a.x, b.z - a.z);
  }
  return { samples: out, length: s };
}

export function samplePath(path, s) {
  const a = path.samples;
  let lo = 0; let hi = a.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid].s <= s) lo = mid; else hi = mid; }
  const p = a[lo]; const q = a[hi];
  const t = q.s > p.s ? Math.min(1, Math.max(0, (s - p.s) / (q.s - p.s))) : 0;
  return { x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t, h: p.h + angleDiff(q.h, p.h) * t, k: p.k + (q.k - p.k) * t };
}

// Velocidad máxima permitida en cada muestra: límite por curva y frenada hasta parar al final.
function speedEnvelope(path, vmax, accel) {
  const a = path.samples; const env = new Float32Array(a.length);
  env[a.length - 1] = 0;
  for (let i = a.length - 2; i >= 0; i -= 1) {
    const curve = a[i].k ? Math.min(vmax, 1.9) : vmax;
    env[i] = Math.min(curve, Math.sqrt(env[i + 1] ** 2 + 2 * accel * (a[i + 1].s - a[i].s)));
  }
  path.env = env;
}

export function envelopeAt(path, s) {
  const a = path.samples;
  let lo = 0; let hi = a.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (a[mid].s <= s) lo = mid; else hi = mid; }
  return Math.min(path.env[lo], path.env[hi]) + 0.12;
}

// Ruta entre dos puntos de la escena. `from` y `to` son plazas, 'spawn' o 'despawn'.
// Devuelve tramos: el primero marcha atrás para salir de la plaza y el resto hacia delante.
export function planRoute(layout, from, to) {
  const { nodes } = layout;
  const A = from === 'spawn' ? { foot: nodes.S, region: 'out' } : from;
  const B = to === 'despawn' ? { foot: nodes.D, region: 'out' } : to;
  let chain;
  if (A.region === B.region) chain = [A.foot, B.foot];
  else if (A.region === 'out') chain = [A.foot, nodes.L1, nodes.I1, B.foot];
  else chain = [A.foot, nodes.I2, nodes.L2, B.foot];
  const legs = [];
  let start = A.foot;
  if (from !== 'spawn') {
    const n = chain[1]; const l = dist(A.foot, n);
    const t = { x: (n.x - A.foot.x) / l, z: (n.z - A.foot.z) / l };
    const back = TURN_R + 0.8;
    const g = { x: A.foot.x - t.x * back, z: A.foot.z - t.z * back };
    const leg = filletPath([{ x: from.x, z: from.z }, A.foot, g]);
    leg.reverse = true;
    speedEnvelope(leg, 1.5, 1.1);
    legs.push(leg);
    start = g;
  }
  const fwd = [start, ...chain.slice(1)];
  if (to !== 'despawn') fwd.push({ x: to.x, z: to.z });
  const leg = filletPath(fwd);
  leg.reverse = false;
  speedEnvelope(leg, 3.4, 1.5);
  legs.push(leg);
  const regions = new Set([A.region, B.region]);
  return { legs, regions: [...regions] };
}
