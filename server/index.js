import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { areas } from './areas.js';
import { hashPin, verifyPin, playerToken, adminToken, checkPassword } from './auth.js';
import { setupWs } from './ws.js';
import { validName, validPin } from './validate.js';
import { createLoginLimiter, createRateLimiter } from './ratelimit.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = express();
app.use(express.json());

// Rate-Limit gegen PIN-Raten: max. 5 Fehlversuche pro Minute und IP,
// danach 60 Sekunden Sperre. Erfolgreicher Login setzt zurück.
// Gemeinsam für beide Bereiche (die IP ist dieselbe Person).
const loginLimiter = createLoginLimiter();

// Missbrauchsschutz für die offene Kontoerstellung: max. 6 neue Konten pro
// Minute und IP, und ein harter Gesamt-Deckel pro Bereich (verhindert
// Massen-Anlage/DB-Spam durch ein Skript; für echte Gäste unmerklich).
const createLimiter = createRateLimiter({ max: 6, windowMs: 60_000 });
const MAX_PLAYERS = 200;

// Ein API-Router pro Bereich (D-019): identische Endpunkte, aber eigene DB,
// eigenes Admin-Passwort und bereichsgestempelte Tokens.
function createApiRouter(area) {
  const router = express.Router();
  const db = area.db;

  router.get('/state', (_req, res) => res.json(db.getState()));

  // Abend-Archiv: alle Party-Tage mit Sieger, Teilnehmern und Gesamtmengen
  router.get('/archive', (_req, res) => res.json({ days: db.getArchive() }));

  // Persönliche Statistik + Achievements fürs Nutzer-Dashboard
  router.get('/players/:id/stats', (req, res) => {
    if (!db.getPlayer(req.params.id)) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
    res.json(db.getPlayerStats(req.params.id));
  });

  function rateLimited(req, res) {
    const wait = loginLimiter.blockedFor(req.ip);
    if (wait === null) return false;
    res.status(429).json({ error: `Zu viele Fehlversuche – bitte ${wait} Sekunden warten.` });
    return true;
  }

  // Nutzer legen sich selbst an (Name + optionale PIN, D-018)
  router.post('/players', (req, res) => {
    if (!createLimiter.take(req.ip)) {
      return res.status(429).json({ error: 'Zu viele neue Konten – bitte kurz warten.' });
    }
    const { name, pin } = req.body ?? {};
    if (!validName(name)) return res.status(400).json({ error: 'Ungültiger Name (1-24 Zeichen)' });
    // PIN ist optional (D-018): leer => Konto ohne PIN; sonst müssen es 4 Ziffern sein
    const hasPin = pin !== undefined && pin !== null && pin !== '';
    if (hasPin && !validPin(pin)) return res.status(400).json({ error: 'PIN muss 4 Ziffern haben' });
    if (db.getPlayerByName(name.trim())) return res.status(409).json({ error: 'Name ist schon vergeben' });
    if (db.countPlayers() >= MAX_PLAYERS) {
      return res.status(429).json({ error: 'Maximale Teilnehmerzahl erreicht.' });
    }

    const player = db.createPlayer(name.trim(), hasPin ? hashPin(pin) : '');
    area.broadcast();
    res.status(201).json({
      player: { id: player.id, name: player.name },
      token: playerToken(player.id, area.id),
    });
  });

  router.post('/login', (req, res) => {
    if (rateLimited(req, res)) return;
    const { playerId, pin } = req.body ?? {};
    const player = playerId ? db.getPlayer(playerId) : null;
    if (!player) {
      loginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Name oder PIN falsch' });
    }
    // Konto ohne PIN (D-018): direkt anmelden. Sonst muss die PIN stimmen.
    if (player.pin_hash) {
      if (!validPin(pin) || !verifyPin(pin, player.pin_hash)) {
        loginLimiter.fail(req.ip);
        return res.status(401).json({ error: 'Name oder PIN falsch' });
      }
    }
    loginLimiter.clear(req.ip);
    res.json({
      player: { id: player.id, name: player.name },
      token: playerToken(player.id, area.id),
    });
  });

  router.post('/admin/login', (req, res) => {
    if (rateLimited(req, res)) return;
    if (!checkPassword(req.body?.password, area.adminPassword)) {
      loginLimiter.fail(req.ip);
      return res.status(401).json({ error: 'Falsches Passwort' });
    }
    loginLimiter.clear(req.ip);
    res.json({ token: adminToken(area.id) });
  });

  return router;
}

const [partykeller, youngstars] = areas;

// API: /partykeller/api/* und /youngstars/api/*; der Alt-Pfad /api/* bleibt
// als Alias für den Partykeller erhalten (bestehende Geräte/Links).
app.use(['/api', `${partykeller.base}/api`], createApiRouter(partykeller));
app.use(`${youngstars.base}/api`, createApiRouter(youngstars));

app.get('/health', (_req, res) => res.json({ ok: true }));

// Auswahlseite: Partykeller oder Youngstars?
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'start.html')));

// Seiten beider Bereiche: gleiche HTML-Dateien, der Bereich ergibt sich aus dem
// URL-Präfix (public/js/area.js wertet ihn im Browser aus).
for (const area of areas) {
  // /partykeller -> /partykeller/ (mit Slash lösen relative Links korrekt auf);
  // Express behandelt beide Schreibweisen gleich, daher req.path prüfen.
  app.get(area.base, (req, res, next) => {
    if (req.path.endsWith('/')) return next();
    res.redirect(`${area.base}/`);
  });
  app.get(`${area.base}/dashboard`, (_req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
  app.get(`${area.base}/tv`, (_req, res) => res.sendFile(path.join(publicDir, 'tv.html')));
  app.get(`${area.base}/admin`, (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
  app.get(`${area.base}/abende`, (_req, res) => res.sendFile(path.join(publicDir, 'abende.html')));
}

// Youngstars bekommt ein eigenes PWA-Manifest (Name, Farben, Icons, start_url)
app.get(`${youngstars.base}/manifest.webmanifest`, (_req, res) =>
  res.sendFile(path.join(publicDir, 'manifest-youngstars.webmanifest')));

// Statics unter beiden Präfixen (Assets/CSS/JS sind in den Seiten relativ
// verlinkt) und weiterhin an der Wurzel (Auswahlseite, Alt-Links).
app.use(partykeller.base, express.static(publicDir));
app.use(youngstars.base, express.static(publicDir));

// Alt-Pfade aus der Zeit vor der Auswahlseite -> Partykeller-Bereich
// (gespeicherte QR-Codes, Lesezeichen, TV-Kiosk auf dem Pi).
for (const p of ['/dashboard', '/tv', '/admin', '/abende']) {
  app.get(p, (_req, res) => res.redirect(`${partykeller.base}${p}`));
}

app.use(express.static(publicDir, { index: false }));

const server = app.listen(config.port, () => {
  console.log(`Partykeller-Counter läuft auf http://0.0.0.0:${config.port}`);
});

setupWs(server, areas);
