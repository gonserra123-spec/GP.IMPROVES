import { useMemo, useState } from 'react';
import { Btn, Plate, StateChip, UndoBar, Wordmark } from '../components.jsx';
import { applyQueue, logout, setEta, tap, useStore } from '../lib/store.js';
import NewVisit from './NewVisit.jsx';
import { Mail, Settings, Summary } from './Owner.jsx';

const hhmm = (iso) => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
const ETA = [['today', 'Hoy'], ['tomorrow', 'Mañana'], ['plus2', '+2 días']];
const etaLabel = (iso) => {
  if (!iso) return null;
  const d = Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00`)) / 86_400_000);
  return d <= 0 ? 'hoy' : d === 1 ? 'mañana' : new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
};
const etaChoice = (iso) => { const d = Math.round((Date.parse(`${iso}T12:00:00`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T12:00:00`)) / 86_400_000); return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : d === 2 ? 'plus2' : null; };

// Qué pasó con el aviso de este coche, en una línea.
function MailLine({ v }) {
  if (v.pending) return <p className="mailline"><span className="pending">Sin enviar</span> Se enviará en cuanto haya conexión.</p>;
  if (v.mailProblem) return <p className="mailline" data-bad="true">⚠ El correo no llegó. Llama al cliente.</p>;
  const m = { pending: 'Aviso en camino…', sent: '✓ Cliente avisado', skipped_unsub: 'El cliente no quiere avisos por correo', skipped_dup: '✓ Cliente avisado' }[v.mail];
  return m ? <p className="mailline">{m}</p> : null;
}

function Car({ v }) {
  const done = v.state === 'finished';
  const prog = v.state === 'in_progress';
  const sub = [[v.make, v.model].filter(Boolean).join(' '), v.email, `Entró a las ${hhmm(v.receivedAt)}`].filter(Boolean);
  return (
    <li className="car" data-state={v.state}>
      <div className="car-top">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {v.photo && !v.pending && <img className="car-thumb" src={`/api/visits/${v.id}/photo`} alt="" />}
          <Plate value={v.plate} />
        </div>
        <StateChip state={v.state} />
      </div>
      <p className="car-sub">{sub.map((s) => <span key={s}>{s}</span>)}</p>
      {!done && (
        <div className="eta" role="group" aria-label="Entrega prevista">
          <span className="hint">Entrega:</span>
          {ETA.map(([k, l]) => <button key={k} type="button" className="eta-chip" aria-pressed={v.eta ? etaChoice(v.eta) === k : false} onClick={() => setEta(v, k)}>{l}</button>)}
          {v.eta && !ETA.some(([k]) => etaChoice(v.eta) === k) && <span className="hint">{etaLabel(v.eta)}</span>}
        </div>
      )}
      <div className="acts">
        <button type="button" className="act" data-next={!prog && !done} data-done={prog || done} disabled={prog || done} onClick={() => tap(v, 'in_progress')}>
          {prog || done ? '✓ En curso' : 'En curso'}
        </button>
        <button type="button" className="act" data-next={prog} data-done={done} disabled={done} onClick={() => tap(v, 'finished')}>
          {done ? '✓ Finalizado' : 'Finalizado'}
        </button>
      </div>
      <MailLine v={v} />
    </li>
  );
}

function Today() {
  const { server, queue, loaded } = useStore();
  const [adding, setAdding] = useState(false);
  const [showDone, setShowDone] = useState(false);
  const list = useMemo(() => applyQueue(server, queue), [server, queue]);
  const open = list.filter((v) => v.state !== 'finished');
  const done = list.filter((v) => v.state === 'finished');
  if (adding) return <NewVisit onClose={() => setAdding(false)} />;
  return (
    <div className="page">
      <Btn variant="block" className="btn--xl" onClick={() => setAdding(true)} style={{ minHeight: 68, fontSize: '1.25rem' }}>+ Nuevo coche</Btn>
      {loaded && !open.length && <p className="empty">No hay coches en el taller. Pulsa «Nuevo coche» cuando entre el primero.</p>}
      <ul className="cars" aria-label="Coches en el taller">{open.map((v) => <Car key={v.id} v={v} />)}</ul>
      {done.length > 0 && (
        <>
          <button type="button" className="more" onClick={() => setShowDone((s) => !s)} aria-expanded={showDone}>{showDone ? 'Ocultar' : 'Ver'} finalizados hoy ({done.length})</button>
          {showDone && <ul className="cars">{done.map((v) => <Car key={v.id} v={v} />)}</ul>}
        </>
      )}
    </div>
  );
}

export default function Work() {
  const { role, workshop, online, queue } = useStore();
  const owner = role === 'owner';
  const [tab, setTab] = useState('today');
  const offline = !online || queue.length > 0;
  return (
    <div className="app">
      <header className="bar">
        <Wordmark />
        <span className="who"><strong>{workshop?.name}</strong>{owner ? ' · Dueño' : ' · Mecánico'}</span>
        <span className="grow" />
        <span className="net" data-off={offline} role="status">{!online ? `Sin conexión${queue.length ? ` · ${queue.length} pendientes` : ''}` : queue.length ? `Enviando ${queue.length}…` : 'Conectado'}</span>
        <Btn variant="ghost sm" onClick={logout}>Salir</Btn>
      </header>
      {owner && (
        <nav className="tabs" role="tablist" aria-label="Secciones">
          {[['today', 'Hoy'], ['mail', 'Envíos'], ['summary', 'Resumen'], ['settings', 'Ajustes']].map(([k, l]) => <button key={k} type="button" role="tab" className="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{l}</button>)}
        </nav>
      )}
      <main>
        {tab === 'today' && <Today />}
        {owner && tab === 'mail' && <Mail />}
        {owner && tab === 'summary' && <Summary />}
        {owner && tab === 'settings' && <Settings />}
      </main>
      <UndoBar />
    </div>
  );
}
