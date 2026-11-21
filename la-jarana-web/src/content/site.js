// Datos reales aportados. Lo que falta se deja vacío a propósito (cero datos inventados).
export const SITE = {
  nombre: 'La Jarana',
  lugar: 'Rubielos de Mora (Teruel)',
  eslogan: 'Make Rubielos Great Again',
  instagram: '@_lajarana',
  instagramUrl: 'https://www.instagram.com/_lajarana/',
  fundacion: '', // [FALTA] año de fundación
};

export const HERO = {
  kicker: 'Comunicado oficial · Rubielos de Mora (Teruel)',
  lead: 'La mejor peña de Rubielos. Lo decimos nosotros, que somos los que más sabemos del tema.',
};

export const MARQUEE = ['Make Rubielos Great Again', 'La Jarana', 'CEO of Gúdar-Javalambre', 'Rubielos de Mora', 'Los mejores, y lo sabemos', 'Sede central: el pajar'];

export const HISTORIA = [
  'Todo empezó cuando un grupo de chicos y un grupo de chicas de Rubielos decidieron juntar fuerzas y hacer planes juntos.',
  'El pueblo no estaba preparado.',
  'Con los años conseguimos un pajar, hoy sede central de operaciones.',
  'Desde ahí llevamos la marca a cada rincón: memes, merchandising y pegatinas.',
  'Todo en nuestro incansable afán de hacer Rubielos grande otra vez.',
];

export const GALERIA = [
  { id: 'tardeos', titulo: 'Tardeos', txt: 'Empiezan a media tarde. Cuándo acaban, ya es otro tema.' },
  { id: 'fiestas', titulo: 'Fiestas patronales', txt: 'Nuestra especialidad. Venimos entrenados todo el año.' },
  { id: 'pajar', titulo: 'El Pajar', txt: 'Sede central de operaciones. Acceso restringido.' },
  { id: 'merch', titulo: 'Merchandising en acción', txt: 'La marca, puesta. Así es como se lleva.' },
];

// img: null → placeholder [FALTA IMAGEN]. tipo 'vaso3d' abre el vaso interactivo.
export const MERCH = [
  { id: 'vaso', nombre: 'El vaso', txt: 'El vaso oficial: bono de piscina, toro del Carmen, carnet de la Comisión y agenda del verano. Ábrelo y gíralo.', img: '/img/merch/vaso.webp', alt: 'Vaso translúcido de La Jarana con el diseño 360° en cian', tipo: 'vaso3d', destacado: true },
  { id: 'sudadera', nombre: 'Sudadera', txt: 'Azul cielo y el logo a la espalda, para que se lea bien desde lejos.', img: null },
  { id: 'peto', nombre: 'Peto', txt: 'Con tu mote, por si alguien en el pueblo todavía no lo sabe.', img: null },
  { id: 'bandera', nombre: 'Bandera', txt: 'Para el balcón. Que se sepa quién manda.', img: '/img/merch/bandera.jpg', alt: 'Bandera azul cielo de La Jarana con el toro sobre la jarra' },
  { id: 'bandana', nombre: 'Bandana', txt: 'Cuello, pelo o muñeca. Donde la pongas, queda mejor que tú.', img: '/img/merch/bandana.jpg', alt: 'Bandana azul cielo de La Jarana' },
  { id: 'pegatina', nombre: 'Pegatinas', txt: 'Make Rubielos Great Again en formato pegable. Se pegan solas (casi).', img: '/img/merch/pegatina.webp', alt: 'Pegatina troquelada Make Rubielos Great Again' },
];
