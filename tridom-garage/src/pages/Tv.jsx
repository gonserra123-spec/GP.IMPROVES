import { useEffect, useState } from 'react';
import { STATES } from '../../shared/domain.js';
import { useT, LangSwitch } from '../i18n/index.jsx';
import { Btn, Plate, StateChip, Wordmark } from '../components/ui.jsx';
import { useLiveCars, locationOf } from '../lib/liveDemo.js';

// Pantalla para la sala de espera: se deja en una tele y el cliente ve cómo va su coche sin preguntar.
export default function Tv() {
  const { t, lang } = useT();
  const { cars, playing, setPlaying } = useLiveCars({ every: 4200 });
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), 15000); return () => clearInterval(id); }, []);
  const clock = now.toLocaleTimeString(lang === 'es' ? 'es-ES' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const shown = cars.filter((c) => c.state !== 'delivered');
  const ready = shown.filter((c) => c.state === 'ready');
  return (
    <div className="tv on-dark" data-tone="dark">
      <header className="tv-bar">
        <Wordmark />
        <div className="tv-title"><h1 className="sign">{t('tv.title')}</h1><span className="demo-tag">{t('common.demo')}</span></div>
        <time className="tv-clock" dateTime={now.toISOString()}>{clock}</time>
      </header>
      <main className="tv-main">
        {ready.length > 0 && <p className="tv-ready" role="status">{t('tv.ready', { n: String(ready.length) })}</p>}
        <ul className="tv-grid">
          {shown.length === 0 && <li className="tv-empty">{t('tv.empty')}</li>}
          {shown.map((c) => {
            const i = cars.indexOf(c);
            return (
              <li key={c.id} className="tv-card" data-state={c.state}>
                <div className="tv-card-top"><Plate value={c.plate} /><StateChip state={c.state} /></div>
                <p className="tv-model">{c.model}</p>
                <div className="stepper" aria-hidden="true">{STATES.map((s, k) => <i key={s} data-on={k <= STATES.indexOf(c.state)} />)}</div>
                <p key={c.state} className="tv-says">{t(`consulta.status.${c.state}`)}</p>
                <small className="tv-where">{t(`locations.${locationOf(c, i)}`)}</small>
              </li>
            );
          })}
        </ul>
      </main>
      <footer className="tv-foot">
        <p>{t('tv.scan')}</p>
        <div className="tv-actions">
          <Btn variant="outline-light sm" aria-pressed={playing} onClick={() => setPlaying((v) => !v)}>{playing ? t('landing.live.pause') : t('landing.live.play')}</Btn>
          <LangSwitch />
          <Btn to="/" variant="outline-light sm">{t('common.home')}</Btn>
        </div>
      </footer>
    </div>
  );
}
