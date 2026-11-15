// Nave del taller: todo lo estático se fusiona en unas pocas mallas (relleno, aristas, pintura de suelo).
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

export const COLORS = {
  white: '#FFFFFF', paper: '#F4F7FC', grid: '#D9E2F2', blue100: '#E6EEFC', blue500: '#2F6FED', blue700: '#1F4FB8', blue900: '#0B2A5B',
  ink: '#0E1B2E', amber: '#F5A524', green: '#1FA971', mute: '#8FA3C4',
};
export const PIT_DEPTH = 1.75;
export const LIFT_TOP = 1.85;

const offset = { polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 };
export const MAT = {
  white: new THREE.MeshBasicMaterial({ color: COLORS.white, ...offset }),
  tint: new THREE.MeshBasicMaterial({ color: COLORS.blue100, ...offset }),
  floor: new THREE.MeshBasicMaterial({ color: COLORS.paper, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 }),
  apron: new THREE.MeshBasicMaterial({ color: COLORS.white, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 3, polygonOffsetUnits: 3 }),
  line: new THREE.LineBasicMaterial({ color: COLORS.blue900 }),
  lineSoft: new THREE.LineBasicMaterial({ color: COLORS.mute }),
  grid: new THREE.LineBasicMaterial({ color: COLORS.grid }),
};

export function textTexture(text, { color = COLORS.blue900, weight = 600, px = 96, pad = 16 } = {}) {
  const c = document.createElement('canvas');
  const ctx = c.getContext('2d');
  const font = `${weight} ${px}px "Saira Condensed", "Arial Narrow", sans-serif`;
  ctx.font = font;
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  c.width = w; c.height = px + pad * 2;
  ctx.font = font; ctx.fillStyle = color; ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, c.height / 2 + px * 0.04);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  return { tex, aspect: c.width / c.height };
}

function label(text, height, opts) {
  const { tex, aspect } = textTexture(text, opts);
  const m = new THREE.Mesh(new THREE.PlaneGeometry(height * aspect, height), new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }));
  m.userData.dispose = () => { tex.dispose(); m.geometry.dispose(); m.material.dispose(); };
  return m;
}

export function buildWorld(layout, { name = 'Taller Demo', brandColor = COLORS.blue500, lang = 'es' } = {}) {
  const { tpl, slots } = layout;
  const B = tpl.building;
  const root = new THREE.Group();
  const fills = []; const tints = []; const edges = []; const paint = []; const paintSoft = [];
  const labels = [];

  const box = (x, y, z, w, h, d, list = fills) => {
    const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z);
    list.push(g); edges.push(new THREE.EdgesGeometry(g));
  };
  const cyl = (x, y, z, r, len, axis = 'x') => {
    const g = new THREE.CylinderGeometry(r, r, len, 16);
    if (axis === 'x') g.rotateZ(Math.PI / 2);
    g.translate(x, y, z); fills.push(g); edges.push(new THREE.EdgesGeometry(g, 40));
  };
  const quad = (x, z, w, d, list = paint, y = 0.006) => {
    const g = new THREE.PlaneGeometry(w, d); g.rotateX(-Math.PI / 2); g.translate(x, y, z); list.push(g);
  };
  const dashes = (x1, z1, x2, z2, list = paint, w = 0.1, dash = 0.7, gap = 0.5) => {
    const len = Math.hypot(x2 - x1, z2 - z1); const horiz = Math.abs(x2 - x1) > Math.abs(z2 - z1);
    for (let s = 0; s + dash <= len + 1e-6; s += dash + gap) {
      const t = (s + dash / 2) / len;
      quad(x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, horiz ? dash : w, horiz ? w : dash, list);
    }
  };
  const arrow = (x, z, dir) => { // dir: 0 este, 1 sur, 2 oeste, 3 norte
    const s = new THREE.Shape();
    s.moveTo(-0.9, -0.14); s.lineTo(0.2, -0.14); s.lineTo(0.2, -0.42); s.lineTo(0.9, 0); s.lineTo(0.2, 0.42); s.lineTo(0.2, 0.14); s.lineTo(-0.9, 0.14); s.closePath();
    const g = new THREE.ShapeGeometry(s); g.rotateX(-Math.PI / 2); g.rotateY(-dir * (Math.PI / 2)); g.translate(x, 0.006, z); paint.push(g);
  };
  const floorLabel = (text, x, z, h = 0.7, opts) => { const m = label(text, h, opts); m.rotation.x = -Math.PI / 2; m.position.set(x, 0.012, z); labels.push(m); };
  const wallLabel = (text, x, y, z, h, opts) => { const m = label(text, h, opts); m.position.set(x, y, z); labels.push(m); };

  // Suelo interior con el hueco del foso.
  const pitX = tpl.bays.pit; const pz0 = tpl.bayZ - 2.7; const pz1 = tpl.bayZ + 4.4; const stairZ = pz1 - PIT_DEPTH;
  const floor = new THREE.Shape();
  floor.moveTo(0, 0); floor.lineTo(B.w, 0); floor.lineTo(B.w, B.d); floor.lineTo(0, B.d); floor.closePath();
  if (tpl.pit) {
    const hole = new THREE.Path();
    hole.moveTo(pitX - 0.5, pz0); hole.lineTo(pitX - 0.5, pz1); hole.lineTo(pitX + 0.5, pz1); hole.lineTo(pitX + 0.5, pz0); hole.closePath();
    floor.holes.push(hole);
  }
  const floorGeo = new THREE.ShapeGeometry(floor); floorGeo.rotateX(Math.PI / 2);
  root.add(new THREE.Mesh(floorGeo, MAT.floor));
  const apron = new THREE.PlaneGeometry(B.w + 10, tpl.outsideZ + 3.4 - B.d); apron.rotateX(-Math.PI / 2); apron.translate(B.w / 2, -0.004, (B.d + tpl.outsideZ + 3.4) / 2);
  root.add(new THREE.Mesh(apron, MAT.apron));

  // Rejilla del suelo cada metro.
  const gp = [];
  for (let x = 1; x < B.w; x += 1) gp.push(x, 0.003, 0, x, 0.003, B.d);
  for (let z = 1; z < B.d; z += 1) {
    if (tpl.pit && z > pz0 && z < pz1) gp.push(0, 0.003, z, pitX - 0.5, 0.003, z, pitX + 0.5, 0.003, z, B.w, 0.003, z);
    else gp.push(0, 0.003, z, B.w, 0.003, z);
  }
  const gridGeo = new THREE.BufferGeometry(); gridGeo.setAttribute('position', new THREE.Float32BufferAttribute(gp, 3));
  root.add(new THREE.LineSegments(gridGeo, MAT.grid));

  // Muros: norte y oeste altos; sur y este en zócalo bajo para ver el interior.
  const T = 0.2;
  box(B.w / 2 - T / 2, 0, -T / 2, B.w + T, B.wallH, T);
  box(-T / 2, 0, B.d / 2, T, B.wallH, B.d);
  const doorW = 3.6; const e0 = tpl.entryX - doorW / 2; const e1 = tpl.entryX + doorW / 2; const x0 = tpl.exitX - doorW / 2; const x1 = tpl.exitX + doorW / 2;
  const curb = 0.22;
  for (const [a, b] of [[0, e0], [e1, x0], [x1, B.w]]) if (b - a > 0.05) box((a + b) / 2, 0, B.d + T / 2, b - a, curb, T);
  box(B.w + T / 2, 0, B.d / 2, T, curb, B.d);
  // Marcos de las puertas de entrada y salida.
  for (const [a, b] of [[e0, e1], [x0, x1]]) {
    box(a, 0, B.d + T / 2, 0.22, 3.3, 0.3); box(b, 0, B.d + T / 2, 0.22, 3.3, 0.3);
    box((a + b) / 2, 3.3, B.d + T / 2, b - a + 0.22, 0.28, 0.3, tints);
  }
  const t = lang === 'en' ? { in: 'ENTRANCE', out: 'EXIT', rec: 'RECEPTION', wait: 'WAITING', pick: 'PICKUP', park: 'PARKING', diag: 'DIAGNOSIS', pit: 'PIT' }
    : { in: 'ENTRADA', out: 'SALIDA', rec: 'RECEPCIÓN', wait: 'ESPERA', pick: 'RECOGIDA', park: 'APARCAMIENTO', diag: 'DIAGNÓSTICO', pit: 'FOSO' };
  floorLabel(t.in, tpl.entryX, B.d + 1.5, 0.75, { color: brandColor });
  floorLabel(t.out, tpl.exitX, B.d + 1.5, 0.75, { color: brandColor });
  arrow(tpl.entryX + 1.25, B.d + 2.9, 3); arrow(tpl.exitX + 1.25, B.d + 2.9, 1);
  arrow((tpl.entryX + tpl.exitX) / 2 - 6, tpl.aisleZ, 0); arrow((tpl.entryX + tpl.exitX) / 2 + 6, tpl.aisleZ, 0);

  // Líneas de seguridad discontinuas a ambos lados del pasillo y del carril exterior.
  dashes(1.2, tpl.aisleZ - 1.55, B.w - 1.2, tpl.aisleZ - 1.55);
  dashes(e1 + 0.4, tpl.aisleZ + 1.55, x0 - 0.4, tpl.aisleZ + 1.55);
  dashes(-3, tpl.laneZ, B.w + 3, tpl.laneZ, paintSoft, 0.1, 1.2, 1.2);

  // Plazas: contorno en U abierto hacia el carril.
  for (const s of Object.values(slots)) {
    const north = s.z < s.foot.z; const len = 5.2; const w = 2.6;
    const zc = s.z; const back = north ? zc - len / 2 : zc + len / 2;
    const list = /^(lift|pit|diagnosis)/.test(s.loc) ? paint : paintSoft;
    if (s.loc !== 'pit') quad(s.x, back, w, 0.08, list);
    quad(s.x - w / 2, zc, 0.08, len, list); quad(s.x + w / 2, zc, 0.08, len, list);
  }
  const mid = (xs) => (xs[0] + xs[xs.length - 1]) / 2;
  floorLabel(t.rec, mid(tpl.south.reception), tpl.southZ + 2.55, 0.5, { color: COLORS.blue700 });
  floorLabel(t.wait, mid(tpl.south.waiting), tpl.southZ + 2.55, 0.5, { color: COLORS.blue700 });
  floorLabel(t.park, mid(tpl.outside.parking), tpl.outsideZ + 3.1, 0.55, { color: COLORS.blue700 });
  floorLabel(t.pick, mid(tpl.outside.pickup), tpl.outsideZ + 3.1, 0.55, { color: brandColor });
  floorLabel(t.diag, tpl.bays.diagnosis_bay, tpl.bayZ + 3.1, 0.45, { color: COLORS.blue700 });

  // Elevadores de dos columnas; el carro con los brazos es la parte móvil.
  const lifts = {};
  for (let i = 1; i <= tpl.lifts; i += 1) {
    const lx = tpl.bays[`lift${i}`]; const lz = tpl.bayZ;
    for (const sx of [-1, 1]) { box(lx + sx * 1.6, 0, lz, 0.24, 2.6, 0.34); box(lx + sx * 1.6, 0, lz, 0.5, 0.04, 0.9, tints); }
    const g = new THREE.Group();
    const lf = []; const le = [];
    const part = (x, y, z, w, h, d) => { const b = new THREE.BoxGeometry(w, h, d); b.translate(x, y, z); lf.push(b); le.push(new THREE.EdgesGeometry(b)); };
    for (const sx of [-1, 1]) {
      part(sx * 1.6, 0.2, 0, 0.34, 0.3, 0.5);
      for (const sz of [-1, 1]) { part(sx * 1.05, 0.1, sz * 0.75, 1.1, 0.08, 0.12); part(sx * 0.62, 0.15, sz * 0.75, 0.22, 0.05, 0.22); }
    }
    g.add(new THREE.Mesh(mergeGeometries(lf), MAT.tint), new THREE.LineSegments(mergeGeometries(le), MAT.line));
    g.position.set(lx, 0, lz);
    root.add(g); lifts[`lift${i}`] = g;
    wallLabel(String(i), lx, 3.25, 0.02, 1.25, { color: brandColor, weight: 700 });
    floorLabel(String(i), lx, lz + 3.15, 0.7, { color: brandColor, weight: 700 });
  }

  // Foso con escalera: paredes interiores, fondo y peldaños.
  if (tpl.pit) {
    const wall = (w, h, cx, cy, cz, ry) => { const g = new THREE.PlaneGeometry(w, h); g.rotateY(ry); g.translate(cx, cy, cz); tints.push(g); };
    const len = pz1 - pz0;
    wall(len, PIT_DEPTH, pitX - 0.5, -PIT_DEPTH / 2, (pz0 + pz1) / 2, Math.PI / 2);
    wall(1, PIT_DEPTH, pitX, -PIT_DEPTH / 2, pz0, 0);
    const bottom = new THREE.PlaneGeometry(1, len); bottom.rotateX(-Math.PI / 2); bottom.translate(pitX, -PIT_DEPTH, (pz0 + pz1) / 2); tints.push(bottom);
    const steps = 7; const sh = PIT_DEPTH / steps;
    for (let k = 0; k < steps; k += 1) box(pitX, -PIT_DEPTH, pz1 - (k + 0.5) * sh, 1, PIT_DEPTH - (k + 1) * sh + 0.001, sh);
    const rim = [pitX - 0.5, 0.004, pz0, pitX + 0.5, 0.004, pz0, pitX + 0.5, 0.004, pz0, pitX + 0.5, 0.004, pz1, pitX + 0.5, 0.004, pz1, pitX - 0.5, 0.004, pz1, pitX - 0.5, 0.004, pz1, pitX - 0.5, 0.004, pz0];
    const rg = new THREE.BufferGeometry(); rg.setAttribute('position', new THREE.Float32BufferAttribute(rim, 3)); edges.push(rg);
    dashes(pitX - 0.85, pz0 - 0.3, pitX - 0.85, pz1 + 0.3, paint, 0.08, 0.4, 0.3); dashes(pitX + 0.85, pz0 - 0.3, pitX + 0.85, pz1 + 0.3, paint, 0.08, 0.4, 0.3);
    wallLabel(t.pit, pitX, 3.25, 0.02, 0.8, { color: brandColor, weight: 700 });
  }

  // Bahía de diagnóstico: carro con pantalla.
  const dx = tpl.bays.diagnosis_bay;
  box(dx + 2, 0, 2.2, 0.7, 0.95, 0.5); box(dx + 2, 0.95, 2.2, 0.62, 0.45, 0.06, tints);
  wallLabel(t.diag, dx, 3.25, 0.02, 0.6, { color: brandColor, weight: 700 });

  // Recepción: mostrador en L y dos sillas de espera.
  box(2.1, 0, 2.3, 3.0, 1.05, 0.6); box(3.3, 0, 3.3, 0.6, 1.05, 1.4); box(2.1, 1.05, 2.3, 3.2, 0.05, 0.75, tints);
  for (const cz of [6.0, 7.1]) { box(0.75, 0, cz, 0.5, 0.45, 0.5); box(0.52, 0.45, cz, 0.06, 0.5, 0.5); }
  wallLabel(t.rec, 2.2, 3.25, 0.02, 0.6, { color: COLORS.blue700, weight: 700 });

  // Carro de herramientas, compresor y banco de trabajo.
  box(9, 0.1, 1.0, 0.9, 0.85, 0.5); box(9, 0.95, 1.0, 0.96, 0.05, 0.56, tints);
  for (const wx of [-0.35, 0.35]) cyl(9 + wx, 0.07, 1.25, 0.07, 0.06, 'x');
  box(23.6, 0, 1.0, 1.5, 0.2, 0.6); cyl(23.6, 0.62, 1.0, 0.36, 1.3, 'x'); box(23.6, 0.98, 1.0, 0.4, 0.3, 0.35, tints);
  box(27.2, 0, 0.75, 2.6, 0.9, 0.7); box(27.2, 0.9, 0.75, 2.7, 0.06, 0.8, tints); box(27.2, 1.4, 0.12, 2.6, 1.1, 0.05, tints);

  // Rótulo del taller en la pared norte.
  wallLabel(name.toUpperCase(), B.w - 4.6, 3.3, 0.02, 0.85, { color: brandColor, weight: 700 });

  const staticGroup = new THREE.Group();
  staticGroup.add(new THREE.Mesh(mergeGeometries(fills), MAT.white));
  staticGroup.add(new THREE.Mesh(mergeGeometries(tints), new THREE.MeshBasicMaterial({ color: COLORS.blue100, side: THREE.DoubleSide, ...offset })));
  staticGroup.add(new THREE.LineSegments(mergeGeometries(edges), MAT.line));
  const paintMat = new THREE.MeshBasicMaterial({ color: brandColor, transparent: true, opacity: 0.85, depthWrite: false });
  const softMat = new THREE.MeshBasicMaterial({ color: '#B4C6EC', depthWrite: false, transparent: true });
  staticGroup.add(new THREE.Mesh(mergeGeometries(paint), paintMat), new THREE.Mesh(mergeGeometries(paintSoft), softMat));
  for (const l of labels) staticGroup.add(l);
  root.add(staticGroup);
  for (const g of [...fills, ...tints, ...edges, ...paint, ...paintSoft]) g.dispose();

  const pit = tpl.pit ? { x: pitX, top: { x: pitX, y: 0, z: pz1 + 0.35 }, bottom: { x: pitX, y: -PIT_DEPTH, z: stairZ - 0.1 }, z0: pz0, z1: pz1 } : null;
  return { root, lifts, pit };
}
