import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import '@fontsource/instrument-serif';
import './styles.css';
import App from './App.jsx';

// Si el usuario suelta Mencken Std Head Narrow en src/assets/fonts, se registra aquí.
const found = import.meta.glob('./assets/fonts/Mencken*.{woff2,woff,otf,ttf}', { eager: true, query: '?url', import: 'default' });
const url = Object.values(found)[0];
if (url) {
  const ff = new FontFace('Mencken Std Head Narrow', `url(${url})`);
  ff.load().then((f) => { document.fonts.add(f); document.documentElement.classList.add('has-mencken'); }).catch(() => {});
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
