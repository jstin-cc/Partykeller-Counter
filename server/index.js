import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import { areas } from './areas.js';
import { hashPin, verifyPin, playerToken, adminToken, checkPassword, verifyToken, tokenArea } from './auth.js';
import { setupWs } from './ws.js';
import { validName, validPin } from './validate.js';
import { validDayString } from './db.js';
import { archiveCsv } from './csv.js';
import { parseBackup } from './backup.js';
import { createLoginLimiter, createRateLimiter } from './ratelimit.js';

// Datum fürs Dateinamens-Suffix der Sicherung (lokal, nicht UTC)
function todayStamp() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = express();

// Body-Parser: normal knapp gehalten, nur die eingespielte Vollsicherung darf
// groß sein (ein Log über mehrere Jahre sprengt sonst das Standardlimit).
const smallJson = express.json({ limit: '100kb' });
const backupJson = express.json({ limit: '20mb' });
app.use((req, res, next) =>
  (req.path.endsWith('/api/import/backup') ? backupJson : smallJson)(req, res, next));

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

  // Detail eines Party-Tags (u. a. für die Archiv-Bearbeitung im Admin)
  router.get('/archive/:day', (req, res) => {
    if (!validDayString(req.params.day)) return res.status(400).json({ error: 'Ungültiger Tag' });
    res.json(db.getArchiveDay(req.params.day));
  });

  // Übergabedateien (CSV) fürs Abend-Archiv (D-025): alle Abende am Stück oder
  // ein einzelner. Wie die Archiv-Bearbeitung nur für Admins (D-027) — das
  // Token kommt im Authorization-Header, deshalb holt die Archiv-Seite die
  // Datei per fetch und nicht über einen einfachen Link.
  function requireAdmin(req, res) {
    const auth = verifyToken((req.get('authorization') ?? '').replace(/^Bearer /, ''));
    if (auth?.role !== 'admin' || tokenArea(auth) !== area.id) {
      res.status(403).json({ error: 'Nur für Admins' });
      return false;
    }
    return true;
  }

  function sendCsv(res, filename, csv) {
    res.type('text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csv);
  }

  router.get('/export/archive', (req, res) => {
    if (!requireAdmin(req, res)) return;
    sendCsv(res, `${area.id}-abende-gesamt.csv`, archiveCsv(db.getExportNights()));
  });

  router.get('/export/archive/:day', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const { day } = req.params;
    if (!validDayString(day)) return res.status(400).json({ error: 'Ungültiger Tag' });
    sendCsv(res, `${area.id}-abend-${day}.csv`, archiveCsv(db.getExportNights(day)));
  });

  // Vollsicherung (D-034): eine JSON-Datei mit allem, was der Bereich braucht,
  // um nach einem Geräte-Tausch identisch weiterzulaufen. Wie die CSV-Exporte
  // nur für Admins, deshalb Token im Header und Download per fetch.
  router.get('/export/backup', (req, res) => {
    if (!requireAdmin(req, res)) return;
    const backup = { ...db.exportBackup(), area: area.id };
    res.type('application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${area.id}-backup-${todayStamp()}.json"`);
    res.send(JSON.stringify(backup));
  });

  // Gegenstück: eine Sicherung wieder einspielen. Das ersetzt den kompletten
  // Bestand des Bereichs, ist also so destruktiv wie der Reset — deshalb
  // dasselbe eigene Lösch-Passwort (RESET_PASSWORD) und dasselbe Rate-Limit.
  router.post('/import/backup', (req, res) => {
    if (!requireAdmin(req, res)) return;
    if (rateLimited(req, res)) return;
    const { password, backup } = req.body ?? {};
    if (!checkPassword(password, config.resetPassword)) {
      loginLimiter.fail(req.ip);
      return res.status(403).json({ error: 'Falsches Lösch-Passwort' });
    }
    loginLimiter.clear(req.ip);
    // Sicherung des anderen Bereichs: technisch möglich, aber praktisch immer
    // ein Versehen (Youngstars-Daten im Partykeller) — deshalb abweisen.
    if (backup?.area && backup.area !== area.id) {
      return res.status(400).json({ error: 'Diese Sicherung stammt aus dem anderen Bereich' });
    }
    let parsed;
    try {
      parsed = parseBackup(backup);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    let counts;
    try {
      counts = db.importBackup(parsed);
    } catch (err) {
      return res.status(400).json({ error: `Einspielen fehlgeschlagen: ${err.message}` });
    }
    area.broadcast();
    res.json(counts);
  });

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

// Fehler aus dem Body-Parser als JSON beantworten (die Admin-Oberfläche zeigt
// error an) — sonst käme beim Import einer kaputten Datei eine HTML-Seite.
app.use((err, req, res, next) => {
  if (err?.type === 'entity.too.large') {
    const backup = req.path.endsWith('/api/import/backup');
    return res.status(413).json({ error: backup ? 'Sicherung ist zu groß (max. 20 MB)' : 'Anfrage ist zu groß' });
  }
  if (err instanceof SyntaxError && 'body' in err) return res.status(400).json({ error: 'Datei ist kein gültiges JSON' });
  return next(err);
});

const server = app.listen(config.port, () => {
  console.log(`Partykeller-Counter läuft auf http://0.0.0.0:${config.port}`);
});

setupWs(server, areas);
