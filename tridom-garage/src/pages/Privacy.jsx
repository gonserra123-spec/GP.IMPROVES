import { useT, LangSwitch } from '../i18n/index.jsx';
import { Link, Wordmark } from '../components/ui.jsx';

export default function Privacy() {
  const { t } = useT();
  return (
    <>
      <header className="site-header" data-tone="light"><Wordmark /><div className="header-right"><LangSwitch /></div></header>
      <main className="legal">
        <div className="wrap">
          <article>
            <div>
              <h1 className="h-section">{t('privacy.title')}</h1>
              <p className="notice notice--warn" style={{ marginTop: 16 }}>{t('privacy.updated')}</p>
            </div>
            {t('privacy.sections').map(([title, text]) => <section key={title}><h2>{title}</h2><p>{text}</p></section>)}
            <p><Link to="/">← {t('common.home')}</Link></p>
          </article>
        </div>
      </main>
    </>
  );
}
