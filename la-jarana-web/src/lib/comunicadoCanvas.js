// Dibuja el comunicado en un canvas para descargarlo (story 1080×1920 o A4 a 150 ppp 1240×1754).
// Mismo formato que en pantalla: cabecera con logo, capital, fórmula, puntos numerados,
// sello abajo a la derecha y pie con firma. Si el texto no cabe, reduce la letra hasta que cabe.
export const FORMATOS = { story: { w: 1080, h: 1920, nombre: 'story' }, a4: { w: 1240, h: 1754, nombre: 'a4' } };
export const FORMULA = 'LA JARANA, EN SU INCANSABLE AFÁN DE HACER RUBIELOS GRANDE OTRA VEZ, VIENE A DISPONER:';
const INK = '#1b2733', SKY = '#74ace5';
const DISPLAY = '"Mencken Std Head Narrow", "Instrument Serif", serif';
const SANS = '"Inter Variable", Inter, system-ui, sans-serif';

const load = (src) => new Promise((ok, ko) => { const i = new Image(); i.onload = () => ok(i); i.onerror = ko; i.src = src; });

// Parte en líneas; las palabras más largas que la línea se cortan por caracteres.
function lines(g, text, maxW) {
  const out = []; let line = '';
  const push = (w) => {
    const t = line ? `${line} ${w}` : w;
    if (g.measureText(t).width <= maxW) { line = t; return; }
    if (line) { out.push(line); line = ''; }
    if (g.measureText(w).width <= maxW) { line = w; return; }
    let chunk = '';
    for (const ch of w) { if (g.measureText(chunk + ch).width > maxW) { out.push(chunk); chunk = ch; } else chunk += ch; }
    line = chunk;
  };
  text.split(/\s+/).filter(Boolean).forEach(push);
  if (line) out.push(line);
  return out;
}

function sello(g, cx, cy, r) {
  g.save(); g.translate(cx, cy); g.rotate(-0.21);
  g.strokeStyle = SKY; g.fillStyle = SKY; g.globalAlpha = 0.95;
  g.lineWidth = r * 0.05; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.stroke();
  g.lineWidth = r * 0.025; g.beginPath(); g.arc(0, 0, r * 0.55, 0, Math.PI * 2); g.stroke();
  const txt = 'LA JARANA · RUBIELOS DE MORA · OFICIAL · ';
  g.font = `800 ${r * 0.17}px ${SANS}`; g.textAlign = 'center'; g.textBaseline = 'middle';
  const step = (Math.PI * 2) / txt.length;
  [...txt].forEach((ch, i) => { g.save(); g.rotate(i * step); g.translate(0, -r * 0.78); g.fillText(ch, 0, 0); g.restore(); });
  g.font = `900 ${r * 0.24}px ${SANS}`; g.fillText('SELLO', 0, 0);
  g.restore();
}

// Pinta el cuerpo (título, capital, fórmula, puntos) desde y0 con escala de letra k.
// Devuelve la y final; con dry=true solo mide.
function cuerpo(g, c, { pad, inner, u, y0, k, dry }) {
  const put = (t, x, y) => { if (!dry) g.fillText(t, x, y); };
  let y = y0;
  g.textBaseline = 'alphabetic'; g.fillStyle = INK;
  g.font = `${96 * u * k}px ${DISPLAY}`;
  for (const l of lines(g, c.titulo.toUpperCase(), inner)) { y += 92 * u * k; put(l, pad, y); }
  y += 40 * u * k;
  const cap = FORMULA[0];
  g.font = `${150 * u * k}px ${DISPLAY}`; g.fillStyle = SKY; put(cap, pad, y + 100 * u * k);
  const capW = g.measureText(cap).width + 18 * u;
  g.fillStyle = INK; g.font = `700 ${30 * u * k}px ${SANS}`;
  const fl = lines(g, FORMULA.slice(1), inner - capW);
  let yy = y + 34 * u * k;
  fl.forEach((l) => { put(l, pad + capW, yy); yy += 42 * u * k; });
  y = Math.max(yy, y + 120 * u * k) + 40 * u * k;
  c.puntos.forEach((p, i) => {
    g.fillStyle = SKY; g.font = `${60 * u * k}px ${DISPLAY}`; put(`${i + 1}.`, pad, y + 40 * u * k);
    g.fillStyle = INK; g.font = `500 ${34 * u * k}px ${SANS}`;
    for (const l of lines(g, p, inner - 70 * u)) { y += 46 * u * k; put(l, pad + 70 * u, y); }
    y += 26 * u * k;
  });
  return y;
}

export async function dibujaComunicado(c, formato = 'story') {
  const { w, h } = FORMATOS[formato];
  await Promise.all([document.fonts?.load(`80px ${DISPLAY}`), document.fonts?.load(`600 30px ${SANS}`)].filter(Boolean)).catch(() => {});
  const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
  const g = cv.getContext('2d');
  const pad = Math.round(w * 0.08), inner = w - pad * 2, u = w / 1080;
  g.fillStyle = SKY; g.fillRect(0, 0, w, h);
  const sx = pad * 0.5, sy = pad * 0.5, sw = w - pad, sh = h - pad;
  g.fillStyle = '#fff'; g.fillRect(sx, sy, sw, sh);
  g.strokeStyle = INK; g.lineWidth = 4 * u; g.strokeRect(sx, sy, sw, sh);
  // cabecera
  let y = sy + 60 * u;
  try {
    // Silueta vectorial del logo en un solo color de tinta (nítida a cualquier tamaño).
    const logo = await load('/img/logo-linea.svg');
    const lh = 150 * u, lw = lh * (1046 / 1369);
    const off = document.createElement('canvas'); off.width = Math.ceil(lw * 2); off.height = Math.ceil(lh * 2);
    const og = off.getContext('2d');
    og.drawImage(logo, 0, 0, off.width, off.height);
    og.globalCompositeOperation = 'source-in'; og.fillStyle = INK; og.fillRect(0, 0, off.width, off.height);
    g.drawImage(off, pad, y, lw, lh);
    g.fillStyle = INK; g.font = `${54 * u}px ${DISPLAY}`; g.textBaseline = 'middle';
    g.fillText('LA JARANA · RUBIELOS DE MORA', pad + lw + 26 * u, y + lh / 2, inner - lw - 26 * u);
    y += lh + 30 * u;
  } catch { y += 40 * u; }
  g.fillStyle = INK; g.fillRect(pad, y, inner, 3 * u); y += 30 * u;
  // el cuerpo debe acabar antes de la zona del sello y el pie
  const r = 120 * u, limite = sy + sh - 160 * u - r * 2 - 20 * u;
  let k = 1;
  while (k > 0.45 && cuerpo(g, c, { pad, inner, u, y0: y, k, dry: true }) > limite) k -= 0.05;
  cuerpo(g, c, { pad, inner, u, y0: y, k, dry: false });
  // sello abajo a la derecha + pie
  sello(g, sx + sw - r - 50 * u, sy + sh - r - 190 * u, r);
  g.fillStyle = INK; g.fillRect(pad, sy + sh - 160 * u, inner, 3 * u);
  g.textBaseline = 'alphabetic';
  g.font = `${44 * u}px ${DISPLAY}`; g.fillText('MAKE RUBIELOS GREAT AGAIN · CEO OF GÚDAR-JAVALAMBRE', pad, sy + sh - 100 * u, inner);
  g.font = `600 ${24 * u}px ${SANS}`; g.fillText('Comunicado proporcionado por La Jarana', pad, sy + sh - 55 * u, inner);
  return cv;
}

// Devuelve true si la descarga arrancó; false si el navegador no pudo generar la imagen.
export async function descargaComunicado(c, formato) {
  try {
    const cv = await dibujaComunicado(c, formato);
    const blob = await new Promise((ok) => cv.toBlob(ok, 'image/png'));
    if (!blob) return false;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `comunicado-la-jarana-${FORMATOS[formato].nombre}.png`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    return true;
  } catch { return false; }
}
