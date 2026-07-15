import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';
import { config } from './config.js';

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

const db = new Database(config.dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
  CREATE TABLE IF NOT EXISTS players (
    id         TEXT PRIMARY KEY,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    pin_hash   TEXT NOT NULL,
    beers      INTEGER NOT NULL DEFAULT 0,
    shots      INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drink_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    drink     TEXT NOT NULL CHECK (drink IN ('beer','shot')),
    ts        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_drink_log_player_ts ON drink_log(player_id, ts);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );
`);

// Party-Tag läuft 06:00 -> 05:59 des Folgetags (D-005)
export function partyDayStartMs(now = Date.now()) {
  const d = new Date(now);
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}

const stmts = {
  insertPlayer: db.prepare(
    'INSERT INTO players (id, name, pin_hash) VALUES (?, ?, ?)'
  ),
  getPlayer: db.prepare('SELECT * FROM players WHERE id = ?'),
  getPlayerByName: db.prepare('SELECT * FROM players WHERE name = ? COLLATE NOCASE'),
  listPlayers: db.prepare('SELECT * FROM players'),
  increment: db.prepare(
    'UPDATE players SET beers = MAX(0, beers + ?), shots = MAX(0, shots + ?) WHERE id = ?'
  ),
  setCounter: db.prepare('UPDATE players SET beers = ?, shots = ? WHERE id = ?'),
  rename: db.prepare('UPDATE players SET name = ? WHERE id = ?'),
  setPinHash: db.prepare('UPDATE players SET pin_hash = ? WHERE id = ?'),
  deletePlayer: db.prepare('DELETE FROM players WHERE id = ?'),
  insertLog: db.prepare('INSERT INTO drink_log (player_id, drink, ts) VALUES (?, ?, ?)'),
  todayCounts: db.prepare(
    'SELECT player_id, drink, COUNT(*) AS n FROM drink_log WHERE ts >= ? GROUP BY player_id, drink'
  ),
  resetCounters: db.prepare('UPDATE players SET beers = 0, shots = 0'),
  clearLog: db.prepare('DELETE FROM drink_log'),
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  setSetting: db.prepare(
    'INSERT INTO settings (key, value) VALUES (?, ?) ' +
    'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  ),
};

export function getSetting(key, fallback = null) {
  const row = stmts.getSetting.get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  stmts.setSetting.run(key, value);
}

export function createPlayer(name, pinHash) {
  const id = crypto.randomUUID();
  stmts.insertPlayer.run(id, name, pinHash);
  return getPlayer(id);
}

export function getPlayer(id) {
  return stmts.getPlayer.get(id) ?? null;
}

export function getPlayerByName(name) {
  return stmts.getPlayerByName.get(name) ?? null;
}

export function incrementDrink(id, drink, delta) {
  const beers = drink === 'beer' ? delta : 0;
  const shots = drink === 'shot' ? delta : 0;
  return stmts.increment.run(beers, shots, id).changes > 0;
}

export function addLogEntry(id, drink, ts = Date.now()) {
  stmts.insertLog.run(id, drink, ts);
}

export function setCounter(id, drink, value) {
  const p = getPlayer(id);
  if (!p) return false;
  const beers = drink === 'beer' ? value : p.beers;
  const shots = drink === 'shot' ? value : p.shots;
  return stmts.setCounter.run(beers, shots, id).changes > 0;
}

export function renamePlayer(id, name) {
  return stmts.rename.run(name, id).changes > 0;
}

export function setPinHash(id, pinHash) {
  return stmts.setPinHash.run(pinHash, id).changes > 0;
}

export function deletePlayer(id) {
  return stmts.deletePlayer.run(id).changes > 0;
}

export const resetAll = db.transaction(() => {
  stmts.resetCounters.run();
  stmts.clearLog.run();
});

// Kompletter Client-State: Rangliste + Heute-Werte (ohne pin_hash!)
export function getState() {
  const today = new Map();
  for (const row of stmts.todayCounts.all(partyDayStartMs())) {
    const entry = today.get(row.player_id) ?? { beer: 0, shot: 0 };
    entry[row.drink] = row.n;
    today.set(row.player_id, entry);
  }

  const players = stmts.listPlayers
    .all()
    .map((p) => {
      const t = today.get(p.id) ?? { beer: 0, shot: 0 };
      return {
        id: p.id,
        name: p.name,
        beers: p.beers,
        shots: p.shots,
        total: p.beers + p.shots,
        beersToday: t.beer,
        shotsToday: t.shot,
        createdAt: p.created_at,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'de'));

  players.forEach((p, i) => { p.rank = i + 1; });
  // joinUrl: vom Admin gesetzte Beitritts-Adresse für den TV-QR-Code
  // (leer => TV nutzt die eigene Server-Adresse als Fallback)
  return { players, joinUrl: getSetting('join_url', '') };
}
