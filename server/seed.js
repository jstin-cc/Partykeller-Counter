// Dev-Seed: legt Testnutzer mit PIN 1111 an (nur für lokale Entwicklung).
// Aufruf: npm run seed            (Partykeller-DB)
//         npm run seed:youngstars (Youngstars-DB)
import { config } from './config.js';
import { createDb } from './db.js';
import { hashPin } from './auth.js';

const db = createDb(process.argv.includes('--youngstars') ? config.youngstarsDbPath : config.dbPath);

const demo = [
  { name: 'Basti', beers: 14, shots: 6, mixes: 4 },
  { name: 'Flo', beers: 11, shots: 9, mixes: 2 },
  { name: 'Jule', beers: 9, shots: 3, mixes: 7 },
  { name: 'Mira', beers: 7, shots: 5, mixes: 1 },
  { name: 'Tom', beers: 5, shots: 2, mixes: 3 },
  { name: 'Nina', beers: 6, shots: 4, mixes: 5 },
  { name: 'Pauli', beers: 4, shots: 1, mixes: 2 },
  { name: 'Lea', beers: 3, shots: 7, mixes: 0 },
];

const pinHash = hashPin('1111');
for (const { name, beers, shots, mixes } of demo) {
  if (db.getPlayerByName(name)) {
    console.log(`überspringe ${name} (existiert schon)`);
    continue;
  }
  const p = db.createPlayer(name, pinHash);
  db.setCounter(p.id, 'beer', beers);
  db.setCounter(p.id, 'shot', shots);
  db.setCounter(p.id, 'mix', mixes);
  // ein paar Einträge für "heute", damit Dashboard und Fun-Facts etwas zeigen
  db.addLogEntry(p.id, 'beer');
  if (shots > 0) db.addLogEntry(p.id, 'shot');
  if (mixes > 0) db.addLogEntry(p.id, 'mix');
  console.log(`angelegt: ${name} (PIN 1111, ${beers} Bier / ${shots} Shots / ${mixes} Mischen)`);
}
