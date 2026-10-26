import Header from './components/Header.jsx';
import Hero from './components/Hero.jsx';
import Studio from './components/Studio.jsx';
import Services from './components/Services.jsx';
import Vano from './components/Vano.jsx';
import Process from './components/Process.jsx';
import Projects from './components/Projects.jsx';
import Faq from './components/Faq.jsx';
import Quote from './components/Quote.jsx';
import Contact from './components/Contact.jsx';
import Footer from './components/Footer.jsx';
import { useI18n } from './i18n/index.jsx';

export default function App() {
  const { t } = useI18n();
  return (
    <>
      <a className="skip" href="#main">{t('a11y.skip')}</a>
      <Header />
      <main id="main">
        <Hero />
        <Projects />
        <Studio />
        <Services />
        <Vano />
        <Process />
        <Faq />
        <Quote />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
