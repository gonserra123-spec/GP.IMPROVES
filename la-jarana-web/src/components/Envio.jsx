import { SITE } from '../content/site.js';
import { MaskWords } from './Reveal.jsx';
import Sticker from './Sticker.jsx';

// CTA final: sin formulario ni email. Todo va por Instagram.
export default function Envio() {
  return (
    <section id="envia" className="sec white" data-logo="white" aria-labelledby="t-env">
      <Sticker style={{ right: '6%', top: '12%' }} rotate={12} size="clamp(100px, 12vw, 170px)" />
      <div className="wrap narrow envio-cta">
        <p className="kicker">Buzón oficial</p>
        <h2 id="t-env" className="display big"><MaskWords text="¿Tienes un vídeo, una foto o un salseo? Mándanoslo" /></h2>
        <p className="lead">Por privado en Instagram. Si es bueno, sale. Si es muy bueno, también.</p>
        <div className="cta">
          <a className="btn btn-xl" href={SITE.instagramUrl} target="_blank" rel="noopener noreferrer"><span>Instagram {SITE.instagram}</span></a>
        </div>
      </div>
    </section>
  );
}
