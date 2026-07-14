import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { config } from './config.js';
import * as db from './db.js';
import { hashPin, verifyPin, playerToken, adminToken, checkAdminPassword } from './auth.js';
import { setupWs, broadcastState } from './ws.js';
import { validName, validPin } from './validate.js';

const publicDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

const app = express();
app.use(express.json());
app.use(express.static(publicDir));

app.get('/dashboard', (_req, res) => res.sendFile(path.join(publicDir, 'dashboard.html')));
app.get('/tv', (_req, res) => res.sendFile(path.join(publicDir, 'tv.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));

app.get('/health', (_req, res) => res.json({ ok: true }));

app.get('/api/state', (_req, res) => res.json(db.getState()));

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
  const { playerId, pin } = req.body ?? {};
  const player = playerId ? db.getPlayer(playerId) : null;
  if (!player || !validPin(pin) || !verifyPin(pin, player.pin_hash)) {
    return res.status(401).json({ error: 'Name oder PIN falsch' });
  }
  res.json({
    player: { id: player.id, name: player.name },
    token: playerToken(player.id),
  });
});

app.post('/api/admin/login', (req, res) => {
  if (!checkAdminPassword(req.body?.password)) {
    return res.status(401).json({ error: 'Falsches Passwort' });
  }
  res.json({ token: adminToken() });
});

const server = app.listen(config.port, () => {
  console.log(`Partykeller-Counter läuft auf http://0.0.0.0:${config.port}`);
});

setupWs(server);
