import { useEffect, useRef } from 'react';
import { MAP } from '../content/data.js';
import { useTr } from '../lib/store.js';

// Mapa interactivo (Leaflet + teselas de OpenStreetMap, oscurecidas y teñidas de azul por CSS). No necesita
// ninguna clave de API. Un clic en el mapa abre Google Maps con la ruta hasta el club.
export default function CommitteeMap() {
  const tr = useTr();
  const box = useRef(null);

  useEffect(() => {
    let map; let cancelled = false;
    (async () => {
      const [{ default: L }] = await Promise.all([import('leaflet'), import('leaflet/dist/leaflet.css')]);
      if (cancelled || !box.current) return;
      map = L.map(box.current, { center: [MAP.lat, MAP.lon], zoom: MAP.zoom, scrollWheelZoom: false, attributionControl: true, zoomControl: true });
      L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">OpenStreetMap</a>',
      }).addTo(map);
      const icon = L.divIcon({ className: 'pin', html: '<span class="pin__dot"></span><span class="pin__ring"></span>', iconSize: [44, 44], iconAnchor: [22, 22] });
      L.marker([MAP.lat, MAP.lon], { icon, title: MAP.label, keyboard: false }).addTo(map);
      map.on('click', () => { window.open(MAP.directions, '_blank', 'noopener,noreferrer'); });
    })();
    return () => { cancelled = true; if (map) map.remove(); };
  }, []);

  return (
    <div className="map">
      <div className="map__canvas" ref={box} role="application" aria-label={tr('Mapa de Committee Club Valencia. Haz clic para abrir la ruta en Google Maps.', 'Map of Committee Club Valencia. Click to open directions in Google Maps.')} />
      <a className="map__link" href={MAP.directions} target="_blank" rel="noopener noreferrer">{tr('Cómo llegar · abrir ruta en Google Maps', 'Directions · open in Google Maps')}</a>
    </div>
  );
}
