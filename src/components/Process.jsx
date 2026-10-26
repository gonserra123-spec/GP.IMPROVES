import { useI18n } from '../i18n/index.jsx';
import Ph from './Ph.jsx';

export default function Process() {
  const { t, dict } = useI18n();
  return (
    <section className="section process" id="proceso" aria-labelledby="proc-t">
      <div className="narrow center">
        <h2 id="proc-t" className="display">{t('process.title')}</h2>
        <p className="lead">{t('process.intro')}</p>
        <div style={{ marginTop: 20 }}><Ph k="process" /></div>
        <ol className="steps" style={{ textAlign: 'left' }}>
          {dict.process.steps.map((s, i) => (
            <li className="step" key={s.title}>
              <span className="n" aria-hidden="true">{i + 1}</span>
              <div>
                <h3>{s.title}</h3>
                <p className="body">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
