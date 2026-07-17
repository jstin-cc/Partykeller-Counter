import { config } from './config.js';
import { createDb } from './db.js';

// Die zwei Bereiche der App (D-019): gleiche Funktionen, komplett getrennte
// Daten (eigene SQLite-Datei), eigener Admin-Zugang, eigener URL-Präfix.
// `broadcast` wird von setupWs() gesetzt und schickt den State des Bereichs
// an alle WebSocket-Clients dieses Bereichs.
export const areas = [
  {
    id: 'partykeller',
    base: '/partykeller',
    name: 'SV Partykeller',
    db: createDb(config.dbPath),
    adminPassword: config.adminPassword,
    broadcast: () => {},
  },
  {
    id: 'youngstars',
    base: '/youngstars',
    name: 'Partykeller Youngstars',
    db: createDb(config.youngstarsDbPath),
    adminPassword: config.youngstarsAdminPassword,
    broadcast: () => {},
  },
];
