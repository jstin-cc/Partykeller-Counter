import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import * as db from './db.js';
import { hashPin, verifyPin, playerToken, adminToken, checkAdminPassword } from './auth.js';
import { setupWs, broadcastState } from './ws.js';
import { validName, validPin } from './validate.js';
import { createLoginLimiter } from './ratelimit.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(publicDir));

app.get('/dashboard', (_req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
app.get('/tv', (_req, res) => res.sendFile(path.join(publicDir, 'tv.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.get('/abende', (_req, res) => res.sendFile(path.join(publicDir, 'abende.html')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/state', (_req, res) => res.json(db.getState()));

// Abend-Archiv: alle Party-Tage mit Sieger, Teilnehmern und Gesamtmengen
app.get('/api/archive', (_req, res) => res.json({ days: db.getArchive() }));

// Persönliche Statistik + Achievements fürs Nutzer-Dashboard
app.get('/api/players/:id/stats', (req, res) => {
  if (!db.getPlayer(req.params.id)) return res.status(404).json({ error: 'Nutzer nicht gefunden' });
  res.json(db.getPlayerStats(req.params.id));
});

// Rate-Limit gegen PIN-Raten: max. 5 Fehlversuche pro Minute und IP,
// danach 60 Sekunden Sperre. Erfolgreicher Login setzt zurück.
const loginLimiter = createLoginLimiter();

function rateLimited(req, res) {
  const wait = loginLimiter.blockedFor(req.ip);
  if (wait === null) return false;
  res.status(429).json({ error: `Zu viele Fehlversuche – bitte ${wait} Sekunden warten.` });
  return true;
}

// Nutzer legen sich selbst an (Name + Pflicht-PIN, D-002)
app.post('/api/players', (req, res) => {
  const { name, pin } = req.body ?? {};
  if (!validName(name)) return res.status(400).json({ error: 'Ungültiger Name (1-24 Zeichen)' });
  if (!validPin(pin)) return res.status(400).json({ error: 'PIN muss 4 Ziffern haben' });
  if (db.getPlayerByName(name.trim())) return res.status(409).json({ error: 'Name ist schon vergeben' });

  const player = db.createPlayer(name.trim(), hashPin(pin));
  broadcastState();
  res.status(201).json({
    player: { id: player.id, name: player.name },
    token: playerToken(player.id),
  });
});

app.post('/api/login', (req, res) => {
  if (rateLimited(req, res)) return;
  const { playerId, pin } = req.body ?? {};
  const player = playerId ? db.getPlayer(playerId) : null;
  if (!player || !validPin(pin) || !verifyPin(pin, player.pin_hash)) {
    loginLimiter.fail(req.ip);
    return res.status(401).json({ error: 'Name oder PIN falsch' });
  }
  loginLimiter.clear(req.ip);
  res.json({
    player: { id: player.id, name: player.name },
    token: playerToken(player.id),
  });
});

app.post('/api/admin/login', (req, res) => {
  if (rateLimited(req, res)) return;
  if (!checkAdminPassword(req.body?.password)) {
    loginLimiter.fail(req.ip);
    return res.status(401).json({ error: 'Falsches Passwort' });
  }
  loginLimiter.clear(req.ip);
  res.json({ token: adminToken() });
});

const server = app.listen(config.port, () => {
  console.log(`Partykeller-Counter läuft auf http://0.0.0.0:${config.port}`);
});

setupWs(server);
