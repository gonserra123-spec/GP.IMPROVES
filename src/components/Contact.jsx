import { useI18n } from '../i18n/index.jsx';
import { BUSINESS } from '../data/business.js';
import Ph from './Ph.jsx';

export default function Contact() {
  const { t } = useI18n();
  return (
    <section className="section" id="contacto" aria-labelledby="con-t">
      <div className="narrow center">
        <h2 id="con-t" className="display">{t('contact.title')}</h2>
        <p className="lead">{t('contact.intro')}</p>
        <div className="contact-list">
          <div className="contact-row">
            <span className="mono k">{t('contact.phone')}</span>
            <a href={`tel:${BUSINESS.phone.tel}`} aria-label={t('contact.callAria')}>{BUSINESS.phone.intl}</a>
          </div>
          <div className="contact-row">
            <span className="mono k">{t('contact.email')}</span>
            <a href={`mailto:${BUSINESS.email}`}>{BUSINESS.email}</a>
          </div>
          <div className="contact-row">
            <span className="mono k">{t('contact.city')}</span>
            <span className="v">{t('contact.cityValue')}</span>
          </div>
          <div className="contact-row">
            <span className="mono k">{t('contact.addressLabel')}</span>
            <span><Ph k="address" /></span>
          </div>
        </div>
        <p className="follow">
          {t('contact.followPre')} <a href={BUSINESS.instagram.url} target="_blank" rel="noopener noreferrer">{BUSINESS.instagram.handle}</a> {t('contact.followPost')}
        </p>
      </div>
    </section>
  );
}
