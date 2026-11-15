// Motor de la escena: coloca cada coche donde dicen los datos y anima solo lo que cambia después.
// Cada coche es una pequeña máquina de estados (parado / conduciendo) con un único objetivo vigente:
// las órdenes intermedias se comprimen porque al terminar el tramo en curso se replanifica desde donde está.
import * as THREE from 'three';
import { buildLayout, planRoute, samplePath, envelopeAt, angleDiff } from './paths.js';
import { buildWorld, MAT, COLORS, LIFT_TOP, PIT_DEPTH } from './world.js';
import { carParts } from './carGeometry.js';
import { createMechanic } from './mechanic.js';
import { isLift } from '../../shared/domain.js';

const WALK_Z = 9.4;
const OUT_Z = 20.3;
const ANON_ID = (o) => `anon:${o.location}:${o.slot}`;

let shadowTex = null;
function getShadowTexture() {
  if (shadowTex) return shadowTex;
  const c = document.createElement('canvas'); c.width = 128; c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 32, 4, 64, 32, 62);
  g.addColorStop(0, 'rgba(11,42,91,0.28)'); g.addColorStop(0.6, 'rgba(11,42,91,0.12)'); g.addColorStop(1, 'rgba(11,42,91,0)');
  ctx.setTransform(1, 0, 0, 0.5, 0, 16); ctx.fillStyle = g; ctx.fillRect(0, -32, 128, 128);
  shadowTex = new THREE.CanvasTexture(c);
  return shadowTex;
}

const iconCache = new Map();
function iconTexture(type) {
  if (iconCache.has(type)) return iconCache.get(type);
  const c = document.createElement('canvas'); c.width = 128; c.height = 128;
  const x = c.getContext('2d');
  const amber = type !== 'ready';
  x.fillStyle = amber ? COLORS.amber : COLORS.blue500;
  x.beginPath();
  if (amber) x.roundRect(14, 14, 100, 100, 22); else x.arc(64, 64, 50, 0, Math.PI * 2);
  x.fill();
  x.strokeStyle = amber ? COLORS.ink : '#fff'; x.lineWidth = 8; x.lineCap = 'round'; x.lineJoin = 'round';
  x.beginPath();
  if (type === 'ready') { x.moveTo(42, 66); x.lineTo(58, 82); x.lineTo(88, 48); }
  else if (type === 'awaiting_approval') { x.roundRect(42, 38, 44, 56, 6); x.moveTo(54, 36); x.lineTo(74, 36); x.moveTo(52, 58); x.lineTo(76, 58); x.moveTo(52, 74); x.lineTo(68, 74); }
  else { x.moveTo(36, 52); x.lineTo(64, 38); x.lineTo(92, 52); x.lineTo(92, 82); x.lineTo(64, 96); x.lineTo(36, 82); x.closePath(); x.moveTo(36, 52); x.lineTo(64, 66); x.lineTo(92, 52); x.moveTo(64, 66); x.lineTo(64, 96); }
  x.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  iconCache.set(type, t);
  return t;
}

function smoothDamp(cur, target, state, smoothTime, maxSpeed, dt) {
  const omega = 2 / smoothTime; const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const maxChange = maxSpeed * smoothTime;
  const change = Math.max(-maxChange, Math.min(maxChange, cur - target));
  const temp = (state.v + omega * change) * dt;
  state.v = (state.v - omega * temp) * exp;
  let out = cur - change + (change + temp) * exp;
  if ((target - cur > 0) === (out > target)) { out = target; state.v = 0; }
  return out;
}

export function createEngine({ template, name, brandColor, lang = 'es', mode = 'panel', reduced = false }) {
  const layout = buildLayout(template);
  const world = buildWorld(layout, { name, brandColor, lang });
  const root = new THREE.Group();
  root.add(world.root);
  const carLayer = new THREE.Group(); root.add(carLayer);

  const cars = new Map();
  const slotOwner = new Map();
  const busy = { in: null, out: null };
  const lifts = {};
  for (const [key, group] of Object.entries(world.lifts)) lifts[key] = { key, group, h: 0, target: 0, st: { v: 0 }, x: template.bays[key], z: template.bayZ };
  const home = { x: 5.2, y: 0, z: WALK_Z - 0.9, face: -Math.PI / 2 };
  const mech = createMechanic('m1', { x: home.x, z: home.z, heading: home.face });
  root.add(mech.root);
  let job = null; let jobAge = 0;
  let first = true;
  let rec = null;
  const engine = { root, layout, cars, lifts, mech, timeScale: 1, reduced, mode, onChange: null };

  function makeCar(v, anon) {
    const P = carParts(anon ? 'compact' : v.bodyType, anon ? null : v.dims);
    const mats = {
      body: new THREE.MeshBasicMaterial({ color: COLORS.white, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      cabin: new THREE.MeshBasicMaterial({ color: anon ? COLORS.paper : COLORS.blue100, transparent: true, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 }),
      line: new THREE.LineBasicMaterial({ color: anon ? COLORS.mute : COLORS.blue900, transparent: true }),
      shadow: new THREE.MeshBasicMaterial({ map: getShadowTexture(), transparent: true, depthWrite: false }),
    };
    const rootG = new THREE.Group(); const lifted = new THREE.Group(); rootG.add(lifted);
    const bodyMesh = new THREE.Mesh(P.bodyGeo, mats.body); bodyMesh.userData.carId = v.id;
    const cabinMesh = new THREE.Mesh(P.cabinGeo, mats.cabin); cabinMesh.userData.carId = v.id;
    lifted.add(bodyMesh, cabinMesh, new THREE.LineSegments(P.edges, mats.line));
    const wheels = [];
    for (const [ax, front] of [[P.axleF, true], [P.axleR, false]]) {
      for (const side of [-1, 1]) {
        const steer = new THREE.Group(); steer.position.set(ax, P.wr, side * P.track);
        const spin = new THREE.Group(); steer.add(spin);
        spin.add(new THREE.Mesh(P.wheelGeo, mats.body), new THREE.LineSegments(P.wheelLines, mats.line));
        lifted.add(steer); wheels.push({ steer, spin, front });
      }
    }
    const shadow = new THREE.Mesh(new THREE.PlaneGeometry(P.L + 1.1, P.W + 1.0), mats.shadow);
    shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.014; rootG.add(shadow);
    const ring = new THREE.Mesh(new THREE.RingGeometry(P.L * 0.62, P.L * 0.62 + 0.09, 48), new THREE.MeshBasicMaterial({ color: COLORS.blue500, transparent: true, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2; ring.position.y = 0.016; ring.visible = false; rootG.add(ring);
    const icon = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthTest: false, opacity: 0 }));
    icon.position.y = P.H + 0.8; icon.scale.setScalar(0.95); icon.visible = false; icon.renderOrder = 5; lifted.add(icon);
    carLayer.add(rootG);
    return {
      id: v.id, v, anon, P, mats, root: rootG, lifted, wheels, shadow, ring, icon, iconType: null, iconA: 0,
      x: 0, y: 0, z: 0, h: 0, slotKey: null, phase: 'idle', route: null, leg: 0, s: 0, spd: 0, steer: 0, spinA: 0,
      opacity: 0, fill: 1, leaving: false, dying: false, blocked: 0, detour: null, readyAck: false, handT: 0, readyT: 0, hl: false, born: true,
    };
  }

  function disposeCar(car) {
    carLayer.remove(car.root);
    for (const m of Object.values(car.mats)) m.dispose();
    car.ring.material.dispose(); car.ring.geometry.dispose(); car.shadow.geometry.dispose(); car.icon.material.dispose();
    if (slotOwner.get(car.slotKey) === car.id) slotOwner.delete(car.slotKey);
    for (const r of ['in', 'out']) if (busy[r] === car.id) busy[r] = null;
    cars.delete(car.id);
  }

  const dataKey = (v) => (v.location !== null && v.location !== undefined && layout.slots[`${v.location}:${v.slot}`] ? `${v.location}:${v.slot}` : null);
  const wantsUp = (car) => !car.anon && car.v.state === 'in_repair' && isLift(car.v.location);

  function wantOf(car) {
    if (car.leaving) return { key: 'gone', up: false };
    if (car.detour && car.slotKey !== car.detour) return { key: car.detour, up: false };
    const key = dataKey(car.v);
    return { key: key || car.slotKey, up: key === car.slotKey && wantsUp(car) };
  }

  function placeAt(car, key) {
    const s = layout.slots[key];
    car.x = s.x; car.z = s.z; car.h = s.heading; car.slotKey = key; car.phase = 'idle'; car.spd = 0; car.steer = 0;
    slotOwner.set(key, car.id);
    const lift = lifts[s.loc];
    if (lift && wantsUp(car)) { lift.h = LIFT_TOP; lift.target = LIFT_TOP; lift.st.v = 0; }
    car.y = lift ? lift.h : 0;
  }

  // Sincroniza con los datos. La primera vez (o con movimiento reducido) coloca cada coche ya en su sitio.
  engine.setVehicles = (list, others = []) => {
    // En la consulta, el coche consultado aparece ya en su plaza (no se anima su llegada).
    const instant = first || engine.reduced || (mode === 'public' && cars.size === 0);
    const seen = new Set();
    const incoming = [...list.map((v) => ({ v, anon: false })), ...others.map((o) => ({ v: { id: ANON_ID(o), location: o.location, slot: o.slot, state: 'anon' }, anon: true }))];
    for (const { v, anon } of incoming) {
      const here = v.state !== 'delivered' && dataKey(v);
      let car = cars.get(v.id);
      if (!here) {
        if (car && !car.dying) { car.v = v; if (instant || car.anon) car.dying = true; else car.leaving = true; }
        continue;
      }
      seen.add(v.id);
      if (car) { car.v = v; car.dying = false; car.leaving = false; continue; }
      car = makeCar(v, anon); cars.set(v.id, car);
      const key = dataKey(v);
      if ((instant || anon) && !slotOwner.has(key)) {
        placeAt(car, key);
        car.readyAck = true; car.opacity = instant ? 1 : 0;
      } else {
        const S = layout.nodes.S;
        car.x = S.x; car.z = S.z; car.h = 0; car.opacity = 0;
      }
    }
    for (const car of cars.values()) if (!seen.has(car.id) && !car.leaving && !car.dying) car.dying = true;
    if (instant) {
      for (const car of [...cars.values()]) if (car.dying || car.leaving) disposeCar(car);
      // Sin animación: cada coche pasa directamente a la plaza que dicen los datos.
      const moved = [...cars.values()].filter((c) => dataKey(c.v) !== c.slotKey || c.phase === 'drive');
      for (const c of moved) { if (slotOwner.get(c.slotKey) === c.id) slotOwner.delete(c.slotKey); if (c.destKey && slotOwner.get(c.destKey) === c.id) slotOwner.delete(c.destKey); for (const r of ['in', 'out']) if (busy[r] === c.id) busy[r] = null; c.slotKey = null; c.route = null; }
      for (const c of moved) { const key = dataKey(c.v); if (key && !slotOwner.has(key)) { placeAt(c, key); c.opacity = 1; } }
      for (const l of Object.values(lifts)) {
        const occ = [...cars.values()].find((c) => c.slotKey && layout.slots[c.slotKey].loc === l.key);
        l.h = occ && wantsUp(occ) ? LIFT_TOP : 0; l.target = l.h; l.st.v = 0; if (occ) occ.y = l.h;
      }
      for (const c of cars.values()) { c.readyAck = true; c.detour = null; }
      pickJob(0, true);
      for (const car of cars.values()) syncVisual(car, 1, true);
      for (const l of Object.values(lifts)) l.group.position.y = l.h;
    }
    first = false;
    engine.dirty = true;
  };

  function tryDrive(car, want) {
    const dest = want.key === 'gone' ? 'despawn' : layout.slots[want.key];
    if (want.key !== 'gone') {
      const owner = slotOwner.get(want.key);
      if (owner && owner !== car.id) { car.blocked += 1 / 60; breakDeadlock(car, owner); return false; }
      const destLift = lifts[dest.loc];
      if (destLift && destLift.h > 0.004) return false;
    }
    const route = planRoute(layout, car.slotKey ? layout.slots[car.slotKey] : 'spawn', dest);
    if (route.regions.some((r) => busy[r] && busy[r] !== car.id)) return false;
    for (const r of route.regions) busy[r] = car.id;
    if (slotOwner.get(car.slotKey) === car.id) slotOwner.delete(car.slotKey);
    if (want.key !== 'gone') slotOwner.set(want.key, car.id);
    Object.assign(car, { route, leg: 0, s: 0, spd: 0, phase: 'drive', destKey: want.key, slotKey: null, blocked: 0, readyAck: false, handT: 0, readyT: 0 });
    return true;
  }

  // Dos coches esperando cada uno la plaza del otro: uno se aparta a una plaza libre y luego sigue.
  function breakDeadlock(car, ownerId) {
    if (car.detour || car.blocked < 2.5) return;
    const owner = cars.get(ownerId);
    if (owner && owner.phase === 'drive') return;
    if (owner && owner.blocked < 1 && car.blocked < 20) return;
    const wanted = new Set([...cars.values()].map((c) => dataKey(c.v)));
    for (const loc of ['parking', 'waiting', 'reception', 'pickup']) {
      for (const s of Object.values(layout.slots)) {
        if (s.loc === loc && !slotOwner.has(s.key) && !wanted.has(s.key)) { car.detour = s.key; car.blocked = 0; return; }
      }
    }
  }

  function updateCar(car, dt) {
    if (car.phase === 'drive') {
      const leg = car.route.legs[car.leg];
      car.spd = Math.min(envelopeAt(leg, car.s), car.spd + (leg.reverse ? 1.1 : 1.5) * dt);
      car.s += car.spd * dt;
      car.spinA += ((leg.reverse ? -1 : 1) * car.spd * dt) / car.P.wr;
      if (car.s >= leg.length) {
        car.s = leg.length;
        const p = samplePath(leg, car.s);
        car.x = p.x; car.z = p.z; car.h = leg.reverse ? p.h + Math.PI : p.h;
        if (car.leg < car.route.legs.length - 1) { car.leg += 1; car.s = 0; car.spd = 0; }
        else {
          for (const r of car.route.regions) if (busy[r] === car.id) busy[r] = null;
          car.phase = 'idle'; car.spd = 0; car.route = null;
          if (car.destKey === 'gone') { disposeCar(car); return true; }
          const s = layout.slots[car.destKey];
          car.slotKey = car.destKey; car.x = s.x; car.z = s.z; car.h = s.heading;
          if (car.detour === car.slotKey) car.detour = null;
        }
        return true;
      }
      const p = samplePath(leg, car.s);
      car.x = p.x; car.z = p.z; car.h = leg.reverse ? p.h + Math.PI : p.h;
      const st = (leg.reverse ? 1 : -1) * Math.atan(car.P.wheelbase * p.k);
      car.steer += (st - car.steer) * Math.min(1, dt * 5);
      return true;
    }
    let active = false;
    if (Math.abs(car.steer) > 0.002) { car.steer *= Math.max(0, 1 - dt * 4); active = true; }
    const want = wantOf(car);
    const slot = car.slotKey ? layout.slots[car.slotKey] : null;
    const lift = slot ? lifts[slot.loc] : null;
    if (lift) {
      const stay = want.key === car.slotKey;
      if (stay && want.up) {
        // El elevador solo sube con el coche parado en su plaza y el mecánico ya colocado al lado.
        if (lift.target < LIFT_TOP && job && job.type === 'attend' && job.car === car && mech.arrived && mech.goalKey === job.key) lift.target = LIFT_TOP;
      } else if (lift.target > 0 || lift.h > 0.004) {
        const clear = mech.inPit() || Math.hypot(mech.x - lift.x, mech.z - lift.z) > 1.7;
        if (clear) lift.target = 0;
      }
      car.y = lift.h;
      if (lift.h > 0.004) return active || Math.abs(lift.target - lift.h) > 0.001;
    } else car.y = 0;
    if (want.key !== car.slotKey) return tryDrive(car, want) || active;
    car.blocked = 0;
    if (!car.anon && car.v.state === 'ready' && !car.readyAck) {
      car.readyT += dt;
      if (job && job.type === 'handover' && job.car === car && mech.arrived && mech.goalKey === job.key) car.handT += dt;
      if (car.handT > 3.2 || car.readyT > 30) car.readyAck = true;
      active = true;
    }
    return active;
  }

  function jobsList() {
    const out = [];
    for (const car of cars.values()) {
      if (car.anon || car.phase !== 'idle' || !car.slotKey || car.leaving || car.dying) continue;
      const s = layout.slots[car.slotKey]; const lift = lifts[s.loc]; const want = wantOf(car);
      const stay = want.key === car.slotKey; const st = car.v.state;
      const north = s.z < s.foot.z; const dz = north ? -1 : 1;
      const beside = { x: s.x - 2.3, y: 0, z: s.z + 1.2, face: 0 };
      const fender = { x: s.x + car.P.W / 2 + 0.45, y: 0, z: s.z + dz * (car.P.L / 2 - 0.7), face: Math.PI };
      const door = { x: s.x - car.P.W / 2 - 0.5, y: 0, z: s.z, face: 0 };
      const add = (type, pri, pos, pose) => out.push({ key: `${type}:${car.id}`, type, pri, car, pos, pose });
      if (lift) {
        if (stay && want.up && lift.h < LIFT_TOP - 0.01) add('attend', 1, beside, 'wait');
        else if (!(stay && want.up) && lift.h > 0.004) add('clear', 1, beside, 'wait');
        else if (stay && want.up) add('work_lift', 2, { x: s.x, y: 0, z: s.z + 0.3, face: s.heading }, 'work_up');
        else if (st === 'in_repair') add('work_hood', 2, fender, 'work_hood');
      } else if (st === 'in_repair' && stay) {
        if (s.loc === 'pit' && world.pit) add('work_pit', 2, { x: world.pit.x, y: -PIT_DEPTH, z: s.z, face: s.heading }, 'work_up');
        else add('work_hood', 2, fender, 'work_hood');
      }
      if (st === 'diagnosis' && stay && !(lift && lift.h > 0.004)) add('inspect', 3, fender, 'inspect');
      if (st === 'ready' && stay && !car.readyAck) add('handover', 3, door, 'handover');
    }
    return out.sort((a, b) => a.pri - b.pri || a.key.localeCompare(b.key));
  }

  const zoneOf = (p) => ((p.y || 0) < -0.05 ? 'pit' : (p.z > template.building.d ? 'out' : 'in'));
  function walkPoints(target) {
    const pts = []; const pit = world.pit;
    let cur = { x: mech.x, y: mech.y, z: mech.z };
    if (zoneOf(cur) === 'pit') {
      if (zoneOf(target) === 'pit') return [target];
      pts.push({ ...pit.bottom }, { ...pit.top }); cur = pit.top;
    }
    let tail = [target]; let anchor = target;
    if (zoneOf(target) === 'pit') { tail = [{ ...pit.top }, { ...pit.bottom }, target]; anchor = pit.top; }
    const doorX = template.exitX - 1.3;
    const a = zoneOf(cur); const b = zoneOf(anchor);
    const near = Math.hypot(cur.x - anchor.x, cur.z - anchor.z) < 2.6;
    if (a === 'in' && b === 'in') { if (!near) pts.push({ x: cur.x, y: 0, z: WALK_Z }, { x: anchor.x, y: 0, z: WALK_Z }); }
    else if (a === 'out' && b === 'out') { if (!near) pts.push({ x: cur.x, y: 0, z: OUT_Z }, { x: anchor.x, y: 0, z: OUT_Z }); }
    else if (a === 'in') pts.push({ x: cur.x, y: 0, z: WALK_Z }, { x: doorX, y: 0, z: WALK_Z }, { x: doorX, y: 0, z: OUT_Z }, { x: anchor.x, y: 0, z: OUT_Z });
    else pts.push({ x: cur.x, y: 0, z: OUT_Z }, { x: doorX, y: 0, z: OUT_Z }, { x: doorX, y: 0, z: WALK_Z }, { x: anchor.x, y: 0, z: WALK_Z });
    return [...pts, ...tail];
  }

  function pickJob(dt, instant = false) {
    const list = jobsList();
    jobAge += dt;
    let next = list[0] || null;
    if (job && next) {
      const same = list.find((j) => j.key === job.key);
      if (same && same.pri === next.pri) {
        const peers = list.filter((j) => j.pri === same.pri);
        next = jobAge > 10 && peers.length > 1 ? peers[(peers.indexOf(same) + 1) % peers.length] : same;
      }
    }
    const key = next ? next.key : 'home';
    if (next) job = next; else job = null;
    const target = next ? next.pos : home;
    const pose = next ? next.pose : 'idle';
    if (instant) { mech.place(target, pose, target.face, key); jobAge = 0; return; }
    if (mech.goalKey !== key) { jobAge = 0; mech.walkTo(walkPoints(target), pose, target.face, key); }
  }

  function syncVisual(car, dt, force = false) {
    const k = force ? 1 : Math.min(1, dt * 4);
    let active = false;
    const S = layout.nodes.S; const D = layout.nodes.D;
    let op = car.dying ? 0 : 1;
    if (car.phase === 'drive') op = Math.min(1, Math.max(0, (car.x - S.x) / 6), Math.max(0, (D.x - car.x) / 6));
    if (Math.abs(op - car.opacity) > 0.004) { car.opacity += (op - car.opacity) * (car.phase === 'drive' ? 1 : k); active = true; } else car.opacity = op;
    const overPit = car.slotKey && layout.slots[car.slotKey].loc === 'pit' && mech.inPit();
    const fill = overPit ? 0.28 : 1;
    if (Math.abs(fill - car.fill) > 0.004) { car.fill += (fill - car.fill) * k; active = true; } else car.fill = fill;
    car.mats.body.opacity = car.opacity * car.fill; car.mats.cabin.opacity = car.opacity * car.fill; car.mats.line.opacity = car.opacity;
    car.mats.shadow.opacity = car.opacity * Math.max(0.35, 1 - car.y * 0.3);
    car.root.visible = car.opacity > 0.01;
    car.root.position.set(car.x, 0, car.z); car.root.rotation.y = car.h; car.lifted.position.y = car.y;
    for (const w of car.wheels) { w.spin.rotation.z = -car.spinA; if (w.front) w.steer.rotation.y = car.steer; }
    const type = car.anon || car.phase !== 'idle' ? null : (car.v.state === 'awaiting_approval' || car.v.state === 'awaiting_part' ? car.v.state : (car.v.state === 'ready' && car.readyAck ? 'ready' : null));
    if (type && type !== car.iconType) { car.iconType = type; car.icon.material.map = iconTexture(type); car.icon.material.needsUpdate = true; }
    const ia = type ? 1 : 0;
    if (Math.abs(ia - car.iconA) > 0.004) { car.iconA += (ia - car.iconA) * (force ? 1 : Math.min(1, dt * 6)); active = true; } else car.iconA = ia;
    car.icon.visible = car.iconA > 0.01; car.icon.material.opacity = car.iconA * car.opacity;
    car.icon.scale.setScalar(0.95 * (0.8 + 0.2 * car.iconA));
    car.ring.visible = car.hl;
    car.mats.line.color.set(car.hl ? COLORS.blue500 : (car.anon ? COLORS.mute : COLORS.blue900));
    car.mats.cabin.color.set(car.hl ? '#BFD4FB' : (car.anon ? COLORS.paper : COLORS.blue100));
    if (car.hl) {
      car.ring.material.opacity = engine.reduced ? 0.7 : 0.45 + 0.3 * Math.sin(clock * 2.4);
      if (!engine.reduced) active = true;
    }
    if (car.dying && car.opacity <= 0.01) { disposeCar(car); return true; }
    return active;
  }

  let clock = 0;
  engine.update = (dtRaw) => {
    const dt = Math.min(0.05, dtRaw) * engine.timeScale;
    if (dt <= 0) return false;
    clock += dt;
    let active = !!engine.dirty; engine.dirty = false;
    if (engine.reduced) {
      for (const car of [...cars.values()]) syncVisual(car, 1, true);
      return active;
    }
    for (const car of [...cars.values()]) if (updateCar(car, dt)) active = true;
    for (const l of Object.values(lifts)) {
      if (Math.abs(l.target - l.h) > 0.0005 || Math.abs(l.st.v) > 0.0005) {
        l.h = smoothDamp(l.h, l.target, l.st, 0.9, 0.78, dt); active = true;
        if (Math.abs(l.target - l.h) < 0.0006) { l.h = l.target; l.st.v = 0; }
      }
      l.group.position.y = l.h;
    }
    for (const car of cars.values()) { const s = car.slotKey && layout.slots[car.slotKey]; if (s && lifts[s.loc] && car.phase === 'idle') car.y = lifts[s.loc].h; }
    pickJob(dt);
    if (mech.update(dt)) active = true;
    for (const car of [...cars.values()]) if (syncVisual(car, dt)) active = true;
    if (rec) record();
    return active;
  };

  engine.setHighlight = (id) => { for (const car of cars.values()) car.hl = car.id === id; engine.dirty = true; };
  // Dónde encuadrar un coche: la plaza a la que va (o donde está si no tiene destino).
  engine.carPosition = (id) => { const c = cars.get(id); if (!c) return null; const s = layout.slots[dataKey(c.v)]; return s ? { x: s.x, y: 0, z: s.z } : { x: c.x, y: c.y, z: c.z }; };
  engine.pickables = () => { const out = []; for (const c of cars.values()) if (!c.anon && c.opacity > 0.5) out.push(c.lifted.children[0], c.lifted.children[1]); return out; };
  engine.isSettled = () => {
    for (const c of cars.values()) if (c.phase === 'drive' || c.leaving || c.dying || wantOf(c).key !== c.slotKey) return false;
    for (const l of Object.values(lifts)) if (Math.abs(l.target - l.h) > 0.001) return false;
    for (const c of cars.values()) { const s = layout.slots[c.slotKey]; if (s && lifts[s.loc] && wantsUp(c) !== (lifts[s.loc].h > LIFT_TOP - 0.01)) return false; }
    return true;
  };
  engine.carSettled = (id) => { const c = cars.get(id); if (!c) return true; if (c.phase === 'drive' || wantOf(c).key !== c.slotKey) return false; const s = layout.slots[c.slotKey]; const l = s && lifts[s.loc]; return !l || (wantsUp(c) ? l.h > LIFT_TOP - 0.01 : l.h < 0.004); };
  engine.bounds = { x0: -2, x1: template.building.w + 2, z0: -1, z1: template.outsideZ + 4 };

  // --- Gancho de depuración (Anexo C1): posición y orientación de todo por fotograma, y registro de saltos.
  engine.snapshot = () => ({
    cars: [...cars.values()].map((c) => ({ id: c.id, x: c.x, y: c.y, z: c.z, heading: c.h, phase: c.phase, slot: c.slotKey })),
    mechanics: [{ id: mech.id, x: mech.x, y: mech.y, z: mech.z, heading: mech.heading, goal: mech.goalKey }],
    lifts: Object.values(lifts).map((l) => ({ id: l.key, h: l.h })),
  });
  let prev = null;
  function record() {
    const now = engine.snapshot();
    rec.frames += 1;
    if (prev) {
      const before = new Map(prev.cars.map((c) => [c.id, c]));
      for (const c of now.cars) {
        const p = before.get(c.id);
        if (!p) continue;
        rec.maxCarStep = Math.max(rec.maxCarStep, Math.hypot(c.x - p.x, c.y - p.y, c.z - p.z));
        rec.maxCarTurn = Math.max(rec.maxCarTurn, Math.abs(angleDiff(c.heading, p.heading)));
        if (c.y > 0.004 && (c.phase === 'drive' || !/^lift/.test(c.slot || ''))) rec.violations.add('coche elevado fuera de un elevador');
      }
      const m = now.mechanics[0]; const pm = prev.mechanics[0];
      rec.maxMechStep = Math.max(rec.maxMechStep, Math.hypot(m.x - pm.x, m.y - pm.y, m.z - pm.z));
      rec.maxMechTurn = Math.max(rec.maxMechTurn, Math.abs(angleDiff(m.heading, pm.heading)));
      now.lifts.forEach((l, i) => { rec.maxLiftStep = Math.max(rec.maxLiftStep, Math.abs(l.h - prev.lifts[i].h)); });
      const vis = [...cars.values()].filter((c) => c.opacity > 0.3);
      for (let i = 0; i < vis.length; i += 1) for (let j = i + 1; j < vis.length; j += 1) {
        const d = Math.hypot(vis[i].x - vis[j].x, vis[i].z - vis[j].z);
        rec.minCarGap = Math.min(rec.minCarGap, d);
      }
    }
    prev = now;
  }
  engine.startRecording = () => { prev = null; rec = { frames: 0, maxCarStep: 0, maxCarTurn: 0, maxMechStep: 0, maxMechTurn: 0, maxLiftStep: 0, minCarGap: Infinity, violations: new Set() }; };
  engine.stopRecording = () => { const r = rec; rec = null; return r ? { ...r, violations: [...r.violations] } : null; };
  engine.advance = (seconds, step = 1 / 60) => { const n = Math.round(seconds / step); for (let i = 0; i < n; i += 1) engine.update(step); return n; };
  engine.triangles = () => { let t = 0; root.traverse((o) => { if (o.isMesh && o.visible) { const g = o.geometry; t += (g.index ? g.index.count : g.attributes.position.count) / 3; } }); return Math.round(t); };
  engine.dispose = () => {
    for (const car of [...cars.values()]) disposeCar(car);
    root.traverse((o) => { if (o.userData.dispose) o.userData.dispose(); else if (o.geometry && !o.geometry.userData.shared) o.geometry.dispose(); });
  };
  return engine;
}
