import { useEffect, useMemo, useRef, useState } from 'react';
import fullTemplate from '../../shared/template.json';
import { isVehicleCode, plateError } from '../../shared/validate.js';
import { normalizePlate } from '../../shared/plates.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Field, Link, Plate, SceneHost, StateChip, Wordmark } from '../components/ui.jsx';
import { getAdapter, NetworkError } from '../data/adapter.js';
import { useScene } from '../scene/store.js';

const MINE = 'mine';

export default function Consulta({ code }) {
  const { t, date, money } = useT();
  const [workshop, setWorkshop] = useState(undefined); // undefined = cargando, null = no existe
  const [plate, setPlate] = useState('');
  const [website, setWebsite] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null); // { token, vehicle, others }
  const [last4, setLast4] = useState('');
  const [verifyErr, setVerifyErr] = useState(null);
  const [cost, setCost] = useState(null);
  const ready = useScene((s) => s.ready);
  const heading = useRef(null);

  useEffect(() => {
    let alive = true;
    getAdapter().then((api) => api.publicWorkshop(code)).then((r) => { if (alive) setWorkshop(r.ok ? r.workshop : null); }).catch(() => { if (alive) setWorkshop(null); });
    return () => { alive = false; useScene.getState().reset(); };
  }, [code]);

  // Solo llega al navegador el DTO de ese coche; de los demás, la plaza que ocupan.
  useEffect(() => {
    const s = useScene.getState();
    if (!result) { s.setData([], []); s.select(null); return; }
    s.setData([{ id: MINE, ...result.vehicle }], result.others);
    s.select(MINE);
  }, [result]);
  useEffect(() => { if (ready && result) useScene.getState().focusOn(MINE); }, [ready, result?.vehicle.location, result?.vehicle.slot, !!result]);

  // Entrada por el QR del albarán: /consulta/CODIGO?c=ABC234 abre el coche directamente.
  useEffect(() => {
    const c = new URLSearchParams(window.location.search).get('c');
    if (!c || !isVehicleCode(c)) return undefined;
    let alive = true;
    setBusy(true);
    getAdapter().then((api) => api.publicLookup({ code, vehicleCode: c.toUpperCase(), website: '' })).then((r) => {
      if (!alive) return;
      if (r.ok) { setResult({ token: r.token, vehicle: r.vehicle, others: r.others }); requestAnimationFrame(() => heading.current?.focus()); }
      else setError(r.status === 429 ? 'rate_limited' : 'not_available');
    }).catch((err) => { if (alive) setError(err instanceof NetworkError ? 'network' : 'not_available'); }).finally(() => { if (alive) setBusy(false); });
    return () => { alive = false; };
  }, [code]);

  // Se refresca solo con el token de vista (sin volver a escribir la matrícula).
  useEffect(() => {
    if (!result) return undefined;
    const id = setInterval(async () => {
      if (document.hidden) return;
      try {
        const api = await getAdapter(); const r = await api.publicRefresh(result.token);
        if (r.ok) setResult((cur) => (cur ? { ...cur, vehicle: r.vehicle, others: r.others } : cur));
      } catch { /* sin red: se reintenta en el siguiente ciclo */ }
    }, 15000);
    return () => clearInterval(id);
  }, [result?.token]);

  const submit = async (e) => {
    e.preventDefault();
    const pe = plateError(plate, { allowGeneric: true });
    if (pe) { setError(pe); return; }
    setBusy(true); setError(null);
    try {
      const api = await getAdapter();
      const r = await api.publicLookup({ code, plate: normalizePlate(plate), website });
      if (r.ok) { setResult({ token: r.token, vehicle: r.vehicle, others: r.others }); setCost(null); setLast4(''); setVerifyErr(null); requestAnimationFrame(() => heading.current?.focus()); }
      else setError(r.status === 429 ? 'rate_limited' : 'not_available');
    } catch (err) { setError(err instanceof NetworkError ? 'network' : 'not_available'); }
    setBusy(false);
  };
  const verify = async (e) => {
    e.preventDefault();
    if (!/^\d{4}$/.test(last4)) { setVerifyErr('last4_format'); return; }
    setVerifyErr(null);
    try {
      const api = await getAdapter(); const r = await api.publicVerify({ token: result.token, last4 });
      if (r.ok) setCost(r.cost); else setVerifyErr(r.status === 429 ? 'rate_limited' : 'not_available');
    } catch { setVerifyErr('network'); }
  };
  const template = useMemo(() => (workshop ? { ...fullTemplate, lifts: workshop.template.lifts, pit: workshop.template.pit } : null), [workshop]);
  const msg = (key) => (key === 'not_available' ? t('consulta.notAvailable') : t(`errors.${key}`));
  const v = result?.vehicle;

  return (
    <div className="consulta">
      <header className="app-bar">
        <Wordmark />
        {workshop && <span className="who"><strong>{workshop.name}</strong></span>}
        {workshop?.code === 'DEMO01' && <span className="demo-tag">{t('common.demo')}</span>}
        <span className="grow" />
        <LangSwitch />
      </header>
      {workshop === undefined && <p className="scene-loading" role="status">{t('common.loading')}</p>}
      {workshop === null && <main className="consulta-side"><p className="notice notice--error">{t('consulta.unknownWorkshop')}</p><Link to="/">{t('common.home')}</Link></main>}
      {workshop && (
        <main className="consulta-main">
          <div className="consulta-scene">
            <SceneHost template={template} name={workshop.name} brandColor={workshop.brandColor} mode="public" interactive="buttons" listVehicles={v ? [{ id: MINE, ...v }] : []} />
            {v && <p className="scene-note">{t('consulta.anon')}</p>}
          </div>
          <div className="consulta-side">
            {!v ? (
              <form className="panel-card" onSubmit={submit} noValidate>
                <h1 className="h-section" style={{ fontSize: '2.25rem' }}>{t('consulta.title')}</h1>
                <p className="lead">{t('consulta.lead')}</p>
                <Field label={t('consulta.plate')} hint={t('panel.form.plateHint')}>
                  {(a) => <input className="input input--plate" autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck="false" maxLength={12} value={plate} onChange={(e) => setPlate(e.target.value.toUpperCase())} {...a} aria-invalid={error ? 'true' : undefined} />}
                </Field>
                <div className="hp" aria-hidden="true"><label>Website<input tabIndex={-1} autoComplete="off" value={website} onChange={(e) => setWebsite(e.target.value)} /></label></div>
                <div aria-live="assertive">{error && <p className="notice notice--error">{msg(error)}</p>}</div>
                <Btn type="submit" variant="block" disabled={busy}>{busy ? t('consulta.checking') : t('consulta.submit')}</Btn>
                <p className="hint"><Link to="/privacidad">{t('consulta.privacy')}</Link></p>
              </form>
            ) : (
              <article className="panel-card" aria-live="polite">
                <div className="detail-head"><div className="grow"><Plate value={v.plate} /><div className="model">{v.make} {v.model}</div></div><StateChip state={v.state} /></div>
                <h1 className="status-line" tabIndex={-1} ref={heading}>{t(`consulta.status.${v.state}`)}</h1>
                <dl className="kv">
                  <dt>{t('consulta.where')}</dt><dd>{t(`locations.${v.location || 'none'}`)}</dd>
                </dl>
                {v.etaAt && v.state !== 'delivered' && <p>{t('consulta.eta', { date: date(v.etaAt) })}</p>}
                {!v.etaAt && ['diagnosis', 'awaiting_approval', 'awaiting_part', 'in_repair'].includes(v.state) && <p className="hint">{t('consulta.etaNone')}</p>}
                {v.parts.length > 0 && (
                  <div className="block">
                    <h3>{t('consulta.parts')}</h3>
                    <ul className="scene-list">{v.parts.map((p, i) => <li key={i}><strong>{p.description}</strong><span className="where">{t(`partStates.${p.state}`)} · {p.etaAt ? t('consulta.partEta', { date: date(p.etaAt) }) : t('consulta.partNoEta')}</span></li>)}</ul>
                  </div>
                )}
                {v.canVerify && (
                  <div className="block">
                    <h3>{t('consulta.verify.title')}</h3>
                    {cost ? (
                      cost.estimate === null && cost.final === null ? <p className="hint">{t('consulta.verify.none')}</p> : (
                        <dl className="cost">
                          {cost.estimate !== null && <div className="kv"><dt>{t('consulta.verify.estimate')}</dt><dd>{money(cost.estimate)}</dd></div>}
                          {cost.final !== null && <div className="kv"><dt>{t('consulta.verify.final')}</dt><dd>{money(cost.final)}</dd></div>}
                        </dl>
                      )
                    ) : (
                      <form onSubmit={verify} noValidate style={{ display: 'grid', gap: 12 }}>
                        <Field label={t('consulta.verify.label')} hint={t('consulta.verify.hint')}>
                          {(a) => <input className="input input--plate" inputMode="numeric" pattern="[0-9]*" autoComplete="off" maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} {...a} aria-invalid={verifyErr ? 'true' : undefined} />}
                        </Field>
                        <div aria-live="assertive">{verifyErr && <p className="notice notice--error">{msg(verifyErr)}</p>}</div>
                        <Btn type="submit" variant="ghost">{t('consulta.verify.submit')}</Btn>
                      </form>
                    )}
                  </div>
                )}
                <p className="hint">{t('consulta.updated')}</p>
                <Btn variant="ghost" onClick={() => { setResult(null); setPlate(''); setCost(null); }}>{t('consulta.again')}</Btn>
              </article>
            )}
          </div>
        </main>
      )}
    </div>
  );
}
