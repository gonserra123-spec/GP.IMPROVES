// Mecánico en silueta: esqueleto sencillo de cajas, animado por código (sin clips externos).
import * as THREE from 'three';
import { MAT, COLORS, PIT_DEPTH } from './world.js';
import { angleDiff, headingOf } from './paths.js';

const hull = new THREE.MeshBasicMaterial({ color: COLORS.blue900, side: THREE.BackSide });

function limb(w, h, d, mat = MAT.white) {
  const g = new THREE.BoxGeometry(w, h, d); g.translate(0, -h / 2, 0);
  const pivot = new THREE.Group();
  pivot.add(new THREE.Mesh(g, mat), new THREE.LineSegments(new THREE.EdgesGeometry(g), MAT.line));
  return pivot;
}

// Ángulos objetivo por postura. Positivo = hacia delante.
const POSES = {
  idle: { lean: 0, shL: 0.06, shR: 0.06, elL: 0.12, elR: 0.12 },
  inspect: { lean: 0.32, shL: 0.2, shR: 1.05, elL: 0.3, elR: 0.5 },
  work_up: { lean: -0.06, shL: 2.75, shR: 2.6, elL: 0.35, elR: 0.5 },
  work_hood: { lean: 0.6, shL: 1.15, shR: 1.3, elL: 0.6, elR: 0.5 },
  handover: { lean: 0.08, shL: 0.1, shR: 1.25, elL: 0.15, elR: 0.25 },
  wait: { lean: 0, shL: 0.5, shR: 0.5, elL: 1.5, elR: 1.5 },
};

// Giro suavizado con velocidad angular máxima (sin volantazos al cambiar de tramo).
const turn = (d, dt) => Math.max(-5.5 * dt, Math.min(5.5 * dt, d * Math.min(1, dt * 9)));

export function createMechanic(id, home) {
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = 0.88; root.add(hips);
  const torso = new THREE.Group(); hips.add(torso);
  const chest = limb(0.2, 0.56, 0.4); chest.position.y = 0.56; torso.add(chest);
  const headGeo = new THREE.SphereGeometry(0.115, 12, 10);
  const head = new THREE.Mesh(headGeo, MAT.white); head.position.y = 0.72;
  const headHull = new THREE.Mesh(headGeo, hull); headHull.scale.setScalar(1.1); head.add(headHull);
  torso.add(head);
  const arm = (side) => {
    const upper = limb(0.1, 0.3, 0.1); upper.position.set(0, 0.52, side * 0.25);
    const fore = limb(0.09, 0.28, 0.09); fore.position.y = -0.3; upper.add(fore);
    torso.add(upper); return { upper, fore };
  };
  const leg = (side) => {
    const upper = limb(0.13, 0.45, 0.14); upper.position.set(0, 0, side * 0.11);
    const lower = limb(0.11, 0.43, 0.12); lower.position.y = -0.45; upper.add(lower);
    hips.add(upper); return { upper, lower };
  };
  const armL = arm(-1); const armR = arm(1); const legL = leg(-1); const legR = leg(1);

  const m = {
    id, root, x: home.x, y: 0, z: home.z, heading: home.heading || 0,
    path: null, s: 0, speed: 0, pose: 'idle', face: null, arrived: true, goalKey: 'home', phase: 0, clock: 0,
    j: { lean: 0, shL: 0, shR: 0, elL: 0, elR: 0, hipL: 0, hipR: 0, knL: 0, knR: 0 },
  };

  // Camina por una polilínea 3D; al cambiar de destino se replanifica desde donde esté.
  m.walkTo = (points, pose, face, goalKey) => {
    m.goalKey = goalKey; m.pose = pose; m.face = face;
    const pts = [{ x: m.x, y: m.y, z: m.z }, ...points].filter((p, i, a) => i === 0 || Math.hypot(p.x - a[i - 1].x, p.z - a[i - 1].z, (p.y || 0) - (a[i - 1].y || 0)) > 0.05);
    if (pts.length < 2) { m.path = null; m.arrived = true; return; }
    let len = 0;
    const segs = [];
    for (let i = 1; i < pts.length; i += 1) {
      const a = pts[i - 1]; const b = pts[i];
      const l = Math.hypot(b.x - a.x, (b.y || 0) - (a.y || 0), b.z - a.z);
      segs.push({ a, b, s0: len, l }); len += l;
    }
    m.path = { segs, len }; m.s = 0; m.arrived = false;
  };

  m.place = (p, pose, face, goalKey) => {
    m.x = p.x; m.y = p.y || 0; m.z = p.z; m.pose = pose; m.face = face; m.goalKey = goalKey; m.path = null; m.arrived = true; m.speed = 0;
    if (face !== null && face !== undefined) m.heading = face;
    Object.assign(m.j, { hipL: 0, hipR: 0, knL: 0, knR: 0 }, POSES[pose] || POSES.idle);
    m.apply();
  };

  m.update = (dt) => {
    m.clock += dt;
    let moving = false;
    if (m.path) {
      const remain = m.path.len - m.s;
      const vmax = 1.45;
      m.speed = Math.min(vmax, m.speed + 3 * dt, Math.sqrt(2 * 2.4 * Math.max(0, remain)) + 0.08);
      m.s = Math.min(m.path.len, m.s + m.speed * dt);
      const seg = m.path.segs.find((sg) => m.s <= sg.s0 + sg.l) || m.path.segs[m.path.segs.length - 1];
      const t = seg.l ? Math.min(1, (m.s - seg.s0) / seg.l) : 1;
      m.x = seg.a.x + (seg.b.x - seg.a.x) * t; m.z = seg.a.z + (seg.b.z - seg.a.z) * t;
      m.y = (seg.a.y || 0) + ((seg.b.y || 0) - (seg.a.y || 0)) * t;
      const want = headingOf(seg.b.x - seg.a.x, seg.b.z - seg.a.z);
      if (Math.hypot(seg.b.x - seg.a.x, seg.b.z - seg.a.z) > 0.01) m.heading += turn(angleDiff(want, m.heading), dt);
      m.phase += m.speed * dt * 4.6;
      moving = true;
      if (m.s >= m.path.len - 1e-4) { m.path = null; m.speed = 0; m.arrived = true; }
    } else if (m.face !== null && m.face !== undefined) {
      const d = angleDiff(m.face, m.heading);
      if (Math.abs(d) > 0.002) { m.heading += turn(d, dt); moving = true; }
    }
    const target = moving && m.path ? null : (POSES[m.pose] || POSES.idle);
    const k = Math.min(1, dt * 7);
    const j = m.j;
    const to = (key, v) => { const d = v - j[key]; if (Math.abs(d) > 0.0005) { j[key] += d * k; moving = true; } };
    if (target) {
      const wob = m.pose.startsWith('work') ? Math.sin(m.clock * 5.5) * 0.14 : (m.pose === 'inspect' ? Math.sin(m.clock * 1.6) * 0.1 : (m.pose === 'handover' ? Math.sin(m.clock * 3) * 0.12 : 0));
      to('lean', target.lean); to('shL', target.shL); to('shR', target.shR + wob); to('elL', target.elL); to('elR', target.elR + wob * 0.8);
      to('hipL', 0); to('hipR', 0); to('knL', 0); to('knR', 0);
      if (wob) moving = true;
    } else {
      const sw = Math.sin(m.phase); const amp = Math.min(1, m.speed / 1.2);
      to('lean', 0.06); to('hipL', sw * 0.55 * amp); to('hipR', -sw * 0.55 * amp);
      to('knL', -Math.max(0, -sw) * 0.75 * amp); to('knR', -Math.max(0, sw) * 0.75 * amp);
      to('shL', -sw * 0.45 * amp); to('shR', sw * 0.45 * amp); to('elL', 0.35); to('elR', 0.35);
    }
    m.apply();
    return moving;
  };

  m.apply = () => {
    const j = m.j;
    root.position.set(m.x, m.y, m.z); root.rotation.y = m.heading;
    torso.rotation.z = -j.lean;
    armL.upper.rotation.z = j.shL; armR.upper.rotation.z = j.shR; armL.fore.rotation.z = j.elL; armR.fore.rotation.z = j.elR;
    legL.upper.rotation.z = j.hipL; legR.upper.rotation.z = j.hipR; legL.lower.rotation.z = j.knL; legR.lower.rotation.z = j.knR;
  };
  m.inPit = () => m.y < -0.05;
  m.apply();
  return m;
}

export { PIT_DEPTH };
