import { useEffect, useMemo, useRef, useState } from 'react';
import template from '../../shared/template.json';
import { STATES } from '../../shared/domain.js';
import { validateContact } from '../../shared/validate.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Field, Link, Plate, Reveal, SceneHost, StateChip, Wordmark } from '../components/ui.jsx';
import { useLenis, useTick, useViewport, scrollToId, reducedMotion } from '../lib/hooks.js';
import { createSpring, clamp, range } from '../lib/spring.js';
import { tickerState } from '../lib/ticker.js';
import { useScene } from '../scene/store.js';
import { createSim } from '../scene/simStore.js';
import { getAdapter, NetworkError } from '../data/adapter.js';
import { LiveShop, Calc, LetterWord } from './landingLive.jsx';

const AZ = Math.PI / 4;
const smooth = (t) => t * t * (3 - 2 * t);
const lerp = (a, b, t) => a + (b - a) * t;

// Fotogramas clave del recorrido de cámara: rectángulos de suelo que se encuadran en cada tramo.
const TOUR = [
  { p: 0, b: null, az: AZ },
  { p: 0.19, b: { x0: -3, x1: 12, z0: 11, z1: 25, h: 3 }, az: AZ + 0.22 },
  { p: 0.34, b: { x0: 14, x1: 25, z0: -1, z1: 12, h: 4 }, az: AZ - 0.16 },
  { p: 0.49, b: { x0: 2, x1: 13, z0: -1, z1: 12, h: 4.4 }, az: AZ + 0.12 },
  { p: 0.64, b: { x0: 11, x1: 25, z0: 8, z1: 19, h: 3 }, az: AZ - 0.1 },
  { p: 0.79, b: { x0: 15, x1: 28, z0: 20, z1: 31, h: 2.5 }, az: AZ + 0.16 },
  { p: 0.96, b: null, az: AZ },
];
const CH0 = 0.115; const CH = 0.15; // inicio y anchura de cada capítulo en el progreso

function Header() {
  const { t } = useT();
  const ref = useRef(null);
  // El logo se adapta al tono de la sección que tiene debajo (claro, oscuro o color de marca).
  useTick((s) => {
    if (!ref.current || (!s.scrolled && s.frame % 20 !== 0)) return;
    let tone = 'light';
    for (const el of document.querySelectorAll('[data-tone]')) {
      if (el === ref.current) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= 36 && r.bottom > 36) tone = el.dataset.tone;
    }
    if (ref.current.dataset.tone !== tone) ref.current.dataset.tone = tone;
  }, 'read');
  const go = (id) => (e) => { e.preventDefault(); scrollToId(id); };
  return (
    <header className="site-header" ref={ref} data-tone="light">
      <Wordmark />
      <nav className="site-nav" aria-label={t('nav.menu')}>
        <a href="#how" onClick={go('how')}>{t('nav.how')}</a>
        <Link to="/panel">{t('nav.tryDemo')}</Link>
        <a href="#contact" onClick={go('contact')}>{t('nav.contact')}</a>
      </nav>
      <div className="header-right"><LangSwitch /></div>
    </header>
  );
}

function Hero() {
  const { t } = useT();
  const wrap = useRef(null); const intro = useRef(null); const chapters = useRef(null); const rail = useRef(null); const hint = useRef(null);
  const rig = useRef(null);
  const target = useRef(0);
  const spring = useRef(createSpring(0, { tension: 70, friction: 20 }));
  const sim = useMemo(() => createSim(template), []);
  const [playing, setPlaying] = useState(true);
  const vehicles = useScene((s) => s.vehicles);
  const steps = t('landing.tour.steps');

  useEffect(() => {
    sim.seed();
    const off = sim.subscribe((list) => useScene.getState().setData(list));
    return () => { off(); useScene.getState().reset(); };
  }, [sim]);

  useViewport(wrap, ({ rect, vh }) => { target.current = clamp(-rect.top / Math.max(1, rect.height - vh)); }, !reducedMotion);

  useTick((s) => {
    const sp = spring.current;
    sp.set(target.current);
    const moved = sp.step(s.dt);
    const p = sp.value;
    const r = rig.current;
    if (r) {
      let i = 0;
      while (i < TOUR.length - 2 && p > TOUR[i + 1].p) i += 1;
      const a = TOUR[i]; const b = TOUR[i + 1];
      const k = smooth(clamp((p - a.p) / (b.p - a.p)));
      const fa = r.frame(a.b || r.bounds, a.az, a.b ? 0.8 : 0.94); const fb = r.frame(b.b || r.bounds, b.az, b.b ? 0.8 : 0.94);
      r.setTarget({ cx: lerp(fa.cx, fb.cx, k), cz: lerp(fa.cz, fb.cz, k), zoom: Math.exp(lerp(Math.log(fa.zoom), Math.log(fb.zoom), k)), az: lerp(a.az, b.az, k) });
    }
    if (!moved && !s.resized && s.frame > 10) return;
    const mobile = s.tier === 'mobile';
    if (intro.current) {
      const o = 1 - range(p, 0.035, 0.1);
      intro.current.style.opacity = o.toFixed(3);
      intro.current.style.transform = `translate3d(0, ${(-p * 420).toFixed(1)}px, 0)`;
      intro.current.style.visibility = o < 0.01 ? 'hidden' : 'visible';
    }
    if (hint.current) hint.current.style.opacity = (1 - range(p, 0.01, 0.05)).toFixed(3);
    if (chapters.current) {
      [...chapters.current.children].forEach((el, i) => {
        const tt = (p - (CH0 + i * CH)) / CH;
        const o = clamp(Math.min(range(tt, 0, 0.22), 1 - range(tt, 0.8, 1)));
        el.style.opacity = o.toFixed(3);
        el.style.visibility = o < 0.01 ? 'hidden' : 'visible';
        el.style.transform = `translate3d(0, ${mobile ? ((0.5 - tt) * 36).toFixed(1) + 'px' : `calc(-50% + ${((0.5 - tt) * 56).toFixed(1)}px)`}, 0)`;
      });
    }
    if (rail.current) {
      rail.current.style.opacity = (range(p, CH0 - 0.03, CH0) * (1 - range(p, CH0 + 5 * CH, CH0 + 5 * CH + 0.04))).toFixed(3);
      [...rail.current.children].forEach((el, i) => { el.firstChild.style.transform = `scaleX(${range(p, CH0 + i * CH, CH0 + (i + 1) * CH).toFixed(3)})`; });
    }
  }, 'write', !reducedMotion);

  return (
    <section className="hero" ref={wrap} data-tone="light" aria-labelledby="hero-title">
      <div className="hero-stage">
        <div className="hero-copy">
          <div className="hero-intro" ref={intro}>
            <span className="demo-tag" style={{ justifySelf: 'start' }}>{t('landing.hero.tag')}</span>
            <Reveal as="h1" id="hero-title" className="h-display" lines={t('landing.hero.title')} />
            <p className="lead">{t('landing.hero.lead')}</p>
            <div className="hero-cta">
              <Btn to="/panel">{t('landing.hero.cta')}</Btn>
              <Btn to="/consulta/DEMO01" variant="ghost">{t('landing.hero.cta2')}</Btn>
            </div>
          </div>
          <ol className="chapters" ref={chapters} aria-label={t('landing.tour.title')}>
            {steps.map((st) => (
              <li className="chapter" key={st.sign}>
                <span className="sign-plate">{st.sign}</span>
                <h3>{st.title}</h3>
                <p>{st.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div className="hero-scene">
          <SceneHost
            template={template} name="Taller Demo" brandColor="#2F6FED" mode="demo" interactive="none" controls={false}
            sim={sim} simulate={playing} listVehicles={vehicles}
            onReady={({ rig: r, engine }) => { r.bounds = engine.bounds; r.stiffness = 3.2; rig.current = r; }}
          />
        </div>
        <div className="rail" ref={rail} aria-hidden="true">{steps.map((st) => <i key={st.sign}><b /></i>)}</div>
        <p className="hero-hint" ref={hint}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6" /></svg>{t('landing.hero.hint')}</p>
        {!reducedMotion && (
          <div className="hero-tools">
            <Btn variant="ghost sm" aria-pressed={playing} onClick={() => setPlaying((v) => !v)} title={t('scene.simNote')}>{playing ? t('scene.simStop') : t('scene.simulate')}</Btn>
          </div>
        )}
      </div>
    </section>
  );
}

function Ribbon() {
  const { t } = useT();
  const track = useRef(null);
  const st = useRef({ x: 0, last: 0, w: 0 });
  useTick((s) => {
    const el = track.current; const c = st.current;
    if (!el) return;
    if (!c.w || s.resized) c.w = el.scrollWidth / 2;
    const v = Math.abs(s.scrollY - c.last); c.last = s.scrollY;
    c.x = (c.x + (0.03 + v * 0.02) * s.dt) % c.w;
    el.style.transform = `translate3d(${(-c.x).toFixed(1)}px, 0, 0)`;
  }, 'write', !reducedMotion);
  const words = ['reception', 'lift1', 'lift2', 'pit', 'diagnosis_bay', 'waiting', 'pickup'].map((k) => t(`locations.${k}`));
  return (
    <div className="ribbon" aria-hidden="true">
      <div className="ribbon-track" ref={track}>{[0, 1].map((n) => words.map((w) => <span key={`${n}${w}`}>{w}</span>))}</div>
    </div>
  );
}

function PanelSection() {
  const { t } = useT();
  const [state, setState] = useState('in_repair');
  return (
    <section className="section section--paper" id="panel" data-tone="paper">
      <div className="wrap split">
        <div>
          <div className="sec-head">
            <Reveal className="h-section" lines={t('landing.panel.title')} />
            <p className="lead">{t('landing.panel.lead')}</p>
          </div>
          <ul className="points">{t('landing.panel.points').map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}</ul>
        </div>
        <div className="mock" aria-label={t('landing.panel.try')}>
          <div className="mock-head">
            <div><Plate value="1234BCD" /> <span className="hint">Seat León</span></div>
            <span className="demo-tag">{t('common.demo')}</span>
          </div>
          <p className="hint">{t('landing.panel.tryNote')}</p>
          <div className="choices" role="group" aria-label={t('panel.detail.state')}>
            {STATES.map((s) => <button key={s} type="button" className="choice" aria-pressed={state === s} onClick={() => setState(s)}>{t(`states.${s}`)}</button>)}
          </div>
          <div className="mock-says" aria-live="polite"><small>{t('nav.customer')}</small><span>{t(`consulta.status.${state}`)}</span></div>
          <Btn to="/panel" variant="block">{t('landing.hero.cta')}</Btn>
        </div>
      </div>
    </section>
  );
}

function CustomerSection() {
  const { t } = useT();
  const wrap = useRef(null);
  const [step, setStep] = useState(reducedMotion ? 4 : 0);
  useViewport(wrap, ({ rect, vh }) => {
    const p = clamp(-rect.top / Math.max(1, rect.height - vh));
    const i = Math.min(STATES.length - 1, Math.floor(p * STATES.length));
    setStep((cur) => (cur === i ? cur : i));
  }, !reducedMotion);
  const state = STATES[step];
  return (
    <section className="section--dark on-dark" id="customer" data-tone="dark">
      <div className="pin-wrap" ref={wrap}>
        <div className="pin-stage">
          <div className="wrap split">
            <div>
              <div className="sec-head">
                <Reveal className="h-section" lines={t('landing.customer.title')} />
                <p className="lead">{t('landing.customer.lead')}</p>
              </div>
              <ul className="points">{t('landing.customer.points').map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}</ul>
            </div>
            <div className="phone">
              <div className="mock-head"><div><span className="hint">{t('landing.customer.cardPlate')}</span><br /><Plate value="1234BCD" /></div><span className="demo-tag">{t('common.demo')}</span></div>
              <div className="stepper" aria-hidden="true">{STATES.map((s, i) => <i key={s} data-on={i <= step} />)}</div>
              <StateChip state={state} />
              <p className="says" aria-live="polite"><span key={state}>{t(`consulta.status.${state}`)}</span></p>
              <Btn to="/consulta/DEMO01" variant="ghost block">{t('landing.hero.cta2')}</Btn>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Contact() {
  const { t } = useT();
  const [v, setV] = useState({ name: '', workshop: '', email: '', phone: '', message: '', consent: false, website: '' });
  const [errors, setErrors] = useState({});
  const [status, setStatus] = useState(null);
  const form = useRef(null);
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault(); setStatus(null);
    const r = validateContact(v);
    setErrors(r.errors);
    if (!r.ok) { requestAnimationFrame(() => form.current?.querySelector('[aria-invalid="true"]')?.focus()); return; }
    setStatus('sending');
    try {
      const api = await getAdapter();
      const res = await api.contact(v);
      if (res.ok) setStatus('ok');
      else if (res.errors) { setErrors(res.errors); setStatus(null); }
      else setStatus(res.error === 'rate_limited' ? 'rate_limited' : 'generic');
    } catch (err) { setStatus(err instanceof NetworkError ? 'network' : 'generic'); }
  };
  return (
    <section className="section section--paper" id="contact" data-tone="paper">
      <div className="wrap split">
        <div className="sec-head">
          <Reveal className="h-section" lines={t('landing.contact.title')} />
          <p className="lead">{t('landing.contact.lead')}</p>
          <p className="hint">{t('landing.contact.pricing')}</p>
        </div>
        <form className="form" onSubmit={submit} noValidate ref={form}>
          <div className="form-row">
            <Field label={t('landing.contact.name')} error={errors.name}>{(a) => <input className="input" autoComplete="name" value={v.name} onChange={set('name')} maxLength={80} {...a} />}</Field>
            <Field label={t('landing.contact.workshop')} error={errors.workshop}>{(a) => <input className="input" autoComplete="organization" value={v.workshop} onChange={set('workshop')} maxLength={80} {...a} />}</Field>
          </div>
          <div className="form-row">
            <Field label={t('landing.contact.email')} error={errors.email}>{(a) => <input className="input" type="email" inputMode="email" autoComplete="email" value={v.email} onChange={set('email')} maxLength={254} {...a} />}</Field>
            <Field label={t('landing.contact.phone')} optional error={errors.phone}>{(a) => <input className="input" type="tel" inputMode="tel" autoComplete="tel" value={v.phone} onChange={set('phone')} maxLength={20} {...a} />}</Field>
          </div>
          <Field label={t('landing.contact.message')} hint={t('landing.contact.messageHint')} error={errors.message}>{(a) => <textarea className="input" value={v.message} onChange={set('message')} maxLength={1500} {...a} />}</Field>
          <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={v.website} onChange={set('website')} /></label></div>
          <div className="field">
            <label className="check"><input type="checkbox" checked={v.consent} onChange={set('consent')} aria-invalid={errors.consent ? 'true' : undefined} /><span>{t('landing.contact.consent')} <Link to="/privacidad">{t('landing.footer.legal')}</Link></span></label>
            {errors.consent && <p className="err" role="alert">{t('errors.required')}</p>}
          </div>
          <Btn type="submit" disabled={status === 'sending'}>{status === 'sending' ? t('landing.contact.sending') : t('landing.contact.submit')}</Btn>
          <div aria-live="polite">
            {status === 'ok' && <p className="notice notice--ok">{t('landing.contact.okDemo')}</p>}
            {status && !['ok', 'sending'].includes(status) && <p className="notice notice--error">{t(`errors.${status}`)}</p>}
          </div>
        </form>
      </div>
    </section>
  );
}

export default function Landing() {
  const { t } = useT();
  useLenis();
  return (
    <>
      <a className="skip" href="#how" onClick={(e) => { e.preventDefault(); scrollToId('how'); }}>{t('common.skip')}</a>
      <Header />
      <main>
        <Hero />
        <Ribbon />
        <LiveShop />
        <section className="section" id="how" data-tone="light">
          <div className="wrap">
            <div className="sec-head"><Reveal className="h-section" lines={t('landing.how.title')} /></div>
            <ol className="steps">{t('landing.how.steps').map((s) => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
          </div>
        </section>
        <PanelSection />
        <CustomerSection />
        <Calc />
        <section className="section section--paper" id="privacy" data-tone="paper">
          <div className="wrap">
            <div className="sec-head"><Reveal className="h-section" lines={t('landing.privacy.title')} /></div>
            <ul className="priv-grid">{t('landing.privacy.points').map(([a, b]) => <li key={a}><strong>{a}</strong><span>{b}</span></li>)}</ul>
            <p style={{ marginTop: 24 }}><Link to="/privacidad">{t('landing.privacy.link')}</Link></p>
          </div>
        </section>
        <section className="section--brand on-dark" data-tone="brand">
          <div className="wrap band">
            <p>{t('landing.band.text')}</p>
            <div className="band-cta"><Btn to="/panel" variant="light">{t('landing.band.cta')}</Btn><Btn to="/consulta/DEMO01" variant="outline-light">{t('landing.band.cta2')}</Btn></div>
          </div>
        </section>
        <Contact />
      </main>
      <footer className="site-footer on-dark" data-tone="dark">
        <div className="wrap footer-grid">
          <p className="footer-word" aria-hidden="true"><LetterWord text="Tridom Automotive" /></p>
          <div className="footer-meta">
            <span>{t('landing.footer.by')}</span>
            {['live', 'panel', 'customer', 'calc', 'privacy'].map((id) => <a key={id} href={`#${id}`} onClick={(e) => { e.preventDefault(); scrollToId(id); }}>{t(`nav.${id}`)}</a>)}
            <span>{t('landing.footer.demo')}</span>
            <Link to="/privacidad">{t('landing.footer.legal')}</Link>
          </div>
          <p className="hint" style={{ color: '#c9d6ee' }}>{t('landing.footer.rights')}</p>
        </div>
      </footer>
    </>
  );
}
