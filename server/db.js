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
    mixes      INTEGER NOT NULL DEFAULT 0,
    hidden     INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS drink_log (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    drink     TEXT NOT NULL CHECK (drink IN ('beer','shot','mix')),
    ts        INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_drink_log_player_ts ON drink_log(player_id, ts);

  CREATE TABLE IF NOT EXISTS settings (
    key   TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS facts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    title      TEXT NOT NULL,
    text       TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrationen für bestehende Datenbanken (D-006: Neustart/Update darf keine
// Daten verlieren). CREATE TABLE IF NOT EXISTS ändert vorhandene Tabellen nicht,
// darum hier idempotent nachziehen.

// 1) players.mixes / players.hidden ergänzen, falls die DB älter ist.
const playerCols = db.prepare('PRAGMA table_info(players)').all().map((c) => c.name);
if (!playerCols.includes('mixes')) {
  db.exec('ALTER TABLE players ADD COLUMN mixes INTEGER NOT NULL DEFAULT 0');
}
if (!playerCols.includes('hidden')) {
  db.exec('ALTER TABLE players ADD COLUMN hidden INTEGER NOT NULL DEFAULT 0');
}

// 2) drink_log durfte früher nur beer/shot. SQLite kann eine CHECK-Constraint
//    nicht per ALTER ändern, deshalb die Tabelle einmalig neu aufbauen und die
//    vorhandenen Log-Einträge übernehmen (Reihenfolge/Heute-Werte bleiben).
const logSql =
  db
    .prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='drink_log'")
    .get()?.sql ?? '';
if (!logSql.includes("'mix'")) {
  db.exec(`
    CREATE TABLE drink_log_new (
      id        INTEGER PRIMARY KEY AUTOINCREMENT,
      player_id TEXT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
      drink     TEXT NOT NULL CHECK (drink IN ('beer','shot','mix')),
      ts        INTEGER NOT NULL
    );
    INSERT INTO drink_log_new (id, player_id, drink, ts)
      SELECT id, player_id, drink, ts FROM drink_log;
    DROP TABLE drink_log;
    ALTER TABLE drink_log_new RENAME TO drink_log;
    CREATE INDEX IF NOT EXISTS idx_drink_log_player_ts ON drink_log(player_id, ts);
  `);
}

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
    'UPDATE players SET beers = MAX(0, beers + ?), shots = MAX(0, shots + ?), mixes = MAX(0, mixes + ?) WHERE id = ?'
  ),
  setCounter: db.prepare('UPDATE players SET beers = ?, shots = ?, mixes = ? WHERE id = ?'),
  rename: db.prepare('UPDATE players SET name = ? WHERE id = ?'),
  setHidden: db.prepare('UPDATE players SET hidden = ? WHERE id = ?'),
  setPinHash: db.prepare('UPDATE players SET pin_hash = ? WHERE id = ?'),
  deletePlayer: db.prepare('DELETE FROM players WHERE id = ?'),
  insertLog: db.prepare('INSERT INTO drink_log (player_id, drink, ts) VALUES (?, ?, ?)'),
  todayCounts: db.prepare(
    'SELECT player_id, drink, COUNT(*) AS n FROM drink_log WHERE ts >= ? GROUP BY player_id, drink'
  ),
  // All-Time-Rekorde: meiste Getränke je Sorte an einem einzelnen Party-Tag.
  // Party-Tag beginnt 06:00, daher ts um 6 h (21600 s) zurückschieben, bevor
  // das Datum gebildet wird (entspricht partyDayStartMs, aber in SQL).
  dayCounts: db.prepare(
    `SELECT drink, player_id,
            date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day,
            COUNT(*) AS n
     FROM drink_log
     GROUP BY drink, player_id, day`
  ),
  // Abend-Archiv: Getränke je Party-Tag, Spieler und Sorte (Party-Tag ab 06:00)
  archiveCounts: db.prepare(
    `SELECT date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day,
            player_id, drink, COUNT(*) AS n
     FROM drink_log
     GROUP BY day, player_id, drink`
  ),
  // Persönliche Statistik: Getränke des Spielers je Party-Tag
  playerDays: db.prepare(
    `SELECT date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day, COUNT(*) AS n
     FROM drink_log WHERE player_id = ?
     GROUP BY day ORDER BY day`
  ),
  firstLogToday: db.prepare(
    'SELECT player_id FROM drink_log WHERE ts >= ? ORDER BY ts, id LIMIT 1'
  ),
  playerLogsToday: db.prepare(
    'SELECT drink, ts FROM drink_log WHERE player_id = ? AND ts >= ? ORDER BY ts'
  ),
  resetCounters: db.prepare('UPDATE players SET beers = 0, shots = 0, mixes = 0'),
  clearLog: db.prepare('DELETE FROM drink_log'),
  listFacts: db.prepare('SELECT id, title, text FROM facts ORDER BY id'),
  insertFact: db.prepare('INSERT INTO facts (title, text) VALUES (?, ?)'),
  deleteFact: db.prepare('DELETE FROM facts WHERE id = ?'),
  countFacts: db.prepare('SELECT COUNT(*) AS n FROM facts'),
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
  const mixes = drink === 'mix' ? delta : 0;
  return stmts.increment.run(beers, shots, mixes, id).changes > 0;
}

export function addLogEntry(id, drink, ts = Date.now()) {
  stmts.insertLog.run(id, drink, ts);
}

export function setCounter(id, drink, value) {
  const p = getPlayer(id);
  if (!p) return false;
  const beers = drink === 'beer' ? value : p.beers;
  const shots = drink === 'shot' ? value : p.shots;
  const mixes = drink === 'mix' ? value : p.mixes;
  return stmts.setCounter.run(beers, shots, mixes, id).changes > 0;
}

export function renamePlayer(id, name) {
  return stmts.rename.run(name, id).changes > 0;
}

export function setHidden(id, hidden) {
  return stmts.setHidden.run(hidden ? 1 : 0, id).changes > 0;
}

// Rekorde: pro Sorte der (Spieler, Party-Tag) mit den meisten Getränken.
// Ausgeblendete Spieler zählen nicht (nicht Teil des Scoreboards).
export function getRecords() {
  const hiddenIds = new Set(
    stmts.listPlayers.all().filter((p) => p.hidden).map((p) => p.id)
  );
  const best = { beer: null, shot: null, mix: null };
  for (const row of stmts.dayCounts.all()) {
    if (hiddenIds.has(row.player_id)) continue;
    const cur = best[row.drink];
    if (!cur || row.n > cur.n) {
      best[row.drink] = { playerId: row.player_id, n: row.n, day: row.day };
    }
  }
  for (const drink of Object.keys(best)) {
    const rec = best[drink];
    if (rec) {
      const p = getPlayer(rec.playerId);
      rec.name = p ? p.name : '—';
      delete rec.playerId;
    }
  }
  return best;
}

// --- Eigene Fun-Facts / Meldungen (Admin) ---
export function listFacts() {
  return stmts.listFacts.all();
}

export function addFact(title, text) {
  if (stmts.countFacts.get().n >= 50) throw new Error('Zu viele Meldungen (max. 50)');
  stmts.insertFact.run(title, text);
}

export function deleteFact(id) {
  return stmts.deleteFact.run(id).changes > 0;
}

// --- Abend-Archiv: jeder Party-Tag mit Sieger, Teilnehmern und Gesamtmengen ---
export function getArchive() {
  const days = new Map(); // day -> { totals, perPlayer: Map }
  for (const row of stmts.archiveCounts.all()) {
    let d = days.get(row.day);
    if (!d) {
      d = { day: row.day, beers: 0, shots: 0, mixes: 0, perPlayer: new Map() };
      days.set(row.day, d);
    }
    if (row.drink === 'beer') d.beers += row.n;
    else if (row.drink === 'shot') d.shots += row.n;
    else d.mixes += row.n;
    d.perPlayer.set(row.player_id, (d.perPlayer.get(row.player_id) ?? 0) + row.n);
  }

  const names = new Map(stmts.listPlayers.all().map((p) => [p.id, p.name]));
  return [...days.values()]
    .map((d) => {
      let winnerId = null;
      let winnerN = 0;
      for (const [pid, n] of d.perPlayer) {
        if (n > winnerN) { winnerId = pid; winnerN = n; }
      }
      return {
        day: d.day,
        beers: d.beers,
        shots: d.shots,
        mixes: d.mixes,
        total: d.beers + d.shots + d.mixes,
        participants: d.perPlayer.size,
        winner: winnerId ? { name: names.get(winnerId) ?? '—', total: winnerN } : null,
      };
    })
    .sort((a, b) => b.day.localeCompare(a.day));
}

// --- Persönliche Statistik + Achievements (für das Nutzer-Dashboard) ---
// Achievements beziehen sich auf den laufenden Party-Tag:
//  - firstDrinker:  erstes geloggtes Getränk des Abends kam von diesem Spieler
//  - midnightBeer:  ein Bier zwischen 00:00 und 00:59 geloggt
//  - threeInHour:   drei Getränke innerhalb von 60 Minuten
//  - mixMaster:     mindestens 3 Mischgetränke heute
export function getPlayerStats(id) {
  const rows = stmts.playerDays.all(id);
  let best = null;
  for (const r of rows) {
    if (!best || r.n > best.total) best = { day: r.day, total: r.n };
  }

  const dayStart = partyDayStartMs();
  const first = stmts.firstLogToday.get(dayStart);
  const logs = stmts.playerLogsToday.all(id, dayStart);

  let midnightBeer = false;
  let mixesToday = 0;
  for (const l of logs) {
    if (l.drink === 'mix') mixesToday += 1;
    if (l.drink === 'beer' && new Date(l.ts).getHours() === 0) midnightBeer = true;
  }
  let threeInHour = false;
  for (let i = 0; i + 2 < logs.length; i++) {
    if (logs[i + 2].ts - logs[i].ts <= 60 * 60 * 1000) { threeInHour = true; break; }
  }

  return {
    days: rows.length,
    best,
    achievements: {
      firstDrinker: !!first && first.player_id === id,
      midnightBeer,
      threeInHour,
      mixMaster: mixesToday >= 3,
    },
  };
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
    const entry = today.get(row.player_id) ?? { beer: 0, shot: 0, mix: 0 };
    entry[row.drink] = row.n;
    today.set(row.player_id, entry);
  }

  const players = stmts.listPlayers
    .all()
    .map((p) => {
      const t = today.get(p.id) ?? { beer: 0, shot: 0, mix: 0 };
      return {
        id: p.id,
        name: p.name,
        beers: p.beers,
        shots: p.shots,
        mixes: p.mixes,
        total: p.beers + p.shots + p.mixes,
        beersToday: t.beer,
        shotsToday: t.shot,
        mixesToday: t.mix,
        hidden: !!p.hidden,
        createdAt: p.created_at,
      };
    })
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, 'de'));

  players.forEach((p, i) => { p.rank = i + 1; });
  // joinUrl: vom Admin gesetzte Beitritts-Adresse für den TV-QR-Code
  // (leer => TV nutzt die eigene Server-Adresse als Fallback)
  // boardMode: vom Admin gewählte TV-Ansicht ('alltime' | 'today')
  // scrollSeconds: Verweildauer pro Ranglisten-Schritt (TV-Rotation)
  // customFacts: vom Admin gepflegte eigene Meldungen fürs Fun-Fact-Band
  return {
    players,
    joinUrl: getSetting('join_url', ''),
    boardMode: getSetting('board_mode', 'alltime'),
    scrollSeconds: Number(getSetting('scroll_seconds', '3.2')),
    customFacts: listFacts(),
    records: getRecords(),
  };
}
