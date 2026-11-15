// Coches generados por código: un perfil lateral por arquetipo, extruido al ancho real del modelo.
// Es un parecido de silueta por categoría con las proporciones reales (largo, ancho, alto), no una réplica.
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import { carProfile, DEFAULT_DIMS } from './carProfile.js';

export { DEFAULT_DIMS };

const cache = new Map();

// Devuelve geometrías compartidas por (carrocería, medidas): relleno, cabina, aristas y rueda.
export function carParts(body, dims) {
  const [dl, dw, dh] = DEFAULT_DIMS[body] || DEFAULT_DIMS.compact;
  const L = dims?.l || dl; const W = dims?.w || dw; const H = dims?.h || dh;
  const key = `${body}:${L}:${W}:${H}`;
  if (cache.has(key)) return cache.get(key);
  const p = carProfile(body, L, H);
  const { a } = p;

  const lower = new THREE.Shape();
  lower.moveTo(...p.lower[0]);
  for (let i = 1; i < p.lower.length; i += 1) lower.lineTo(...p.lower[i]);
  // Bajos de atrás hacia delante, con los pasos de rueda centrados en cada eje.
  for (const ax of [p.axleR, p.axleF]) {
    lower.lineTo(ax - Math.cos(p.dip) * p.ar, a.gc);
    lower.absarc(ax, a.wr, p.ar, Math.PI + p.dip, -p.dip, true);
  }
  lower.lineTo(L / 2 - 0.02 * L, a.gc);
  lower.closePath();

  const cabin = new THREE.Shape();
  cabin.moveTo(...p.cabin[0]);
  for (let i = 1; i < p.cabin.length; i += 1) cabin.lineTo(...p.cabin[i]);
  cabin.closePath();

  const extrude = (shape, width) => {
    const bevel = 0.05;
    const g = new THREE.ExtrudeGeometry(shape, { depth: width - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 1, curveSegments: 7 });
    g.translate(0, 0, -(width - bevel * 2) / 2);
    return g;
  };
  const bodyGeo = extrude(lower, W);
  const cabinGeo = extrude(cabin, W * 0.86);
  const wheelGeo = new THREE.CylinderGeometry(a.wr, a.wr, 0.2, 18);
  wheelGeo.rotateX(Math.PI / 2);
  const hubGeo = new THREE.BoxGeometry(a.wr * 1.5, a.wr * 0.24, 0.215);
  const tri = (g) => (g.index ? g.index.count : g.attributes.position.count) / 3;
  const parts = {
    L, W, H, wr: a.wr, axleF: p.axleF, axleR: p.axleR, track: W / 2 - 0.11, wheelbase: p.axleF - p.axleR,
    bodyGeo, cabinGeo, wheelGeo, hubGeo,
    // Aristas precalculadas y fusionadas: una sola llamada de dibujo para el contorno y otra por rueda.
    edges: mergeGeometries([new THREE.EdgesGeometry(bodyGeo, 28), new THREE.EdgesGeometry(cabinGeo, 28)]),
    wheelLines: mergeGeometries([new THREE.EdgesGeometry(wheelGeo, 40), new THREE.EdgesGeometry(hubGeo, 40)]),
    triangles: Math.round(tri(bodyGeo) + tri(cabinGeo) + 4 * (tri(wheelGeo) + tri(hubGeo))),
  };
  cache.set(key, parts);
  return parts;
}

