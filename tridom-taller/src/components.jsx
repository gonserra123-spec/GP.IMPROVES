import { useEffect, useId, useState } from 'react';
import { formatPlate } from '../shared/plates.js';
import { STATE_LABEL } from '../shared/rules.js';
import { clearToast, dismissUndo, undoLast, useStore } from './lib/store.js';

export const Wordmark = () => <a href="/" className="wordmark" aria-label="Tridom Automotive">Tridom <b>Automotive</b></a>;
export const Plate = ({ value, className = '' }) => <span className={`plate ${className}`}>{formatPlate(value)}</span>;
export const StateChip = ({ state }) => <span className="chip" data-state={state}>{STATE_LABEL[state]}</span>;

export function Btn({ variant = '', className = '', children, ...rest }) {
  const cls = `btn ${variant.split(' ').filter(Boolean).map((v) => `btn--${v}`).join(' ')} ${className}`;
  return <button type="button" className={cls} {...rest}>{children}</button>;
}

export function Field({ label, error, hint, children }) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {children({ id, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': error ? `${id}-e` : undefined })}
      {hint && !error && <p className="hint">{hint}</p>}
      {error && <p className="err" id={`${id}-e`} role="alert">{error}</p>}
    </div>
  );
}

// Barra inferior con cuenta atrás: el toque se puede deshacer mientras el correo aún no ha salido.
export function UndoBar() {
  const { undo, toast, undoSeconds } = useStore();
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!undo) return undefined;
    const t = setInterval(() => { setNow(Date.now()); if (Date.now() >= undo.until) dismissUndo(); }, 100);
    return () => clearInterval(t);
  }, [undo]);
  if (undo) {
    const left = Math.max(0, undo.until - now);
    const total = undo.kind === 'error' ? 5000 : undoSeconds * 1000;
    return (
      <div className="undo" data-kind={undo.kind} role="status" aria-live="polite">
        <span>{undo.kind === 'error' ? undo.label : <><b>{undo.label}</b>{undo.plate ? ` · ${formatPlate(undo.plate)}` : ''}</>}</span>
        {undo.kind !== 'error' && <button type="button" onClick={undoLast}>Deshacer · {Math.ceil(left / 1000)}</button>}
        <i className="bar-time" style={{ width: '100%', transform: `scaleX(${Math.min(1, left / total)})` }} />
      </div>
    );
  }
  if (toast) {
    return (
      <div className="undo" data-kind={toast.kind === 'error' ? 'error' : 'ok'} role="status" aria-live="polite">
        <span>{toast.text}</span>
        <button type="button" onClick={clearToast}>Vale</button>
      </div>
    );
  }
  return null;
}
