import { useI18n } from '../i18n/index.jsx';

export default function Hero() {
  const { t, dict } = useI18n();
  const [a, b, c, d] = dict.hero.lines;
  return (
    <section className="hero" id="top">
      <div className="wrap">
        <h1 aria-label={t('hero.h1')}>
          <span className="ln" aria-hidden="true">{a} {b}</span>
          <span className="dot" aria-hidden="true" />
          <span className="ln" aria-hidden="true">{c} {d}</span>
        </h1>
        <p className="lead">{t('hero.lead')}</p>
      </div>
    </section>
  );
}
