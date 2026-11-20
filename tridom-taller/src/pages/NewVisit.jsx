import { useEffect, useRef, useState } from 'react';
import { Btn, Field, Plate } from '../components.jsx';
import { ERR, get } from '../lib/api.js';
import { createVisit } from '../lib/store.js';
import { isEmail, maskEmail, normEmail, parseQuery } from '../../shared/rules.js';
import { normalizePlate } from '../../shared/plates.js';

const ETA = [['today', 'Hoy'], ['tomorrow', 'Mañana'], ['plus2', '+2 días']];

// Reduce la foto a ~1000 px y JPEG: pesa poco, sale en el correo y no llena la cola del dispositivo.
async function shrink(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = url; });
    const k = Math.min(1, 1000 / Math.max(img.width, img.height));
    const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}

// Alta con una sola cosa: matrícula o correo. Si el cliente ya está, se rellena todo; si no, pide solo lo que falta.
export default function NewVisit({ onClose }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState(null); // { kind, matches }
  const [pick, setPick] = useState(null); // coincidencia elegida
  const [extra, setExtra] = useState({ email: '', plate: '', model: '' });
  const [eta, setEta] = useState(null);
  const [photo, setPhoto] = useState(null);
  const [errors, setErrors] = useState({});
  const [change, setChange] = useState(false);
  const seq = useRef(0);

  const parsed = parseQuery(q);
  useEffect(() => {
    setPick(null); setFound(null); setChange(false);
    if (!['plate', 'email'].includes(parsed.kind)) return undefined;
    const n = ++seq.current;
    const t = setTimeout(async () => {
      try { const r = await get(`/lookup?q=${encodeURIComponent(q)}`); if (r.ok && n === seq.current) { setFound(r); if (r.matches.length === 1) setPick(r.matches[0]); } } catch { if (n === seq.current) setFound({ kind: parsed.kind, matches: [], offline: true }); }
    }, 250);
    return () => clearTimeout(t);
  }, [q]); // eslint-disable-line react-hooks/exhaustive-deps

  const kind = parsed.kind;
  const unknown = found && !found.matches.length;
  const needEmail = kind === 'plate' && unknown; // matrícula nueva: falta el correo
  const needPlate = kind === 'email' && unknown; // correo nuevo: falta la matrícula
  const askMulti = kind === 'email' && found?.matches.length > 1 && !pick;

  const submit = (e) => {
    e.preventDefault();
    const errs = {};
    let plate = pick?.plate; let email = null; const known = !!pick;
    if (known) { if (change && extra.email) { if (isEmail(normEmail(extra.email))) email = normEmail(extra.email); else errs.email = ERR.email_format; } }
    else if (needEmail) { plate = parsed.plate; if (!isEmail(normEmail(extra.email))) errs.email = extra.email ? ERR.email_format : ERR.required; else email = normEmail(extra.email); }
    else if (needPlate) { email = parsed.email; const p = parseQuery(extra.plate); if (p.kind !== 'plate') errs.plate = extra.plate ? ERR.plate_format : ERR.required; else plate = p.plate; }
    else errs.q = 'Escribe la matrícula o el correo del cliente.';
    setErrors(errs);
    if (Object.keys(errs).length) return;
    const [make, ...rest] = (pick ? '' : extra.model).split(' ');
    createVisit({ plate, email, known, make: pick ? undefined : make || undefined, model: pick ? undefined : rest.join(' ') || undefined, eta, photo });
    onClose();
  };
  const ready = pick || (needEmail && extra.email) || (needPlate && extra.plate);

  return (
    <form className="page" onSubmit={submit} noValidate>
      <div className="actions" style={{ justifyContent: 'space-between' }}>
        <h2 className="sign" style={{ fontSize: '1.75rem', color: 'var(--blue-900)' }}>Nuevo coche</h2>
        <Btn variant="ghost sm" onClick={onClose}>Cancelar</Btn>
      </div>
      <div className="card">
        <Field label="Matrícula o correo del cliente" error={errors.q} hint="Con una sola cosa basta: si el cliente ya vino, el resto se rellena solo.">
          {(a) => <input className="input input--big" autoFocus autoComplete="off" autoCapitalize="characters" spellCheck="false" value={q} onChange={(e) => setQ(e.target.value)} placeholder="1234 BCD  o  nombre@correo.com" {...a} />}
        </Field>
        {kind === 'plate_invalid' && <p className="hint">Sigue escribiendo la matrícula (4 cifras y 3 letras)…</p>}
        {kind === 'email_invalid' && <p className="hint">Sigue escribiendo el correo…</p>}

        {found?.matches.length > 0 && (
          <div className="found" role="group" aria-label="Clientes encontrados">
            <p className="notice notice--ok"><strong>{found.matches.length === 1 ? 'Cliente conocido' : 'Elige el coche'}</strong>: no hace falta escribir nada más.</p>
            {found.matches.map((m) => (
              <button key={m.plate} type="button" aria-pressed={pick?.plate === m.plate} onClick={() => setPick(m)}>
                <Plate value={m.plate} /><span>{[m.make, m.model].filter(Boolean).join(' ') || 'Coche sin modelo'}<br /><small className="hint">{m.email}</small></span>
              </button>
            ))}
          </div>
        )}
        {askMulti && <p className="hint">Ese correo tiene varios coches: toca el que ha entrado.</p>}

        {needEmail && (
          <>
            <p className="notice notice--warn">Es la primera vez que vemos {parsed.plate && <Plate value={parsed.plate} />}. Solo falta el correo.</p>
            <Field label="Correo del cliente" error={errors.email}>{(a) => <input className="input" type="email" inputMode="email" autoComplete="off" autoCapitalize="none" value={extra.email} onChange={(e) => setExtra({ ...extra, email: e.target.value })} {...a} />}</Field>
          </>
        )}
        {needPlate && (
          <>
            <p className="notice notice--warn">No tenemos ningún coche con ese correo. Solo falta la matrícula.</p>
            <Field label="Matrícula" error={errors.plate}>{(a) => <input className="input input--big" autoCapitalize="characters" autoComplete="off" spellCheck="false" value={extra.plate} onChange={(e) => setExtra({ ...extra, plate: e.target.value })} {...a} />}</Field>
          </>
        )}
        {(needEmail || needPlate) && <Field label="Marca y modelo (opcional)">{(a) => <input className="input" autoComplete="off" value={extra.model} onChange={(e) => setExtra({ ...extra, model: e.target.value })} placeholder="Seat Ibiza" {...a} />}</Field>}
        {pick && !change && <button type="button" className="hint" style={{ background: 'none', border: 0, textAlign: 'left', textDecoration: 'underline', minHeight: 44 }} onClick={() => setChange(true)}>El correo ha cambiado</button>}
        {pick && change && <Field label="Nuevo correo del cliente" error={errors.email}>{(a) => <input className="input" type="email" inputMode="email" autoCapitalize="none" value={extra.email} onChange={(e) => setExtra({ ...extra, email: e.target.value })} {...a} />}</Field>}
      </div>

      {(pick || needEmail || needPlate) && (
        <div className="card">
          <div className="eta" role="group" aria-label="Entrega prevista"><span className="hint">Entrega prevista (opcional):</span>
            {ETA.map(([k, l]) => <button key={k} type="button" className="eta-chip" aria-pressed={eta === k} onClick={() => setEta(eta === k ? null : k)}>{l}</button>)}
          </div>
          <label className="photo-pick">
            <span className="btn btn--ghost btn--sm">{photo ? 'Cambiar foto' : 'Foto del coche (opcional)'}</span>
            <input type="file" accept="image/*" capture="environment" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { try { setPhoto(await shrink(f)); } catch { setPhoto(null); } } }} />
            {photo && <img className="car-thumb" src={photo} alt="Foto del coche" />}
          </label>
          <p className="hint">La foto va en el primer correo y protege al taller si luego hay una reclamación.</p>
        </div>
      )}
      <Btn variant="block" type="submit" disabled={!ready} style={{ minHeight: 68, fontSize: '1.25rem' }}>Dar de alta y avisar al cliente</Btn>
      {pick && <p className="hint">Se enviará «Tu coche ya está en el taller» a {pick.email} (puedes deshacerlo 10 segundos).</p>}
    </form>
  );
}
