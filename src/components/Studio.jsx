import { useI18n } from '../i18n/index.jsx';
import Ph from './Ph.jsx';

export default function Studio() {
  const { t, dict } = useI18n();
  return (
    <section className="section studio" id="estudio" aria-labelledby="studio-t">
      <div className="narrow center">
        <h2 id="studio-t" className="display">{t('studio.title')}</h2>
        <p className="statement">{t('studio.p1')}</p>
        <p className="body">{t('studio.p2')}</p>
        <div style={{ marginTop: 28 }}><Ph k="team" /></div>
      </div>
      <div className="wrap">
        <div className="people">
          {dict.studio.people.map((name) => (
            <div className="person" key={name}>
              <div className="ph-photo"><Ph>{t('studio.photoPh')}</Ph></div>
              <p className="name">{name}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
