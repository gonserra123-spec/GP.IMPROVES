// Datos públicos del taller que se muestran en su web (/). Es el único sitio que hay que tocar para
// poner los datos reales. Todo lo que vale null (o lista vacía) aún no lo ha dado el taller y se pinta
// como FALTA: no se inventa nada (ni teléfonos, ni precios, ni reseñas, ni fotos).
export const TALLER = {
  name: 'Tridom Garage',
  // Código del taller en el sistema de seguimiento. Es público: es el mismo que va en los QR del albarán.
  code: String(import.meta.env.VITE_PUBLIC_WORKSHOP || 'DEMO01').toUpperCase(),
  brandColor: '#2C3E57',

  // ---- Contacto ----
  phone: '+34 608 62 06 30',
  whatsapp: '34608620630', // solo cifras, con prefijo
  email: 'alsulo2912@gmail.com',
  address: 'Calle de Isabel la Católica, 13, 46004 València',
  city: 'Valencia',
  parking: null, // FALTA. Opcional: 'Aparcamiento para clientes en la puerta'

  // ---- Horario ----
  // Franjas por día (0 = domingo … 6 = sábado). Es un horario de ejemplo hasta que el taller dé el suyo:
  // mientras hoursAreExample sea true se marca como ejemplo y no se dice «Abierto ahora».
  hoursAreExample: false,
  week: {
    1: [['08:00', '13:30'], ['15:00', '19:00']],
    2: [['08:00', '13:30'], ['15:00', '19:00']],
    3: [['08:00', '13:30'], ['15:00', '19:00']],
    4: [['08:00', '13:30'], ['15:00', '19:00']],
    5: [['08:00', '13:30'], ['15:00', '19:00']],
    6: [['09:00', '13:00']],
    0: [],
  },
  holidaysNote: null, // FALTA. Opcional: 'Cerrado en festivos y la segunda quincena de agosto'

  // ---- Servicios y precios orientativos ----
  // from: precio «desde» en euros (IVA incluido) o null si el taller aún no lo ha dado.
  // per: 'hour' | 'wheel' | 'piece' si el precio es por unidad. free: true si no se cobra.
  // Precios orientativos del sector en España (2026), a revisar por el taller.
  services: [
    { id: 'mot', from: 25 },
    { id: 'oil', from: 89 },
    { id: 'brakes', from: 85 },
    { id: 'diagnosis', free: true },
    { id: 'tyres', from: 15, per: 'wheel' },
    { id: 'bodywork', from: 150, per: 'piece' },
    { id: 'aircon', from: 59 },
    { id: 'service', from: 129 },
    { id: 'electrics', from: 95 },
    { id: 'mechanics', from: 40, per: 'hour' },
  ],

  // ---- Presupuesto y pago ----
  freeQuote: true,
  diagnosisFee: 0, // 0 = gratis
  payments: ['cash', 'card', 'bizum', 'transfer', 'financing'],

  // ---- Reseñas de Google (copiadas tal cual del perfil del taller) ----
  reviews: {
    rating: null, // FALTA. Nota media de Google, p. ej. 4.8
    count: null, // FALTA. Número total de reseñas
    url: null, // FALTA. Enlace al perfil de Google del taller
    items: [], // FALTA. { author: 'Nombre', rating: 5, date: '2026-10-02', text: 'Texto literal' }
  },

  // ---- Fotos (ficheros en public/taller/, en webp o jpg) ----
  // Fotos de archivo de Unsplash (licencia Unsplash) hasta tener las del taller: ver docs/assets-licenses.md.
  photosAreStock: true,
  photos: [
    { src: '/taller/zona-trabajo.jpg', alt: { es: 'Mecánico revisando el motor de un coche con el capó abierto', en: 'Mechanic checking a car engine with the bonnet open' } },
    { src: '/taller/equipo.jpg', alt: { es: 'Dos mecánicos trabajando bajo un coche en el elevador', en: 'Two mechanics working under a car on the lift' } },
    { src: '/taller/mecanico.jpg', alt: { es: 'Mecánico revisando los bajos de un coche', en: 'Mechanic inspecting the underside of a car' } },
    { src: '/taller/herramientas.jpg', alt: { es: 'Caja de llaves de taller', en: 'Box of workshop spanners' } },
  ],

  // ---- Marcas y especialidades ----
  allBrands: true,
  brands: [], // FALTA. Marcas en las que está especializado, p. ej. ['Seat', 'Volkswagen']
  specialties: ['diesel', 'hybrid', 'vans', 'fleets'], // ids: diesel, hybrid, electric, fleets, classic, vans

  // ---- Quiénes somos ----
  about: {
    // Texto de ejemplo para la demo: sustituir por la historia real del taller.
    since: 2009,
    family: true,
    team: 5,
    certifications: [], // FALTA. Textos literales: 'Taller autorizado n.º …', 'Red …'
    text: {
      es: 'Abrimos en 2009 como un taller familiar y seguimos igual: pocas manos, mucho oficio y trato directo. Te explicamos qué tiene tu coche con palabras claras y no tocamos nada sin que lo apruebes.',
      en: 'We opened in 2009 as a family workshop and we still are: a small team, plenty of experience and straight talk. We explain what your car needs in plain words and touch nothing until you approve it.',
    },
  },
};

export const isDemoWorkshop = TALLER.code === 'DEMO01';

// La matrícula pasa de la web a la consulta por sessionStorage, no por la URL,
// para que no quede en historiales, registros del servidor ni cabeceras Referer.
export const PLATE_HANDOFF = 'tg.consulta.plate';

export const telHref = (phone) => `tel:${String(phone).replace(/[^\d+]/g, '')}`;
export const waHref = (n) => `https://wa.me/${String(n).replace(/\D/g, '')}`;
export const mapsLink = (address) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
export const mapsEmbed = (address) => `https://www.google.com/maps?q=${encodeURIComponent(address)}&output=embed`;

// Hora actual en el taller (Europe/Madrid), venga de donde venga el visitante.
function madridNow(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Madrid', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now).map((p) => [p.type, p.value]));
  const day = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(parts.weekday);
  return { day, min: Number(parts.hour) * 60 + Number(parts.minute) };
}
const toMin = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };

// { open: bool, until?: 'HH:MM', next?: { day, at: 'HH:MM' } } o null si el horario es de ejemplo.
export function openState(week = TALLER.week, now) {
  if (TALLER.hoursAreExample) return null;
  const { day, min } = madridNow(now);
  for (const [a, b] of week[day] || []) if (min >= toMin(a) && min < toMin(b)) return { open: true, until: b, day };
  for (let i = 0; i < 7; i += 1) {
    const d = (day + i) % 7;
    const slot = (week[d] || []).find(([a]) => i > 0 || toMin(a) > min);
    if (slot) return { open: false, next: { day: d, at: slot[0], today: i === 0, tomorrow: i === 1 }, day };
  }
  return { open: false, day };
}

export const todayIndex = (now) => madridNow(now).day;
