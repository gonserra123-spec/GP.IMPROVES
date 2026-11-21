// Vaso 3D de La Jarana — vaso de festival de 400 ml (PP translúcido esmerilado, tinta cian).
// Módulo entregado en la-jarana-assets/vaso3d/vaso3d.js. Cambios mínimos para la web:
//  · el bucle va en el ticker único de Motion (frame.update) en vez de un rAF propio (Regla 7);
//  · el cursor lo pone la web (cursor propio), no el canvas;
//  · destroy() libera también geometrías, materiales y textura, y corta renders tardíos.
// Uso: mountVaso(contenedor, { texture }) → { destroy, setRotation, setFill }
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { frame, cancelFrame } from 'motion';

export function mountVaso(container, opts = {}) {
  const texUrl = opts.texture || 'vaso_textura_cian.png';
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  container.appendChild(renderer.domElement);
  renderer.domElement.style.touchAction = 'pan-y';
  renderer.domElement.setAttribute('aria-hidden', 'true');

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0.35, 11);
  camera.lookAt(0, 0, 0);

  scene.add(new THREE.HemisphereLight(0xffffff, 0x9cc6ee, 0.9));
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(4, 6, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xdff0ff, 1.1);
  rim.position.set(-6, 2, -4);
  scene.add(rim);

  // Proporciones reales aprox.: Ø boca 80 mm, Ø base 62 mm, alto 150 mm
  const R_TOP = 1.0, R_BOT = 0.775, H = 3.75, SEG = 128;
  const cup = new THREE.Group();
  scene.add(cup);

  const plastic = new THREE.MeshPhysicalMaterial({
    color: 0xf4f6f8, roughness: 0.62, metalness: 0, transmission: 0.55,
    thickness: 0.08, ior: 1.49, transparent: true, opacity: 0.5,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const wall = new THREE.Mesh(new THREE.CylinderGeometry(R_TOP, R_BOT, H, SEG, 1, true), plastic);
  wall.renderOrder = 1;
  cup.add(wall);

  const base = new THREE.Mesh(new THREE.CircleGeometry(R_BOT * 0.985, SEG), plastic);
  base.rotation.x = -Math.PI / 2;
  base.position.y = -H / 2 + 0.06;
  cup.add(base);

  const rimMat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.45, transparent: true, opacity: 0.9 });
  const lip = new THREE.Mesh(new THREE.TorusGeometry(R_TOP, 0.028, 16, SEG), rimMat);
  lip.rotation.x = Math.PI / 2;
  lip.position.y = H / 2;
  cup.add(lip);
  const foot = new THREE.Mesh(new THREE.TorusGeometry(R_BOT * 1.005, 0.02, 12, SEG), rimMat);
  foot.rotation.x = Math.PI / 2;
  foot.position.y = -H / 2 + 0.12;
  cup.add(foot);

  const tex = new THREE.TextureLoader().load(texUrl, () => (loaded = true));
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
  tex.wrapS = THREE.RepeatWrapping;
  let loaded = false;

  // Tinta por fuera (nítida) y su "fantasma" visto a través del plástico por detrás
  const inkGeo = new THREE.CylinderGeometry(R_TOP * 1.002, R_BOT * 1.002, H * 0.94, SEG, 1, true);
  const inkFront = new THREE.Mesh(inkGeo, new THREE.MeshBasicMaterial({
    map: tex, color: 0xd6e6f5, transparent: true, alphaTest: 0.05, side: THREE.FrontSide, depthWrite: false,
  }));
  inkFront.renderOrder = 3;
  const inkBack = new THREE.Mesh(inkGeo, new THREE.MeshBasicMaterial({
    map: tex, transparent: true, opacity: 0.13, side: THREE.BackSide, depthWrite: false,
  }));
  inkBack.renderOrder = 0;
  cup.add(inkBack, inkFront);

  // --- Cerveza: líquido + espuma + chorro + burbujas. Se controla con setFill(0..1) ---
  const Y0 = -H / 2 + 0.07, LMAX = H * 0.9;
  const rAt = (y) => R_BOT + (R_TOP - R_BOT) * ((y + H / 2) / H);
  const beerMat = new THREE.MeshStandardMaterial({
    color: 0xf2a62a, roughness: 0.25, emissive: 0xd9780a, emissiveIntensity: 0.55,
  });
  const foamMat = new THREE.MeshStandardMaterial({ color: 0xfff6e4, roughness: 1, emissive: 0xfff1d6, emissiveIntensity: 0.35 });
  const beer = new THREE.Mesh(new THREE.BufferGeometry(), beerMat);
  const foam = new THREE.Mesh(new THREE.BufferGeometry(), foamMat);
  beer.renderOrder = -1; foam.renderOrder = -1;
  cup.add(beer, foam);

  const streamGeo = new THREE.CylinderGeometry(0.085, 0.1, 1, 20, 1, true);
  streamGeo.translate(0, 0.5, 0);
  const stream = new THREE.Mesh(streamGeo, new THREE.MeshPhysicalMaterial({
    color: 0xf2a62a, roughness: 0.15, transparent: true, opacity: 0, emissive: 0xd9780a, emissiveIntensity: 0.6,
  }));
  scene.add(stream); // en la escena (no en el vaso) para que caiga recto aunque el vaso gire

  const NB = 70, bubPos = new Float32Array(NB * 3), bubSeed = [];
  for (let i = 0; i < NB; i++) bubSeed.push([Math.random() * Math.PI * 2, Math.random(), 0.2 + Math.random() * 0.8]);
  const bubGeo = new THREE.BufferGeometry();
  bubGeo.setAttribute('position', new THREE.BufferAttribute(bubPos, 3));
  const bubbles = new THREE.Points(bubGeo, new THREE.PointsMaterial({ color: 0xfff4d6, size: 0.035, transparent: true, opacity: 0.8, depthWrite: false }));
  cup.add(bubbles);

  const fillState = { cur: 0, target: 0, built: -1, pour: 0 };
  const rebuild = (f) => {
    const h = Math.max(f * LMAX, 0.0001), yTop = Y0 + h;
    beer.geometry.dispose();
    beer.geometry = new THREE.CylinderGeometry(rAt(yTop) * 0.965, rAt(Y0) * 0.965, h, 96);
    beer.position.y = Y0 + h / 2;
    const fh = 0.06 + 0.22 * Math.min(1, f * 1.6);
    foam.geometry.dispose();
    foam.geometry = new THREE.CylinderGeometry(rAt(yTop + fh) * 0.965 + (f > 0.98 ? 0.06 : 0), rAt(yTop) * 0.965, fh, 96);
    foam.position.y = yTop + fh / 2;
    beer.visible = foam.visible = bubbles.visible = f > 0.003;
    fillState.built = f;
  };
  rebuild(0);

  cup.rotation.z = 0.0;
  const state = { rot: -Math.PI / 2, vel: reduced ? 0 : 0.35, drag: false, lastX: 0, tiltX: 0, tiltTarget: 0 };
  const AUTO = reduced ? 0 : 0.35;

  const el = renderer.domElement;
  const down = (e) => { state.drag = true; state.lastX = e.clientX; el.setPointerCapture?.(e.pointerId); };
  const move = (e) => {
    const r = el.getBoundingClientRect();
    state.tiltTarget = ((e.clientY - r.top) / r.height - 0.5) * 0.25;
    if (!state.drag) return;
    const dx = e.clientX - state.lastX;
    state.lastX = e.clientX;
    state.rot += dx * 0.012;
    state.vel = dx * 0.6;
  };
  const up = () => { state.drag = false; };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointermove', move);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  const leave = () => (state.tiltTarget = 0);
  el.addEventListener('pointerleave', leave);

  const resize = () => {
    const w = Math.max(1, container.clientWidth), h = Math.max(1, container.clientHeight);
    renderer.setSize(w, h, false);
    el.style.width = '100%'; el.style.height = '100%';
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting));
  io.observe(container);

  const clock = { elapsedTime: 0 };
  let destroyed = false;
  const tick = ({ delta }) => {
    const dt = Math.min(delta / 1000, 0.05);
    if (!visible || destroyed) return;
    clock.elapsedTime += dt;
    if (!state.drag) {
      state.vel += (AUTO - state.vel) * Math.min(1, dt * 2.2); // inercia que vuelve al giro automático
      state.rot += state.vel * dt;
    }
    state.tiltX += (state.tiltTarget - state.tiltX) * Math.min(1, dt * 5);
    cup.rotation.y = state.rot;
    cup.rotation.x = state.tiltX;
    if (!reduced) cup.position.y = Math.sin(clock.elapsedTime * 1.1) * 0.05;

    const prev = fillState.cur;
    fillState.cur += (fillState.target - fillState.cur) * (reduced ? 1 : Math.min(1, dt * 4));
    if (Math.abs(fillState.cur - fillState.built) > 0.002) rebuild(fillState.cur);
    const pouring = fillState.target > fillState.cur + 0.004 || fillState.cur - prev > 0.0005;
    fillState.pour += ((pouring && !reduced ? 1 : 0) - fillState.pour) * Math.min(1, dt * 8);
    const surf = cup.position.y + Y0 + fillState.cur * LMAX + 0.05;
    stream.position.set(0, surf, 0);
    stream.scale.set(fillState.pour, 12 - surf, fillState.pour);
    stream.material.opacity = 0.9 * fillState.pour;
    stream.visible = fillState.pour > 0.02;
    if (bubbles.visible) {
      const t = clock.elapsedTime, top = fillState.cur * LMAX;
      for (let i = 0; i < NB; i++) {
        const [a, o, s] = bubSeed[i];
        const y = ((o + t * 0.12 * s) % 1) * top;
        const r = rAt(Y0 + y) * 0.8 * (0.3 + 0.7 * ((i * 37) % 10) / 10);
        bubPos[i * 3] = Math.cos(a) * r; bubPos[i * 3 + 1] = Y0 + y; bubPos[i * 3 + 2] = Math.sin(a) * r;
      }
      bubGeo.attributes.position.needsUpdate = true;
    }
    renderer.render(scene, camera);
  };
  frame.update(tick, true);

  return {
    setRotation: (r) => (state.rot = r),
    // 0 = vacío, 1 = lleno hasta arriba con espuma rebosando. Pensado para ligarlo al progreso del scroll.
    setFill: (v) => (fillState.target = Math.max(0, Math.min(1, v))),
    destroy() {
      destroyed = true; cancelFrame(tick); ro.disconnect(); io.disconnect();
      el.removeEventListener('pointerdown', down); el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up); el.removeEventListener('pointercancel', up); el.removeEventListener('pointerleave', leave);
      scene.traverse((o) => { o.geometry?.dispose(); o.material?.dispose?.(); });
      tex.dispose(); renderer.dispose(); pmrem.dispose(); el.remove();
    },
  };
}
