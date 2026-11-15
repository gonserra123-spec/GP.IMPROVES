// Cámara ortográfica isométrica: giro limitado, zoom y desplazamiento con inercia (objetivo + suavizado).
const AZ0 = Math.PI / 4;
const EL = 0.62;

export function createRig(camera, bounds, wallH = 4.2) {
  const rig = { cx: 0, cz: 0, zoom: 20, az: AZ0, t: { cx: 0, cz: 0, zoom: 20, az: AZ0 }, w: 800, h: 600, fitZoom: 20, auto: true, stiffness: 6 };
  const axes = (az) => ({
    right: { x: Math.cos(az), z: -Math.sin(az) },
    ground: { x: -Math.sin(az), z: -Math.cos(az) },
    up: { x: -Math.sin(EL) * Math.sin(az), y: Math.cos(EL), z: -Math.sin(EL) * Math.cos(az) },
  });

  // Encuadre de un rectángulo de suelo [x0,x1]×[z0,z1] con margen.
  rig.frame = (b, az = AZ0, margin = 0.94) => {
    const a = axes(az);
    let minX = Infinity; let maxX = -Infinity; let minY = Infinity; let maxY = -Infinity;
    for (const x of [b.x0, b.x1]) for (const z of [b.z0, b.z1]) for (const y of [0, b.h ?? wallH]) {
      const sx = x * a.right.x + z * a.right.z; const sy = x * a.up.x + y * a.up.y + z * a.up.z;
      minX = Math.min(minX, sx); maxX = Math.max(maxX, sx); minY = Math.min(minY, sy); maxY = Math.max(maxY, sy);
    }
    const zoom = Math.min(rig.w / (maxX - minX), rig.h / (maxY - minY)) * margin;
    const mx = (minX + maxX) / 2; const my = (minY + maxY) / 2;
    const g = my / Math.sin(EL);
    return { cx: a.right.x * mx + a.ground.x * g, cz: a.right.z * mx + a.ground.z * g, zoom, az };
  };
  rig.fit = (jump = false) => {
    const f = rig.frame(bounds);
    rig.fitZoom = f.zoom; rig.auto = true;
    Object.assign(rig.t, f);
    if (jump) rig.jump();
  };
  rig.setSize = (w, h) => { rig.w = w; rig.h = h; rig.fitZoom = rig.frame(bounds).zoom; if (rig.auto) rig.fit(true); };
  rig.jump = () => { rig.cx = rig.t.cx; rig.cz = rig.t.cz; rig.zoom = rig.t.zoom; rig.az = rig.t.az; rig.apply(); };
  const clampT = () => {
    rig.t.az = Math.min(AZ0 + 0.6, Math.max(AZ0 - 0.6, rig.t.az));
    rig.t.zoom = Math.min(rig.fitZoom * 4.5, Math.max(rig.fitZoom * 0.7, rig.t.zoom));
    rig.t.cx = Math.min(bounds.x1 + 4, Math.max(bounds.x0 - 4, rig.t.cx));
    rig.t.cz = Math.min(bounds.z1 + 4, Math.max(bounds.z0 - 4, rig.t.cz));
  };
  rig.pan = (dx, dy) => {
    const a = axes(rig.az); rig.auto = false;
    rig.t.cx += (-a.right.x * dx + (a.ground.x * dy) / Math.sin(EL)) / rig.zoom;
    rig.t.cz += (-a.right.z * dx + (a.ground.z * dy) / Math.sin(EL)) / rig.zoom;
    clampT();
  };
  rig.zoomBy = (f) => { rig.auto = false; rig.t.zoom *= f; clampT(); };
  rig.rotate = (d) => { rig.auto = false; rig.t.az += d; clampT(); };
  rig.focus = (x, z, zoomFactor = 1.75) => { rig.auto = false; rig.t.cx = x; rig.t.cz = z; rig.t.zoom = rig.fitZoom * zoomFactor; rig.t.az = AZ0; clampT(); };
  rig.setTarget = (t) => { rig.auto = false; Object.assign(rig.t, t); };

  rig.update = (dt) => {
    const k = 1 - Math.exp(-dt * rig.stiffness);
    let moving = false;
    for (const key of ['cx', 'cz', 'az']) {
      const d = rig.t[key] - rig[key];
      if (Math.abs(d) > 0.0004) { rig[key] += d * k; moving = true; } else rig[key] = rig.t[key];
    }
    const dz = rig.t.zoom - rig.zoom;
    if (Math.abs(dz) > rig.zoom * 0.0004) { rig.zoom += dz * k; moving = true; } else rig.zoom = rig.t.zoom;
    if (moving) rig.apply();
    return moving;
  };
  rig.apply = () => {
    const D = 120;
    camera.position.set(rig.cx + Math.cos(EL) * Math.sin(rig.az) * D, Math.sin(EL) * D, rig.cz + Math.cos(EL) * Math.cos(rig.az) * D);
    camera.up.set(0, 1, 0);
    camera.lookAt(rig.cx, 0, rig.cz);
    camera.zoom = rig.zoom;
    camera.updateProjectionMatrix();
  };
  return rig;
}
