import { validName, validFactTitle, validFactText } from './validate.js';

// Vollsicherung eines Bereichs (D-034): alles, was nötig ist, um den Bereich
// nach einem Laptop-/SD-Karten-Tausch identisch weiterlaufen zu lassen —
// Konten samt PIN-Hash, das komplette Getränke-Log, die Einstellungen
// (TV-Modus, Abend-Namen, QR-Adresse, Takte) und die eigenen Fun-Facts.
// NICHT enthalten ist die .env: nur mit demselben TOKEN_SECRET bleiben auch die
// Logins auf den Handys gültig (D-006), Passwörter gehören ohnehin nicht in
// eine Datei, die im Chat oder auf einem USB-Stick landet.

export const BACKUP_FORMAT = 'partykeller-counter-backup';
export const BACKUP_VERSION = 1;

// Eine Sicherung kommt zwar vom Admin, wird aber praktisch ungeprüft in die DB
// geschrieben. Deshalb harte Obergrenzen gegen kaputte oder absurd große
// Dateien — großzügig über allem, was ein echter Keller je erreicht.
const LIMITS = { players: 1000, drinkLog: 300000, settings: 2000, facts: 200 };

const DRINKS = ['beer', 'shot', 'mix'];
// PIN-Hash-Format aus auth.js: 's1:<salt-hex>:<hash-hex>'; leer = Konto ohne PIN
const PIN_HASH = /^s1:[0-9a-f]+:[0-9a-f]+$/;

function fail(msg) {
  throw new Error(msg);
}

function list(data, key) {
  const rows = data[key];
  if (!Array.isArray(rows)) fail(`Sicherung unvollständig: „${key}" fehlt`);
  if (rows.length > LIMITS[key]) fail(`Zu viele Einträge in „${key}" (max. ${LIMITS[key]})`);
  return rows;
}

function str(value, max, label) {
  if (typeof value !== 'string' || value.length < 1 || value.length > max) {
    fail(`Sicherung beschädigt: ${label}`);
  }
  return value;
}

// AUTOINCREMENT-IDs werden mit übernommen, damit ein wiederhergestellter Stand
// wirklich identisch ist. Fehlt die ID, vergibt SQLite eine neue.
function rowId(value, label) {
  if (value === undefined || value === null) return null;
  if (!Number.isInteger(value) || value <= 0) fail(`Sicherung beschädigt: ${label}`);
  return value;
}

function count(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 1_000_000) {
    fail(`Sicherung beschädigt: ${label}`);
  }
  return value;
}

// Prüft eine hochgeladene Sicherung vollständig durch und gibt sie in genau der
// Form zurück, in der db.importBackup() sie einspielt. Wirft mit einer für den
// Admin lesbaren Meldung, sobald irgendetwas nicht passt — lieber gar nicht
// einspielen als halb.
export function parseBackup(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail('Datei ist keine Sicherung');
  if (data.format !== BACKUP_FORMAT) fail('Datei ist keine Sicherung dieser App');
  if (data.version !== BACKUP_VERSION) {
    fail(`Sicherungs-Version ${data.version} wird nicht unterstützt (erwartet: ${BACKUP_VERSION})`);
  }

  const ids = new Set();
  const names = new Set();
  const players = list(data, 'players').map((p) => {
    if (!p || typeof p !== 'object') fail('Sicherung beschädigt: Nutzer-Eintrag');
    const id = str(p.id, 64, 'Nutzer-ID');
    if (!validName(p.name)) fail(`Ungültiger Name in der Sicherung: „${p.name}"`);
    const name = p.name.trim();
    if (ids.has(id)) fail(`Nutzer-ID doppelt in der Sicherung: ${id}`);
    // players.name ist UNIQUE COLLATE NOCASE — doppelte Namen würden erst beim
    // Schreiben auffallen, hier gibt es dafür eine verständliche Meldung.
    if (names.has(name.toLowerCase())) fail(`Name doppelt in der Sicherung: „${name}"`);
    ids.add(id);
    names.add(name.toLowerCase());
    const pinHash = typeof p.pin_hash === 'string' ? p.pin_hash : fail('Sicherung beschädigt: PIN');
    if (pinHash !== '' && !PIN_HASH.test(pinHash)) fail(`PIN-Hash unbrauchbar bei „${name}"`);
    return {
      id,
      name,
      pin_hash: pinHash,
      beers: count(p.beers, 'Bier-Zähler'),
      shots: count(p.shots, 'Shot-Zähler'),
      mixes: count(p.mixes, 'Mischen-Zähler'),
      hidden: p.hidden ? 1 : 0,
      created_at: str(p.created_at, 40, 'Anlegedatum'),
    };
  });

  const drinkLog = list(data, 'drinkLog').map((e) => {
    if (!e || typeof e !== 'object') fail('Sicherung beschädigt: Log-Eintrag');
    if (!ids.has(e.player_id)) fail('Log-Eintrag ohne passenden Nutzer in der Sicherung');
    if (!DRINKS.includes(e.drink)) fail(`Unbekanntes Getränk in der Sicherung: „${e.drink}"`);
    if (!Number.isInteger(e.ts) || e.ts <= 0) fail('Sicherung beschädigt: Zeitstempel');
    return { id: rowId(e.id, 'Log-ID'), player_id: e.player_id, drink: e.drink, ts: e.ts };
  });

  const keys = new Set();
  const settings = list(data, 'settings').map((s) => {
    if (!s || typeof s !== 'object') fail('Sicherung beschädigt: Einstellung');
    const key = str(s.key, 80, 'Einstellungs-Schlüssel');
    if (keys.has(key)) fail(`Einstellung doppelt in der Sicherung: ${key}`);
    keys.add(key);
    if (typeof s.value !== 'string' || s.value.length > 500) fail(`Einstellung unbrauchbar: ${key}`);
    return { key, value: s.value };
  });

  const facts = list(data, 'facts').map((f) => {
    if (!f || typeof f !== 'object') fail('Sicherung beschädigt: Fun-Fact');
    if (!validFactTitle(f.title) || !validFactText(f.text)) fail('Fun-Fact in der Sicherung ist zu lang oder leer');
    return {
      id: rowId(f.id, 'Fun-Fact-ID'),
      title: f.title.trim(),
      text: f.text.trim(),
      created_at: str(f.created_at, 40, 'Fun-Fact-Datum'),
    };
  });

  return { players, drinkLog, settings, facts };
}
