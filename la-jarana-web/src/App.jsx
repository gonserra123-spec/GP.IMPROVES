import { useEffect, useState } from 'react';
import { MotionConfig } from 'motion/react';
import Nav from './components/Nav.jsx';
import Cursor from './components/Cursor.jsx';
import Hero from './components/Hero.jsx';
import Marquee from './components/Marquee.jsx';
import Comunicados from './components/Comunicados.jsx';
import Stories from './components/Stories.jsx';
import Llenado from './components/Llenado.jsx';
import Nosotros from './components/Nosotros.jsx';
import Mapa from './components/Mapa.jsx';
import Galeria from './components/Galeria.jsx';
import Merch from './components/Merch.jsx';
import Envio from './components/Envio.jsx';
import Cierre from './components/Cierre.jsx';
import Lluvia from './components/Lluvia.jsx';

// Al cambiar de pestaña: "Vuelve a la Jarana 🍺"; al volver, el título original.
function useTituloPestana() {
  useEffect(() => {
    const original = document.title;
    const f = () => { document.title = document.hidden ? 'Vuelve a la Jarana 🍺' : original; };
    document.addEventListener('visibilitychange', f);
    return () => { document.removeEventListener('visibilitychange', f); document.title = original; };
  }, []);
}

export default function App() {
  const [story, setStory] = useState(null); // índice del comunicado abierto
  useTituloPestana();
  return (
    <MotionConfig reducedMotion="user">
      <Cursor />
      <Nav />
      <main>
        <Hero />
        <Marquee />
        <Comunicados onOpen={setStory} />
        <Llenado />
        <Nosotros />
        <Mapa />
        <Galeria />
        <Merch />
        <Envio />
        <Cierre />
      </main>
      <Lluvia />
      <Stories index={story} onClose={() => setStory(null)} onChange={setStory} />
    </MotionConfig>
  );
}
