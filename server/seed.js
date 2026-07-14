// Dev-Seed: legt Testnutzer mit PIN 1111 an (nur für lokale Entwicklung).
// Aufruf: npm run seed
import * as db from './db.js';
import { hashPin } from './auth.js';

const demo = [
  { name: 'Basti', beers: 14, shots: 6 },
  { name: 'Flo', beers: 11, shots: 9 },
  { name: 'Jule', beers: 9, shots: 3 },
  { name: 'Mira', beers: 7, shots: 5 },
  { name: 'Tom', beers: 5, shots: 2 },
];

const pinHash = hashPin('1111');
for (const { name, beers, shots } of demo) {
  if (db.getPlayerByName(name)) {
    console.log(`überspringe ${name} (existiert schon)`);
    continue;
  }
  const p = db.createPlayer(name, pinHash);
  db.setCounter(p.id, 'beer', beers);
  db.setCounter(p.id, 'shot', shots);
  // ein paar Einträge für "heute", damit das Dashboard etwas zeigt
  db.addLogEntry(p.id, 'beer');
  if (shots > 0) db.addLogEntry(p.id, 'shot');
  console.log(`angelegt: ${name} (PIN 1111, ${beers} Bier / ${shots} Shots)`);
}
