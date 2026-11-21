import { useEffect, useRef, useState } from 'react';
import { mountVaso } from '../lib/vaso3d.js';

// Monta el vaso 3D real (textura del diseño 360°). Una sola animación es dueña de su rotación:
// el propio módulo (giro automático + arrastre con inercia). onReady recibe la instancia (setFill…).
export default function VasoCanvas({ label = 'Vaso oficial de La Jarana en 3D. Arrástralo para girarlo.', onReady }) {
  const host = useRef(null);
  const ready = useRef(onReady); ready.current = onReady;
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!host.current) return;
    let v;
    try { v = mountVaso(host.current, { texture: '/img/vaso-textura.webp' }); ready.current?.(v); } catch { setFailed(true); }
    return () => { ready.current?.(null); v?.destroy(); };
  }, []);
  if (failed) return <img className="vaso-fallback" src="/img/merch/vaso.webp" alt="Vaso oficial de La Jarana" />;
  return <div className="vaso" ref={host} role="img" aria-label={label} />;
}
