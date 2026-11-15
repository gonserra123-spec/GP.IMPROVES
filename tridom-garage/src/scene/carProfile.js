// Perfiles laterales por arquetipo (sin three): los usan la malla 3D y los dibujos SVG.
// Fracciones del largo (desde el frente) y del alto. wr = radio de rueda en metros.
export const ARCH = {
  city: { fo: 0.19, ro: 0.17, wr: 0.3, gc: 0.15, belt: 0.58, nose: 0.42, wb: 0.27, rs: 0.42, re: 0.86, rb: 0.975, deck: 0.58 },
  compact: { fo: 0.2, ro: 0.18, wr: 0.32, gc: 0.15, belt: 0.58, nose: 0.42, wb: 0.28, rs: 0.43, re: 0.82, rb: 0.965, deck: 0.58 },
  sedan: { fo: 0.19, ro: 0.21, wr: 0.33, gc: 0.14, belt: 0.6, nose: 0.44, wb: 0.29, rs: 0.43, re: 0.7, rb: 0.86, deck: 0.6 },
  wagon: { fo: 0.19, ro: 0.22, wr: 0.33, gc: 0.14, belt: 0.59, nose: 0.44, wb: 0.27, rs: 0.4, re: 0.9, rb: 0.985, deck: 0.59 },
  suv_small: { fo: 0.19, ro: 0.18, wr: 0.35, gc: 0.2, belt: 0.58, nose: 0.48, wb: 0.27, rs: 0.41, re: 0.86, rb: 0.975, deck: 0.58 },
  suv_large: { fo: 0.185, ro: 0.19, wr: 0.37, gc: 0.21, belt: 0.59, nose: 0.5, wb: 0.27, rs: 0.4, re: 0.88, rb: 0.98, deck: 0.59 },
  coupe: { fo: 0.19, ro: 0.2, wr: 0.33, gc: 0.13, belt: 0.62, nose: 0.46, wb: 0.31, rs: 0.47, re: 0.66, rb: 0.9, deck: 0.62 },
  mpv: { fo: 0.19, ro: 0.19, wr: 0.33, gc: 0.16, belt: 0.55, nose: 0.42, wb: 0.2, rs: 0.38, re: 0.9, rb: 0.985, deck: 0.55 },
  van: { fo: 0.18, ro: 0.2, wr: 0.34, gc: 0.17, belt: 0.5, nose: 0.42, wb: 0.11, rs: 0.22, re: 0.97, rb: 0.995, deck: 0.5 },
  pickup: { fo: 0.17, ro: 0.22, wr: 0.38, gc: 0.23, belt: 0.56, nose: 0.5, wb: 0.24, rs: 0.34, re: 0.55, rb: 0.6, deck: 0.54 },
};
export const DEFAULT_DIMS = {
  city: [4.0, 1.75, 1.47], compact: [4.35, 1.8, 1.45], sedan: [4.75, 1.83, 1.44], wagon: [4.65, 1.82, 1.46], suv_small: [4.3, 1.8, 1.6],
  suv_large: [4.55, 1.86, 1.66], coupe: [4.4, 1.82, 1.35], mpv: [4.45, 1.83, 1.64], van: [4.9, 1.95, 1.95], pickup: [5.33, 1.86, 1.81],
};

export function carProfile(body, L, H) {
  const a = ARCH[body] || ARCH.compact;
  const xf = L / 2; const xr = -L / 2;
  const at = (f) => xf - f * L; // fracción desde el frente -> x
  const belt = a.belt * H; const nose = a.nose * H; const deck = a.deck * H;
  const ar = a.wr + 0.07;
  const dip = Math.asin(Math.min(0.95, (a.wr - a.gc) / ar));
  return {
    a, belt, ar, dip,
    axleF: xf - a.fo * L, axleR: xr + a.ro * L,
    lower: [[xf, a.gc + 0.06], [xf, nose * 0.82], [xf - 0.035 * L, nose], [at(a.wb), belt], [at(a.rb), belt], [xr + 0.015 * L, deck], [xr, deck - 0.1 * H], [xr, a.gc + 0.08]],
    cabin: [[at(a.wb), belt - 0.03], [at(a.rs), H], [at(a.re), H], [at(a.rb), belt - 0.03]],
  };
}

// Perfil lateral en SVG (el mismo trazado que la malla 3D), para la ficha y el catálogo de la landing.
export function profileSvgPath(body, L, H) {
  const p = carProfile(body, L, H);
  const { a } = p;
  const pt = ([x, y]) => `${(L / 2 - x).toFixed(3)} ${(H - y).toFixed(3)}`;
  const arch = (ax) => {
    const rear = ax - Math.cos(p.dip) * p.ar; const front = ax + Math.cos(p.dip) * p.ar;
    return `L ${pt([rear, a.gc])} A ${p.ar.toFixed(3)} ${p.ar.toFixed(3)} 0 1 0 ${pt([front, a.gc])}`;
  };
  const lower = `M ${p.lower.map(pt).join(' L ')} ${arch(p.axleR)} ${arch(p.axleF)} L ${pt([L / 2 - 0.02 * L, a.gc])} Z`;
  const cabin = `M ${p.cabin.map(pt).join(' L ')} Z`;
  return { lower, cabin, wheels: [p.axleF, p.axleR].map((ax) => ({ cx: L / 2 - ax, cy: H - a.wr, r: a.wr })), L, H };
}
