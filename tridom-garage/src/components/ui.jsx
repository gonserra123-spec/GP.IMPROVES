import { Component, lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { createSpring, SPRINGS } from '../lib/spring.js';
import { useTick, useViewport, reducedMotion } from '../lib/hooks.js';
import { useT } from '../i18n/index.jsx';
import { useScene } from '../scene/store.js';
import { formatPlate } from '../../shared/plates.js';

export function navigate(to) {
  window.history.pushState({}, '', to);
  window.dispatchEvent(new PopStateEvent('popstate'));
  window.scrollTo(0, 0);
}

export function Link({ to, children, ...rest }) {
  const onClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || to.startsWith('#')) return;
    e.preventDefault(); navigate(to);
  };
  return <a href={to} onClick={onClick} {...rest}>{children}</a>;
}

// El flood nace donde entra el puntero.
const flood = (e) => {
  const r = e.currentTarget.getBoundingClientRect();
  e.currentTarget.style.setProperty('--fx', `${e.clientX - r.left}px`);
  e.currentTarget.style.setProperty('--fy', `${e.clientY - r.top}px`);
};
export function Btn({ to, variant = '', className = '', children, ...rest }) {
  const cls = `btn ${variant ? variant.split(' ').map((v) => `btn--${v}`).join(' ') : ''} ${className}`;
  if (to) return <Link to={to} className={cls} onPointerEnter={flood} {...rest}>{children}</Link>;
  return <button type="button" className={cls} onPointerEnter={flood} {...rest}>{children}</button>;
}

// Titular con máscara por línea; cada línea sube con un muelle cuando entra en pantalla.
export function Reveal({ as: Tag = 'h2', lines, className = '', delay = 90, ...rest }) {
  const ref = useRef(null);
  const st = useRef({ springs: null, started: false, t0: 0 });
  const list = Array.isArray(lines) ? lines : [lines];
  if (!st.current.springs || st.current.springs.length !== list.length) st.current.springs = list.map(() => createSpring(reducedMotion ? 0 : 1, SPRINGS.reveal));
  useViewport(ref, ({ inView }) => { if (inView && !st.current.started) { st.current.started = true; st.current.t0 = performance.now(); } }, !reducedMotion);
  useTick((s) => {
    const el = ref.current; const c = st.current;
    if (!el || !c.started) return;
    const spans = el.querySelectorAll('.rv-line > span');
    c.springs.forEach((sp, i) => {
      if (s.time - c.t0 >= i * delay) sp.set(0);
      if (sp.step(s.dt) && spans[i]) spans[i].style.transform = `translateY(${(sp.value * 105).toFixed(2)}%)`;
    });
  }, 'write', !reducedMotion);
  return (
    <Tag ref={ref} className={className} {...rest}>
      {list.map((l, i) => <span className="rv-line" key={i}><span style={reducedMotion ? undefined : { transform: 'translateY(105%)' }}>{l}</span></span>)}
    </Tag>
  );
}

export function Field({ label, hint, error, optional, children, id: given }) {
  const { t } = useT();
  const auto = useId(); const id = given || auto;
  const describe = [hint && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  return (
    <div className="field">
      <label htmlFor={id}>{label}{optional && <span className="opt"> ({t('common.optional')})</span>}</label>
      {children({ id, 'aria-describedby': describe, 'aria-invalid': error ? 'true' : undefined })}
      {hint && !error && <p className="hint" id={`${id}-h`}>{hint}</p>}
      {error && <p className="err" id={`${id}-e`} role="alert">{t(`errors.${error}`)}</p>}
    </div>
  );
}

export const StateChip = ({ state }) => { const { t } = useT(); return <span className="chip" data-state={state}>{t(`states.${state}`)}</span>; };
export const Plate = ({ value }) => <span className="plate">{formatPlate(value)}</span>;

// Equivalente textual de la escena y vista de reserva si WebGL no está disponible.
export function SceneList({ vehicles, onSelect, selectedId }) {
  const { t } = useT();
  if (!vehicles.length) return <p className="empty">{t('scene.empty')}</p>;
  return (
    <ul className="scene-list">
      {vehicles.map((v) => (
        <li key={v.id} aria-current={selectedId === v.id ? 'true' : undefined}>
          {v.plate && <Plate value={v.plate} />}
          <span>{v.make} {v.model}</span>
          <StateChip state={v.state} />
          <span className="where">{t(`locations.${v.location || 'none'}`)}</span>
          {onSelect && <button type="button" className="btn btn--ghost btn--sm" onClick={() => onSelect(v.id)}>{t('panel.detail.state')}</button>}
        </li>
      ))}
    </ul>
  );
}

const LazyScene = lazy(() => import('../scene/GarageScene.jsx'));

class SceneBoundary extends Component {
  constructor(p) { super(p); this.state = { failed: false }; }
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() { useScene.getState().setFallback(true); }
  render() { return this.state.failed ? null : this.props.children; }
}

// Carga diferida de la escena (three va en su propio chunk) con barra de carga y caída a la vista en lista.
export function SceneHost({ listVehicles, onSelect, selectedId, ...props }) {
  const { t } = useT();
  const fallback = useScene((s) => s.fallback);
  const ready = useScene((s) => s.ready);
  const [gl, setGl] = useState(true);
  useEffect(() => {
    try { const c = document.createElement('canvas'); if (!(c.getContext('webgl2') || c.getContext('webgl'))) { setGl(false); useScene.getState().setFallback(true); } } catch { setGl(false); useScene.getState().setFallback(true); }
  }, []);
  if (fallback || !gl) {
    return (
      <div className="scene-fallback" style={{ padding: 16, display: 'grid', gap: 12 }}>
        <h2 className="sign" style={{ fontSize: '1.5rem', color: 'var(--blue-900)' }}>{t('scene.fallbackTitle')}</h2>
        <p className="hint">{t('scene.fallbackNote')}</p>
        <SceneList vehicles={listVehicles || []} onSelect={onSelect} selectedId={selectedId} />
        {gl && <Btn variant="ghost sm" onClick={() => useScene.getState().setFallback(false)}>{t('scene.show3d')}</Btn>}
      </div>
    );
  }
  const loading = <div className="scene-loading" role="status"><span>{t('scene.loading')}</span><progress aria-label={t('scene.loading')} /></div>;
  return (
    <SceneBoundary>
      <Suspense fallback={loading}>
        <LazyScene onSelect={onSelect} {...props} />
        {!ready && loading}
      </Suspense>
    </SceneBoundary>
  );
}

export function Wordmark({ to = '/' }) {
  return <Link to={to} className="wordmark" aria-label="Tridom Automotive">Tridom <b>Automotive</b></Link>;
}
