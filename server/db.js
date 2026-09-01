import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import Database from 'better-sqlite3';

// Party-Tag läuft 06:00 -> 05:59 des Folgetags (D-005)
export function partyDayStartMs(now = Date.now()) {
  const d = new Date(now);
  if (d.getHours() < 6) d.setDate(d.getDate() - 1);
  d.setHours(6, 0, 0, 0);
  return d.getTime();
}

// 'YYYY-MM-DD' -> [startMs, endMs) des Party-Tags (06:00 bis 06:00 Folgetag)
export function partyDayRangeMs(day) {
  const [y, m, d] = day.split('-').map(Number);
  const start = new Date(y, m - 1, d, 6, 0, 0, 0).getTime();
  return [start, start + 24 * 60 * 60 * 1000];
}

export function validDayString(day) {
  if (typeof day !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  // Die Form allein reicht nicht: new Date(2026, 12, 99) rollt stillschweigend
  // in den März weiter. Deshalb gegenprüfen, dass das Datum wirklich existiert.
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(y, m - 1, d, 6, 0, 0, 0);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

// Aktueller Party-Tag als 'YYYY-MM-DD' (Datum des 06:00-Starts)
export function partyDayString(now = Date.now()) {
  const d = new Date(partyDayStartMs(now));
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Eine DB-Instanz pro Bereich (D-019): Partykeller und Youngstars bekommen je
// eine eigene SQLite-Datei mit identischem Schema — Daten können sich nie
// vermischen. Alle Query-Funktionen hängen an der zurückgegebenen Instanz.
export function createDb(dbPath) {
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });

  const db = new Database(dbPath);
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

  const stmts = {
    insertPlayer: db.prepare(
      'INSERT INTO players (id, name, pin_hash) VALUES (?, ?, ?)'
    ),
    getPlayer: db.prepare('SELECT * FROM players WHERE id = ?'),
    getPlayerByName: db.prepare('SELECT * FROM players WHERE name = ? COLLATE NOCASE'),
    listPlayers: db.prepare('SELECT * FROM players'),
    countPlayers: db.prepare('SELECT COUNT(*) AS n FROM players'),
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
    // Verlauf eines Abends: Getränke je Party-Tag und Uhr-Stunde (alle zusammen)
    archiveHours: db.prepare(
      `SELECT date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day,
              CAST(strftime('%H', ts/1000, 'unixepoch', 'localtime') AS INTEGER) AS hour,
              COUNT(*) AS n
       FROM drink_log
       GROUP BY day, hour`
    ),
    // Abend-Namen liegen als settings-Zeilen 'night_name:<tag>' (D-028)
    listNightNames: db.prepare(
      "SELECT key, value FROM settings WHERE key LIKE 'night_name:%'"
    ),
    deleteSetting: db.prepare('DELETE FROM settings WHERE key = ?'),
    // Persönliche Statistik: Getränke des Spielers je Party-Tag
    playerDays: db.prepare(
      `SELECT date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day, COUNT(*) AS n
       FROM drink_log WHERE player_id = ?
       GROUP BY day ORDER BY day`
    ),
    firstLogToday: db.prepare(
      'SELECT player_id, ts FROM drink_log WHERE ts >= ? ORDER BY ts, id LIMIT 1'
    ),
    // Getränke je Spieler und Sorte in einem Party-Tag (Archiv-Detail/Bearbeitung)
    dayLogs: db.prepare(
      `SELECT player_id, drink, COUNT(*) AS n, MAX(ts) AS last_ts
       FROM drink_log WHERE ts >= ? AND ts < ?
       GROUP BY player_id, drink`
    ),
    // Gesamt je Spieler und Party-Tag inkl. letztem Zeitstempel (Tagessieger-Tiebreak)
    dayPlayerTotals: db.prepare(
      `SELECT date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day,
              player_id, COUNT(*) AS n, MAX(ts) AS last_ts
       FROM drink_log
       GROUP BY day, player_id`
    ),
    // Erstes Getränk jedes Party-Tags (SQLite: bare column folgt MIN(ts))
    dayFirstLogs: db.prepare(
      `SELECT date((ts/1000) - 21600, 'unixepoch', 'localtime') AS day,
              player_id, MIN(ts) AS ts
       FROM drink_log
       GROUP BY day`
    ),
    // Alle Logs eines Spielers (Abzeichen-Historie über alle Abende)
    playerLogsAll: db.prepare(
      'SELECT drink, ts FROM drink_log WHERE player_id = ? ORDER BY ts'
    ),
    // Archiv-Korrektur: jüngsten Log-Eintrag der Sorte in diesem Party-Tag löschen
    deleteNewestDayLog: db.prepare(
      `DELETE FROM drink_log WHERE id = (
         SELECT id FROM drink_log
         WHERE player_id = ? AND drink = ? AND ts >= ? AND ts < ?
         ORDER BY ts DESC, id DESC LIMIT 1
       )`
    ),
    lastLogTsOfDay: db.prepare(
      'SELECT MAX(ts) AS ts FROM drink_log WHERE player_id = ? AND ts >= ? AND ts < ?'
    ),
    // Durstigste Stunde des laufenden Party-Tags
    topHourToday: db.prepare(
      `SELECT strftime('%H', ts/1000, 'unixepoch', 'localtime') AS hour, COUNT(*) AS n
       FROM drink_log WHERE ts >= ?
       GROUP BY hour ORDER BY n DESC, hour LIMIT 1`
    ),
    // Getränke (sichtbarer Spieler) in einem Zeitfenster — für den Rekordkurs-
    // Vergleich „Rekord-Abend zum gleichen Zeitpunkt"
    countLogsRange: db.prepare(
      `SELECT COUNT(*) AS n FROM drink_log dl
       JOIN players p ON p.id = dl.player_id
       WHERE p.hidden = 0 AND dl.ts >= ? AND dl.ts < ?`
    ),
    // Zeitpunkt des jeweils letzten Getränks: Tiebreak bei Punktegleichstand
    // (wer zuerst auf den Stand kam, steht in der Rangliste vorne)
    lastLogTs: db.prepare('SELECT player_id, MAX(ts) AS ts FROM drink_log GROUP BY player_id'),
    lastLogTsToday: db.prepare(
      'SELECT player_id, MAX(ts) AS ts FROM drink_log WHERE ts >= ? GROUP BY player_id'
    ),
    playerLogsToday: db.prepare(
      'SELECT drink, ts FROM drink_log WHERE player_id = ? AND ts >= ? ORDER BY ts'
    ),
    resetCounters: db.prepare('UPDATE players SET beers = 0, shots = 0, mixes = 0'),
    clearLog: db.prepare('DELETE FROM drink_log'),
    listFacts: db.prepare('SELECT id, title, text FROM facts ORDER BY id'),
    insertFact: db.prepare('INSERT INTO facts (title, text) VALUES (?, ?)'),
    updateFact: db.prepare('UPDATE facts SET title = ?, text = ? WHERE id = ?'),
    deleteFact: db.prepare('DELETE FROM facts WHERE id = ?'),
    countFacts: db.prepare('SELECT COUNT(*) AS n FROM facts'),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    setSetting: db.prepare(
      'INSERT INTO settings (key, value) VALUES (?, ?) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value'
    ),
  };

  function getSetting(key, fallback = null) {
    const row = stmts.getSetting.get(key);
    return row ? row.value : fallback;
  }

  function setSetting(key, value) {
    stmts.setSetting.run(key, value);
  }

  function createPlayer(name, pinHash) {
    const id = crypto.randomUUID();
    stmts.insertPlayer.run(id, name, pinHash);
    return getPlayer(id);
  }

  function getPlayer(id) {
    return stmts.getPlayer.get(id) ?? null;
  }

  function getPlayerByName(name) {
    return stmts.getPlayerByName.get(name) ?? null;
  }

  function countPlayers() {
    return stmts.countPlayers.get().n;
  }

  function incrementDrink(id, drink, delta) {
    const beers = drink === 'beer' ? delta : 0;
    const shots = drink === 'shot' ? delta : 0;
    const mixes = drink === 'mix' ? delta : 0;
    return stmts.increment.run(beers, shots, mixes, id).changes > 0;
  }

  function addLogEntry(id, drink, ts = Date.now()) {
    stmts.insertLog.run(id, drink, ts);
  }

  function setCounter(id, drink, value) {
    const p = getPlayer(id);
    if (!p) return false;
    const beers = drink === 'beer' ? value : p.beers;
    const shots = drink === 'shot' ? value : p.shots;
    const mixes = drink === 'mix' ? value : p.mixes;
    return stmts.setCounter.run(beers, shots, mixes, id).changes > 0;
  }

  function renamePlayer(id, name) {
    return stmts.rename.run(name, id).changes > 0;
  }

  function setHidden(id, hidden) {
    return stmts.setHidden.run(hidden ? 1 : 0, id).changes > 0;
  }

  // Rekorde: pro Sorte der (Spieler, Party-Tag) mit den meisten Getränken.
  // Ausgeblendete Spieler zählen nicht (nicht Teil des Scoreboards).
  function getRecords() {
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
  function listFacts() {
    return stmts.listFacts.all();
  }

  function addFact(title, text) {
    if (stmts.countFacts.get().n >= 50) throw new Error('Zu viele Meldungen (max. 50)');
    stmts.insertFact.run(title, text);
  }

  function updateFact(id, title, text) {
    return stmts.updateFact.run(title, text, id).changes > 0;
  }

  function deleteFact(id) {
    return stmts.deleteFact.run(id).changes > 0;
  }

  // Sieger je Party-Tag: meiste Getränke, bei Gleichstand wer zuerst auf dem
  // Stand war (D-020 gilt auch hier). Map day -> { playerId, n }
  function getDayWinners() {
    const byDay = new Map();
    for (const row of stmts.dayPlayerTotals.all()) {
      const cur = byDay.get(row.day);
      if (!cur || row.n > cur.n || (row.n === cur.n && row.last_ts < cur.last_ts)) {
        byDay.set(row.day, { playerId: row.player_id, n: row.n, last_ts: row.last_ts });
      }
    }
    return byDay;
  }

  // --- Abend-Namen (D-028): frei vergebener Titel je Party-Tag ---------------
  // Liegen in `settings` unter 'night_name:<tag>' — kein eigenes Schema nötig,
  // und sie überleben den Neustart wie jede andere Einstellung (D-006).
  const NIGHT_NAME_PREFIX = 'night_name:';

  function listNightNames() {
    const map = new Map();
    for (const row of stmts.listNightNames.all()) {
      map.set(row.key.slice(NIGHT_NAME_PREFIX.length), row.value);
    }
    return map;
  }

  function getNightName(day) {
    return getSetting(NIGHT_NAME_PREFIX + day, '');
  }

  // Leerer Name entfernt die Benennung wieder (statt eine leere Zeile zu halten)
  function setNightName(day, name) {
    const key = NIGHT_NAME_PREFIX + day;
    if (name) setSetting(key, name);
    else stmts.deleteSetting.run(key);
  }

  // --- Verlauf je Abend (D-029): Getränke pro Stunde, alle Personen zusammen --
  // Index 0 ist die Stunde ab 06:00 (Party-Tag-Start, D-005). Leere Stunden am
  // Anfang und Ende fallen weg, damit der Graph den tatsächlichen Abend zeigt
  // und nicht 24 Stunden, von denen 16 leer sind.
  function buildTimelines() {
    const raw = new Map();   // day -> number[24]
    for (const row of stmts.archiveHours.all()) {
      let slots = raw.get(row.day);
      if (!slots) { slots = new Array(24).fill(0); raw.set(row.day, slots); }
      slots[(row.hour - 6 + 24) % 24] += row.n;
    }
    const out = new Map();
    for (const [day, slots] of raw) {
      const first = slots.findIndex((n) => n > 0);
      if (first < 0) continue;
      let last = slots.length - 1;
      while (slots[last] === 0) last -= 1;
      out.set(day, { startHour: (6 + first) % 24, counts: slots.slice(first, last + 1) });
    }
    return out;
  }

  // --- Abend-Archiv: jeder Party-Tag mit Sieger, Teilnehmern und Gesamtmengen ---
  function getArchive() {
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
    const winners = getDayWinners();   // Tagessieger inkl. Uhrzeit-Tiebreak (D-020)
    const nightNames = listNightNames();
    const timelines = buildTimelines();
    return [...days.values()]
      .map((d) => {
        const w = winners.get(d.day);
        return {
          day: d.day,
          name: nightNames.get(d.day) ?? '',
          timeline: timelines.get(d.day) ?? null,
          beers: d.beers,
          shots: d.shots,
          mixes: d.mixes,
          total: d.beers + d.shots + d.mixes,
          participants: d.perPlayer.size,
          winner: w ? { name: names.get(w.playerId) ?? '—', total: w.n } : null,
        };
      })
      .sort((a, b) => b.day.localeCompare(a.day));
  }

  // Detail eines Party-Tags: alle Spieler (auch mit 0, damit der Admin nachträglich
  // Getränke ergänzen kann), Teilnehmer zuerst nach Menge, Rest alphabetisch.
  function getArchiveDay(day) {
    const [start, end] = partyDayRangeMs(day);
    const perPlayer = new Map();
    for (const row of stmts.dayLogs.all(start, end)) {
      let e = perPlayer.get(row.player_id);
      if (!e) { e = { beers: 0, shots: 0, mixes: 0, lastTs: 0 }; perPlayer.set(row.player_id, e); }
      if (row.drink === 'beer') e.beers = row.n;
      else if (row.drink === 'shot') e.shots = row.n;
      else e.mixes = row.n;
      e.lastTs = Math.max(e.lastTs, row.last_ts);
    }

    const players = stmts.listPlayers.all().map((p) => {
      const e = perPlayer.get(p.id) ?? { beers: 0, shots: 0, mixes: 0, lastTs: null };
      return {
        id: p.id,
        name: p.name,
        beers: e.beers,
        shots: e.shots,
        mixes: e.mixes,
        total: e.beers + e.shots + e.mixes,
        lastDrinkTs: e.lastTs || null,
      };
    });
    players.sort((a, b) =>
      b.total - a.total ||
      (a.lastDrinkTs ?? Infinity) - (b.lastDrinkTs ?? Infinity) ||
      a.name.localeCompare(b.name, 'de')
    );
    return { day, name: getNightName(day), players };
  }

  // Export fürs Abend-Archiv (D-025): eine Zeile je Party-Tag und Person, im
  // Langformat — so lässt sich die Datei ohne Nacharbeit als Pivot auswerten.
  // Ohne `day` über alle Abende, mit `day` nur dieser eine. Personen ohne
  // Getränke an dem Abend bleiben draußen; ausgeblendete Personen sind dabei,
  // damit die Übergabe vollständig ist (wie die Tagessummen im Archiv).
  function getExportNights(day = null) {
    const names = new Map(stmts.listPlayers.all().map((p) => [p.id, p.name]));
    const byDay = new Map();  // day -> Map(playerId -> { beers, shots, mixes })

    for (const row of stmts.archiveCounts.all()) {
      if (day && row.day !== day) continue;
      let players = byDay.get(row.day);
      if (!players) { players = new Map(); byDay.set(row.day, players); }
      let e = players.get(row.player_id);
      if (!e) { e = { beers: 0, shots: 0, mixes: 0 }; players.set(row.player_id, e); }
      if (row.drink === 'beer') e.beers = row.n;
      else if (row.drink === 'shot') e.shots = row.n;
      else e.mixes = row.n;
    }

    const rows = [];
    for (const [d, players] of byDay) {
      for (const [playerId, e] of players) {
        const total = e.beers + e.shots + e.mixes;
        if (total === 0) continue;
        rows.push({ day: d, name: names.get(playerId) ?? '—', ...e, total });
      }
    }
    // Chronologisch, innerhalb eines Abends die stärkste Bilanz zuerst
    rows.sort((a, b) =>
      a.day.localeCompare(b.day) || b.total - a.total || a.name.localeCompare(b.name, 'de')
    );
    return rows;
  }

  // Archiv-Korrektur (Admin): ein Getränk an einem bestimmten Party-Tag ergänzen
  // oder entfernen. Wirkt auf drink_log UND den All-Time-Zähler, damit Rangliste,
  // Rekorde und Archiv konsistent bleiben.
  const adjustArchiveDrink = db.transaction((playerId, day, drink, delta) => {
    if (!getPlayer(playerId)) throw new Error('Nutzer nicht gefunden');
    const [start, end] = partyDayRangeMs(day);
    if (delta === -1) {
      if (stmts.deleteNewestDayLog.run(playerId, drink, start, end).changes === 0) {
        throw new Error('An diesem Abend ist nichts mehr zum Entfernen');
      }
    } else {
      // Zeitstempel hinter das letzte Getränk des Spielers an diesem Abend legen
      // (sonst 20:00), damit Reihenfolge/Tiebreak plausibel bleiben.
      const last = stmts.lastLogTsOfDay.get(playerId, start, end)?.ts;
      const ts = Math.min(last ? last + 1000 : start + 14 * 60 * 60 * 1000, end - 1);
      stmts.insertLog.run(playerId, drink, ts);
    }
    incrementDrink(playerId, drink, delta);
  });

  // --- Persönliche Statistik + Abzeichen (für das Profil im Nutzer-Dashboard) ---
  // Jedes Abzeichen wird pro Party-Tag vergeben; `count` zählt, an wie vielen
  // Abenden (inkl. heute) es erreicht wurde, `today` gilt für den laufenden Abend:
  //  - firstDrinker:  erstes geloggtes Getränk des Abends kam von diesem Spieler
  //  - midnightBeer:  ein Bier zwischen 00:00 und 00:59 geloggt
  //  - threeInHour:   drei Getränke innerhalb von 60 Minuten
  //  - mixMaster:     mindestens 3 Mischgetränke an einem Abend
  //  - dayWinner:     Gesamt-Tagessieger des Abends (heute: führt aktuell)
  function getPlayerStats(id) {
    const rows = stmts.playerDays.all(id);
    let best = null;
    let drinksTotal = 0;
    for (const r of rows) {
      drinksTotal += r.n;
      if (!best || r.n > best.total) best = { day: r.day, total: r.n };
    }

    const today = partyDayString();

    // Abzeichen-Historie: alle Logs des Spielers nach Party-Tag gruppieren
    const perDay = new Map(); // day -> [{drink, ts}]
    for (const l of stmts.playerLogsAll.all(id)) {
      const day = partyDayString(l.ts);
      let list = perDay.get(day);
      if (!list) { list = []; perDay.set(day, list); }
      list.push(l);
    }

    const counts = { firstDrinker: 0, midnightBeer: 0, threeInHour: 0, mixMaster: 0, dayWinner: 0 };
    const todayFlags = { firstDrinker: false, midnightBeer: false, threeInHour: false, mixMaster: false, dayWinner: false };
    const award = (key, day) => {
      counts[key] += 1;
      if (day === today) todayFlags[key] = true;
    };

    for (const [day, logs] of perDay) {
      let midnightBeer = false;
      let mixes = 0;
      for (const l of logs) {
        if (l.drink === 'mix') mixes += 1;
        if (l.drink === 'beer' && new Date(l.ts).getHours() === 0) midnightBeer = true;
      }
      if (midnightBeer) award('midnightBeer', day);
      if (mixes >= 3) award('mixMaster', day);
      for (let i = 0; i + 2 < logs.length; i++) {
        if (logs[i + 2].ts - logs[i].ts <= 60 * 60 * 1000) { award('threeInHour', day); break; }
      }
    }

    for (const row of stmts.dayFirstLogs.all()) {
      if (row.player_id === id) award('firstDrinker', row.day);
    }
    for (const [day, w] of getDayWinners()) {
      if (w.playerId === id) award('dayWinner', day);
    }

    return {
      days: rows.length,
      best,
      // Ø Getränke pro Abend (nur geloggte Getränke, eine Nachkommastelle)
      avgPerNight: rows.length ? Math.round((drinksTotal / rows.length) * 10) / 10 : 0,
      achievements: Object.fromEntries(
        Object.keys(counts).map((k) => [k, { count: counts[k], today: todayFlags[k] }])
      ),
    };
  }

  function setPinHash(id, pinHash) {
    return stmts.setPinHash.run(pinHash, id).changes > 0;
  }

  function deletePlayer(id) {
    return stmts.deletePlayer.run(id).changes > 0;
  }

  const resetAll = db.transaction(() => {
    stmts.resetCounters.run();
    stmts.clearLog.run();
  });

  // Kompletter Client-State: Rangliste + Heute-Werte (ohne pin_hash!)
  function getState() {
    const today = new Map();
    for (const row of stmts.todayCounts.all(partyDayStartMs())) {
      const entry = today.get(row.player_id) ?? { beer: 0, shot: 0, mix: 0 };
      entry[row.drink] = row.n;
      today.set(row.player_id, entry);
    }

    const lastTs = new Map();
    for (const row of stmts.lastLogTs.all()) lastTs.set(row.player_id, row.ts);
    const lastTsToday = new Map();
    for (const row of stmts.lastLogTsToday.all(partyDayStartMs())) lastTsToday.set(row.player_id, row.ts);

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
          hasPin: !!p.pin_hash,   // ob eine PIN gesetzt ist (D-018); der Hash selbst bleibt geheim
          createdAt: p.created_at,
          // Zeitpunkt des letzten Getränks (all-time / heute) für den Tiebreak
          lastDrinkTs: lastTs.get(p.id) ?? null,
          lastDrinkTsToday: lastTsToday.get(p.id) ?? null,
        };
      })
      // Tiebreak bei Punktegleichstand: zuerst nach Uhrzeit (wer zuerst auf dem
      // Stand war), erst wenn auch die unbekannt ist (z. B. reine Admin-Korrektur
      // ohne Log-Eintrag), alphabetisch als letzter Fallback.
      .sort((a, b) =>
        b.total - a.total ||
        (a.lastDrinkTs ?? Infinity) - (b.lastDrinkTs ?? Infinity) ||
        a.name.localeCompare(b.name, 'de')
      );

    players.forEach((p, i) => { p.rank = i + 1; });

    // joinUrl: vom Admin gesetzte Beitritts-Adresse für den TV-QR-Code
    // (leer => TV nutzt die eigene Server-Adresse als Fallback)
    // boardMode: vom Admin gewählte TV-Ansicht ('alltime' | 'today' | 'archive')
    // boardDay/archivePlayers: bei 'archive' der gezeigte Party-Tag samt Werten
    // scrollSeconds: Verweildauer pro Ranglisten-Schritt (TV-Rotation)
    // funfactSeconds: Wechseltakt des Fun-Fact-Bands (30–300 s, im Admin einstellbar)
    // customFacts: vom Admin gepflegte eigene Meldungen fürs Fun-Fact-Band
    // funStats: berechnete Zahlen fürs Fun-Fact-Band (siehe getFunStats)
    const boardMode = getSetting('board_mode', 'alltime');
    const boardDay = getSetting('board_day', '');
    const state = {
      players,
      joinUrl: getSetting('join_url', ''),
      boardMode,
      scrollSeconds: Number(getSetting('scroll_seconds', '3.2')),
      funfactSeconds: Number(getSetting('funfact_seconds', '30')),
      customFacts: listFacts(),
      records: getRecords(),
      funStats: getFunStats(),
    };
    if (boardMode === 'archive' && validDayString(boardDay)) {
      state.boardDay = boardDay;
      state.boardName = getNightName(boardDay);
      state.archivePlayers = getArchiveDay(boardDay).players.filter((p) => p.total > 0);
    }
    return state;
  }

  // Kennzahlen fürs Fun-Fact-Band: alles aus drink_log, ausgeblendete Spieler
  // zählen nicht mit (wie bei den Rekorden).
  function getFunStats() {
    const players = stmts.listPlayers.all();
    const hiddenIds = new Set(players.filter((p) => p.hidden).map((p) => p.id));
    const names = new Map(players.map((p) => [p.id, p.name]));

    // Abende gesamt + Rekord-Abend (meiste Getränke aller zusammen) +
    // Stammgast (meiste Abende) + meiste Tagessiege
    const dayTotals = new Map();   // day -> Getränke gesamt
    const nightsBy = new Map();    // playerId -> Anzahl Abende
    for (const row of stmts.dayPlayerTotals.all()) {
      if (hiddenIds.has(row.player_id)) continue;
      dayTotals.set(row.day, (dayTotals.get(row.day) ?? 0) + row.n);
      nightsBy.set(row.player_id, (nightsBy.get(row.player_id) ?? 0) + 1);
    }
    let recordNight = null;
    for (const [day, total] of dayTotals) {
      if (!recordNight || total > recordNight.total) recordNight = { day, total };
    }
    let regular = null;
    for (const [pid, nights] of nightsBy) {
      if (!regular || nights > regular.nights) regular = { name: names.get(pid) ?? '—', nights };
    }
    const wins = new Map();
    for (const w of getDayWinners().values()) {
      if (hiddenIds.has(w.playerId)) continue;
      wins.set(w.playerId, (wins.get(w.playerId) ?? 0) + 1);
    }
    let topWinner = null;
    for (const [pid, n] of wins) {
      if (!topWinner || n > topWinner.wins) topWinner = { name: names.get(pid) ?? '—', wins: n };
    }

    const dayStart = partyDayStartMs();
    const first = stmts.firstLogToday.get(dayStart);
    const topHour = stmts.topHourToday.get(dayStart);

    // Rekordkurs (Bier-Pace): läuft der laufende Abend schneller als der beste
    // BISHERIGE Abend? Vergleich: Getränke heute gesamt vs. Getränke des
    // Rekord-Abends bis zur gleichen Uhrzeit (gleiche Zeit seit 06:00-Start).
    const today = partyDayString();
    let bestPrev = null;
    for (const [day, total] of dayTotals) {
      if (day === today) continue;
      if (!bestPrev || total > bestPrev.total) bestPrev = { day, total };
    }
    const todayTotal = dayTotals.get(today) ?? 0;
    let pace = null;
    if (bestPrev && todayTotal > 0) {
      const [recStart] = partyDayRangeMs(bestPrev.day);
      const elapsed = Math.max(0, Date.now() - dayStart);
      const recordAtSameTime = stmts.countLogsRange.get(recStart, recStart + elapsed).n;
      pace = {
        todayTotal,
        recordDay: bestPrev.day,
        recordTotal: bestPrev.total,
        recordAtSameTime,
        onPace: todayTotal > recordAtSameTime,
      };
    }

    return {
      nights: dayTotals.size,
      recordNight,
      regular,
      topWinner,
      pace,
      firstToday: first && !hiddenIds.has(first.player_id)
        ? { name: names.get(first.player_id) ?? '—', ts: first.ts }
        : null,
      topHourToday: topHour ? { hour: Number(topHour.hour), n: topHour.n } : null,
    };
  }

  return {
    getSetting, setSetting,
    createPlayer, getPlayer, getPlayerByName, countPlayers,
    incrementDrink, addLogEntry, setCounter, renamePlayer, setHidden,
    getRecords, listFacts, addFact, updateFact, deleteFact,
    getArchive, getArchiveDay, adjustArchiveDrink, getExportNights, getPlayerStats,
    getNightName, setNightName,
    setPinHash, deletePlayer, resetAll, getState,
  };
}
