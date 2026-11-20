import { useEffect, useState } from 'react';
import { useT } from '../i18n/index.jsx';
import { Btn, Link, Reveal } from '../components/ui.jsx';
import { scrollToId } from '../lib/hooks.js';
import { TALLER, telHref, waHref, mapsLink, mapsEmbed, openState, todayIndex } from '../data/taller.js';

// Secciones de información de la web del taller. Todo sale de src/data/taller.js;
// lo que falta se pinta con <Missing /> en lugar de inventarlo.

export function Missing({ children }) {
  const { t } = useT();
  return <span className="missing">{children || t('common.pending')}</span>;
}

const Icon = ({ d }) => <svg viewBox="0 0 24 24" aria-hidden="true"><path d={d} /></svg>;
const I = {
  phone: 'M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z',
  chat: 'M4 20l1.4-4.2A8 8 0 1 1 8.6 19z M9 10.5c.5 1.6 1.9 3 3.5 3.5l1-1 2 1v1a1.5 1.5 0 0 1-1.5 1.5A6 6 0 0 1 8 10.5 1.5 1.5 0 0 1 9.5 9h1l1 2z',
  cal: 'M4 6h16v14H4zM4 10h16M8 3v4M16 3v4',
  pin: 'M12 21s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12zM12 6.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5z',
  clock: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 7v5l3 2',
  car: 'M3 15l2-5.5A2 2 0 0 1 6.9 8h10.2a2 2 0 0 1 1.9 1.5L21 15v3H3zM6.5 18v2M17.5 18v2M7 13.5h.01M17 13.5h.01',
  star: 'M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z',
};

// Estado de apertura en vivo (se recalcula cada minuto). null con horario de ejemplo.
function useOpenState() {
  const [st, setSt] = useState(() => openState());
  useEffect(() => { const id = setInterval(() => setSt(openState()), 60000); return () => clearInterval(id); }, []);
  return st;
}

function OpenLabel({ st }) {
  const { t } = useT();
  if (!st) return null;
  if (st.open) return <span className="open-pill" data-open="true">{t('taller.top.open', { time: st.until })}</span>;
  if (!st.next) return <span className="open-pill">{t('taller.top.closedLong')}</span>;
  const when = st.next.today ? t('taller.top.today') : st.next.tomorrow ? t('taller.top.tomorrow') : t('taller.top.on', { day: t('taller.days')[st.next.day].toLowerCase() });
  return <span className="open-pill">{t('taller.top.closed', { when, time: st.next.at })}</span>;
}

// Llamar · WhatsApp · Cita. Se usa arriba de todo, en el hero y fija abajo en el móvil.
export function ContactActions({ variant = 'bar' }) {
  const { t } = useT();
  return (
    <div className={`contact-actions contact-actions--${variant}`}>
      {TALLER.phone
        ? <a className="act act--call" href={telHref(TALLER.phone)}><Icon d={I.phone} /><span>{variant === 'bar' ? TALLER.phone : t('taller.top.call')}</span></a>
        : <span className="act act--call" aria-disabled="true"><Icon d={I.phone} /><span>{t('taller.top.phone')}: <Missing /></span></span>}
      {TALLER.whatsapp
        ? <a className="act act--wa" href={waHref(TALLER.whatsapp)} target="_blank" rel="noopener noreferrer"><Icon d={I.chat} /><span>{t('taller.top.whatsapp')}</span></a>
        : <span className="act act--wa" aria-disabled="true"><Icon d={I.chat} /><span>{t('taller.top.whatsapp')}: <Missing /></span></span>}
      <Link className="act act--book" to={`/cita/${TALLER.code}`}><Icon d={I.cal} /><span>{t('taller.top.book')}</span></Link>
    </div>
  );
}

// Franja fija de arriba: abierto/cerrado, pedir cita y ver mi coche. Visible desde el primer segundo.
export function TopBar() {
  const { t } = useT();
  const st = useOpenState();
  return (
    <div className="top-bar on-dark" role="region" aria-label={TALLER.name}>
      <OpenLabel st={st} />
      <div className="contact-actions contact-actions--bar">
        <Link className="act act--book" to={`/cita/${TALLER.code}`}><Icon d={I.cal} /><span>{t('taller.top.book')}</span></Link>
        <a className="act act--car" href="#estado" onClick={(e) => { e.preventDefault(); scrollToId('estado'); }}><Icon d={I.car} /><span>{t('taller.nav.cta')}</span></a>
      </div>
    </div>
  );
}

function hoursNotes(week, t) {
  const notes = [];
  const weekday = week[1] || [];
  if (weekday.length > 1) notes.push(t('taller.visit.split', { from: weekday[0][1], to: weekday[1][0] }));
  const sat = week[6] || [];
  if (sat.length === 1 && Number(sat[0][1].slice(0, 2)) <= 15) notes.push(t('taller.visit.saturday'));
  if (!(week[0] || []).length) notes.push(t('taller.visit.sunday'));
  return notes;
}

export function Visit() {
  const { t } = useT();
  const [mapOn, setMapOn] = useState(false);
  const today = todayIndex();
  const order = [1, 2, 3, 4, 5, 6, 0];
  const days = t('taller.days');
  const fmt = (slots) => (slots.length ? slots.map(([a, b]) => `${a} – ${b}`).join(' · ') : t('taller.visit.closed'));
  return (
    <section className="section section--paper" id="visita" data-tone="paper" aria-labelledby="visit-title">
      <div className="wrap">
        <div className="sec-head"><Reveal className="h-section" id="visit-title" lines={t('taller.visit.title')} /></div>
        <div className="visit-grid">
          <div className="map-card">
            {TALLER.address && mapOn
              ? <iframe title={t('taller.visit.directions')} src={mapsEmbed(TALLER.address)} loading="lazy" referrerPolicy="no-referrer-when-downgrade" />
              : (
                <div className="map-placeholder">
                  <Icon d={I.pin} />
                  {TALLER.address
                    ? <><Btn variant="ghost sm" onClick={() => setMapOn(true)}>{t('taller.visit.mapLoad')}</Btn><p className="hint">{t('taller.visit.mapNote')}</p></>
                    : <p className="hint">{t('taller.visit.mapMissing')}</p>}
                </div>
              )}
          </div>
          <div className="info-card">
            <dl className="contact-list">
              <div><dt>{t('taller.visit.address')}</dt><dd>{TALLER.address || <><Missing /> · {TALLER.city}</>}</dd></div>
              {TALLER.parking && <div><dt>{t('taller.visit.parking')}</dt><dd>{TALLER.parking}</dd></div>}
            </dl>
            {TALLER.address
              ? <a className="btn btn--block" href={mapsLink(TALLER.address)} target="_blank" rel="noopener noreferrer">{t('taller.visit.directions')}</a>
              : <span className="btn btn--block" aria-disabled="true">{t('taller.visit.directions')}</span>}
            <div className="info-head"><h3>{t('taller.visit.hours')}</h3>{TALLER.hoursAreExample && <span className="demo-tag">{t('taller.visit.example')}</span>}</div>
            <dl className="hours">
              {order.map((d) => (
                <div key={d} data-today={d === today}>
                  <dt>{days[d]}{d === today && <span className="today-tag">{t('taller.visit.today')}</span>}</dt>
                  <dd>{fmt(TALLER.week[d] || [])}</dd>
                </div>
              ))}
            </dl>
            <ul className="hours-notes">
              {hoursNotes(TALLER.week, t).map((n) => <li key={n}>{n}</li>)}
              {TALLER.holidaysNote && <li>{TALLER.holidaysNote}</li>}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}

const SVC_ICONS = {
  mot: 'M9 3h6v3H9zM7 4.5H5v16h14v-16h-2M8.5 13l2.5 2.5 4.5-5',
  oil: 'M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11zM9.5 15a2.5 2.5 0 0 0 2.5 2.5',
  brakes: 'M12 4a8 8 0 1 0 0 16 8 8 0 0 0 0-16zM12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4zM18 5.5l2.5-2M6 18.5l-2.5 2',
  diagnosis: 'M4 15a8 8 0 1 1 16 0M12 15l4-5M3 19h18',
  tyres: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8zM12 3v5M12 16v5M3 12h5M16 12h5',
  bodywork: 'M4 15l2-5h12l2 5v3H4zM6 18v2M18 18v2M15 4l4 4-6 6-4 1 1-4z',
  aircon: 'M12 2v20M4.5 6.5l15 11M19.5 6.5l-15 11M9 4l3 2 3-2M9 20l3-2 3 2',
  service: 'M4 7h16M4 12h10M4 17h7M17 14l2 2 3-4',
  electrics: 'M13 2L5 13h6l-1 9 8-11h-6z',
  mechanics: 'M14.7 6.3a4 4 0 0 0-5.4 5.4L3 18l3 3 6.3-6.3a4 4 0 0 0 5.4-5.4l-2.6 2.6-2.4-.6-.6-2.4z',
};

// Precios redondos sin céntimos («Desde 89 €»), con céntimos solo si los hay.
const euros = (lang, n) => new Intl.NumberFormat(lang === 'es' ? 'es-ES' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: n % 1 ? 2 : 0 }).format(n);

export function Services() {
  const { t, lang } = useT();
  const money = (n) => euros(lang, n);
  return (
    <section className="section" id="servicios" data-tone="light" aria-labelledby="services-title">
      <div className="wrap">
        <div className="sec-head">
          <Reveal className="h-section" id="services-title" lines={t('taller.services.title')} />
          <p className="lead">{t('taller.services.lead')}</p>
        </div>
        <ul className="svc-grid">
          {TALLER.services.map(({ id, from, per, free }) => {
            const [title, text] = t(`taller.services.items.${id}`);
            return (
              <li key={id} id={`servicio-${id}`}>
                <Icon d={SVC_ICONS[id]} />
                <h3>{title}</h3>
                <p>{text}</p>
                <p className="svc-price">{free ? t('taller.services.free') : from != null ? t('taller.services.from', { price: per ? t(`taller.services.per.${per}`, { price: money(from) }) : money(from) }) : <Missing>{t('taller.services.priceMissing')}</Missing>}</p>
                <Link className="svc-book" to={`/cita/${TALLER.code}`}>{t('taller.services.book')} →</Link>
              </li>
            );
          })}
        </ul>
        <p className="hint" style={{ marginTop: 20 }}>{t('taller.services.note')}</p>
      </div>
    </section>
  );
}

export function Quote() {
  const { t, money } = useT();
  return (
    <section className="section section--paper" id="presupuesto" data-tone="paper" aria-labelledby="quote-title">
      <div className="wrap split">
        <div className="sec-head"><Reveal className="h-section" id="quote-title" lines={t('taller.quote.title')} /></div>
        <div className="quote-list">
          <p className="quote-main">
            {TALLER.freeQuote === true && t('taller.quote.free')}
            {TALLER.freeQuote === false && t('taller.quote.paid', { price: TALLER.diagnosisFee != null ? money(TALLER.diagnosisFee) : t('common.pending') })}
            {TALLER.freeQuote == null && <Missing>{t('taller.quote.freeMissing')}</Missing>}
          </p>
          {TALLER.diagnosisFee === 0 && <p className="quote-main">{t('taller.quote.diagnosisFree')}</p>}
          {TALLER.diagnosisFee > 0 && <p>{t('taller.quote.diagnosisFee', { price: money(TALLER.diagnosisFee) })}</p>}
          <p>{t('taller.quote.approve')}</p>
          <div>
            <h3 className="mini-title">{t('taller.quote.payments')}</h3>
            {TALLER.payments.length
              ? <ul className="tag-list">{TALLER.payments.map((m) => <li key={m}>{t(`taller.quote.methods.${m}`)}</li>)}</ul>
              : <Missing>{t('taller.quote.paymentsMissing')}</Missing>}
          </div>
        </div>
      </div>
    </section>
  );
}

function Stars({ value }) {
  const { t } = useT();
  return (
    <span className="stars" role="img" aria-label={t('taller.reviews.stars', { n: value })}>
      {[0, 1, 2, 3, 4].map((i) => <svg key={i} viewBox="0 0 24 24" data-on={value >= i + 0.75} data-half={value >= i + 0.25 && value < i + 0.75} aria-hidden="true"><path d={I.star} /></svg>)}
    </span>
  );
}

export function Reviews() {
  const { t, date, lang } = useT();
  const r = TALLER.reviews;
  const has = r.rating != null;
  return (
    <section className="section" id="opiniones" data-tone="light" aria-labelledby="reviews-title">
      <div className="wrap">
        <div className="sec-head reviews-head">
          <Reveal className="h-section" id="reviews-title" lines={t('taller.reviews.title')} />
          {has && (
            <div className="rating-big">
              <strong>{r.rating.toLocaleString(lang === 'es' ? 'es-ES' : 'en-GB', { minimumFractionDigits: 1 })}</strong>
              <div><Stars value={r.rating} /><span>{t('taller.reviews.of')}{r.count != null && <> · {t('taller.reviews.count', { n: r.count })}</>}</span></div>
            </div>
          )}
        </div>
        {r.items.length > 0 && (
          <ul className="review-grid">
            {r.items.map((it) => (
              <li key={`${it.author}${it.date}`}>
                <Stars value={it.rating} />
                <blockquote>{it.text}</blockquote>
                <p className="hint">{it.author}{it.date && <> · {date(it.date, { month: 'long', year: 'numeric' })}</>}</p>
              </li>
            ))}
          </ul>
        )}
        {!has && <p className="missing-block">{t('taller.reviews.missing')}</p>}
        {r.url && <p style={{ marginTop: 24 }}><a className="btn btn--ghost" href={r.url} target="_blank" rel="noopener noreferrer">{t('taller.reviews.all')}</a></p>}
      </div>
    </section>
  );
}

export function Photos() {
  const { t, lang } = useT();
  const list = TALLER.photos;
  const slots = list.length ? list : [{ missing: 'missing' }, { missing: 'missing' }, { missing: 'missingTeam' }, { missing: 'missing' }];
  return (
    <section className="section section--paper" id="fotos" data-tone="paper" aria-labelledby="photos-title">
      <div className="wrap">
        <div className="sec-head"><Reveal className="h-section" id="photos-title" lines={t('taller.photos.title')} /></div>
        <ul className="photo-grid">
          {slots.map((p, i) => (
            <li key={p.src || i}>
              {p.src
                ? <img src={p.src} alt={p.alt[lang] || p.alt.es} loading="lazy" decoding="async" width="800" height="600" />
                : <div className="photo-missing"><Missing>{t(`taller.photos.${p.missing}`)}</Missing></div>}
            </li>
          ))}
        </ul>
        {list.length > 0 && TALLER.photosAreStock && <p className="hint" style={{ marginTop: 12 }}>{t('taller.photos.stock')}</p>}
      </div>
    </section>
  );
}

export function Brands() {
  const { t } = useT();
  return (
    <section className="section" id="marcas" data-tone="light" aria-labelledby="brands-title">
      <div className="wrap split">
        <div className="sec-head"><Reveal className="h-section" id="brands-title" lines={t('taller.brands.title')} /></div>
        <div className="quote-list">
          <div>
            {TALLER.allBrands === true && <p className="quote-main">{t('taller.brands.all')}</p>}
            {TALLER.brands.length > 0 && <><h3 className="mini-title">{t('taller.brands.some')}</h3><ul className="tag-list">{TALLER.brands.map((b) => <li key={b}>{b}</li>)}</ul></>}
            {TALLER.allBrands == null && !TALLER.brands.length && <Missing>{t('taller.brands.allMissing')}</Missing>}
          </div>
          <div>
            <h3 className="mini-title">{t('taller.brands.specialties')}</h3>
            {TALLER.specialties.length
              ? <ul className="tag-list">{TALLER.specialties.map((s) => <li key={s}>{t(`taller.brands.specs.${s}`)}</li>)}</ul>
              : <Missing>{t('taller.brands.specMissing')}</Missing>}
          </div>
        </div>
      </div>
    </section>
  );
}

export function About() {
  const { t, lang } = useT();
  const a = TALLER.about;
  const text = a.text && (a.text[lang] || a.text.es);
  const facts = [
    a.since && t('taller.about.since', { year: a.since }),
    a.since && t('taller.about.years', { n: new Date().getFullYear() - a.since }),
    a.family && t('taller.about.family'),
    a.team && t('taller.about.team', { n: a.team }),
  ].filter(Boolean);
  const empty = !text && !facts.length && !a.certifications.length;
  return (
    <section className="section" id="quienes" data-tone="light" aria-labelledby="about-title">
      <div className="wrap split">
        <div className="sec-head"><Reveal className="h-section" id="about-title" lines={t('taller.about.title')} /></div>
        <div className="quote-list">
          {text && <p className="quote-main">{text}</p>}
          {facts.length > 0 && <ul className="tag-list">{facts.map((f) => <li key={f}>{f}</li>)}</ul>}
          {a.certifications.length > 0 && <div><h3 className="mini-title">{t('taller.about.certs')}</h3><ul className="tag-list">{a.certifications.map((c) => <li key={c}>{c}</li>)}</ul></div>}
          {empty && <p className="missing-block">{t('taller.about.missing')}</p>}
        </div>
      </div>
    </section>
  );
}
