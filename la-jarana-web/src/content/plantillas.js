// Generador de respaldo (sin IA): fórmulas de comunicado mezcladas al azar según estilo y extensión.
// {T} = tema escrito por el usuario. Se usa si el Worker no está configurado, falla o limita.

export const ESTILOS = [
  { id: 'solemne', nombre: 'Solemne institucional' },
  { id: 'boe', nombre: 'Notarial tipo BOE' },
  { id: 'gamberro', nombre: 'Gamberro de peña' },
  { id: 'epico', nombre: 'Épico «Make Rubielos Great Again»' },
];
export const EXTENSIONES = [
  { id: 'corto', nombre: 'Corto', puntos: 2 },
  { id: 'medio', nombre: 'Medio', puntos: 4 },
  { id: 'largo', nombre: 'Largo', puntos: 6 },
];

const BANCO = {
  solemne: {
    titulo: ['Comunicado oficial sobre {T}', 'Disposición relativa a {T}', 'Nota institucional: {T}'],
    puntos: [
      'Que {T} queda declarado asunto de máximo interés para el pueblo de Rubielos de Mora.',
      'Que esta peña asume, con la responsabilidad que la caracteriza, la gestión de {T}.',
      'Que se insta a la ciudadanía a mantener la calma y a confiar en el criterio de La Jarana.',
      'Que cualquier duda sobre {T} será resuelta en el pajar, sede central de operaciones.',
      'Que la presente disposición entra en vigor en el momento de su lectura.',
      'Que el incumplimiento de lo aquí dispuesto será objeto de profunda decepción colectiva.',
      'Que La Jarana agradece de antemano la colaboración ciudadana, que da por hecha.',
      'Que se dará cuenta de los avances sobre {T} en los cauces oficiales: Instagram.',
    ],
  },
  boe: {
    titulo: ['Resolución por la que se regula {T}', 'Orden sobre {T}', 'Real Decreto Jaranero de {T}'],
    puntos: [
      'Primero. Se aprueba la regulación de {T} en todo el término municipal y alrededores.',
      'Segundo. Quedan derogadas cuantas disposiciones de igual o inferior rango se opongan a {T}.',
      'Tercero. Se faculta a La Jarana para dictar cuantas normas sean necesarias para su desarrollo.',
      'Cuarto. Lo dispuesto se aplicará con carácter retroactivo cuando así convenga a la peña.',
      'Quinto. Contra esta resolución no cabe recurso alguno, salvo invitar a una ronda.',
      'Sexto. La presente orden se publicará en el tablón oficial, es decir, en las stories.',
      'Séptimo. Se habilita el pajar como registro general a efectos de {T}.',
      'Octavo. Esta resolución entrará en vigor al día siguiente de su publicación, o antes.',
    ],
  },
  gamberro: {
    titulo: ['Lo de {T}, explicado', 'Aviso a navegantes: {T}', 'Sobre {T} (léelo entero)'],
    puntos: [
      'Que lo de {T} lo vamos a hacer nosotros, porque si no, no lo hace nadie.',
      'Que quien tenga dudas sobre {T} se pase por el pajar y se le resuelven.',
      'Que no hace falta que nos deis las gracias, pero se aceptan.',
      'Que {T} pasa a ser oficialmente cosa de La Jarana. Sin debate.',
      'Que el que se queje, que traiga hielo.',
      'Que esto se va a comentar en el pueblo durante semanas, y lo sabemos.',
      'Que si sale bien, ha sido idea nuestra. Si sale mal, también, pero no lo diremos.',
      'Que nos vemos donde siempre, a la hora de siempre, más o menos.',
    ],
  },
  epico: {
    titulo: ['Make {T} Great Again', 'La gran cruzada de {T}', '{T}: el momento es ahora'],
    puntos: [
      'Que la historia recordará este día como el día en que {T} volvió a ser grande.',
      'Que Rubielos no se rinde, y La Jarana menos.',
      'Que {T} será recordado de Gúdar a Javalambre, y un poco más allá.',
      'Que nunca antes un pueblo estuvo tan preparado para {T}.',
      'Que los ojos de toda la comarca están puestos en nosotros. Con razón.',
      'Que esta peña no promete: cumple. Y luego lo sube a Instagram.',
      'Que el pajar ha hablado, y el pajar nunca se equivoca.',
      'Que Make Rubielos Great Again no es un lema: es un plan.',
    ],
  },
};

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (arr) => arr.map((x) => [Math.random(), x]).sort((a, b) => a[0] - b[0]).map((x) => x[1]);

export function limpiaTema(t) {
  return String(t || '').replace(/[\u0000-\u001F\u007F<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 120);
}

export function generaLocal({ tema, estilo, extension }) {
  const T = limpiaTema(tema) || 'el asunto que nos ocupa';
  const b = BANCO[estilo] || BANCO.gamberro;
  const n = (EXTENSIONES.find((e) => e.id === extension) || EXTENSIONES[1]).puntos;
  const fill = (s) => s.replaceAll('{T}', T);
  // En estilo BOE los puntos van numerados (Primero, Segundo…): se respeta el orden.
  const puntos = estilo === 'boe' ? b.puntos.slice(0, n) : shuffle(b.puntos).slice(0, n);
  return { titulo: fill(pick(b.titulo)), puntos: puntos.map(fill), origen: 'plantillas' };
}
