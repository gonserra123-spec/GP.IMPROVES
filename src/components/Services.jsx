import { useI18n } from '../i18n/index.jsx';
import Ph from './Ph.jsx';

export default function Services() {
  const { t, dict } = useI18n();
  return (
    <section className="section" id="reformas" aria-labelledby="svc-t" style={{ borderTop: '1px solid var(--line)' }}>
      <div className="wrap">
        <div className="services-head">
          <h2 id="svc-t" className="display">{t('services.title')}</h2>
          <p className="lead">{t('services.intro')}</p>
          <Ph k="services" />
        </div>
        <div className="services-grid">
          {dict.services.items.map((it) => (
            <article key={it.title} className="svc">
              <h3>{it.title}</h3>
              <p className="body">{it.text}</p>
              <p className="inc">{t('services.includes')}</p>
              <ul className="pts">{it.points.map((p) => <li key={p}>{p}</li>)}</ul>
            </article>
          ))}
        </div>
        <div className="svc-other">
          <h3 className="h40">{t('services.other.title')}</h3>
          <p className="body">{t('services.other.text')}</p>
          <a className="btn btn-fill" href="#presupuesto">{t('services.cta')}</a>
        </div>
      </div>
    </section>
  );
}
