// Demo de reservados VIP · Committee Club Valencia
// Toda la lógica vive en el servidor (app.mjs); esta pantalla solo llama a la API.

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const eur = (n) => `${Math.round(n).toLocaleString('es-ES', { useGrouping: 'always' })} €`;
const pct = (n, d = 1) => `${(n * 100).toFixed(d).replace('.', ',')} %`;
const num = (n, d = 0) => n.toLocaleString('es-ES', { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: 'always' });
const dayLabel = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
const debounce = (fn, ms) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };

// ---------- Registro de la API ----------
const calls = [];
function logCall(method, url, reqBody, status, ms, resBody) {
  calls.unshift({ method, url, reqBody, status, ms, resBody });
  if (calls.length > 40) calls.pop();
  $('#apilog-count').textContent = `${calls.length >= 40 ? '40+' : calls.length} llamadas`;
  $('#apilog-entries').innerHTML = calls.map((c) => `
    <div class="entry"><details><summary><span class="mono m-${c.method}">${c.method}</span> <span class="mono">${esc(c.url)}</span>
      <span class="tag ${c.status < 400 ? 'green' : 'red'}">${c.status || 'sin red'}</span> <span class="muted">${c.ms} ms</span></summary>
      ${c.reqBody ? `<pre>→ ${esc(JSON.stringify(c.reqBody, null, 2))}</pre>` : ''}<pre>← ${esc(JSON.stringify(c.resBody, null, 2).slice(0, 1800))}</pre></details></div>`).join('');
}
async function api(method, url, body) {
  const t0 = performance.now();
  let status = 0, data;
  try {
    const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    status = res.status;
    data = await res.json();
  } catch {
    data = { error: { code: 'red', message: 'No hay conexión con el servidor de la demo.' } };
  }
  logCall(method, url, body, status, Math.round(performance.now() - t0), data);
  if (status === 0 || status >= 400) throw Object.assign(new Error(data.error?.message ?? 'Error'), { code: data.error?.code, status });
  return data;
}
function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast'; t.setAttribute('role', 'status'); t.textContent = msg;
  document.body.append(t);
  setTimeout(() => t.remove(), 4200);
}

// ---------- Datos comunes ----------
let CLUB = null, BOTTLES = [];
const STATUS_COLOR = { libre: '#34d399', retenida: '#f5b544', reservada: '#e8334f', bloqueada: '#6f6a7d' };
const zoneColor = (id) => CLUB.zones.find((z) => z.id === id)?.color ?? '#fff';
const zoneName = (id) => CLUB.zones.find((z) => z.id === id)?.name ?? id;

function planSvg(floor, tables, { selected = null, interactive = true } = {}) {
  const first = floor === 'first';
  const vb = first ? '0 0 1000 620' : '0 0 1000 420';
  const deco = first
    ? `<rect x="400" y="18" width="200" height="46" rx="6" fill="#6f6a7d"/><text x="500" y="47" text-anchor="middle" font-size="16" fill="#fff">DJ</text>
       <rect x="250" y="180" width="500" height="300" rx="14" fill="#2a2040" stroke="#6f6a7d" stroke-dasharray="6 6"/>
       <text class="zone-label" x="500" y="335" text-anchor="middle" font-size="22" fill="#a39db3">PISTA</text>
       <text class="zone-label" x="500" y="150" text-anchor="middle" font-size="13">PRINCIPAL · detrás de la cabina</text>
       <text class="zone-label" x="140" y="160" text-anchor="middle" font-size="13">TARIMA</text>
       <text class="zone-label" x="860" y="160" text-anchor="middle" font-size="13">TARIMA</text>
       <text class="zone-label" x="500" y="515" text-anchor="middle" font-size="13">GHOST · acceso privado</text>`
    : `<text class="zone-label" x="500" y="40" text-anchor="middle" font-size="14">PETIT COMITÉ · planta superior · hip-hop y R&amp;B</text>
       <rect x="30" y="170" width="90" height="140" rx="8" fill="#2a2040"/><text class="zone-label" x="75" y="245" text-anchor="middle" font-size="12">ESCALERA</text>`;
  const circles = tables.filter((t) => t.floor === floor).map((t) => {
    const col = STATUS_COLOR[t.status];
    const free = t.status === 'libre';
    const label = `Mesa ${t.id}, ${zoneName(t.zone)}, ${t.price} euros, ${t.status}`;
    return `<g><circle class="t ${selected === t.id ? 'sel' : ''} ${interactive && !free ? 'off' : ''}" data-id="${t.id}" cx="${t.x}" cy="${t.y}" r="19" fill="${col}" stroke="${zoneColor(t.zone)}"
      ${interactive ? `role="button" tabindex="0" aria-label="${esc(label)}"` : `aria-label="${esc(label)}"`}><title>${esc(label)}</title></circle>
      <text x="${t.x}" y="${t.y + 4}" text-anchor="middle" font-size="${t.id.length > 2 ? 10 : 12}">${t.id}</text></g>`;
  }).join('');
  return `<svg class="plan" viewBox="${vb}" role="group" aria-label="Plano de ${first ? 'la planta principal' : 'la planta superior'}">${deco}${circles}</svg>`;
}
const legendHtml = `<div class="legend"><span><i style="background:#34d399"></i>Libre</span><span><i style="background:#f5b544"></i>Retenida</span><span><i style="background:#e8334f"></i>Reservada</span><span><i style="background:#6f6a7d"></i>Bloqueada</span></div>`;

function bindPlan(root, handler) {
  $$('circle.t', root).forEach((c) => {
    const fire = () => handler(c.dataset.id);
    c.addEventListener('click', fire);
    c.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fire(); } });
  });
}

// =====================================================================
// CLIENTE
// =====================================================================
const C = { step: 1, events: [], date: null, people: 5, tables: [], floor: 'first', tableId: null, hold: null, items: new Map(), quote: null, cat: 'Champán', search: '', offer: null, reservation: null, timer: null, busy: false, error: '' };
const root = $('#p-cliente');

const EXPLAIN = {
  1: ['GET /api/events', 'Lista las próximas noches con edad mínima y ocupación real de la sala.', 'Si llegas con un enlace de oferta: GET /api/offers/:token comprueba que no esté usado ni caducado.'],
  2: ['GET /api/events/:fecha/tables', 'Devuelve el estado de cada mesa en tiempo real.', 'POST /api/holds retiene la mesa 10 minutos para que nadie más la reserve mientras pagas.'],
  3: ['POST /api/quote', 'Cada vez que cambias una botella se recalcula el consumo mínimo, el suplemento por personas extra y la señal.', 'Los refrescos incluidos se cuentan por botella de destilado. El champán no lleva refrescos.'],
  4: ['POST /api/reservations', 'Valida la edad según la noche, el consumo mínimo y la oferta.', 'POST /api/reservations/:id/pay confirma la señal del 50 % (aquí simulado) y dispara la confirmación por WhatsApp y el aviso al equipo.'],
  5: ['GET /api/outbox', 'La confirmación con el QR y el aviso a los encargados salen del servidor.', 'En el panel «Sala» la mesa pasa a rojo y la botella aparece en la lista de preparación de barra.'],
};

function clearTimer() { if (C.timer) { clearInterval(C.timer); C.timer = null; } }
function startTimer() {
  clearTimer();
  C.timer = setInterval(async () => {
    const el = $('#timer-left');
    if (!C.hold) return clearTimer();
    const left = Math.max(0, Math.round((C.hold.expiresAt - Date.now()) / 1000));
    if (el) el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    if (left === 0) {
      clearTimer(); C.hold = null; C.tableId = null; C.step = 2; C.items.clear();
      toast('La retención de la mesa ha caducado. Elige de nuevo.');
      await loadTables(); render();
    }
  }, 1000);
}

async function loadEvents() {
  C.events = (await api('GET', '/api/events')).events;
}
async function loadTables() {
  C.tables = (await api('GET', `/api/events/${C.date}/tables`)).tables;
}
const itemsPayload = () => [...C.items].map(([bottleId, qty]) => ({ bottleId, qty }));
const refreshQuote = debounce(async () => {
  if (!C.tableId) return;
  try {
    C.quote = await api('POST', '/api/quote', { date: C.date, tableId: C.tableId, people: C.people, items: itemsPayload(), offerToken: C.offer?.token });
    updateSummary();
  } catch (e) { C.error = e.message; render(); }
}, 120);

async function openOffer(token) {
  try {
    C.offer = await api('GET', `/api/offers/${encodeURIComponent(token)}`);
    C.date = C.offer.date; C.step = 1;
    showTab('cliente');
    await loadEvents(); render();
  } catch (e) { toast(e.message); }
}

function resetFlow() {
  clearTimer();
  Object.assign(C, { step: 1, date: C.offer?.date ?? null, tableId: null, hold: null, items: new Map(), quote: null, reservation: null, error: '', people: 5 });
}

function stepsBar() {
  return `<div class="steps" aria-hidden="true">${[1, 2, 3, 4].map((i) => `<i class="${i <= Math.min(C.step, 4) ? 'done' : ''}"></i>`).join('')}</div>`;
}

function render() {
  const e = EXPLAIN[C.step];
  root.innerHTML = `<div class="client-layout">
    <div class="phone" id="phone">${stepsBar()}${stepHtml()}</div>
    <aside class="card"><h3>Qué hace el sistema ahora</h3>
      <p class="muted small">Paso ${Math.min(C.step, 4)} de 4. Esta demo la usa el cliente desde el móvil.</p>
      <ul class="explain"><li><code>${esc(e[0])}</code></li><li>${esc(e[1])}</li><li>${esc(e[2])}</li></ul>
      <hr style="border-color:var(--line)">
      <p class="small muted">Qué se ha simulado: el cobro, el envío de WhatsApp y los datos de clientes. Todo lo demás (disponibilidad, retenciones, reglas de la mesa, edad mínima, ofertas de un solo uso) lo calcula el servidor.</p>
    </aside></div>`;
  bindStep();
}

function stepHtml() {
  if (C.step === 1) {
    const offer = C.offer ? `<div class="banner"><b>Oferta para ${esc(C.offer.name)}:</b> ${esc(C.offer.benefitText)}. Válida para el ${esc(dayLabel(C.offer.date))}. <span class="muted">Un solo uso.</span></div>` : '';
    const list = C.events.filter((ev) => !C.offer || ev.date === C.offer.date).slice(0, C.offer ? 1 : 9).map((ev) => `
      <button class="night" data-date="${ev.date}" aria-pressed="${C.date === ev.date}">
        <span><b>${esc(dayLabel(ev.date))}</b><br><span class="muted small">+${ev.minAge} · desde las ${ev.opens}</span></span>
        <span style="text-align:right"><span class="small">${ev.tablesFree} mesas libres</span><div class="meter" style="width:90px"><i style="width:${Math.round(ev.occupancy * 100)}%"></i></div></span></button>`).join('');
    return `<h3>Reserva tu mesa</h3>${offer}<div class="grid" style="gap:8px">${list}</div>
      <div><div class="small muted">¿Cuántos sois?</div><div class="stepper"><button id="minus" aria-label="Una persona menos">−</button><output id="people">${C.people}</output><button id="plus" aria-label="Una persona más">+</button></div>
      <div class="tiny muted">Mesa para 5. Hasta 2 personas extra con un 20 % de suplemento cada una.</div></div>
      <div class="error" role="alert">${esc(C.error)}</div>
      <button class="btn" id="next" ${C.date ? '' : 'disabled'} style="margin-top:auto">Elegir mesa</button>`;
  }
  if (C.step === 2) {
    const sel = C.tables.find((t) => t.id === C.tableId);
    const info = sel ? `<div class="timer"><span>Mesa <b style="color:var(--text)">${sel.id}</b> · ${esc(zoneName(sel.zone))} · desde ${eur(sel.price)}</span><span>retenida <b id="timer-left">10:00</b></span></div>` : '<p class="muted small">Toca una mesa libre. Se retiene 10 minutos mientras completas la reserva.</p>';
    return `<h3>Elige tu mesa</h3><div style="display:flex;gap:8px"><button class="chip" data-floor="first" aria-pressed="${C.floor === 'first'}">Planta principal</button><button class="chip" data-floor="upper" aria-pressed="${C.floor === 'upper'}">Planta superior</button></div>
      <div id="plan-wrap">${planSvg(C.floor, C.tables, { selected: C.tableId })}</div>${legendHtml}${info}
      <div class="error" role="alert">${esc(C.error)}</div>
      <div style="display:flex;gap:8px;margin-top:auto"><button class="btn ghost" id="back">Atrás</button><button class="btn" id="next" style="flex:1" ${C.hold ? '' : 'disabled'}>Elegir botellas</button></div>`;
  }
  if (C.step === 3) {
    const cats = CLUB.categories.map((c) => `<button class="chip" data-cat="${c}" aria-pressed="${C.cat === c && !C.search}">${c}</button>`).join('');
    return `<h3>Botellas y refrescos</h3><div style="display:flex;gap:6px;flex-wrap:wrap">${cats}</div>
      <div class="field" style="margin:0"><label class="sr-only" for="search">Buscar</label><input id="search" type="search" placeholder="Buscar marca" value="${esc(C.search)}"></div>
      <div class="list" id="bottle-list">${bottleListHtml()}</div>
      <div class="sticky-sum" id="summary">${summaryHtml()}</div>
      <div class="error" role="alert">${esc(C.error)}</div>
      <div style="display:flex;gap:8px"><button class="btn ghost" id="back">Atrás</button><button class="btn" id="next" style="flex:1" ${C.quote?.meetsMinimum ? '' : 'disabled'}>Continuar</button></div>`;
  }
  if (C.step === 4) {
    const q = C.quote;
    return `<h3>Tus datos y la señal</h3>
      <form id="form" novalidate>
        <div class="field"><label for="f-name">Nombre</label><input id="f-name" autocomplete="name" required></div>
        <div class="field"><label for="f-phone">Teléfono (WhatsApp)</label><input id="f-phone" inputmode="tel" autocomplete="tel" placeholder="+34 600 000 000" required></div>
        <div class="field"><label for="f-email">Correo (opcional)</label><input id="f-email" type="email" autocomplete="email"></div>
        <div class="field"><label for="f-birth">Fecha de nacimiento</label><input id="f-birth" type="date" required></div>
        <div class="field"><label for="f-pr">Código de relaciones públicas (opcional)</label><input id="f-pr" placeholder="RP-ANA" style="text-transform:uppercase"></div>
        <label class="check"><input type="checkbox" id="f-terms"><span>Acepto las condiciones: la señal del 50 % confirma la mesa y el resto se paga al llegar.</span></label>
        <label class="check"><input type="checkbox" id="f-consent"><span class="small">Quiero recibir ofertas y recordatorios por WhatsApp (opcional). Puedo darme de baja en cualquier mensaje.</span></label>
      </form>
      <div class="card" style="padding:12px" id="summary">${summaryHtml(true)}</div>
      <div class="error" role="alert" id="form-error">${esc(C.error)}</div>
      <div style="display:flex;gap:8px;margin-top:auto"><button class="btn ghost" id="back">Atrás</button><button class="btn gold" id="pay" style="flex:1" ${C.busy ? 'disabled' : ''}>Pagar señal de ${eur(q?.deposit ?? 0)} (simulado)</button></div>`;
  }
  const r = C.reservation;
  return `<h3>Reserva confirmada</h3>
    <div class="ok-box"><b>${esc(r.code)}</b> · Mesa ${esc(r.tableId)} (${esc(zoneName(r.zone))})<br>${esc(dayLabel(r.date))} · ${r.people} personas</div>
    <div class="qr" id="qr" aria-label="Código QR de la reserva"></div>
    <div class="small">Señal cobrada: <b>${eur(r.deposit)}</b> · Resto en sala: <b>${eur(r.remaining)}</b></div>
    ${r.items.map((l) => `<div class="small muted">${l.qty} × ${esc(l.name)} · ${l.mixers ? `${l.mixers} refrescos` : 'sin refrescos'}</div>`).join('')}
    ${r.bonus.map((b) => `<div class="small" style="color:var(--gold)">Cortesía: ${esc(b.name)}</div>`).join('')}
    <div class="card small" id="wa" style="padding:10px"></div>
    <button class="btn" id="again" style="margin-top:auto">Nueva reserva</button>`;
}

function bottleListHtml() {
  const q = C.search.trim().toLowerCase();
  const list = BOTTLES.filter((b) => (q ? b.name.toLowerCase().includes(q) : b.category === C.cat));
  if (!list.length) return '<p class="muted small">Sin resultados.</p>';
  return list.map((b) => `<div class="bottle"><div><div>${esc(b.name)}</div><div class="tiny muted">${b.mixers ? `${b.mixers} refrescos incluidos` : 'Sin refrescos'}</div></div><b>${eur(b.price)}</b>
    <div class="qty"><button data-dec="${b.id}" aria-label="Quitar ${esc(b.name)}">−</button><span>${C.items.get(b.id) ?? 0}</span><button data-inc="${b.id}" aria-label="Añadir ${esc(b.name)}">+</button></div></div>`).join('');
}

function summaryHtml(full = false) {
  const q = C.quote;
  if (!q) return '<p class="muted small">Calculando…</p>';
  const progress = Math.min(100, Math.round((q.itemsTotal / q.minSpend) * 100));
  const head = `<div class="small" style="display:flex;justify-content:space-between"><span>Consumo mínimo (${q.people} pers.)</span><b>${eur(q.minSpend)}</b></div>
    <div class="meter" aria-hidden="true"><i style="width:${progress}%;${q.meetsMinimum ? 'background:var(--green)' : ''}"></i></div>
    <div class="small" style="margin-top:6px">${q.meetsMinimum ? `<span style="color:var(--green)">Mínimo alcanzado</span> · seleccionado ${eur(q.itemsTotal)}` : `Seleccionado ${eur(q.itemsTotal)} · faltan <b>${eur(q.missing)}</b>`}</div>`;
  const extra = [
    q.extraPeople ? `<div class="tiny muted">${q.extraPeople} persona(s) extra: +${eur(q.surcharge)}${q.surchargeWaived ? ` · <span style="color:var(--gold)">suplemento gratis por tu oferta (−${eur(q.surchargeWaived)})</span>` : ''}</div>` : '',
    q.mixers ? `<div class="tiny muted">${q.mixers} refrescos incluidos</div>` : '',
    ...q.bonus.map((b) => `<div class="tiny" style="color:var(--gold)">Cortesía: ${esc(b.name)} (${eur(b.value)})</div>`),
  ].join('');
  const money = full ? `<div class="small" style="margin-top:8px;display:grid;grid-template-columns:1fr auto;gap:2px 8px"><span>Comprometido</span><b>${eur(q.committed)}</b><span>Señal ahora (50 %)</span><b>${eur(q.deposit)}</b><span>Resto en sala</span><b>${eur(q.remaining)}</b></div>` : '';
  return head + extra + money;
}
function updateSummary() {
  const s = $('#summary');
  if (s) s.innerHTML = summaryHtml(C.step === 4);
  const nx = $('#next');
  if (nx && C.step === 3) nx.disabled = !C.quote?.meetsMinimum;
  if (C.step === 4) { const p = $('#pay'); if (p) p.textContent = `Pagar señal de ${eur(C.quote?.deposit ?? 0)} (simulado)`; }
}

function bindStep() {
  const on = (sel, fn) => { const el = $(sel, root); if (el) el.addEventListener('click', fn); };
  if (C.step === 1) {
    $$('.night', root).forEach((b) => b.addEventListener('click', () => { C.date = b.dataset.date; C.error = ''; render(); }));
    on('#minus', () => { C.people = Math.max(1, C.people - 1); $('#people').textContent = C.people; });
    on('#plus', () => { C.people = Math.min(7, C.people + 1); $('#people').textContent = C.people; });
    on('#next', async () => {
      try { await loadTables(); C.step = 2; C.error = ''; } catch (e) { C.error = e.message; }
      render();
    });
  }
  if (C.step === 2) {
    $$('[data-floor]', root).forEach((b) => b.addEventListener('click', () => { C.floor = b.dataset.floor; render(); }));
    bindPlan(root, async (id) => {
      const t = C.tables.find((x) => x.id === id);
      if (t.status !== 'libre' && id !== C.tableId) return toast(`La mesa ${id} no está libre.`);
      if (id === C.tableId) return;
      try {
        if (C.hold) await api('DELETE', `/api/holds/${C.hold.holdId}`);
        C.hold = await api('POST', '/api/holds', { date: C.date, tableId: id });
        C.tableId = id; C.error = ''; startTimer();
      } catch (e) { C.error = e.message; C.hold = null; C.tableId = null; }
      await loadTables(); render();
    });
    on('#back', async () => { if (C.hold) { await api('DELETE', `/api/holds/${C.hold.holdId}`); } clearTimer(); C.hold = null; C.tableId = null; C.step = 1; render(); });
    on('#next', async () => {
      try { C.quote = await api('POST', '/api/quote', { date: C.date, tableId: C.tableId, people: C.people, items: itemsPayload(), offerToken: C.offer?.token }); C.step = 3; C.error = ''; }
      catch (e) { C.error = e.message; }
      render();
    });
  }
  if (C.step === 3) {
    $$('[data-cat]', root).forEach((b) => b.addEventListener('click', () => { C.cat = b.dataset.cat; C.search = ''; render(); }));
    const s = $('#search', root);
    s.addEventListener('input', () => { C.search = s.value; $('#bottle-list').innerHTML = bottleListHtml(); bindQty(); });
    bindQty();
    on('#back', () => { C.step = 2; render(); startTimerIfHold(); });
    on('#next', () => { C.step = 4; C.error = ''; render(); });
  }
  if (C.step === 4) {
    on('#back', () => { C.step = 3; render(); });
    on('#pay', submitReservation);
  }
  if (C.step === 5) {
    on('#again', async () => { resetFlow(); await loadEvents(); render(); });
    showQr(); showWhatsapp();
  }
}
const startTimerIfHold = () => { if (C.hold) startTimer(); };
function bindQty() {
  $$('[data-inc]').forEach((b) => b.addEventListener('click', () => changeQty(b.dataset.inc, 1)));
  $$('[data-dec]').forEach((b) => b.addEventListener('click', () => changeQty(b.dataset.dec, -1)));
}
function changeQty(id, d) {
  const n = Math.max(0, Math.min(10, (C.items.get(id) ?? 0) + d));
  if (n === 0) C.items.delete(id); else C.items.set(id, n);
  $('#bottle-list').innerHTML = bottleListHtml(); bindQty();
  refreshQuote();
}

async function submitReservation() {
  const v = (id) => $(id).value.trim();
  const body = {
    holdId: C.hold?.holdId, name: v('#f-name'), phone: v('#f-phone'), email: v('#f-email'), birthdate: $('#f-birth').value,
    people: C.people, items: itemsPayload(), prCode: v('#f-pr').toUpperCase() || undefined, acceptTerms: $('#f-terms').checked,
    consentMarketing: $('#f-consent').checked, offerToken: C.offer?.token,
  };
  C.busy = true; $('#pay').disabled = true;
  try {
    const r = await api('POST', '/api/reservations', body);
    C.reservation = await api('POST', `/api/reservations/${r.id}/pay`);
    clearTimer(); C.hold = null; C.step = 5; C.error = '';
    if (C.offer) C.offer = null;
    history.replaceState(null, '', location.pathname);
  } catch (e) {
    C.error = e.message;
    if (['retencion_caducada'].includes(e.code)) { C.step = 2; C.hold = null; C.tableId = null; await loadTables(); }
  }
  C.busy = false; render();
}
function showQr() {
  const box = $('#qr');
  const text = C.reservation.qr;
  try {
    const qr = window.qrcode(0, 'M'); qr.addData(text); qr.make();
    box.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  } catch { box.innerHTML = `<div class="mono" style="color:#111;word-break:break-all">${esc(text)}</div>`; }
}
async function showWhatsapp() {
  try {
    const { messages } = await api('GET', '/api/outbox');
    const m = messages.find((x) => x.type === 'confirmacion');
    $('#wa').innerHTML = m ? `<div class="tiny muted">WhatsApp enviado (simulado) a ${esc(m.to)}</div>${esc(m.text)}` : '';
  } catch { /* opcional */ }
}

// =====================================================================
// SALA (encargado)
// =====================================================================
const S = { date: null, data: null, selected: null, poll: null };
const salaEl = $('#p-sala');

async function loadSala() {
  if (!S.date) S.date = C.events[0]?.date;
  S.data = await api('GET', `/api/admin/night?date=${S.date}`);
  renderSala();
}
function renderSala() {
  const d = S.data, k = d.kpis;
  const sel = d.tables.find((t) => t.id === S.selected);
  const tile = (n, l) => `<div class="kpi"><b>${n}</b><span>${l}</span></div>`;
  salaEl.innerHTML = `
    <div style="display:flex;gap:12px;align-items:end;flex-wrap:wrap;margin-bottom:16px">
      <div><h2>Panel de la noche</h2><div class="muted small">Se actualiza solo cada 5 segundos. Es el mismo plano que ve el cliente.</div></div>
      <div class="field" style="margin:0 0 0 auto"><label for="s-date">Noche</label><select id="s-date">${C.events.map((e) => `<option value="${e.date}" ${e.date === S.date ? 'selected' : ''}>${esc(dayLabel(e.date))}</option>`).join('')}</select></div>
    </div>
    <div class="grid cols-4" style="margin-bottom:16px">
      ${tile(`${k.ocupacion} %`, 'ocupación de mesas')}${tile(`${k.reservadas} / ${k.retenidas} / ${k.libres}`, 'reservadas / retenidas / libres')}
      ${tile(eur(k.consumoComprometido), 'consumo comprometido')}${tile(`${eur(k.senalesCobradas)} · ${eur(k.pendienteEnSala)}`, 'señales cobradas · pendiente en sala')}
    </div>
    <div class="grid cols-2">
      <div class="card"><h3>Plano</h3><div class="muted small" style="margin-bottom:8px">Toca una mesa para ver su detalle o bloquearla.</div>
        ${planSvg('first', d.tables, { selected: S.selected })}<div style="height:10px"></div>${planSvg('upper', d.tables, { selected: S.selected })}${legendHtml}
        <div class="card" style="margin-top:12px;background:var(--surface-2)" id="s-detail">${detailHtml(sel)}</div></div>
      <div class="grid" style="align-content:start">
        <div class="card"><h3>Preparación de barra</h3><div class="muted small">Botellas y refrescos de las reservas confirmadas. Total refrescos: <b>${d.mixersTotal}</b></div>
          ${d.barPrep.length ? `<table class="data"><tr><th>Botella</th><th>Uds.</th><th>Refrescos</th></tr>${d.barPrep.slice(0, 12).map((p) => `<tr><td>${esc(p.name)}</td><td>${p.qty}</td><td>${p.mixers}</td></tr>`).join('')}</table>` : '<p class="muted small">Todavía no hay reservas confirmadas.</p>'}</div>
        <div class="card"><h3>Comisiones por relaciones públicas</h3>
          <table class="data"><tr><th>Código</th><th>Consumo comprometido</th></tr>${d.comisionPorRRPP.map((c) => `<tr><td>${esc(c.code)}</td><td>${eur(c.committed)}</td></tr>`).join('') || '<tr><td colspan="2" class="muted">Sin datos</td></tr>'}</table></div>
        <div class="card"><h3>Últimas reservas</h3>
          <table class="data"><tr><th>Código</th><th>Mesa</th><th>Cliente</th><th>Pax</th><th>Total</th></tr>${d.reservations.slice(0, 8).map((r) => `<tr><td class="mono">${esc(r.code)}</td><td>${esc(r.tableId)}</td><td>${esc(r.name)}</td><td>${r.people}</td><td>${eur(r.committed)}</td></tr>`).join('')}</table></div>
      </div>
    </div>`;
  $('#s-date', salaEl).addEventListener('change', (e) => { S.date = e.target.value; S.selected = null; loadSala(); });
  bindPlan(salaEl, (id) => { S.selected = id; renderSala(); });
  const blockBtn = $('#s-block', salaEl), unblockBtn = $('#s-unblock', salaEl);
  if (blockBtn) blockBtn.addEventListener('click', async () => { try { await api('POST', '/api/admin/block', { date: S.date, tableId: S.selected, reason: 'Compromiso de la sala' }); } catch (e) { toast(e.message); } loadSala(); });
  if (unblockBtn) unblockBtn.addEventListener('click', async () => { await api('DELETE', `/api/admin/block?date=${S.date}&tableId=${S.selected}`); loadSala(); });
}
function detailHtml(t) {
  if (!t) return '<span class="muted small">Ninguna mesa seleccionada.</span>';
  const head = `<b>Mesa ${t.id}</b> · ${esc(zoneName(t.zone))} · mínimo ${eur(t.price)} <span class="tag ${t.status === 'libre' ? 'green' : t.status === 'reservada' ? 'red' : 'gold'}">${t.status}</span>`;
  if (t.reservation) return `${head}<div class="small" style="margin-top:6px">${esc(t.reservation.name)} · ${t.reservation.people} pax · ${eur(t.reservation.committed)} · ${esc(t.reservation.code)}${t.reservation.prCode ? ` · ${esc(t.reservation.prCode)}` : ''}</div>`;
  if (t.status === 'bloqueada') return `${head}<div class="small muted">${esc(t.block?.reason ?? '')}</div><button class="btn small ghost" id="s-unblock" style="margin-top:8px">Desbloquear</button>`;
  if (t.status === 'libre') return `${head}<div><button class="btn small ghost" id="s-block" style="margin-top:8px">Bloquear mesa (reserva manual)</button></div>`;
  return head;
}

// =====================================================================
// CAMPAÑAS
// =====================================================================
const K = { threshold: 0.6, preview: null, outbox: [], pick: null };
const campEl = $('#p-campanas');

async function loadCampaigns() {
  K.preview = await api('GET', `/api/campaigns/preview?threshold=${K.threshold}`);
  K.outbox = (await api('GET', '/api/outbox')).messages.filter((m) => m.token);
  renderCampaigns();
}
function renderCampaigns() {
  const p = K.preview, t = p.totals;
  const tile = (n, l) => `<div class="kpi"><b>${n}</b><span>${l}</span></div>`;
  campEl.innerHTML = `
    <h2>Campañas de cumpleaños y reactivación</h2>
    <p class="muted small" style="max-width:70ch">Cruza la base de clientes (sintética) con la ocupación real de las próximas noches. Solo escribe a quien dio su consentimiento, solo ofrece noches con hueco, deja un 10 % de grupo de control y crea un enlace de un solo uso por cliente.</p>
    <div class="grid cols-4" style="margin:16px 0">
      ${tile(t.customers, 'clientes en la base')}${tile(`${t.withConsent} (${Math.round((t.withConsent / t.customers) * 100)} %)`, 'con consentimiento')}
      ${tile(t.sendable, 'ofertas a enviar')}${tile(`${t.control} · ${p.excluded.sinConsentimiento}`, 'grupo de control · sin consentimiento')}
    </div>
    <div class="card" style="margin-bottom:16px"><div class="range"><label for="k-th">Solo ofrecer noches con menos de este % de ocupación</label><b>${Math.round(K.threshold * 100)} %</b>
      <input type="range" id="k-th" min="0.3" max="0.9" step="0.05" value="${K.threshold}"></div>
      <div class="small muted">Noches con hueco: ${p.nightsWithRoom.map((n) => `${esc(dayLabel(n.date))} (${n.occupancy} %)`).join(' · ') || 'ninguna'}</div></div>
    <div class="grid cols-2">
      <div class="card"><h3>Destinatarios</h3><div class="small muted" style="margin-bottom:8px">Toca una fila para ver el mensaje.</div>
        <div style="max-height:380px;overflow:auto"><table class="data"><tr><th>Cliente</th><th>Motivo</th><th>Noche</th><th></th></tr>
        ${p.items.slice(0, 40).map((i, n) => `<tr data-row="${n}" style="cursor:pointer"><td>${esc(i.name)}<div class="tiny muted">${esc(i.phone)}</div></td><td>${esc(i.reason)}<div><span class="tag ${i.type === 'cumpleanos' ? 'gold' : 'violet'}">${i.type === 'cumpleanos' ? 'cumpleaños' : 'reactivación'}</span></div></td><td>${esc(dayLabel(i.night.date))}<div class="tiny muted">${i.night.occupancy} % ocupada</div></td><td>${i.control ? '<span class="tag">control</span>' : ''}</td></tr>`).join('')}</table></div></div>
      <div class="grid" style="align-content:start">
        <div class="card"><h3>Mensaje</h3><div id="k-msg" class="small">${K.pick != null && p.items[K.pick] ? `<p>${esc(p.items[K.pick].message)}</p><div class="tag gold">${esc(p.items[K.pick].benefitText)}</div>` : '<span class="muted">Selecciona un destinatario.</span>'}</div>
          <button class="btn" id="k-send" style="margin-top:12px" ${t.sendable ? '' : 'disabled'}>Enviar campaña (simulado)</button></div>
        <div class="card"><h3>Mensajes enviados</h3>${K.outbox.length ? K.outbox.slice(0, 6).map((m) => `<div class="small" style="border-top:1px solid var(--line);padding:8px 0"><b>${esc(m.name)}</b> <span class="tag">${esc(m.type)}</span><div class="muted">${esc(m.text)}</div><button class="btn small ghost" data-offer="${esc(m.token)}" style="margin-top:6px">Abrir enlace como cliente</button></div>`).join('') : '<span class="muted small">Aún no se ha enviado nada.</span>'}</div>
      </div></div>`;
  $('#k-th', campEl).addEventListener('change', (e) => { K.threshold = Number(e.target.value); loadCampaigns(); });
  $$('[data-row]', campEl).forEach((tr) => tr.addEventListener('click', () => { K.pick = Number(tr.dataset.row); renderCampaigns(); }));
  $('#k-send', campEl).addEventListener('click', async () => {
    const r = await api('POST', '/api/campaigns/send');
    toast(`${r.sent} ofertas enviadas (simulado). ${r.controlGroup} clientes quedan como grupo de control.`);
    loadCampaigns();
  });
  $$('[data-offer]', campEl).forEach((b) => b.addEventListener('click', () => openOffer(b.dataset.offer)));
}

// =====================================================================
// SIMULADOR
// =====================================================================
const M = { scenario: 'base', defaults: null, levers: {}, assumptions: { occupancy: {}, fees: {} }, result: null };
const simEl = $('#p-simulador');
const LEVER_LABEL = { reactivation: 'Reactivación', birthday: 'Cumpleaños', recovery: 'Reserva 24 h', upsell: 'Venta guiada' };

async function loadModel(reset = true) {
  if (!M.defaults) { const first = await api('GET', '/api/model?scenario=base'); M.defaults = first.defaults; }
  if (reset) { M.levers = { ...M.defaults.levers[M.scenario] }; M.assumptions = { occupancy: { ...M.defaults.assumptions.occupancy }, fees: { ...M.defaults.assumptions.fees } }; }
  M.result = (await api('POST', '/api/model', { scenario: M.scenario, levers: M.levers, assumptions: M.assumptions })).result;
  renderSim();
}
const recompute = debounce(() => loadModel(false), 180);
function renderSim() {
  const r = M.result;
  const slider = (label, value, min, max, step, fmt, set) => `<div class="range"><label>${label}</label><b>${fmt(value)}</b><input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-set="${set}" aria-label="${label}"></div>`;
  const maxRev = Math.max(...Object.values(r.levers).map((l) => l.revenue), 1);
  const tile = (n, l) => `<div class="kpi"><b>${n}</b><span>${l}</span></div>`;
  simEl.innerHTML = `
    <h2>Simulador económico</h2>
    <p class="muted small" style="max-width:75ch">Las cifras usan <b>supuestos ilustrativos</b>: no tenemos la ocupación ni la caja reales de Committee. Mueve los controles para ver cómo cambia el resultado y sustitúyelos por datos reales cuando el grupo los facilite.</p>
    <div style="display:flex;gap:8px;margin:12px 0">${['conservador', 'base', 'optimista'].map((s) => `<button class="chip" data-scn="${s}" aria-pressed="${M.scenario === s}">${s}</button>`).join('')}</div>
    <div class="grid cols-2">
      <div class="card"><h3>Supuestos</h3>
        ${slider('Mesas vendidas en jueves', M.assumptions.occupancy.thu, 0.1, 0.95, 0.05, (v) => pct(v, 0), 'occ.thu')}
        ${slider('Mesas vendidas en viernes', M.assumptions.occupancy.fri, 0.1, 0.95, 0.05, (v) => pct(v, 0), 'occ.fri')}
        ${slider('Mesas vendidas en sábado', M.assumptions.occupancy.sat, 0.1, 0.95, 0.05, (v) => pct(v, 0), 'occ.sat')}
        ${slider('Clientes que aceptan comunicaciones', M.levers.optIn, 0.2, 0.8, 0.05, (v) => pct(v, 0), 'lev.optIn')}
        ${slider('Conversión de reactivación', M.levers.reactConv, 0.01, 0.15, 0.005, (v) => pct(v), 'lev.reactConv')}
        ${slider('Conversión de cumpleaños', M.levers.birthdayConv, 0.005, 0.08, 0.005, (v) => pct(v), 'lev.birthdayConv')}
        ${slider('Reservas recuperadas por reserva 24 h', M.levers.recovered, 0, 0.08, 0.005, (v) => pct(v), 'lev.recovered')}
        ${slider('Reservas que pasan por el flujo guiado', M.levers.flowShare, 0.2, 1, 0.05, (v) => pct(v, 0), 'lev.flowShare')}
        ${slider('Incremento de gasto por venta guiada', M.levers.upsell, 0, 0.2, 0.01, (v) => pct(v, 0), 'lev.upsell')}
        ${slider('Cuota mensual del servicio', M.assumptions.fees.monthly, 0, 1500, 50, (v) => eur(v), 'fee.monthly')}
      </div>
      <div class="grid" style="align-content:start">
        <div class="grid cols-2">
          ${tile(`+${num(r.extraTables)}`, `mesas extra por temporada (+${pct(r.pctTables)})`)}${tile(eur(r.extraRevenue), `facturación extra (+${pct(r.pctRevenue)})`)}
          ${tile(eur(r.net), 'beneficio neto tras costes')}${tile(`${num(r.breakEvenPerWeek, 1)} / semana`, 'mesas extra para cubrir el servicio')}
        </div>
        <div class="card bars"><h3>Facturación extra por palanca</h3>
          ${Object.entries(r.levers).map(([k, l]) => `<div class="row"><span>${LEVER_LABEL[k]}</span><div class="bar" style="width:${Math.max(2, (l.revenue / maxRev) * 100)}%"></div><b>${eur(l.revenue)}</b></div>`).join('')}</div>
        <div class="card small"><h3>Punto de partida (supuesto)</h3>
          <div>Mesas vendidas por temporada: <b>${num(r.baseline.seasonTables)}</b> de ${num(r.baseline.capacitySeason)} posibles</div>
          <div>Facturación de mesas estimada: <b>${eur(r.baseline.baseRevenue)}</b></div>
          <div>Coste del servicio: <b>${eur(r.serviceCost)}</b> (incluye ${eur(r.waCost)} de WhatsApp)</div>
          <div>Retorno sobre el coste: <b>${num(r.roi, 1)} veces</b> · ${r.fitsInFreeCapacity ? 'las mesas extra caben en la capacidad libre' : '<span style="color:var(--red)">las mesas extra superan la capacidad libre</span>'}</div></div>
      </div></div>`;
  $$('[data-scn]', simEl).forEach((b) => b.addEventListener('click', () => { M.scenario = b.dataset.scn; loadModel(true); }));
  $$('[data-set]', simEl).forEach((inp) => inp.addEventListener('input', () => {
    const [grp, key] = inp.dataset.set.split('.'); const v = Number(inp.value);
    if (grp === 'occ') M.assumptions.occupancy[key] = v; else if (grp === 'fee') M.assumptions.fees[key] = v; else M.levers[key] = v;
    inp.previousElementSibling.textContent = grp === 'fee' ? eur(v) : (key === 'reactConv' || key === 'birthdayConv' || key === 'recovered') ? pct(v) : pct(v, 0);
    recompute();
  }));
}

// =====================================================================
// API (documentación)
// =====================================================================
const ENDPOINTS = [
  ['GET', '/api/club', 'Datos de la sala, reglas de mesa, zonas y temporada'],
  ['GET', '/api/events', 'Próximas noches con edad mínima y ocupación'],
  ['GET', '/api/events/:fecha/tables', 'Estado de cada mesa en una noche'],
  ['GET', '/api/bottles', 'Carta de botellas 2026/27'],
  ['POST', '/api/quote', 'Presupuesto: mínimo, suplemento, señal y refrescos'],
  ['POST', '/api/holds', 'Retiene una mesa 10 minutos'],
  ['DELETE', '/api/holds/:id', 'Libera una retención'],
  ['POST', '/api/reservations', 'Crea la reserva (valida edad, mínimo y oferta)'],
  ['POST', '/api/reservations/:id/pay', 'Confirma la señal (cobro simulado) y avisa al equipo'],
  ['GET', '/api/admin/night?date=', 'Panel de la noche: KPIs, barra, comisiones'],
  ['POST', '/api/admin/block', 'Bloquea una mesa libre (reserva manual)'],
  ['GET', '/api/campaigns/preview', 'Segmentación de cumpleaños y reactivación'],
  ['POST', '/api/campaigns/send', 'Envía la campaña (simulado) y crea enlaces de un solo uso'],
  ['GET', '/api/offers/:token', 'Valida un enlace de oferta'],
  ['GET', '/api/outbox', 'Mensajes enviados (WhatsApp y Telegram simulados)'],
  ['POST', '/api/model', 'Modelo económico con supuestos a medida'],
  ['POST', '/api/admin/reset', 'Reinicia los datos de la demo'],
];
$('#p-api').innerHTML = `
  <h2>API de la demo</h2>
  <p class="muted small" style="max-width:75ch">En producción estas mismas operaciones se conectarían a flujos de n8n: disponibilidad, cobro con pasarela, WhatsApp Business y aviso a los encargados. Aquí el servidor las simula en memoria.</p>
  <div class="card" style="margin:16px 0"><table class="data"><tr><th>Método</th><th>Ruta</th><th>Qué hace</th></tr>
    ${ENDPOINTS.map(([m, p, d]) => `<tr><td class="mono m-${m}">${m}</td><td class="mono">${esc(p)}</td><td>${esc(d)}</td></tr>`).join('')}</table></div>
  <div class="card"><h3>Ejemplo</h3><pre class="mono" style="white-space:pre-wrap;margin:8px 0 0">curl -X POST ${location.origin}/api/quote \\
  -H "Content-Type: application/json" \\
  -d '{"date":"2026-11-14","tableId":"P3","people":7,"items":[{"bottleId":"champan-moet-chandon","qty":2}]}'</pre></div>`;

// =====================================================================
// Pestañas y arranque
// =====================================================================
const TABS = ['cliente', 'sala', 'campanas', 'simulador', 'api'];
function showTab(name) {
  TABS.forEach((t) => {
    $(`#tab-${t}`).setAttribute('aria-selected', String(t === name));
    $(`#p-${t}`).classList.toggle('active', t === name);
  });
  clearInterval(S.poll); S.poll = null;
  if (name === 'sala') { loadSala().catch((e) => toast(e.message)); S.poll = setInterval(() => loadSala().catch(() => {}), 5000); }
  if (name === 'campanas') loadCampaigns().catch((e) => toast(e.message));
  if (name === 'simulador') loadModel(!M.result).catch((e) => toast(e.message));
  if (name === 'cliente' && C.events.length) render();
}
TABS.forEach((t) => $(`#tab-${t}`).addEventListener('click', () => showTab(t)));

(async function init() {
  try {
    const [club, bottles] = await Promise.all([api('GET', '/api/club'), api('GET', '/api/bottles')]);
    CLUB = club; BOTTLES = bottles.bottles;
    await loadEvents();
    const token = new URLSearchParams(location.search).get('oferta');
    if (token) await openOffer(token); else render();
    if (!club.seasonOpen) toast('Committee cierra en verano: las fechas de la demo son ilustrativas.');
  } catch (e) {
    root.innerHTML = `<div class="card"><h3>No se pudo cargar la demo</h3><p class="muted">${esc(e.message)}</p></div>`;
  }
})();
