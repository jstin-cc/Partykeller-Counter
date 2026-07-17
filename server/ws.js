import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { verifyToken, tokenArea, hashPin } from './auth.js';
import { validName, validPin, validFactTitle, validFactText, normalizeJoinUrl } from './validate.js';

// Nachrichten-Contract siehe PLAN.md §5; Server validiert alles.
// Ein Handler-Satz pro Bereich (D-019): db und Increment-Buckets hängen am
// jeweiligen Bereich, damit sich Partykeller und Youngstars nie vermischen.
function createHandlers(area) {
  const db = area.db;

  return {
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
      // PIN optional (D-018): leer => Konto ohne PIN
      const hasPin = pin != null && pin !== '';
      if (hasPin && !validPin(pin)) throw new Error('PIN muss 4 Ziffern haben');
      if (db.getPlayerByName(name.trim())) throw new Error('Name ist schon vergeben');
      db.createPlayer(name.trim(), hasPin ? hashPin(pin) : '');
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
      // leer => PIN entfernen (Konto danach ohne PIN, D-018); sonst 4 Ziffern
      const hasPin = pin != null && pin !== '';
      if (hasPin && !validPin(pin)) throw new Error('PIN muss 4 Ziffern haben');
      if (!db.setPinHash(id, hasPin ? hashPin(pin) : '')) throw new Error('Nutzer nicht gefunden');
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

    // Rotationsgeschwindigkeit der TV-Rangliste: Sekunden pro Scroll-Schritt
    setScrollSpeed(auth, { seconds }) {
      requireAdmin(auth);
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 1 || seconds > 30) {
        throw new Error('Geschwindigkeit muss zwischen 1 und 30 Sekunden liegen');
      }
      db.setSetting('scroll_seconds', String(seconds));
    },

    // Wechseltakt des Fun-Fact-Bands: 30 s (kürzeste) bis 300 s = 5 min (längste)
    setFunfactSpeed(auth, { seconds }) {
      requireAdmin(auth);
      if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds < 30 || seconds > 300) {
        throw new Error('Fun-Fact-Takt muss zwischen 30 und 300 Sekunden liegen');
      }
      db.setSetting('funfact_seconds', String(seconds));
    },

    addFact(auth, { title, text }) {
      requireAdmin(auth);
      if (!validFactTitle(title)) throw new Error('Titel: 1-30 Zeichen');
      if (!validFactText(text)) throw new Error('Text: 1-160 Zeichen');
      db.addFact(title.trim(), text.trim());
    },

    deleteFact(auth, { id }) {
      requireAdmin(auth);
      if (!Number.isInteger(id)) throw new Error('Ungültige Meldung');
      if (!db.deleteFact(id)) throw new Error('Meldung nicht gefunden');
    },

    deletePlayer(auth, { id }) {
      requireAdmin(auth);
      if (!db.deletePlayer(id)) throw new Error('Nutzer nicht gefunden');
    },

    reset(auth, { confirm, password }) {
      requireAdmin(auth);
      if (confirm !== 'RESET') throw new Error('Reset braucht confirm: "RESET"');
      // Eigenes Lösch-Passwort (RESET_PASSWORD, getrennt vom Admin-Login);
      // gilt für beide Bereiche, löscht aber nur die DB dieses Bereichs (D-019).
      if (password !== config.resetPassword) throw new Error('Falsches Passwort');
      db.resetAll();
    },

    setJoinUrl(auth, { url }) {
      requireAdmin(auth);
      db.setSetting('join_url', normalizeJoinUrl(url));
    },
  };
}

function requireAdmin(auth) {
  if (auth?.role !== 'admin') throw new Error('Nur für Admins erlaubt');
}

// Increment-Throttle pro SPIELER (nicht pro Verbindung), damit Neu-Verbinden den
// Schutz nicht aushebelt: Token-Bucket mit im Schnitt ~1 Getränk/Sekunde und
// kurzem Burst bis 5. Map ist durch die Teilnehmerzahl begrenzt (Deckel 200).
function createIncrementThrottle() {
  const buckets = new Map(); // playerId -> { tokens, last }
  return function allow(playerId) {
    const now = Date.now();
    let b = buckets.get(playerId);
    if (!b) { b = { tokens: 5, last: now }; buckets.set(playerId, b); }
    b.tokens = Math.min(5, b.tokens + (now - b.last) / 1000);
    b.last = now;
    if (b.tokens < 1) return false;
    b.tokens -= 1;
    return true;
  };
}

// Ein WebSocketServer pro Bereich: /partykeller/ws und /youngstars/ws
// (Alt-Pfad /ws bleibt für den Partykeller erhalten). Broadcasts gehen nur an
// die Clients des eigenen Bereichs; area.broadcast wird hier gesetzt.
export function setupWs(server, areas) {
  for (const area of areas) {
    const wss = new WebSocketServer({ noServer: true });
    const handlers = createHandlers(area);
    const allowIncrement = createIncrementThrottle();
    area.wss = wss;

    area.broadcast = () => {
      const msg = JSON.stringify({ type: 'state', ...area.db.getState() });
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(msg);
      }
    };

    wss.on('connection', (ws) => {
      ws.send(JSON.stringify({ type: 'state', ...area.db.getState() }));

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
        // Bereichs-Stempel prüfen: fremde Tokens gelten hier nicht (D-019)
        if (tokenArea(auth) !== area.id) {
          ws.send(JSON.stringify({ type: 'error', message: 'Token gehört zum anderen Bereich' }));
          return;
        }

        // Spieler-Increments drosseln (pro Spieler; Admins bleiben ungedrosselt)
        if (msg.type === 'increment' && auth.role === 'player' && !allowIncrement(auth.sub)) {
          ws.send(JSON.stringify({ type: 'error', message: 'Immer mit der Ruhe – gleich geht’s weiter. 🍺' }));
          return;
        }

        try {
          handler(auth, msg);
          area.broadcast();
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      });
    });
  }

  server.on('upgrade', (req, socket, head) => {
    const { pathname } = new URL(req.url, 'http://localhost');
    const area =
      areas.find((a) => pathname === `${a.base}/ws`) ??
      (pathname === '/ws' ? areas[0] : null);   // Alt-Pfad => Partykeller
    if (!area) {
      socket.destroy();
      return;
    }
    area.wss.handleUpgrade(req, socket, head, (ws) => area.wss.emit('connection', ws, req));
  });
}
