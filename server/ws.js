import { WebSocketServer } from 'ws';
import { config } from './config.js';
import { verifyToken, tokenArea, hashPin, checkPassword } from './auth.js';
import { validName, validPin, validFactTitle, validFactText, validNightName, normalizeJoinUrl } from './validate.js';
import { validDayString, partyDayStartMs } from './db.js';

// Nachrichten-Contract siehe PLAN.md §5; Server validiert alles.
// Ein Handler-Satz pro Bereich (D-019): db und Increment-Buckets hängen am
// jeweiligen Bereich, damit sich Partykeller und Youngstars nie vermischen.
function createHandlers(area, loginLimiter) {
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

      // Nur echte Getränke landen im Log; Admin-Korrekturen nicht (D-005).
      // Zähler und Log-Eintrag als eine Transaktion (D-046): nie das eine
      // ohne das andere, auch nicht bei einem Absturz genau dazwischen.
      const ok = auth.role === 'player'
        ? db.logDrink(playerId, drink)
        : db.incrementDrink(playerId, drink, delta);
      if (!ok) throw new Error('Nutzer nicht gefunden');
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

    // 'archive' zeigt einen vergangenen Party-Tag auf dem TV (day Pflicht)
    setBoardMode(auth, { mode, day }) {
      requireAdmin(auth);
      if (!['alltime', 'today', 'archive'].includes(mode)) throw new Error('Unbekannter Anzeigemodus');
      if (mode === 'archive') {
        if (!validDayString(day)) throw new Error('Ungültiger Archiv-Tag');
        db.setSetting('board_day', day);
      }
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
      // Neuer Takt heißt neue Restzeit — sonst zählt die Admin-Übersicht
      // gegen die alte Dauer (D-043).
      area.setFactIndex(area.factIndex);
    },

    // Saison-Akzente an/aus (D-071)
    setSeasonal(auth, { on }) {
      requireAdmin(auth);
      if (typeof on !== 'boolean') throw new Error('on muss boolean sein');
      db.setSetting('seasonal', on ? '1' : '0');
    },

    // Schnitt-Vergleich im Dashboard an/aus (D-075)
    setPaceCompare(auth, { on }) {
      requireAdmin(auth);
      if (typeof on !== 'boolean') throw new Error('on muss boolean sein');
      db.setSetting('pace_compare', on ? '1' : '0');
    },

    addFact(auth, { title, text }) {
      requireAdmin(auth);
      if (!validFactTitle(title)) throw new Error('Titel: 1-30 Zeichen');
      if (!validFactText(text)) throw new Error('Text: 1-160 Zeichen');
      db.addFact(title.trim(), text.trim());
    },

    updateFact(auth, { id, title, text }) {
      requireAdmin(auth);
      if (!Number.isInteger(id)) throw new Error('Ungültige Meldung');
      if (!validFactTitle(title)) throw new Error('Titel: 1-30 Zeichen');
      if (!validFactText(text)) throw new Error('Text: 1-160 Zeichen');
      if (!db.updateFact(id, title.trim(), text.trim())) throw new Error('Meldung nicht gefunden');
    },

    deleteFact(auth, { id }) {
      requireAdmin(auth);
      if (!Number.isInteger(id)) throw new Error('Ungültige Meldung');
      if (!db.deleteFact(id)) throw new Error('Meldung nicht gefunden');
    },

    // Getränke-Protokoll (D-073): einzelne Log-Einträge ändern, löschen,
    // nachtragen — die Zähler ziehen in db.js mit
    editLog(auth, { id, playerId, drink, ts }) {
      requireAdmin(auth);
      if (!Number.isSafeInteger(id)) throw new Error('Ungültiger Eintrag');
      checkLogFields(playerId, drink, ts);
      area.db.editLogEntry(id, playerId, drink, ts);
    },

    deleteLog(auth, { id }) {
      requireAdmin(auth);
      if (!Number.isSafeInteger(id)) throw new Error('Ungültiger Eintrag');
      area.db.deleteLogEntry(id);
    },

    addLog(auth, { playerId, drink, ts }) {
      requireAdmin(auth);
      checkLogFields(playerId, drink, ts);
      area.db.addLogAdmin(playerId, drink, ts);
    },

    setNightName(auth, { day, name }) {
      requireAdmin(auth);
      if (!validDayString(day)) throw new Error('Ungültiger Archiv-Tag');
      const clean = String(name ?? '').trim();
      if (!validNightName(clean)) throw new Error('Abend-Name: höchstens 40 Zeichen');
      db.setNightName(day, clean);
    },

    deletePlayer(auth, { id }) {
      requireAdmin(auth);
      if (!db.deletePlayer(id)) throw new Error('Nutzer nicht gefunden');
    },

    reset(auth, { confirm, password }, ip) {
      requireAdmin(auth);
      if (confirm !== 'RESET') throw new Error('Reset braucht confirm: "RESET"');
      // Eigenes Lösch-Passwort (RESET_PASSWORD, getrennt vom Admin-Login);
      // gilt für beide Bereiche, löscht aber nur die DB dieses Bereichs (D-019).
      // Zeitkonstant verglichen und mit derselben Fehlversuch-Sperre wie der
      // Login und das Einspielen einer Sicherung (D-084).
      const wait = loginLimiter.blockedFor(ip);
      if (wait !== null) throw new Error(`Zu viele Fehlversuche – bitte ${wait} Sekunden warten.`);
      if (!checkPassword(password, config.resetPassword)) {
        loginLimiter.fail(ip);
        throw new Error('Falsches Passwort');
      }
      loginLimiter.clear(ip);
      db.resetAll();
    },

    setJoinUrl(auth, { url }) {
      requireAdmin(auth);
      db.setSetting('join_url', normalizeJoinUrl(url));
    },

    // Fun-Fact-Band von Hand weiterschalten (D-043). Der Server hält nur eine
    // laufende Nummer; welcher Fact das ist, rechnen die Clients mit ihrer
    // eigenen Liste modulo aus — deshalb reicht hier eine Zahl.
    setFactIndex(auth, { index }) {
      requireAdmin(auth);
      if (!Number.isInteger(index) || index < 0 || index > 100000) {
        throw new Error('Ungültige Fact-Nummer');
      }
      area.setFactIndex(index);
    },
  };
}

function checkLogFields(playerId, drink, ts) {
  if (typeof playerId !== 'string' || !playerId) throw new Error('Ungültiges Konto');
  if (!['beer', 'shot', 'mix'].includes(drink)) throw new Error('Unbekanntes Getränk');
  if (!Number.isSafeInteger(ts) || ts <= 0) throw new Error('Ungültige Uhrzeit');
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
export function setupWs(server, areas, { loginLimiter }) {
  for (const area of areas) {
    // maxPayload: die größte legitime Nachricht (Fact-Text) ist unter 1 KB;
    // Standard wären 100 MB, die ein Client dem Server aufdrücken könnte.
    const wss = new WebSocketServer({ noServer: true, maxPayload: 16 * 1024 });
    wss.on('error', (err) => console.error(`[${area.id}] WebSocket-Server: ${err.message}`));
    const handlers = createHandlers(area, loginLimiter);
    const allowIncrement = createIncrementThrottle();
    area.wss = wss;

    // Broadcasts bündeln (D-066): Der erste geht sofort raus, alles was in
    // den nächsten 100 ms dazukommt, als EIN Stand hinterher. Sonst rechnet
    // bei einer Runde (alle tippen gleichzeitig) der Server den State für
    // jedes Getränk einzeln aus und schickt ihn jedes Mal an alle Geräte.
    const BROADCAST_GAP_MS = 100;
    let broadcastTimer = null;
    let lastBroadcast = 0;
    const sendState = () => {
      broadcastTimer = null;
      lastBroadcast = Date.now();
      const msg = JSON.stringify({ type: 'state', ...area.db.getState() });
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(msg);
      }
    };
    area.broadcast = () => {
      if (broadcastTimer) return;
      const wait = lastBroadcast + BROADCAST_GAP_MS - Date.now();
      if (wait <= 0) sendState();
      else broadcastTimer = setTimeout(sendState, wait);
    };

    // --- Fun-Fact-Uhr (D-043) ---------------------------------------------
    // Der Server zählt eine laufende Nummer hoch; Fernseher und Admin rechnen
    // daraus mit ihrer eigenen (identischen) Liste den aktuellen Fact aus.
    // Damit zeigen zwei Fernseher dasselbe, und der Admin kann springen.
    // Die Position ist reine Anzeige und steht bewusst nicht in der DB: nach
    // einem Neustart fängt das Band wieder vorn an.
    area.factIndex = 0;
    area.factSince = Date.now();
    let factTimer = null;

    const factSeconds = () => {
      const s = Number(area.db.getSetting('funfact_seconds', '30'));
      return Number.isFinite(s) && s >= 5 ? s : 30;
    };

    const factMessage = () => JSON.stringify({
      type: 'fact', index: area.factIndex, since: area.factSince, seconds: factSeconds(),
    });

    area.broadcastFact = () => {
      const msg = factMessage();
      for (const client of wss.clients) {
        if (client.readyState === client.OPEN) client.send(msg);
      }
    };

    function armFactTimer() {
      clearTimeout(factTimer);
      factTimer = setTimeout(() => {
        area.factIndex += 1;
        area.factSince = Date.now();
        area.broadcastFact();
        armFactTimer();
      }, factSeconds() * 1000);
      // Der Takt darf den Prozess nicht am Leben halten
      factTimer.unref?.();
    }

    area.setFactIndex = (index) => {
      area.factIndex = index;
      area.factSince = Date.now();
      armFactTimer();
      area.broadcastFact();
    };

    armFactTimer();

    // Tageswechsel (D-084): Um 06:00 beginnt ein neuer Party-Tag, und alle
    // Heute-Werte springen auf 0. Ohne eigenen Broadcast sähen TV und Handys
    // das erst beim nächsten Getränk — der TV im Modus „Heute" zeigte bis
    // dahin den ganzen Tag die Zahlen der letzten Nacht.
    let dayTimer = null;
    function armDayTimer() {
      clearTimeout(dayTimer);
      // 06:00 des Folgetags per Datum, nicht +24 h (Zeitumstellung)
      const next = new Date(partyDayStartMs());
      next.setDate(next.getDate() + 1);
      // eine Sekunde Luft, damit der State sicher schon zum neuen Tag gehört
      dayTimer = setTimeout(() => { area.broadcast(); armDayTimer(); }, next.getTime() - Date.now() + 1000);
      dayTimer.unref?.();
    }
    armDayTimer();

    // Heartbeat (D-046): Handys im Standby oder ohne WLAN verschwinden nicht
    // von selbst aus wss.clients — erst das TCP-Timeout nach Minuten räumt sie
    // weg, bis dahin füllt jeder Broadcast ihre Sendepuffer. Deshalb alle 30 s
    // ein Ping; wer bis zum nächsten nicht geantwortet hat, fliegt raus.
    const HEARTBEAT_MS = 30_000;
    const heartbeat = setInterval(() => {
      for (const client of wss.clients) {
        if (client.isAlive === false) { client.terminate(); continue; }
        client.isAlive = false;
        client.ping();
      }
    }, HEARTBEAT_MS);
    heartbeat.unref?.();

    wss.on('connection', (ws, req) => {
      // Schlüssel fürs Fehlversuch-Limit wie bei Express' req.ip
      const ip = req?.socket?.remoteAddress ?? '';
      // Ohne 'error'-Listener wirft Node bei einem kaputten Frame (ungültiges
      // UTF-8, zu große Nachricht) eine unbehandelte Exception und der ganze
      // Server stirbt (D-046). ws schließt die Verbindung danach selbst.
      ws.on('error', (err) => console.warn(`[${area.id}] WebSocket-Client: ${err.message}`));
      ws.isAlive = true;
      ws.on('pong', () => { ws.isAlive = true; });

      ws.send(JSON.stringify({ type: 'state', ...area.db.getState() }));
      ws.send(factMessage());

      ws.on('message', (raw) => {
        let msg;
        try {
          msg = JSON.parse(raw);
        } catch {
          ws.send(JSON.stringify({ type: 'error', message: 'Ungültiges JSON' }));
          return;
        }

        // Nur eigene Handler: Object.hasOwn hält „constructor" & Co. draußen
        const handler = Object.hasOwn(handlers, msg?.type ?? '') ? handlers[msg.type] : null;
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
          handler(auth, msg, ip);
          area.broadcast();
        } catch (err) {
          ws.send(JSON.stringify({ type: 'error', message: err.message }));
        }
      });
    });
  }

  server.on('upgrade', (req, socket, head) => {
    // Kaputte Adresse (z. B. „GET http://[") wirft in new URL — ohne
    // try/catch riss das den ganzen Server mit (D-084)
    let pathname;
    try {
      ({ pathname } = new URL(req.url, 'http://localhost'));
    } catch {
      socket.destroy();
      return;
    }
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
