import { TICKETS_URL } from '../content/data.js';
import { useTr } from '../lib/store.js';

// Único punto de salida hacia la compra de entradas: la web no vende. Mientras no esté
// confirmada la URL de Grupo Salamandra (TICKETS_URL en data.js) el enlace queda desactivado.
export default function TicketLink({ className = '', children }) {
  const tr = useTr();
  const ready = Boolean(TICKETS_URL);
  return (
    <a
      className={className}
      href={ready ? TICKETS_URL : undefined}
      target={ready ? '_blank' : undefined}
      rel="noopener noreferrer"
      aria-disabled={ready ? undefined : true}
      title={ready ? undefined : tr('Enlace de Grupo Salamandra pendiente de confirmar', 'Grupo Salamandra link pending confirmation')}
    >
      {children}
    </a>
  );
}
