// Crea un «Taller Demo» con datos ficticios para probar en local. Imprime las dos claves (mecánico y dueño).
//   npm run seed:demo            (usa ./data; con DATA_DIR=... en otro sitio)
import { createWorkshop, listWorkshops, regenerateKey } from '../server/auth.js';
import { setSettings, workshopDb, closeAll } from '../server/db.js';
import { createVisit, setState } from '../server/visits.js';

const NAME = 'Taller Demo';
let w = listWorkshops().find((x) => x.name === NAME);
let keys;
if (w) {
  keys = { mechanicKey: regenerateKey(w.id, 'mechanic'), ownerKey: regenerateKey(w.id, 'owner') };
  console.log('El Taller Demo ya existía: se han generado claves nuevas.');
} else {
  const c = createWorkshop(NAME);
  w = { id: c.id }; keys = c;
  const session = { r: 'owner' };
  setSettings(workshopDb(w.id), { phone: '961 00 00 00', hours: 'L-V 8:00-18:00', replyTo: 'taller-demo@example.com', ownerEmail: 'dueno-demo@example.com', summaryOn: true, summaryHour: 19 });
  const now = Date.now();
  const rows = [
    ['1234BCD', 'cliente1@example.com', 'Seat', 'León', 'in_progress', 95], ['5678FGH', 'cliente2@example.com', 'Renault', 'Clio', 'received', 20],
    ['9012JKL', 'cliente3@example.com', 'Toyota', 'RAV4', 'finished', 240], ['3456MNP', 'cliente4@example.com', 'Volkswagen', 'Golf', 'finished', 300],
  ];
  for (const [plate, email, make, model, state, minsAgo] of rows) {
    const at = now - minsAgo * 60_000;
    const v = createVisit(w.id, session, { plate, email, make, model, eta: 'today' }, at).visit;
    if (state !== 'received') setState(w.id, session, v.id, 'in_progress', at + 25 * 60_000);
    if (state === 'finished') setState(w.id, session, v.id, 'finished', at + 150 * 60_000);
  }
}
console.log(`\nTaller: ${NAME}\nClave del mecánico: ${keys.mechanicKey}\nClave del dueño:    ${keys.ownerKey}\n`);
closeAll();
