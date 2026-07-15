import { WebSocketServer } from 'ws';
import * as db from './db.js';
import { config } from './config.js';
import { verifyToken, hashPin } from './auth.js';
import { validName, validPin, normalizeJoinUrl } from './validate.js';

let wss;

export function broadcastState() {
  if (!wss) return;
  const msg = JSON.stringify({ type: 'state', ...db.getState() });
  for (const client of wss.clients) {
    if (client.readyState === client.OPEN) client.send(msg);
  }
}

function requireAdmin(auth) {
  if (auth?.role !== 'admin') throw new Error('Nur für Admins erlaubt');
}

// Nachrichten-Contract siehe PLAN.md §5; Server validiert alles.
const handlers = {
  increment(auth, { playerId, drink, delta }) {
    if (!['beer', 'shot', 'mix'].includes(drink)) throw new Error('Unbekanntes Getränk');
    if (!Number.isInteger(delta)) throw new Error('delta muss ganzzahlig sein');

    if (auth?.role === 'player') {
      if (auth.sub !== playerId) throw new Error('Nur der eigene Zähler ist erlaubt');
      if (delta !== 1) throw new Error('Nutzer dürfen nur +1 zählen (D-004)');
    } else {
      requireAdmin(auth);
      if (Math.abs(delta) > 1000) throw new Error('delta außerhalb des erlaubten Bereichs');
    }

    if (!db.incrementDrink(playerId, drink, delta)) throw new Error('Nutzer nicht gefunden');
    // Nur echte Getränke landen im Log; Admin-Korrekturen nicht (D-005)
    if (auth.role === 'player') db.addLogEntry(playerId, drink);
  },

  addPlayer(auth, { name, pin }) {
    requireAdmin(auth);
    if (!validName(name)) throw new Error('Ungültiger Name (1-24 Zeichen)');
    if (!validPin(pin)) throw new Error('PIN muss 4 Ziffern haben');
    if (db.getPlayerByName(name.trim())) throw new Error('Name ist schon vergeben');
    db.createPlayer(name.trim(), hashPin(pin));
  },

  renamePlayer(auth, { id, name }) {
    requireAdmin(auth);
    if (!validName(name)) throw new Error('Ungültiger Name (1-24 Zeichen)');
    const existing = db.getPlayerByName(name.trim());
    if (existing && existing.id !== id) throw new Error('Name ist schon vergeben');
    if (!db.renamePlayer(id, name.trim())) throw new Error('Nutzer nicht gefunden');
  },

  setPin(auth, { id, pin }) {
    requireAdmin(auth);
    if (!validPin(pin)) throw new Error('PIN muss 4 Ziffern haben');
    if (!db.setPinHash(id, hashPin(pin))) throw new Error('Nutzer nicht gefunden');
  },

  setCounter(auth, { id, drink, value }) {
    requireAdmin(auth);
    if (!['beer', 'shot', 'mix'].includes(drink)) throw new Error('Unbekanntes Getränk');
    if (!Number.isInteger(value) || value < 0) throw new Error('Wert muss >= 0 sein');
    if (!db.setCounter(id, drink, value)) throw new Error('Nutzer nicht gefunden');
  },

  setHidden(auth, { id, hidden }) {
    requireAdmin(auth);
    if (typeof hidden !== 'boolean') throw new Error('hidden muss boolean sein');
    if (!db.setHidden(id, hidden)) throw new Error('Nutzer nicht gefunden');
  },

  setBoardMode(auth, { mode }) {
    requireAdmin(auth);
    if (!['alltime', 'today'].includes(mode)) throw new Error('Unbekannter Anzeigemodus');
    db.setSetting('board_mode', mode);
  },

  deletePlayer(auth, { id }) {
    requireAdmin(auth);
    if (!db.deletePlayer(id)) throw new Error('Nutzer nicht gefunden');
  },

  reset(auth, { confirm, password }) {
    requireAdmin(auth);
    if (confirm !== 'RESET') throw new Error('Reset braucht confirm: "RESET"');
    // Zusätzliche Sicherung: Admin-Passwort erneut eingeben (gleiche .env wie Login)
    if (password !== config.adminPassword) throw new Error('Falsches Passwort');
    db.resetAll();
  },

  setJoinUrl(auth, { url }) {
    requireAdmin(auth);
    db.setSetting('join_url', normalizeJoinUrl(url));
  },
};

export function setupWs(server) {
  wss = new WebSocketServer({ server, path: '/ws' });

  wss.on('connection', (ws) => {
    ws.send(JSON.stringify({ type: 'state', ...db.getState() }));

    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw);
      } catch {
        ws.send(JSON.stringify({ type: 'error', message: 'Ungültiges JSON' }));
        return;
      }

      const handler = handlers[msg?.type];
      if (!handler) {
        ws.send(JSON.stringify({ type: 'error', message: `Unbekannter Nachrichtentyp: ${msg?.type}` }));
        return;
      }

      const auth = verifyToken(msg.token);
      if (!auth) {
        ws.send(JSON.stringify({ type: 'error', message: 'Nicht angemeldet oder Token ungültig' }));
        return;
      }

      try {
        handler(auth, msg);
        broadcastState();
      } catch (err) {
        ws.send(JSON.stringify({ type: 'error', message: err.message }));
      }
    });
  });

  return wss;
}
