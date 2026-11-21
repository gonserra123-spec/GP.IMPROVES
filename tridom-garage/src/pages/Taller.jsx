import { useEffect, useMemo, useRef, useState } from 'react';
import template from '../../shared/template.json';
import { STATES } from '../../shared/domain.js';
import { plateError } from '../../shared/validate.js';
import { normalizePlate } from '../../shared/plates.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Field, Link, Reveal, SceneHost, StateChip, Wordmark, navigate } from '../components/ui.jsx';
import { useLenis, useTick, useViewport, scrollToId, reducedMotion } from '../lib/hooks.js';
import { createSpring, clamp, range } from '../lib/spring.js';
import { useScene } from '../scene/store.js';
import { createSim } from '../scene/simStore.js';
import { LetterWord } from './landingLive.jsx';
import { TALLER, isDemoWorkshop, PLATE_HANDOFF } from '../data/taller.js';
import { About, Brands, ContactActions, Photos, Quote, Reviews, Services, TopBar, Visit } from './tallerSections.jsx';

// Web pública del taller. Lo principal: que el cliente vea cómo va su coche escribiendo la matrícula.
// Mismas bases que la landing del producto: DESIGN.md, ticker único, muelles, sin @keyframes, ES/EN.

const AZ = Math.PI / 4;
const ROAD = STATES.filter((s) => s !== 'delivered');
const go = (id) => (e) => { e.preventDefault(); scrollToId(id); };
const NAV = [['estado', 'estado'], ['visita', 'visit'], ['servicios', 'services'], ['opiniones', 'reviews'], ['quienes', 'about']];

function Header() {
  const { t } = useT();
  const ref = useRef(null);
  // El logo y el selector de idioma toman el tono de la sección que tienen debajo.
  useTick((s) => {
    if (!ref.current || (!s.scrolled && s.frame % 20 !== 0)) return;
    let tone = 'light';
    for (const el of document.querySelectorAll('[data-tone]')) {
      if (el === ref.current) continue;
      const r = el.getBoundingClientRect();
      if (r.top <= 84 && r.bottom > 84) tone = el.dataset.tone; // 84 = franja de contacto + mitad de la cabecera
    }
    if (ref.current.dataset.tone !== tone) ref.current.dataset.tone = tone;
  }, 'read');
  return (
    <header className="site-header" ref={ref} data-tone="light">
      <Wordmark a="Tridom" b="Garage" />
      <nav className="site-nav" aria-label={t('nav.menu')}>
        {NAV.map(([id, k]) => <a key={id} href={`#${id}`} onClick={go(id)}>{t(`taller.nav.${k}`)}</a>)}
      </nav>
      <div className="header-right"><LangSwitch /></div>
    </header>
  );
}

// Campo de matrícula con la banda azul europea. Al enviar, pasa a la consulta del taller.
function PlateForm({ idPrefix = 'hero' }) {
  const { t } = useT();
  const [plate, setPlate] = useState('');
  const [error, setError] = useState(null);
  const input = useRef(null);
  const submit = (e) => {
    e.preventDefault();
    const pe = plateError(plate, { allowGeneric: true });
    if (pe) { setError(pe); input.current?.focus(); return; }
    try { sessionStorage.setItem(PLATE_HANDOFF, normalizePlate(plate)); } catch { /* sin almacenamiento: la consulta pedirá la matrícula */ }
    navigate(`/consulta/${TALLER.code}`);
  };
  return (
    <form className="plate-form" onSubmit={submit} noValidate>
      <Field id={`${idPrefix}-plate`} label={t('taller.hero.plate')} hint={t('panel.form.plateHint')} error={error || undefined}>
        {(a) => (
          <div className="plate-box" data-invalid={error ? 'true' : undefined}>
            <span className="plate-band" aria-hidden="true"><i />E</span>
            <input
              ref={input} className="plate-input" placeholder="1234 BCD" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck="false"
              maxLength={12} value={plate} onChange={(e) => { setPlate(e.target.value.toUpperCase()); setError(null); }} {...a}
            />
          </div>
        )}
      </Field>
      <Btn type="submit" variant="block">{t('taller.hero.submit')}</Btn>
    </form>
  );
}

function Hero() {
  const { t } = useT();
  const wrap = useRef(null);
  const rig = useRef(null);
  const target = useRef(0);
  const spring = useRef(createSpring(0, { tension: 60, friction: 20 }));
  const sim = useMemo(() => createSim(template), []);
  const vehicles = useScene((s) => s.vehicles);

  useEffect(() => {
    sim.seed();
    const off = sim.subscribe((list) => useScene.getState().setData(list));
    return () => { off(); useScene.getState().reset(); };
  }, [sim]);

  // Capa a distinta velocidad: al bajar, la cámara gira un poco y se acerca a la nave.
  useViewport(wrap, ({ rect }) => { target.current = clamp(-rect.top / Math.max(1, rect.height)); }, !reducedMotion);
  useTick((s) => {
    const sp = spring.current; sp.set(target.current);
    const moved = sp.step(s.dt);
    const r = rig.current;
    if (!r || (!moved && !s.resized && s.frame > 10)) return;
    const p = sp.value;
    const f = r.frame(r.bounds, AZ - 0.3 * p, 0.94 - 0.18 * p);
    r.setTarget({ cx: f.cx, cz: f.cz, zoom: f.zoom, az: AZ - 0.3 * p });
  }, 'write', !reducedMotion);

  return (
    <section className="th-hero" ref={wrap} data-tone="light" aria-labelledby="hero-title" id="estado">
      <div className="th-hero-copy">
        <span className="sign-plate">{t('taller.hero.tag')}</span>
        <Reveal as="h1" id="hero-title" className="h-display" lines={t('taller.hero.title')} />
        <p className="lead">{t('taller.hero.lead')}</p>
        <PlateForm />
        <p className="hint">{t('taller.hero.qr')}</p>
        <div className="hero-talk"><p className="mini-title">{t('taller.hero.talk')}</p><ContactActions variant="hero" /></div>
      </div>
      <div className="th-hero-scene">
        <SceneHost
          template={template} name={TALLER.name} brandColor={TALLER.brandColor} mode="demo" interactive="none" controls={false}
          sim={sim} simulate={!reducedMotion} listVehicles={vehicles}
          onReady={({ rig: r, engine }) => { r.bounds = engine.bounds; r.stiffness = 3.2; rig.current = r; }}
        />
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
  const words = TALLER.services.map(({ id }) => t(`taller.services.items.${id}`)[0]);
  return (
    <div className="ribbon" aria-hidden="true">
      <div className="ribbon-track" ref={track}>{[0, 1].map((n) => words.map((w) => <span key={`${n}${w}`}>{w}</span>))}</div>
    </div>
  );
}

// Perfil lateral de un turismo, en el mismo trazo que la escena.
function CarProfile({ wheels }) {
  return (
    <svg className="road-car" viewBox="0 0 132 52" aria-hidden="true">
      <g transform="translate(132 0) scale(-1 1)">
      <path className="body" d="M6 38 L6 30 Q8 24 18 22 L38 20 L52 9 Q56 6 62 6 L88 6 Q95 6 100 11 L111 21 Q124 23 126 30 L126 38 Q126 40 124 40 L112 40 A14 14 0 0 0 84 40 L46 40 A14 14 0 0 0 18 40 L8 40 Q6 40 6 38 Z" />
      <path className="glass" d="M44 20 L55 11 Q57 9.5 60 9.5 L71 9.5 L71 20 Z M75 9.5 L87 9.5 Q92 9.5 95 12.5 L103 20 L75 20 Z" />
      {[32, 98].map((cx, i) => (
        <g key={cx} ref={(el) => { wheels.current[i] = el; }} className="wheel">
          <circle className="tyre" cx={cx} cy={40} r={10} />
          <circle className="rim" cx={cx} cy={40} r={4.5} />
          <path className="spoke" d={`M${cx - 9} 40 H${cx + 9} M${cx} 31 V49`} />
        </g>
      ))}
      </g>
    </svg>
  );
}

// Firma: el coche recorre la carretera de estados con el scroll y el móvil dice lo que leería el cliente.
function Road() {
  const { t } = useT();
  const wrap = useRef(null); const track = useRef(null); const car = useRef(null); const fill = useRef(null);
  const wheels = useRef([]);
  const target = useRef(0);
  const spring = useRef(createSpring(0, { tension: 90, friction: 22 }));
  const [step, setStep] = useState(0);
  const N = ROAD.length;

  useViewport(wrap, ({ rect, vh }) => { target.current = clamp(-rect.top / Math.max(1, rect.height - vh)); }, !reducedMotion);
  useTick((s) => {
    const sp = spring.current; sp.set(target.current);
    const moved = sp.step(s.dt);
    if (!moved && !s.resized && s.frame > 10) return;
    const p = range(sp.value, 0.04, 0.92);
    const w = track.current?.clientWidth || 0;
    const x = p * w;
    if (car.current) car.current.style.transform = `translate3d(${x.toFixed(1)}px, 0, 0)`;
    // Las ruedas giran lo que avanza el coche (radio 10 en un perfil de 132 de ancho).
    const scale = (car.current?.clientWidth || 132) / 132;
    const deg = -(x / (10 * scale)) * (180 / Math.PI);
    wheels.current.forEach((g) => { if (g) g.style.transform = `rotate(${deg.toFixed(1)}deg)`; });
    if (fill.current) fill.current.style.transform = `scaleX(${p.toFixed(4)})`;
    const i = Math.min(N - 1, Math.round(p * (N - 1)));
    setStep((cur) => (cur === i ? cur : i));
  }, 'write', !reducedMotion);

  if (reducedMotion) {
    return (
      <section className="section section--dark on-dark" data-tone="dark" aria-labelledby="road-title">
        <div className="wrap">
          <div className="sec-head"><Reveal className="h-section" id="road-title" lines={t('taller.road.title')} /><p className="lead">{t('taller.road.lead')}</p></div>
          <ol className="road-list">{ROAD.map((s) => <li key={s}><StateChip state={s} /><span>{t(`consulta.status.${s}`)}</span></li>)}</ol>
        </div>
      </section>
    );
  }

  const state = ROAD[step];
  return (
    <section className="section--dark on-dark" data-tone="dark" aria-labelledby="road-title">
      <div className="road-wrap" ref={wrap}>
        <div className="road-stage">
          <div className="wrap road-grid">
            <div className="sec-head">
              <Reveal className="h-section" id="road-title" lines={t('taller.road.title')} />
              <p className="lead">{t('taller.road.lead')}</p>
            </div>
            <div className="phone road-phone" aria-live="polite">
              <div className="mock-head"><span className="hint">{t('taller.road.phone')}</span><span className="hint">{t('taller.road.step', { n: step + 1, total: N })}</span></div>
              <div className="stepper" style={{ gridTemplateColumns: `repeat(${N}, 1fr)` }} aria-hidden="true">{ROAD.map((s, i) => <i key={s} data-on={i <= step} />)}</div>
              <StateChip state={state} />
              <p className="says"><span key={state}>{t(`consulta.status.${state}`)}</span></p>
            </div>
          </div>
          <div className="wrap">
            <div className="road" ref={track}>
              <div className="road-car-wrap" ref={car}><CarProfile wheels={wheels} /></div>
              <div className="road-line"><b ref={fill} /></div>
              <ol className="road-stops">
                {ROAD.map((s, i) => (
                  <li key={s} data-on={i <= step} data-now={i === step} style={{ left: `${(i / (N - 1)) * 100}%` }}>
                    <i /><span>{t(`states.${s}`)}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function How() {
  const { t } = useT();
  return (
    <section className="section section--paper" id="como" data-tone="paper" aria-labelledby="how-title">
      <div className="wrap">
        <div className="sec-head"><Reveal className="h-section" id="how-title" lines={t('taller.how.title')} /></div>
        <ol className="steps">{t('taller.how.steps').map((s) => <li key={s.title}><h3>{s.title}</h3><p>{s.text}</p></li>)}</ol>
      </div>
    </section>
  );
}

function Faq() {
  const { t } = useT();
  return (
    <section className="section section--paper" id="faq" data-tone="paper" aria-labelledby="faq-title">
      <div className="wrap split">
        <div className="sec-head"><Reveal className="h-section" id="faq-title" lines={t('taller.faq.title')} /></div>
        <div className="faq">
          {t('taller.faq.items').map(([q, a]) => (
            <details key={q}><summary>{q}</summary><p>{a}</p></details>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function Taller() {
  const { t } = useT();
  useLenis();
  return (
    <>
      <a className="skip" href="#estado" onClick={go('estado')}>{t('common.skip')}</a>
      <TopBar />
      <Header />
      <main>
        <Hero />
        <Ribbon />
        <Visit />
        <Services />
        <Quote />
        <Reviews />
        <Road />
        <Photos />
        <Brands />
        <How />
        <section className="section--brand on-dark" data-tone="brand">
          <div className="wrap band">
            <p>{t('taller.cita.text')}</p>
            <div className="band-cta">
              <Btn to={`/cita/${TALLER.code}`} variant="light">{t('taller.cita.cta')}</Btn>
              <Btn variant="outline-light" onClick={() => scrollToId('estado')}>{t('taller.nav.cta')}</Btn>
            </div>
          </div>
        </section>
        <Faq />
        <About />
      </main>
      <footer className="site-footer on-dark" data-tone="dark">
        <div className="wrap footer-grid">
          <p className="footer-word" aria-hidden="true"><LetterWord text={TALLER.name} /></p>
          <div className="footer-meta">
            {NAV.map(([id, k]) => (
              <a key={id} href={`#${id}`} onClick={go(id)}>{t(`taller.nav.${k}`)}</a>
            ))}
            <Link to={`/cita/${TALLER.code}`}>{t('taller.cita.cta')}</Link>
            <Link to="/panel">{t('taller.footer.staff')}</Link>
            <Link to="/privacidad">{t('taller.footer.legal')}</Link>
          </div>
          <div className="footer-meta">
            <Link to="/producto">{t('taller.footer.by')}</Link>
            {isDemoWorkshop && <span>{t('taller.footer.demo')}</span>}
          </div>
        </div>
      </footer>
    </>
  );
}
