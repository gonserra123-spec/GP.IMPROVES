// Ilustraciones animadas del estado del coche para la página del cliente: SVG y CSS, sin imágenes ni librerías.
// Mismo estilo «plano técnico de taller» que el resto: trazo azul oscuro, fondo claro, sin sombras ni degradados.
const INK = 'var(--blue-900)';
const BLUE = 'var(--blue-500)';
const AMBER = '#f5a524';

// Coche de lado. (x, y) es su esquina superior izquierda; las ruedas llegan a y + 72.
function Car({ x, y, lights = false }) {
  return (
    <g transform={`translate(${x} ${y})`}>
      <path d="M4 36 L4 52 Q4 58 10 58 L190 58 Q196 58 196 52 L196 40 Q196 34 188 32 L166 28 L150 10 Q146 4 138 4 L66 4 Q58 4 54 10 L36 28 L12 32 Q4 34 4 36 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M70 10 L134 10 L148 28 L52 28 Z" fill="var(--blue-100)" stroke={INK} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M101 10 L101 28 M100 31 L100 54" stroke={INK} strokeWidth="1.5" />
      <rect x="186" y="36" width="9" height="6" rx="1.5" fill={lights ? AMBER : '#fff'} stroke={INK} strokeWidth="1.2" />
      <rect x="5" y="36" width="8" height="6" rx="1.5" fill="#d64545" stroke={INK} strokeWidth="1.2" />
      {[46, 154].map((cx) => <g key={cx}><circle cx={cx} cy="58" r="14" fill={INK} /><circle cx={cx} cy="58" r="6" fill="#fff" /></g>)}
    </g>
  );
}

// Pared con cuadrícula de plano y suelo del taller (línea del suelo en y = 190).
function Backdrop({ tint }) {
  const v = Array.from({ length: 9 }, (_, i) => `M${(i + 1) * 40} 0V190`).join('');
  const h = Array.from({ length: 4 }, (_, i) => `M0 ${(i + 1) * 40}H400`).join('');
  return (
    <>
      <rect width="400" height="230" fill={tint} />
      <path d={v + h} stroke="var(--grid)" strokeWidth="1" opacity="0.8" />
      <rect y="190" width="400" height="40" fill="#fff" />
      <path d="M0 190H400" stroke={INK} strokeWidth="2" />
    </>
  );
}

// Mecánico de frente, con el centro en x = 335 y los pies en el suelo. Los brazos los pone cada escena.
function Mechanic({ children }) {
  return (
    <g>
      <rect x="326" y="168" width="8" height="22" fill={INK} />
      <rect x="336" y="168" width="8" height="22" fill={INK} />
      <rect x="322" y="187" width="13" height="4" rx="2" fill={INK} />
      <rect x="335" y="187" width="13" height="4" rx="2" fill={INK} />
      <rect x="324" y="134" width="22" height="36" rx="5" fill={BLUE} stroke={INK} strokeWidth="2" />
      {children}
      <circle cx="335" cy="123" r="11" fill="#fff" stroke={INK} strokeWidth="2" />
      <path d="M324 120 A11 11 0 0 1 346 120 Z" fill={AMBER} stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <path d="M321 120 H349" stroke={INK} strokeWidth="2" strokeLinecap="round" />
      <circle cx="331" cy="125" r="1.5" fill={INK} /><circle cx="339" cy="125" r="1.5" fill={INK} />
      <path d="M330 129 Q335 134 340 129" fill="none" stroke={INK} strokeWidth="1.6" strokeLinecap="round" />
    </g>
  );
}

const Arm = ({ d }) => <path d={d} fill="none" stroke={BLUE} strokeWidth="7" strokeLinecap="round" />;
const Hand = ({ x, y }) => <circle cx={x} cy={y} r="4.5" fill="#fff" stroke={INK} strokeWidth="1.8" />;
const Spark = ({ x, y, s = 7, delay = 0 }) => (
  <path className="spark" style={{ '--x': `${x}px`, '--y': `${y}px`, animationDelay: `${delay}s` }}
    d={`M0 ${-s} Q0 0 ${s} 0 Q0 0 0 ${s} Q0 0 ${-s} 0 Q0 0 0 ${-s} Z`} fill={AMBER} stroke={INK} strokeWidth="1" strokeLinejoin="round" />
);

// 1 · Recibido: el coche aparcado, a salvo, con el reloj corriendo y tres puntos de «esperando turno».
function Waiting() {
  return (
    <>
      <Backdrop tint="var(--blue-100)" />
      <path d="M84 197 V224 M316 197 V224" stroke={BLUE} strokeWidth="3" strokeDasharray="6 5" />
      <rect x="326" y="30" width="40" height="40" rx="6" fill={BLUE} stroke={INK} strokeWidth="2" />
      <text x="346" y="60" textAnchor="middle" fontSize="28" fontWeight="700" fill="#fff" fontFamily="var(--font-sign)">P</text>
      <g transform="translate(62 62)">
        <circle r="26" fill="#fff" stroke={INK} strokeWidth="2.5" />
        <path d="M0 -21V-17M21 0H17M0 21V17M-21 0H-17" stroke={INK} strokeWidth="2" strokeLinecap="round" />
        <path d="M0 0L-9 -8M0 0V-13" stroke={INK} strokeWidth="3" strokeLinecap="round" />
        <g className="sec"><path d="M0 5V-19" stroke="#d64545" strokeWidth="1.6" strokeLinecap="round" /></g>
        <circle r="2.6" fill={INK} />
      </g>
      <Car x={100} y={118} />
      <g>
        <path d="M188 82 L200 96 L212 82 Z" fill="#fff" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
        <rect x="160" y="46" width="80" height="38" rx="19" fill="#fff" stroke={INK} strokeWidth="2" />
        <path d="M189 83H211" stroke="#fff" strokeWidth="3" />
        {[182, 200, 218].map((cx, i) => <circle key={cx} className={`dot dot${i + 1}`} cx={cx} cy="65" r="4.5" fill={BLUE} />)}
      </g>
    </>
  );
}

// 2 · En curso: el coche sube al elevador y el mecánico trabaja en él con la llave.
function Working() {
  return (
    <>
      <Backdrop tint="var(--blue-100)" />
      <g transform="translate(62 62)">
        <g className="spin">
          <circle r="15" fill="none" stroke={INK} strokeWidth="7" strokeDasharray="5.9 5.9" />
          <circle r="11" fill="#fff" stroke={INK} strokeWidth="2.5" />
          <circle r="4" fill={INK} />
        </g>
      </g>
      <rect x="120" y="186" width="160" height="4" rx="1" fill={INK} />
      <g className="scissor"><path d="M130 186 L270 152 M270 186 L130 152" fill="none" stroke={INK} strokeWidth="5" strokeLinecap="round" vectorEffect="non-scaling-stroke" /></g>
      <g className="lift">
        <rect x="90" y="146" width="220" height="6" rx="2" fill={INK} />
        <Car x={100} y={74} lights />
      </g>
      <Mechanic>
        <g className="arm-work">
          <Arm d="M324 142 L306 124" />
          <g className="wrench">
            <path d="M293 126 H319" stroke={INK} strokeWidth="5" strokeLinecap="round" />
            <path d="M293 126 H319" stroke="#cfd8ea" strokeWidth="2.6" strokeLinecap="round" />
            <circle cx="292" cy="126" r="4.5" fill="none" stroke={INK} strokeWidth="2.2" />
          </g>
          <Hand x={306} y={124} />
        </g>
        <path d="M346 142 L354 160" fill="none" stroke={BLUE} strokeWidth="7" strokeLinecap="round" />
        <Hand x={354} y={161} />
      </Mechanic>
      <g stroke={AMBER} strokeWidth="2.5" strokeLinecap="round">
        <path className="flick" style={{ animationDelay: '3.1s' }} d="M284 116 L278 110" />
        <path className="flick" style={{ animationDelay: '3.4s' }} d="M282 122 L274 122" />
        <path className="flick" style={{ animationDelay: '3.7s' }} d="M284 128 L278 134" />
      </g>
    </>
  );
}

// 3 · Finalizado: coche reluciente, sello de «listo» y el mecánico satisfecho con el pulgar arriba.
function Done() {
  return (
    <>
      <Backdrop tint="#e9f7f1" />
      <g className="hop"><Car x={100} y={118} lights /></g>
      <Spark x={146} y={128} s={8} delay={0.2} />
      <Spark x={236} y={140} s={6} delay={1} />
      <Spark x={286} y={158} s={7} delay={1.6} />
      <Spark x={118} y={166} s={6} delay={0.7} />
      <g className="seal">
        <circle cx="200" cy="64" r="22" fill="var(--green)" stroke={INK} strokeWidth="2.5" />
        <path d="M189 64 L197 72 L212 56" fill="none" stroke="#fff" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
      </g>
      <Mechanic>
        <Arm d="M324 142 L313 160" />
        <g transform="translate(310 168) rotate(-20)"><circle r="3.5" fill="none" stroke={INK} strokeWidth="2" /><path d="M3 0H13M9 0V4M13 0V4" stroke={INK} strokeWidth="2" strokeLinecap="round" /></g>
        <Hand x={313} y={161} />
        <g className="arm-up">
          <Arm d="M346 142 L364 124" />
          <rect x="361" y="112" width="6" height="12" rx="3" fill="#fff" stroke={INK} strokeWidth="1.8" />
          <Hand x={364} y={125} />
        </g>
      </Mechanic>
    </>
  );
}

const SCENES = {
  received: { Scene: Waiting, label: 'Dibujo de tu coche aparcado dentro del taller, esperando turno.', caption: 'Tu coche está aparcado dentro del taller, a salvo y esperando turno.' },
  in_progress: { Scene: Working, label: 'Dibujo de tu coche subido al elevador con un mecánico trabajando en él.', caption: 'Un mecánico está trabajando en tu coche ahora mismo.' },
  finished: { Scene: Done, label: 'Dibujo de tu coche reluciente con el mecánico satisfecho.', caption: 'Revisado y listo. Tu coche te está esperando.' },
};

// La página lo pinta con key={estado}: al cambiar de estado, la animación empieza de nuevo.
export default function TrackScene({ state }) {
  const { Scene, label, caption } = SCENES[state] || SCENES.received;
  return (
    <figure className="scene" data-state={state}>
      <svg viewBox="0 0 400 230" role="img" aria-label={label}><Scene /></svg>
      <figcaption>{caption}</figcaption>
    </figure>
  );
}
