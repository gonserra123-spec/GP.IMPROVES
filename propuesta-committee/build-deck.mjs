import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { TABLES, ZONES, BOTTLES, MENU_CATEGORIES, CLUB, RULES } from './data.mjs';
import { ASSUMPTIONS, SCENARIOS, runAll, zoneStats, fmtEUR, fmtPct, fmtNum } from './model.mjs';

const require = createRequire(import.meta.url);
const PptxGenJS = require('pptxgenjs');
const dir = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(dir, 'Propuesta-Committee-Reservados-VIP.pptx');
const APPLY_THEME = process.env.APPLY_THEME_JS;

// ---------- Tema ----------
const THEME = {
  name: 'Committee Night',
  headFontFace: 'Cambria',
  bodyFontFace: 'Calibri',
  colors: {
    dk1: '14101C', lt1: 'FFFFFF', dk2: '2A1F3D', lt2: 'F4F1F7',
    accent1: 'E8334F', accent2: 'F5B544', accent3: 'A78BFA', accent4: '38BDF8', accent5: '34D399', accent6: '6F6A7D',
    hlink: 'E8334F', folHlink: 'A78BFA',
  },
};
const HEX = { ink: '14101C', night: '2A1F3D', red: 'E8334F', gold: 'F5B544', violet: 'A78BFA', sky: '38BDF8', green: '34D399', mute: '6F6A7D', soft: 'F4F1F7', line: 'E3DEEA', white: 'FFFFFF' };

const pres = new PptxGenJS();
pres.layout = 'LAYOUT_WIDE'; // 13.333 x 7.5
pres.theme = { headFontFace: THEME.headFontFace, bodyFontFace: THEME.bodyFontFace };
pres.title = 'Reservados VIP inteligentes para Committee Club Valencia';
pres.author = 'GP.IMPROVES';
pres.company = 'GP.IMPROVES';
const C = pres.SchemeColor;
const W = 13.333, M = 0.6;

const R = runAll();
const B = R.base;
const stats = zoneStats();

// ---------- Layouts ----------
const titlePh = (color, y = 0.42) => ({
  placeholder: { options: { name: 'title', type: 'title', x: M, y, w: W - 2 * M, h: 0.95, fontSize: 32, bold: true, color, align: 'left', valign: 'middle', margin: 0 }, text: '' },
});
const footer = (color) => ({ text: { text: 'GP.IMPROVES · Propuesta para Committee Club Valencia', options: { x: M, y: 7.02, w: 8, h: 0.3, fontSize: 10, color, margin: 0, isTextBox: true } } });

pres.defineSlideMaster({
  title: 'CONTENT', background: { color: HEX.white }, margin: [0.5, M, 0.6, M],
  objects: [titlePh(C.text1), footer(C.accent6)],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, color: C.accent6, fontSize: 10, align: 'right' },
});
pres.defineSlideMaster({
  title: 'DARK', background: { color: HEX.ink }, margin: [0.5, M, 0.6, M],
  objects: [titlePh(C.background1), footer(C.accent6)],
  slideNumber: { x: W - M - 0.6, y: 7.02, w: 0.6, h: 0.3, color: C.accent6, fontSize: 10, align: 'right' },
});

for (const title of ['Portada', 'Contexto', 'Propuesta', 'Captación', 'Números', 'Cierre', 'Anexo']) pres.addSection({ title });

// ---------- Helpers ----------
const slideIn = (master, section, title, notes) => {
  const s = pres.addSlide({ masterName: master, sectionTitle: section });
  s.addText(title, { placeholder: 'title' });
  if (notes) s.addNotes(notes);
  return s;
};
const T = (s, text, o = {}) => s.addText(text, { isTextBox: true, margin: 0, fontSize: 14, color: C.text1, valign: 'top', ...o });
const card = (s, x, y, w, h, o = {}) => s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.12, fill: { color: o.fill ?? C.background2 }, line: { color: o.fill ?? C.background2, width: 0 }, ...o.shape });
const dot = (s, x, y, d, color, text, o = {}) => {
  s.addShape(pres.ShapeType.ellipse, { x, y, w: d, h: d, fill: { color }, line: { color, width: 0 } });
  if (text) T(s, text, { x, y, w: d, h: d, align: 'center', valign: 'middle', bold: true, color: o.textColor ?? C.background1, fontSize: o.fontSize ?? 14 });
};
const note = (s, text, y = 6.62) => T(s, text, { x: M, y, w: W - 2 * M, h: 0.34, fontSize: 11, color: C.accent6, italic: true });
const eur = (n) => fmtEUR(n);

// Plano ilustrativo de la planta principal, dibujado con los mismos datos que la demo
function miniPlan(s, x, y, w, colorFor, { labels = false } = {}) {
  const k = w / 1000, h = 620 * k;
  s.addShape(pres.ShapeType.roundRect, { x, y, w, h, rectRadius: 0.08, fill: { color: HEX.night }, line: { color: HEX.night, width: 0 } });
  s.addShape(pres.ShapeType.roundRect, { x: x + 400 * k, y: y + 18 * k, w: 200 * k, h: 46 * k, rectRadius: 0.04, fill: { color: HEX.mute }, line: { color: HEX.mute, width: 0 } });
  T(s, 'DJ', { x: x + 400 * k, y: y + 18 * k, w: 200 * k, h: 46 * k, align: 'center', valign: 'middle', fontSize: 11, bold: true, color: C.background1 });
  s.addShape(pres.ShapeType.roundRect, { x: x + 250 * k, y: y + 180 * k, w: 500 * k, h: 300 * k, rectRadius: 0.1, fill: { color: '3A2D52' }, line: { color: HEX.mute, width: 0.75, dashType: 'dash' } });
  T(s, 'PISTA', { x: x + 250 * k, y: y + 180 * k, w: 500 * k, h: 300 * k, align: 'center', valign: 'middle', fontSize: 14, bold: true, color: C.accent6 });
  const r = 17 * k;
  for (const t of TABLES.filter((t) => t.floor === 'first')) {
    const col = colorFor(t);
    s.addShape(pres.ShapeType.ellipse, { x: x + t.x * k - r, y: y + t.y * k - r, w: 2 * r, h: 2 * r, fill: { color: col }, line: { color: col, width: 0 } });
    if (labels) T(s, t.id, { x: x + t.x * k - r, y: y + t.y * k - r, w: 2 * r, h: 2 * r, align: 'center', valign: 'middle', fontSize: t.id.length > 2 ? 8 : 10, bold: true, color: HEX.ink, wrap: false });
  }
}
const zoneColor = (t) => ZONES.find((z) => z.id === t.zone).color.slice(1);

// ============ 1. Portada ============
{
  const s = pres.addSlide({ sectionTitle: 'Portada' });
  s.background = { color: HEX.ink };
  miniPlan(s, 7.35, 1.2, 5.4, zoneColor);
  T(s, 'PROPUESTA DE AUTOMATIZACIÓN', { x: M, y: 1.25, w: 6.4, h: 0.4, fontSize: 14, bold: true, color: C.accent2, charSpacing: 3 });
  T(s, 'Reservados VIP inteligentes', { x: M, y: 1.8, w: 6.5, h: 2.2, fontSize: 50, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: 'top' });
  T(s, 'Mesa en el plano, botella y refrescos en un solo flujo, más campañas de cumpleaños y reactivación para llenar las noches flojas.', { x: M, y: 4.2, w: 6.2, h: 1.2, fontSize: 18, color: C.background2 });
  T(s, 'Committee Club Valencia · Noviembre 2026', { x: M, y: 6.2, w: 6.4, h: 0.4, fontSize: 14, bold: true, color: C.background1 });
  T(s, 'GP.IMPROVES', { x: M, y: 6.6, w: 6.4, h: 0.4, fontSize: 14, color: C.accent6 });
  T(s, 'Plano ilustrativo con las zonas VIP: Tarima, Principal y Ghost', { x: 7.35, y: 1.2 + 620 * 0.0054 + 0.15, w: 5.4, h: 0.3, fontSize: 11, color: C.accent6, italic: true });
  s.addNotes('Apertura. Una frase: automatizamos la reserva de mesa y la fidelización para que se llenen las noches con hueco. Todo el plano es ilustrativo.');
}

// ============ 2. Resumen ejecutivo ============
{
  const s = slideIn('CONTENT', 'Contexto', 'Más mesas llenas sin ampliar la sala',
    'Escenario base. Dejar claro que son estimaciones con supuestos explícitos, y que se sustituyen por datos reales de la sala.');
  T(s, 'Committee ya vende mesas con consumo mínimo, pero la elección de mesa y botella se resuelve en buena parte por mensajes. Proponemos un flujo único de reserva y tres campañas automáticas para recuperar clientes.', { x: M, y: 1.55, w: 12.1, h: 0.9, fontSize: 18 });
  const stat = (x, big, label, sub, col) => {
    card(s, x, 2.75, 3.85, 3.1);
    T(s, big, { x: x + 0.3, y: 3.0, w: 3.3, h: 1.1, fontSize: 48, bold: true, color: col, fontFace: THEME.headFontFace, valign: 'middle' });
    T(s, label, { x: x + 0.3, y: 4.15, w: 3.3, h: 0.7, fontSize: 18, bold: true });
    T(s, sub, { x: x + 0.3, y: 4.85, w: 3.3, h: 0.9, fontSize: 14, color: C.accent6 });
  };
  stat(M, `+${fmtPct(B.pctTables)}`, 'mesas vendidas por temporada', `≈ ${fmtNum(B.extraTables)} mesas extra en noches con hueco`, C.accent1);
  stat(M + 4.12, `+${fmtEUR(B.extraRevenue / 1000, 0).replace(' €', '')} k€`, 'facturación extra de mesas', `${fmtPct(B.pctRevenue)} sobre la facturación de mesas estimada`, C.accent2);
  stat(M + 8.24, `${fmtNum(B.breakEvenPerWeek, 1)}`, 'mesas por semana', 'es lo que hace falta vender de más para cubrir el coste del servicio', C.accent3);
  note(s, `Escenario base. Rango de facturación extra: ${eur(R.conservador.extraRevenue)} (conservador) a ${eur(R.optimista.extraRevenue)} (optimista). Cifras ilustrativas.`);
}

// ============ 3. La sala ============
{
  const s = slideIn('CONTENT', 'Contexto', 'Committee: 42 mesas VIP en cuatro zonas',
    'Datos públicos. El número de mesas por zona viene de Spain Club Promoter; la plataforma oficial no lo publica.');
  const rows = [
    ['Dirección', 'C/ Sant Vicent Màrtir, 200 · València centro'],
    ['Grupo', 'Grupo Salamandra (Akuarela, Convento, MYA, L’Umbracle)'],
    ['Apertura', 'Jueves, viernes y sábado · hasta las 07:30 · septiembre a mayo'],
    ['Edad', 'Jueves +18 · viernes y sábado +21'],
    ['Salas', 'First Floor (reguetón y comercial) · Petit (hip-hop y R&B)'],
    ['Entrada', 'Desde 22 € con consumición, por tramos 22 · 27 · 32 €'],
    ['Vestimenta', 'Casual elegante · sin pantalón corto'],
  ];
  card(s, M, 1.6, 7.5, 5.0);
  rows.forEach(([k, v], i) => {
    T(s, k, { x: M + 0.3, y: 1.8 + i * 0.66, w: 1.5, h: 0.55, fontSize: 14, bold: true, color: C.accent1, valign: 'middle' });
    T(s, v, { x: M + 1.85, y: 1.8 + i * 0.66, w: 5.45, h: 0.55, fontSize: 14, valign: 'middle' });
  });
  const kpi = (x, y, n, l, col) => {
    card(s, x, y, 2.05, 1.55, { fill: HEX.ink });
    T(s, n, { x, y: y + 0.12, w: 2.05, h: 0.85, fontSize: 40, bold: true, color: col, align: 'center', valign: 'middle', fontFace: THEME.headFontFace });
    T(s, l, { x, y: y + 0.95, w: 2.05, h: 0.45, fontSize: 14, color: C.background1, align: 'center' });
  };
  kpi(8.55, 1.6, '42', 'mesas VIP', C.accent1);
  kpi(10.7, 1.6, '4', 'zonas', C.accent2);
  kpi(8.55, 3.35, '5+2', 'personas por mesa', C.accent3);
  kpi(10.7, 3.35, '3', 'noches por semana', C.accent4);
  T(s, 'Convento comparte carta con Committee y el grupo gestiona otras tres salas: lo que funcione aquí se puede replicar.', { x: 8.55, y: 5.2, w: 4.5, h: 1.2, fontSize: 14, color: C.accent6 });
}

// ============ 4. Cómo se reserva hoy ============
{
  const s = slideIn('CONTENT', 'Contexto', 'Hoy elegir mesa y botella pasa por mensajes y PDF',
    'Importante: no recorrí el pago de la plataforma oficial hasta el final, así que la afirmación se formula con cautela. Validar con el grupo.');
  const cols = [
    ['Plataforma oficial', 'smdgroup.club', ['Entradas por evento', 'Reservado por zona, con precio «desde»', 'Enlace propio para cada relaciones públicas'], C.accent1],
    ['Relaciones públicas', 'Web propia + WhatsApp', ['Planos y carta en PDF', 'La mesa se asigna por mensajes', 'Enlace de pago con 2 h de validez'], C.accent2],
    ['Agregadores', 'Clubbable · Discoruta · Xceed', ['Listados y fichas de la sala', 'Datos a veces desactualizados', 'Redirigen a la venta oficial'], C.accent3],
  ];
  cols.forEach(([t, sub, items, col], i) => {
    const x = M + i * 4.12;
    card(s, x, 1.6, 3.85, 3.35);
    dot(s, x + 0.3, 1.85, 0.5, col, String(i + 1));
    T(s, t, { x: x + 0.95, y: 1.85, w: 2.7, h: 0.5, fontSize: 20, bold: true, valign: 'middle' });
    T(s, sub, { x: x + 0.3, y: 2.55, w: 3.3, h: 0.35, fontSize: 14, color: C.accent6 });
    T(s, items.map((t2, j) => ({ text: t2, options: { bullet: true, breakLine: j < items.length - 1 } })), { x: x + 0.3, y: 3.0, w: 3.3, h: 1.8, fontSize: 14, paraSpaceAfter: 6 });
  });
  card(s, M, 5.2, 12.13, 1.3, { fill: HEX.ink });
  T(s, 'La oportunidad', { x: M + 0.35, y: 5.35, w: 3, h: 0.35, fontSize: 14, bold: true, color: C.accent2 });
  T(s, 'La ficha oficial muestra la zona y un precio «desde». Elegir la mesa concreta y la botella sigue pasando por un mensaje y un PDF. Ahí se pueden perder consultas fuera de horario y se vende menos de lo posible.', { x: M + 0.35, y: 5.72, w: 11.4, h: 0.7, fontSize: 14, color: C.background1 });
}

// ============ 5. Zonas y precios ============
{
  const s = slideIn('CONTENT', 'Contexto', 'Cuatro zonas, de 150 a 1.500 € de consumo mínimo',
    'El precio de la mesa no es una entrada: es crédito para consumir de la carta. Ghost: solo se conoce la mesa 1 a 1.500 € y el mínimo de la zona a 500 €.');
  const order = ['tarima', 'principal', 'petit', 'ghost'];
  const info = {
    tarima: ['First Floor', '14', '200 €', '150 €', 'A ras de pista, con barra propia'],
    principal: ['First Floor', '7', '400 €', '300 €', 'Detrás de la cabina del DJ'],
    petit: ['Planta superior', '16', '500 €', '500 €', 'Sala casi solo de mesas · hip-hop y R&B'],
    ghost: ['First Floor', '5', '500–1.500 €', '500–1.500 €', 'Acceso privado · show de botellas'],
  };
  const head = ['Zona', 'Sala', 'Mesas', 'Vie–sáb', 'Jueves', 'Ambiente'].map((t) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.ink }, fontSize: 13 } }));
  const rows = [head, ...order.map((id) => {
    const z = ZONES.find((x) => x.id === id);
    return [{ text: z.name, options: { bold: true, color: HEX.ink } }, ...info[id].map((t) => ({ text: t, options: { color: HEX.ink } }))];
  })];
  s.addTable(rows, { x: M, y: 1.65, w: 8.2, colW: [1.3, 1.45, 0.8, 1.25, 1.25, 2.15], rowH: [0.45, 0.75, 0.75, 0.75, 0.75], fontSize: 13, valign: 'middle', border: { type: 'solid', color: HEX.line, pt: 0.75 }, fill: { color: HEX.soft } });
  T(s, 'Persona extra: +20 % del precio de la mesa (máximo 2). El importe se consume íntegro en botellas; entrada y refrescos incluidos.', { x: M, y: 5.6, w: 8.2, h: 0.7, fontSize: 14 });
  s.addChart(pres.charts.DOUGHNUT, [{ name: 'Mesas', labels: order.map((id) => ZONES.find((z) => z.id === id).name), values: order.map((id) => Number(info[id][1])) }], {
    x: 9.1, y: 1.55, w: 3.7, h: 4.3, holeSize: 55, chartColors: order.map((id) => ZONES.find((z) => z.id === id).color.slice(1)),
    showLegend: true, legendPos: 'b', legendFontSize: 12, legendColor: HEX.ink, legendFontFace: '+mn-lt', showPercent: false, showValue: true, dataLabelColor: HEX.white, dataLabelFontSize: 14, dataLabelFontBold: true, dataLabelFontFace: '+mn-lt',
    showTitle: true, title: 'Mesas por zona', titleFontSize: 14, titleColor: HEX.ink, titleFontFace: '+mn-lt', dataBorder: { pt: 2, color: HEX.white },
  });
  note(s, 'Fuentes: Grupo Salamandra, Spain Club Promoter y Valencia Nightlife. Las fuentes discrepan en algunos precios; ver anexo.');
}

// ============ 6. Reglas de la mesa ============
{
  const s = slideIn('CONTENT', 'Contexto', 'El precio de la mesa es crédito para botellas',
    'Ejemplo con una mesa Principal de 300 € (jueves). El suplemento por persona extra es del 20 % del precio de la mesa.');
  const step = (x, n, pr, lbl, col) => {
    card(s, x, 1.65, 2.55, 2.5);
    T(s, `${n} personas`, { x, y: 1.85, w: 2.55, h: 0.4, fontSize: 14, bold: true, align: 'center', color: C.accent6 });
    T(s, pr, { x, y: 2.3, w: 2.55, h: 1.0, fontSize: 40, bold: true, align: 'center', valign: 'middle', color: col, fontFace: THEME.headFontFace });
    T(s, lbl, { x: x + 0.2, y: 3.35, w: 2.15, h: 0.7, fontSize: 14, align: 'center' });
  };
  step(M, 5, '300 €', 'precio base de la mesa', C.accent1);
  step(M + 2.8, 6, '360 €', '1 persona extra (+20 %)', C.accent2);
  step(M + 5.6, 7, '420 €', 'máximo: 2 extra (+40 %)', C.accent3);
  T(s, 'Ejemplo: mesa Principal en jueves. A partir de 8 personas hace falta una segunda mesa.', { x: M, y: 4.4, w: 8.2, h: 0.4, fontSize: 14, color: C.accent6 });
  card(s, 9.25, 1.65, 3.5, 4.85, { fill: HEX.ink });
  T(s, 'Cómo se paga', { x: 9.55, y: 1.85, w: 3, h: 0.4, fontSize: 18, bold: true, color: C.accent2 });
  T(s, [
    ['Señal del 50 %', 'con un enlace que caduca a las 2 horas'],
    ['50 % restante', 'al llegar, en efectivo o tarjeta'],
    ['Sin señal', 'no hay reserva confirmada'],
    ['Enlace caducado', 'la mesa se libera y vuelve al plano'],
  ].flatMap(([a, b], i) => [
    { text: a, options: { bold: true, color: HEX.white, breakLine: true } },
    { text: b, options: { color: 'CFC9DA', breakLine: i < 3, paraSpaceAfter: 12 } },
  ]), { x: 9.55, y: 2.4, w: 3.0, h: 3.8, fontSize: 14 });
  card(s, M, 5.05, 8.2, 1.45);
  T(s, 'Qué incluye', { x: M + 0.3, y: 5.2, w: 3, h: 0.35, fontSize: 14, bold: true, color: C.accent1 });
  T(s, 'Entrada VIP para el grupo, refrescos para acompañar y el importe íntegro como consumo de la carta. Ghost añade show: canción a elegir, cartel con mensaje y bandera.', { x: M + 0.3, y: 5.58, w: 7.6, h: 0.85, fontSize: 14 });
}

// ============ 7. Carta ============
{
  const cats = MENU_CATEGORIES;
  const min = cats.map((c) => Math.min(...BOTTLES.filter((b) => b.category === c).map((b) => b.price)));
  const max = cats.map((c) => Math.max(...BOTTLES.filter((b) => b.category === c).map((b) => b.price)));
  const s = slideIn('CONTENT', 'Contexto', `Una carta de ${BOTTLES.length} referencias desde 200 €`,
    'La carta es la misma en Committee y Convento (temporada 2026/27), publicada por una web de relaciones públicas que dice haberla recibido del grupo.');
  s.addChart(pres.charts.BAR, [
    { name: 'Precio más bajo', labels: cats, values: min },
    { name: 'Precio más alto', labels: cats, values: max },
  ], {
    x: M, y: 1.5, w: 8.2, h: 5.0, barDir: 'col', barGrouping: 'clustered', chartColors: [HEX.violet, HEX.red], barGapWidthPct: 60,
    showLegend: true, legendPos: 'b', legendFontSize: 12, legendColor: HEX.ink, legendFontFace: '+mn-lt',
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 11, dataLabelColor: HEX.ink, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '#,##0',
    catAxisLabelColor: HEX.ink, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.mute, valAxisLabelFontSize: 11, valAxisLabelFontFace: '+mn-lt',
    valGridLine: { color: HEX.line, size: 0.75 }, catGridLine: { style: 'none' }, valAxisLabelFormatCode: '#,##0',
    showTitle: true, title: 'Precio de botella por categoría (€)', titleFontSize: 14, titleColor: HEX.ink, titleFontFace: '+mn-lt',
  });
  const counts = cats.map((c) => [c, BOTTLES.filter((b) => b.category === c).length]);
  card(s, 9.1, 1.6, 3.65, 4.9);
  T(s, 'Referencias por categoría', { x: 9.4, y: 1.8, w: 3.1, h: 0.4, fontSize: 14, bold: true, color: C.accent1 });
  counts.forEach(([c, n], i) => {
    T(s, c, { x: 9.4, y: 2.35 + i * 0.5, w: 2, h: 0.4, fontSize: 14, valign: 'middle' });
    T(s, String(n), { x: 11.6, y: 2.35 + i * 0.5, w: 0.9, h: 0.4, fontSize: 14, bold: true, align: 'right', valign: 'middle' });
  });
  note(s, 'Fuente: carta 2026/27 publicada por Spain Club Promoter. Los precios pueden variar en eventos especiales.');
}

// ============ 8. Propuesta: el flujo ============
{
  const s = slideIn('CONTENT', 'Propuesta', 'Reservar mesa y botella en un solo flujo',
    'Pensado para móvil: la mayor parte del tráfico llega desde Instagram y WhatsApp.');
  const steps = [
    ['Fecha y grupo', 'Elige la noche y cuántos sois. Se aplica la edad mínima de esa noche.', C.accent1],
    ['Mesa en el plano', 'Plano por zonas con estado en tiempo real. La mesa queda retenida 10 minutos.', C.accent2],
    ['Botellas y refrescos', 'Carta con precios. Un contador marca cuánto falta para el consumo mínimo.', C.accent3],
    ['Datos y señal', 'Nombre, teléfono, cumpleaños y señal del 50 %. Confirmación con QR por WhatsApp.', C.accent4],
  ];
  steps.forEach(([t, d, col], i) => {
    const x = M + i * 3.07;
    card(s, x, 1.7, 2.85, 3.6);
    dot(s, x + 0.25, 1.95, 0.6, col, String(i + 1), { fontSize: 20 });
    T(s, t, { x: x + 0.25, y: 2.75, w: 2.4, h: 0.5, fontSize: 18, bold: true });
    T(s, d, { x: x + 0.25, y: 3.3, w: 2.4, h: 1.9, fontSize: 16 });
    if (i < 3) s.addShape(pres.ShapeType.rightArrow, { x: x + 2.88, y: 3.3, w: 0.17, h: 0.3, fill: { color: C.accent6 }, line: { color: C.accent6, width: 0 } });
  });
  card(s, M, 5.55, 12.13, 0.95, { fill: HEX.ink });
  T(s, 'Por detrás, un flujo de n8n controla la disponibilidad, el cobro, las confirmaciones, el recordatorio del mismo día y la liberación de mesas sin pagar.', { x: M + 0.35, y: 5.65, w: 11.4, h: 0.75, fontSize: 14, color: C.background1, valign: 'middle' });
}

// ============ 9. Qué recibe la sala ============
{
  const s = slideIn('CONTENT', 'Propuesta', 'La sala ve la noche entera en un plano',
    'El mismo plano sirve al cliente y al encargado. Verde: libre; ámbar: retenida; rojo: reservada.');
  const col = (t) => { const i = TABLES.indexOf(t); return i % 5 === 0 || i % 7 === 0 ? HEX.red : i % 4 === 1 ? HEX.gold : HEX.green; };
  miniPlan(s, M, 1.6, 6.0, col, { labels: true });
  [['Libre', HEX.green], ['Retenida', HEX.gold], ['Reservada', HEX.red]].forEach(([l, c], i) => {
    dot(s, M + i * 1.9, 5.55, 0.22, c);
    T(s, l, { x: M + 0.32 + i * 1.9, y: 5.5, w: 1.4, h: 0.32, fontSize: 14, valign: 'middle' });
  });
  const items = [
    ['Panel de la noche', 'Ocupación, ingresos de mesas y listado de reservas en directo.'],
    ['Aviso al equipo', 'Cada reserva llega al grupo de encargados por WhatsApp o Telegram.'],
    ['Preparación de barra', 'Lista agregada de botellas y refrescos antes de abrir.'],
    ['Reservas manuales', 'El encargado bloquea mesas para compromisos o reservas por teléfono.'],
    ['Código de relaciones públicas', 'Cada reserva conserva su enlace para calcular la comisión.'],
  ];
  items.forEach(([t, d], i) => {
    const y = 1.6 + i * 0.98;
    dot(s, 7.2, y + 0.08, 0.5, [C.accent1, C.accent2, C.accent3, C.accent4, C.accent5][i], String(i + 1), { fontSize: 14 });
    T(s, t, { x: 7.9, y, w: 4.8, h: 0.35, fontSize: 16, bold: true });
    T(s, d, { x: 7.9, y: y + 0.38, w: 4.8, h: 0.55, fontSize: 14, color: C.accent6 });
  });
  note(s, 'Plano ilustrativo, no es el plano real de la sala. Se muestra la planta principal; la planta Petit se gestiona igual.');
}

// ============ 10. Campañas ============
{
  const s = slideIn('CONTENT', 'Captación', 'Tres campañas automáticas llenan las noches flojas',
    'Cada reserva alimenta la base de datos con fecha de nacimiento y última visita. Con eso se disparan las campañas.');
  const cards = [
    ['Cumpleaños', 'Se envía 10 días antes', 'Enlace personal para reservar esa semana. Un cumpleaños mueve a un grupo de 5 a 7 personas, el tamaño de una mesa.', 'Ventaja: botella de cortesía', C.accent1, '«Tu cumpleaños se acerca. Reserva tu mesa esta semana y te invitamos a una botella de champán.»'],
    ['Reactivación', 'Titular con 60 a 90 días sin volver', 'Oferta con caducidad dirigida a quien reservó, que es quien mueve al grupo.', 'Ventaja: extras sin suplemento', C.accent2, '«Hace tiempo que no te vemos. Este jueves, hasta 7 personas en tu mesa sin suplemento.»'],
    ['Tras la visita', 'A los 2 o 3 días', 'Fotos de la noche y un enlace para repetir. Cuesta poco y mantiene el contacto sin regalar nada.', 'Ventaja: ninguna, solo recordatorio', C.accent3, '«Gracias por venir. Aquí tienes las fotos de la noche y tu enlace para repetir.»'],
  ];
  cards.forEach(([t, trig, d, adv, col, msg], i) => {
    const x = M + i * 4.12;
    card(s, x, 1.6, 3.85, 4.9);
    dot(s, x + 0.3, 1.85, 0.55, col, String(i + 1), { fontSize: 18 });
    T(s, t, { x: x + 1.0, y: 1.85, w: 2.7, h: 0.55, fontSize: 22, bold: true, valign: 'middle' });
    T(s, trig, { x: x + 0.3, y: 2.65, w: 3.3, h: 0.4, fontSize: 14, bold: true, color: C.accent6 });
    T(s, d, { x: x + 0.3, y: 3.15, w: 3.3, h: 1.35, fontSize: 14 });
    T(s, msg, { x: x + 0.3, y: 4.5, w: 3.3, h: 0.85, fontSize: 14, italic: true, color: C.accent6 });
    card(s, x + 0.3, 5.45, 3.25, 0.75, { fill: HEX.ink });
    T(s, adv, { x: x + 0.3, y: 5.45, w: 3.25, h: 0.75, fontSize: 14, bold: true, color: C.background1, align: 'center', valign: 'middle' });
  });
}

// ============ 11. Reglas de la oferta ============
{
  const s = slideIn('CONTENT', 'Captación', 'La oferta protege el margen de las noches llenas',
    'Regalar valor percibido de bajo coste en vez de rebajar el precio, porque el precio de la mesa es crédito de consumo.');
  const g = [
    ['Valor añadido, no descuento', 'Rebajar la mesa recorta directamente el margen. Una botella de cortesía o los extras sin suplemento cuestan menos y se perciben más.', C.accent1],
    ['Solo donde sobra aforo', 'La oferta vale para jueves y para zonas con menos del 60 % de ocupación prevista. Un sábado lleno no se regala.', C.accent2],
    ['Enlace de un solo uso', 'Personal, con fecha de caducidad y válido para una única reserva, para que no circule por grupos de WhatsApp.', C.accent3],
    ['Grupo de control del 10 %', 'Un 10 % de los clientes elegibles no recibe la oferta. Así se mide cuántas mesas son realmente nuevas.', C.accent4],
  ];
  g.forEach(([t, d, col], i) => {
    const x = M + (i % 2) * 6.17, y = 1.6 + Math.floor(i / 2) * 2.5;
    card(s, x, y, 5.95, 2.3);
    dot(s, x + 0.3, y + 0.3, 0.5, col, String(i + 1), { fontSize: 16 });
    T(s, t, { x: x + 1.0, y: y + 0.3, w: 4.7, h: 0.5, fontSize: 18, bold: true, valign: 'middle' });
    T(s, d, { x: x + 0.3, y: y + 0.95, w: 5.4, h: 1.25, fontSize: 16 });
  });
}

// ============ 12. Supuestos ============
{
  const a = ASSUMPTIONS, b = SCENARIOS.base;
  const s = slideIn('CONTENT', 'Números', 'El modelo mezcla datos públicos y supuestos explícitos',
    'Esta diapositiva es la más importante para la honestidad de las cifras: todo lo marcado como supuesto debe sustituirse por datos de caja del grupo.');
  const pub = { text: 'Público', options: { color: '0F7B55', bold: true } }, sup = { text: 'Supuesto', options: { color: 'B45309', bold: true } };
  const rows = [
    ['Mesas y precios por zona', '42 mesas · 150 a 1.500 €', pub],
    ['Reglas de mesa (5+2, +20 %, señal 50 %)', 'Según Grupo Salamandra y relaciones públicas', pub],
    ['Semanas de apertura por temporada', `${a.weeksPerSeason} semanas, jueves a sábado`, sup],
    ['Mesas vendidas (jueves · viernes · sábado)', `${fmtPct(a.occupancy.thu, 0)} · ${fmtPct(a.occupancy.fri, 0)} · ${fmtPct(a.occupancy.sat, 0)}`, sup],
    ['Gasto sobre el mínimo · margen bruto', `${fmtPct(a.extraSpend, 0)} · ${fmtPct(a.grossMargin, 0)}`, sup],
    ['Clientes que aceptan comunicaciones', `${fmtPct(SCENARIOS.conservador.optIn, 0)} / ${fmtPct(b.optIn, 0)} / ${fmtPct(SCENARIOS.optimista.optIn, 0)}`, sup],
    ['Conversión de reactivación', `${fmtPct(SCENARIOS.conservador.reactConv, 0)} / ${fmtPct(b.reactConv, 0)} / ${fmtPct(SCENARIOS.optimista.reactConv, 0)}`, sup],
    ['Conversión de cumpleaños', `${fmtPct(SCENARIOS.conservador.birthdayConv)} / ${fmtPct(b.birthdayConv)} / ${fmtPct(SCENARIOS.optimista.birthdayConv)}`, sup],
    ['Reservas recuperadas por reserva 24 h', `${fmtPct(SCENARIOS.conservador.recovered)} / ${fmtPct(b.recovered)} / ${fmtPct(SCENARIOS.optimista.recovered)}`, sup],
    ['Incremento de gasto por venta guiada', `${fmtPct(SCENARIOS.conservador.upsell, 0)} / ${fmtPct(b.upsell, 0)} / ${fmtPct(SCENARIOS.optimista.upsell, 0)}`, sup],
  ].map(([k, v, o]) => [{ text: k, options: { color: HEX.ink } }, { text: v, options: { color: HEX.ink } }, o]);
  const head = ['Parámetro', 'Valor (conservador / base / optimista)', 'Origen'].map((t) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.ink } } }));
  s.addTable([head, ...rows], { x: M, y: 1.55, w: 12.13, colW: [5.2, 5.0, 1.93], rowH: 0.43, fontSize: 13, valign: 'middle', border: { type: 'solid', color: HEX.line, pt: 0.75 }, fill: { color: HEX.soft } });
  note(s, 'Los supuestos hay que sustituirlos por datos reales de caja y reservas. Las cifras que siguen no son una promesa de resultados.', 6.6);
}

// ============ 13. Resultados por palanca ============
{
  const s = slideIn('CONTENT', 'Números', `Entre +${fmtPct(R.conservador.pctRevenue, 0)} y +${fmtPct(R.optimista.pctRevenue, 0)} de facturación de mesas`,
    'Cada columna suma la facturación extra de las cuatro palancas. La venta guiada (upsell) pesa más que las tres campañas juntas en el caso base, y es la palanca más sensible al supuesto.');
  const names = ['Conservador', 'Base', 'Optimista'];
  const keys = ['conservador', 'base', 'optimista'];
  const series = [['Reactivación', 'reactivation'], ['Cumpleaños', 'birthday'], ['Reserva 24 h', 'recovery'], ['Venta guiada', 'upsell']];
  s.addChart(pres.charts.BAR, keys.map((sc, i) => ({ name: names[i], labels: series.map(([n]) => n), values: series.map(([, k]) => Math.round(R[sc].levers[k].revenue)) })), {
    x: M, y: 1.5, w: 8.0, h: 5.0, barDir: 'col', barGrouping: 'clustered', chartColors: [HEX.violet, HEX.red, HEX.gold], barGapWidthPct: 50,
    showLegend: true, legendPos: 'b', legendFontSize: 12, legendColor: HEX.ink, legendFontFace: '+mn-lt',
    showValue: true, dataLabelPosition: 'outEnd', dataLabelFontSize: 10, dataLabelColor: HEX.ink, dataLabelFontFace: '+mn-lt', dataLabelFormatCode: '#,##0',
    catAxisLabelColor: HEX.ink, catAxisLabelFontSize: 12, catAxisLabelFontFace: '+mn-lt', valAxisLabelColor: HEX.mute, valAxisLabelFontSize: 11, valAxisLabelFontFace: '+mn-lt',
    valGridLine: { color: HEX.line, size: 0.75 }, catGridLine: { style: 'none' }, valAxisLabelFormatCode: '#,##0',
    showTitle: true, title: 'Facturación extra por temporada y palanca (€)', titleFontSize: 14, titleColor: HEX.ink, titleFontFace: '+mn-lt',
  });
  keys.forEach((k, i) => {
    const y = 1.6 + i * 1.65;
    card(s, 8.95, y, 3.8, 1.5);
    T(s, names[i], { x: 9.2, y: y + 0.12, w: 3.3, h: 0.35, fontSize: 14, bold: true, color: C.accent6 });
    T(s, eur(R[k].extraRevenue), { x: 9.2, y: y + 0.47, w: 3.3, h: 0.6, fontSize: 28, bold: true, fontFace: THEME.headFontFace, color: [C.accent3, C.accent1, C.accent2][i] });
    T(s, `${fmtNum(R[k].extraTables)} mesas extra · +${fmtPct(R[k].pctTables)}`, { x: 9.2, y: y + 1.05, w: 3.3, h: 0.35, fontSize: 14 });
  });
}

// ============ 14. Tabla de escenarios ============
{
  const s = slideIn('CONTENT', 'Números', 'Incluso el caso conservador cubre el coste del servicio',
    'Beneficio neto = margen bruto de la facturación extra, menos el coste de las ventajas ofrecidas, menos el coste del servicio.');
  const f = [
    ['Mesas extra por temporada', (r) => fmtNum(r.extraTables)],
    ['Sobre mesas vendidas', (r) => `+${fmtPct(r.pctTables)}`],
    ['Facturación extra de mesas', (r) => eur(r.extraRevenue)],
    ['Sobre facturación de mesas', (r) => `+${fmtPct(r.pctRevenue)}`],
    ['Margen bruto tras ventajas', (r) => eur(r.grossProfit)],
    ['Coste del servicio', (r) => eur(r.serviceCost)],
    ['Beneficio neto', (r) => eur(r.net)],
    ['Retorno sobre el coste', (r) => `${fmtNum(r.roi, 1)} veces`],
  ];
  const head = ['', 'Conservador', 'Base', 'Optimista'].map((t, i) => ({ text: t, options: { bold: true, color: HEX.white, align: i ? 'right' : 'left', fill: { color: i === 2 ? HEX.red : HEX.ink } } }));
  const rows = f.map(([k, fn], ri) => [
    { text: k, options: { color: HEX.ink, bold: ri === 6 } },
    ...['conservador', 'base', 'optimista'].map((sc) => ({ text: fn(R[sc]), options: { color: HEX.ink, align: 'right', bold: ri === 6 || sc === 'base' } })),
  ]);
  s.addTable([head, ...rows], { x: M, y: 1.6, w: 12.13, colW: [5.2, 2.31, 2.31, 2.31], rowH: 0.46, fontSize: 14, valign: 'middle', border: { type: 'solid', color: HEX.line, pt: 0.75 }, fill: { color: HEX.soft } });
  T(s, `Capacidad libre estimada: ${fmtNum(B.baseline.freeSeason)} mesas por temporada. Las mesas extra del caso optimista (${fmtNum(R.optimista.extraTables)}) caben con holgura.`, { x: M, y: 5.95, w: 12.1, h: 0.5, fontSize: 14 });
  note(s, 'Cifras ilustrativas basadas en los supuestos de la diapositiva anterior, pendientes de validar con datos de la sala.');
}

// ============ 15. Inversión ============
{
  const s = slideIn('CONTENT', 'Números', `Inversión orientativa: ${eur(B.serviceCost)} por temporada`,
    'Precio de partida para negociar; no es una oferta cerrada. El coste de WhatsApp depende de la tarifa vigente de Meta y del volumen de mensajes.');
  const f = ASSUMPTIONS.fees;
  const items = [
    ['Puesta en marcha', eur(f.setup), 'Integración, plano y carta, flujos de n8n y formación del equipo', C.accent1],
    ['Mantenimiento mensual', `${eur(f.monthly)} × ${f.months} meses`, 'Servicio, soporte y ajuste de campañas durante la temporada', C.accent2],
    ['Mensajes de WhatsApp', `≈ ${eur(B.waCost)}`, `${fmtNum(B.messages)} mensajes de marketing a ${fmtEUR(ASSUMPTIONS.waCostPerMsg, 2)} cada uno (tarifa a comprobar)`, C.accent3],
  ];
  items.forEach(([t, v, d, col], i) => {
    const y = 1.6 + i * 1.65;
    card(s, M, y, 7.4, 1.5);
    dot(s, M + 0.25, y + 0.45, 0.6, col, String(i + 1), { fontSize: 18 });
    T(s, t, { x: M + 1.1, y: y + 0.15, w: 3.2, h: 0.4, fontSize: 14, bold: true, color: C.accent6 });
    T(s, v, { x: M + 1.1, y: y + 0.5, w: 6.1, h: 0.5, fontSize: 24, bold: true, fontFace: THEME.headFontFace });
    T(s, d, { x: M + 1.1, y: y + 1.0, w: 6.1, h: 0.45, fontSize: 14 });
  });
  card(s, 8.3, 1.6, 4.45, 4.8, { fill: HEX.ink });
  T(s, 'Punto de equilibrio', { x: 8.6, y: 1.85, w: 3.9, h: 0.4, fontSize: 14, bold: true, color: C.accent2 });
  T(s, fmtNum(B.breakEvenPerWeek, 1), { x: 8.6, y: 2.4, w: 3.9, h: 1.3, fontSize: 72, bold: true, color: C.background1, fontFace: THEME.headFontFace, valign: 'middle' });
  T(s, 'mesas extra por semana', { x: 8.6, y: 3.75, w: 3.9, h: 0.45, fontSize: 18, bold: true, color: C.background1 });
  T(s, `Con esa cifra, el margen de las mesas nuevas paga la temporada entera. El caso conservador vende ${fmtNum(R.conservador.extraTables / ASSUMPTIONS.weeksPerSeason, 1)} mesas extra por semana.`, { x: 8.6, y: 4.3, w: 3.9, h: 1.2, fontSize: 14, color: 'CFC9DA' });
  T(s, 'Beneficio neto estimado, caso base', { x: 8.6, y: 5.35, w: 3.9, h: 0.3, fontSize: 12, color: C.accent2, bold: true });
  T(s, eur(B.net), { x: 8.6, y: 5.68, w: 3.9, h: 0.5, fontSize: 28, bold: true, color: C.background1, fontFace: THEME.headFontFace });
}

// ============ 16. Plan ============
{
  const s = slideIn('CONTENT', 'Cierre', 'Piloto en seis semanas, medido con grupo de control',
    'El piloto empieza por una zona y una noche flojas (jueves, Tarima) para limitar el riesgo.');
  const ph = [
    ['Semanas 1–2', 'Datos e integración', 'Recibir plano real, carta y ocupación. Decidir cómo convivir con la plataforma del grupo.', C.accent1, 'Plano y carta cargados'],
    ['Semanas 3–4', 'Piloto en un jueves', 'Reserva con plano y botellas solo para Tarima los jueves. Reserva manual en paralelo como red.', C.accent2, 'Primeras reservas reales'],
    ['Semanas 5–6', 'Campañas y medición', 'Activar cumpleaños y reactivación con grupo de control del 10 %. Primer informe de resultados.', C.accent3, 'Informe con grupo de control'],
    ['Mes 3 en adelante', 'Ampliar', 'Más zonas y noches, y después Convento y el resto de salas del grupo.', C.accent4, 'Decisión de ampliar'],
  ];
  s.addShape(pres.ShapeType.line, { x: M + 0.3, y: 2.45, w: 3 * 3.07, h: 0, line: { color: C.accent6, width: 1.5, dashType: 'dash' } });
  ph.forEach(([when, t, d, col, deliv], i) => {
    const x = M + i * 3.07;
    dot(s, x, 2.15, 0.6, col, String(i + 1), { fontSize: 18 });
    T(s, when, { x, y: 1.6, w: 2.8, h: 0.35, fontSize: 14, bold: true, color: C.accent6 });
    card(s, x, 3.0, 2.85, 3.5);
    T(s, t, { x: x + 0.25, y: 3.2, w: 2.4, h: 0.6, fontSize: 18, bold: true });
    T(s, d, { x: x + 0.25, y: 3.85, w: 2.4, h: 1.75, fontSize: 14 });
    T(s, deliv, { x: x + 0.25, y: 5.75, w: 2.4, h: 0.55, fontSize: 14, bold: true, color: C.accent1, valign: 'bottom' });
  });
}

// ============ 17. Riesgos ============
{
  const s = slideIn('CONTENT', 'Cierre', 'Seis puntos a resolver antes de arrancar',
    'Los dos más críticos son la integración con la plataforma del grupo y el consentimiento para las campañas.');
  const r = [
    ['Plataforma del grupo', 'Saber si es propia o de un proveedor y si dan acceso al histórico de compradores.'],
    ['Consentimiento RGPD', 'Casilla aparte sin premarcar y baja en cada mensaje. Sin ella no se envía publicidad.'],
    ['WhatsApp oficial', 'Los envíos promocionales exigen la API de WhatsApp Business con plantillas aprobadas.'],
    ['Edad y alcohol', 'Jueves +18, viernes y sábado +21. Se verifica en puerta con documento original.'],
    ['Relaciones públicas', 'Mantener su enlace y su comisión en cada reserva, o lo verán como competencia.'],
    ['Precios y disponibilidad', 'Las fuentes públicas discrepan en algunos precios. Se fijan con el grupo.'],
  ];
  r.forEach(([t, d], i) => {
    const x = M + (i % 3) * 4.12, y = 1.6 + Math.floor(i / 3) * 2.55;
    card(s, x, y, 3.85, 2.35);
    dot(s, x + 0.25, y + 0.25, 0.5, [C.accent1, C.accent2, C.accent3, C.accent4, C.accent5, C.accent6][i], String(i + 1), { fontSize: 16 });
    T(s, t, { x: x + 0.95, y: y + 0.25, w: 2.8, h: 0.5, fontSize: 16, bold: true, valign: 'middle' });
    T(s, d, { x: x + 0.25, y: y + 0.95, w: 3.4, h: 1.3, fontSize: 16 });
  });
}

// ============ 18. Siguientes pasos (oscura) ============
{
  const s = slideIn('DARK', 'Cierre', 'Qué necesitamos del grupo para cerrar los números',
    'Cierre. Pedir una reunión con quien gestione la plataforma de entradas y con el responsable de la sala.');
  const asks = [
    'Mesas vendidas por noche y zona en las dos últimas temporadas',
    'Plano real con numeración, aforos y precio de cada mesa',
    'Consumo medio real por mesa y margen de la carta',
    'Plataforma de venta actual y acceso a su histórico',
    'Número de relaciones públicas y esquema de comisiones',
    'Política de señal, cancelación y bloqueo de mesas',
  ];
  asks.forEach((t, i) => {
    const x = M + (i % 2) * 6.17, y = 1.7 + Math.floor(i / 2) * 1.2;
    dot(s, x, y + 0.1, 0.5, [C.accent1, C.accent2, C.accent3][Math.floor(i / 2)], String(i + 1), { fontSize: 16 });
    T(s, t, { x: x + 0.75, y, w: 5.1, h: 0.75, fontSize: 16, color: C.background1, valign: 'middle' });
  });
  card(s, M, 5.5, 12.13, 1.1, { fill: HEX.night });
  T(s, 'Próximo paso: reunión con el grupo y demo en vivo de la reserva con plano, botellas y campañas.', { x: M + 0.4, y: 5.5, w: 11.3, h: 1.1, fontSize: 18, bold: true, color: C.accent2, valign: 'middle' });
}

// ============ 19. Anexo ============
{
  const s = slideIn('CONTENT', 'Anexo', 'Anexo: fuentes y discrepancias entre ellas',
    'Cuando las fuentes discrepan, el modelo usa el dato más prudente o el de la fuente más cercana al grupo.');
  const head = ['Dato', 'Fuentes', 'Valor usado'].map((t) => ({ text: t, options: { bold: true, color: HEX.white, fill: { color: HEX.ink } } }));
  const rows = [
    ['Principal, viernes y sábado', 'Spain Club: 400 € · Valencia Nightlife: 300 €', '400 € (jueves 300 €)'],
    ['Ghost', 'Oficial: desde 1.500 € · Spain Club: desde 500 €, mesa 1 a 1.500 €', 'Escala de 500 a 1.500 €'],
    ['Petit Comité', 'Oficial y Spain Club: 500 € · un enlace: 300 €', '500 €'],
    ['Mesas por zona', 'Solo Spain Club: 14 · 7 · 16 · 5', '42 mesas en total'],
    ['Apertura de jueves', 'Oficial: 00:30 · otras fuentes: 23:59', '00:30 (oficial)'],
    ['Entrada', 'Oficial: 22 € · guía: tramos de 22 a 32 €', 'Desde 22 €'],
  ].map((r) => r.map((t) => ({ text: t, options: { color: HEX.ink } })));
  s.addTable([head, ...rows], { x: M, y: 1.55, w: 12.13, colW: [2.9, 6.3, 2.93], rowH: [0.45, ...Array(6).fill(0.55)], fontSize: 13, valign: 'middle', border: { type: 'solid', color: HEX.line, pt: 0.75 }, fill: { color: HEX.soft } });
  T(s, 'Fuentes consultadas en noviembre de 2026:', { x: M, y: 5.5, w: 12, h: 0.3, fontSize: 12, bold: true, color: C.accent6 });
  T(s, CLUB.sources.map(([n]) => n).join(' · ') + ' · Clubbable · Xceed · MATO', { x: M, y: 5.85, w: 12.1, h: 0.7, fontSize: 12, color: C.accent6 });
}

await pres.writeFile({ fileName: OUT });
if (APPLY_THEME) {
  const { applyTheme } = require(APPLY_THEME);
  await applyTheme(OUT, THEME);
}
console.log('Escrito', OUT, APPLY_THEME ? '(tema aplicado)' : '(sin aplicar tema)');
