// Cola de correos: cada botón del mecánico encola un aviso que sale pasados los segundos de «deshacer».
// Un único remitente por taller, enlace de baja en todos, anti-duplicados y registro de envíos.
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { DATA_DIR, DEDUPE_MINUTES, MAIL, PUBLIC_URL, SECRET, UNDO_SECONDS } from './config.js';
import { getSettings, workshopDb, workshopDir } from './db.js';
import { getWorkshop, listWorkshops } from './auth.js';
import { DEFAULT_TEMPLATES, renderTemplate } from '../shared/rules.js';
import { formatPlate } from '../shared/plates.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const iso = (ms) => new Date(ms).toISOString();

// ---------- Baja ----------
export function unsubToken(wid, email) {
  const p = `${wid}.${Buffer.from(email).toString('base64url')}`;
  return `${p}.${createHmac('sha256', SECRET).update(`unsub:${p}`).digest('base64url')}`;
}
export function readUnsubToken(token) {
  const [w, e, s] = String(token).split('.');
  if (!w || !e || !s) return null;
  const p = `${w}.${e}`;
  const good = createHmac('sha256', SECRET).update(`unsub:${p}`).digest('base64url');
  if (good.length !== s.length || !timingSafeEqual(Buffer.from(good), Buffer.from(s))) return null;
  try { return { wid: w, email: Buffer.from(e, 'base64url').toString('utf8') }; } catch { return null; }
}
export function unsubscribe(wid, email) {
  workshopDb(wid).prepare('INSERT OR IGNORE INTO unsubs (email, at) VALUES (?, ?)').run(email, iso(Date.now()));
}

// ---------- Enlace de seguimiento: una visita, un código firmado, sin cuenta ----------
export function trackToken(wid, visitId) {
  const p = `${wid}.${visitId}`;
  return `${p}.${createHmac('sha256', SECRET).update(`track:${p}`).digest('base64url')}`;
}
export function readTrackToken(token) {
  const [w, v, s] = String(token).split('.');
  if (!w || !v || !s || !/^[a-z0-9]{6,32}$/.test(w) || !/^[0-9a-f-]{36}$/.test(v)) return null;
  const good = createHmac('sha256', SECRET).update(`track:${w}.${v}`).digest('base64url');
  if (good.length !== s.length || !timingSafeEqual(Buffer.from(good), Buffer.from(s))) return null;
  return { wid: w, visitId: v };
}

// ---------- Contenido ----------
function layout({ workshop, text, settings, link, track }) {
  const paras = text.split('\n').map((l) => (l.trim() ? `<p style="margin:0 0 12px">${esc(l)}</p>` : '')).join('');
  const contact = [settings.phone && `Teléfono: ${esc(settings.phone)}`, settings.hours && `Horario: ${esc(settings.hours)}`].filter(Boolean).join(' · ');
  return `<!doctype html><html lang="es"><body style="margin:0;background:#f4f7fc;font-family:Arial,Helvetica,sans-serif;color:#0e1b2e">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#fff;border:1px solid #0b2a5b;border-radius:10px">
<tr><td style="padding:18px 24px;border-bottom:1px solid #d9e2f2;font-size:20px;font-weight:700;color:#0b2a5b;letter-spacing:.04em;text-transform:uppercase">${esc(workshop)}</td></tr>
<tr><td style="padding:24px;font-size:16px;line-height:1.5">${paras}${track ? `<p style="margin:20px 0 0"><a href="${esc(track)}" style="display:inline-block;background:#2f6fed;color:#fff;text-decoration:none;font-weight:700;padding:14px 22px;border-radius:8px">Ver cómo va mi coche</a></p>` : ''}</td></tr>
<tr><td style="padding:16px 24px;border-top:1px solid #d9e2f2;font-size:12px;color:#44567a;line-height:1.5">${contact ? `${contact}<br>` : ''}Recibes este aviso porque dejaste tu coche en ${esc(workshop)}.${link ? ` <a href="${esc(link)}" style="color:#1f4fb8">No quiero recibir más avisos</a>.` : ''}</td></tr>
</table></td></tr></table></body></html>`;
}

// ---------- Cola ----------
function insertMail(db, row) {
  db.prepare(`INSERT INTO outbox (id, visit_id, event_id, kind, to_email, subject, body, status, created_at, send_after, error)
              VALUES (@id, @visit_id, @event_id, @kind, @to_email, @subject, @body, @status, @created_at, @send_after, @error)`).run(row);
  return row;
}

// Encola el aviso de un cambio de estado. Sale tras UNDO_SECONDS: ese margen es el «deshacer».
export function queueVisitMail(wid, visit, kind, eventId, now = Date.now()) {
  const db = workshopDb(wid);
  const w = getWorkshop(wid);
  const settings = getSettings(db);
  const tpl = settings.templates?.[kind] || DEFAULT_TEMPLATES[kind];
  const { subject, body } = renderTemplate(tpl, {
    workshop: w.name, plateText: formatPlate(visit.plate), model: [visit.make, visit.model].filter(Boolean).join(' '),
    eta: visit.eta, phone: settings.phone, hours: settings.hours,
  });
  const base = { id: randomUUID(), visit_id: visit.id, event_id: eventId, kind, to_email: visit.email, subject, body, created_at: iso(now), send_after: iso(now + UNDO_SECONDS * 1000), error: null };
  if (db.prepare('SELECT 1 FROM unsubs WHERE email = ?').get(visit.email)) return insertMail(db, { ...base, status: 'skipped_unsub' });
  const since = iso(now - DEDUPE_MINUTES * 60_000);
  if (db.prepare("SELECT 1 FROM outbox WHERE visit_id = ? AND kind = ? AND status IN ('pending','sending','sent') AND created_at > ?").get(visit.id, kind, since)) return insertMail(db, { ...base, status: 'skipped_dup' });
  return insertMail(db, { ...base, status: 'pending' });
}

export function queueSummary(wid, to, subject, body, now = Date.now()) {
  return insertMail(workshopDb(wid), { id: randomUUID(), visit_id: null, event_id: null, kind: 'summary', to_email: to, subject, body, status: 'pending', created_at: iso(now), send_after: iso(now), error: null });
}

export const cancelPending = (wid, where, ...args) => workshopDb(wid).prepare(`UPDATE outbox SET status = 'cancelled' WHERE status = 'pending' AND ${where}`).run(...args).changes;

export function recentMail(wid, limit = 100) {
  return workshopDb(wid).prepare('SELECT id, visit_id AS visitId, kind, to_email AS toEmail, subject, status, error, created_at AS createdAt, send_after AS sendAfter, sent_at AS sentAt FROM outbox ORDER BY created_at DESC LIMIT ?').all(limit);
}

// ---------- Proveedores ----------
async function sendDev(msg, wid) {
  const dir = join(DATA_DIR, 'outbox-dev'); mkdirSync(dir, { recursive: true });
  const id = `dev-${randomUUID()}`;
  writeFileSync(join(dir, `${Date.now()}-${id}.json`), JSON.stringify({ ...msg, attachments: (msg.attachments || []).map((a) => ({ filename: a.filename, bytes: a.content.length })), workshop: wid }, null, 2));
  return { id };
}
async function sendResend(msg, outboxId, wid) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST', signal: AbortSignal.timeout(15_000),
    headers: { Authorization: `Bearer ${MAIL.resendKey}`, 'Content-Type': 'application/json', 'Idempotency-Key': outboxId },
    body: JSON.stringify({ from: msg.from, to: [msg.to], reply_to: msg.replyTo || undefined, subject: msg.subject, text: msg.text, html: msg.html, headers: msg.headers, attachments: msg.attachments, tags: [{ name: 'w', value: wid }, { name: 'o', value: outboxId }] }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${res.status} ${String(data.message || data.name || 'error').slice(0, 120)}`);
  return { id: data.id };
}
let sender = null; // sustituible en las pruebas
export const setSender = (fn) => { sender = fn; };

async function deliver(wid, row, now) {
  const db = workshopDb(wid);
  const w = getWorkshop(wid);
  const settings = getSettings(db);
  const link = row.kind === 'summary' ? '' : `${PUBLIC_URL}/baja/${unsubToken(wid, row.to_email)}`;
  const track = row.kind !== 'summary' && row.visit_id ? `${PUBLIC_URL}/coche/${trackToken(wid, row.visit_id)}` : '';
  const attachments = [];
  if (row.kind === 'received' && row.visit_id) {
    const f = join(workshopDir(wid), 'photos', `${row.visit_id}.jpg`);
    if (existsSync(f)) attachments.push({ filename: 'tu-coche.jpg', content: readFileSync(f).toString('base64') });
  }
  const msg = {
    from: `"${w.name.replace(/["\r\n<>]/g, '')}" <${MAIL.from}>`, to: row.to_email, replyTo: settings.replyTo || undefined,
    subject: row.subject, text: `${row.body}${track ? `\n\nVer cómo va tu coche: ${track}` : ''}${link ? `\n\nNo quiero recibir más avisos: ${link}` : ''}`,
    html: layout({ workshop: w.name, text: row.body, settings, link, track }), attachments,
    headers: link ? { 'List-Unsubscribe': `<${link}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } : undefined,
  };
  if (sender) return sender(msg, row, wid);
  return MAIL.provider === 'resend' ? sendResend(msg, row.id, wid) : sendDev(msg, wid);
}

// Envía lo que ya ha cumplido su margen. Reintenta con espera creciente y, tras 3 fallos, lo deja como «failed».
export async function processOutbox(now = Date.now()) {
  let sent = 0;
  for (const w of listWorkshops()) {
    if (w.status !== 'active') continue;
    const db = workshopDb(w.id);
    const due = db.prepare("SELECT * FROM outbox WHERE status = 'pending' AND send_after <= ? ORDER BY send_after LIMIT 20").all(iso(now));
    for (const row of due) {
      if (!db.prepare("UPDATE outbox SET status = 'sending' WHERE id = ? AND status = 'pending'").run(row.id).changes) continue;
      try {
        const r = await deliver(w.id, row, now);
        db.prepare("UPDATE outbox SET status = 'sent', provider_id = ?, sent_at = ?, error = NULL WHERE id = ?").run(r.id, iso(Date.now()), row.id);
        sent += 1;
      } catch (e) {
        const attempts = row.attempts + 1;
        const msg = String(e.message || e).slice(0, 160);
        if (attempts >= 3) db.prepare("UPDATE outbox SET status = 'failed', attempts = ?, error = ? WHERE id = ?").run(attempts, msg, row.id);
        else db.prepare("UPDATE outbox SET status = 'pending', attempts = ?, error = ?, send_after = ? WHERE id = ?").run(attempts, msg, iso(now + attempts * 60_000), row.id);
      }
    }
  }
  return sent;
}

// Correo de prueba desde la administración: usa exactamente el mismo camino que los avisos reales.
export async function sendTest(to) {
  const msg = {
    from: `"Tridom Automotive" <${MAIL.from}>`, to, subject: 'Prueba de correo · Tridom Automotive',
    text: 'Si lees esto, el correo de Tridom Automotive está bien conectado.\n\nNo hace falta responder.',
    html: layout({ workshop: 'Tridom Automotive', text: 'Si lees esto, el correo de Tridom Automotive está bien conectado.\n\nNo hace falta responder.', settings: {}, link: '' }), attachments: [],
  };
  const id = `test-${randomUUID()}`;
  try {
    const r = sender ? await sender(msg, { id, kind: 'test' }, 'admin') : MAIL.provider === 'resend' ? await sendResend(msg, id, 'admin') : await sendDev(msg, 'admin');
    return { ok: true, provider: MAIL.provider, id: r.id };
  } catch (e) { return { ok: false, provider: MAIL.provider, error: String(e.message || e).slice(0, 160) }; }
}

// ---------- Rebotes (webhook de Resend, firma Svix) ----------
export function verifyWebhook(headers, rawBody) {
  const secret = MAIL.webhookSecret;
  if (!secret) return false;
  const id = headers['svix-id']; const ts = headers['svix-timestamp']; const sigs = String(headers['svix-signature'] || '');
  if (!id || !ts || !sigs || Math.abs(Date.now() / 1000 - Number(ts)) > 300) return false;
  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const good = createHmac('sha256', key).update(`${id}.${ts}.${rawBody}`).digest('base64');
  return sigs.split(' ').some((s) => { const v = s.split(',')[1] || ''; return v.length === good.length && timingSafeEqual(Buffer.from(v), Buffer.from(good)); });
}
export function applyWebhookEvent(evt) {
  const tags = evt?.data?.tags || {};
  const wid = Array.isArray(tags) ? tags.find((t) => t.name === 'w')?.value : tags.w;
  const oid = Array.isArray(tags) ? tags.find((t) => t.name === 'o')?.value : tags.o;
  if (!wid || !oid || !getWorkshop(wid)) return false;
  const status = { 'email.bounced': 'bounced', 'email.complained': 'bounced', 'email.failed': 'failed' }[evt.type];
  if (!status) return false;
  workshopDb(wid).prepare('UPDATE outbox SET status = ?, error = ? WHERE id = ?').run(status, String(evt.type).slice(0, 40), oid);
  return true;
}
