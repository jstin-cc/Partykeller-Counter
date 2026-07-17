import dotenv from 'dotenv';

dotenv.config();

function fail(msg) {
  console.error(`Konfigurationsfehler: ${msg} (siehe .env.example)`);
  process.exit(1);
}

const port = Number(process.env.PORT ?? 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) fail('PORT ist keine gültige Portnummer');

const adminPassword = process.env.ADMIN_PASSWORD;
if (!adminPassword) fail('ADMIN_PASSWORD ist nicht gesetzt');

// Eigener Admin-Zugang für den Youngstars-Bereich (D-019) — bewusst Pflicht,
// damit der Bereich nie versehentlich mit dem Partykeller-Passwort läuft.
const youngstarsAdminPassword = process.env.YOUNGSTARS_ADMIN_PASSWORD;
if (!youngstarsAdminPassword) fail('YOUNGSTARS_ADMIN_PASSWORD ist nicht gesetzt (neuer Youngstars-Bereich, siehe README)');

const tokenSecret = process.env.TOKEN_SECRET;
if (!tokenSecret || tokenSecret.length < 16) fail('TOKEN_SECRET fehlt oder ist zu kurz (min. 16 Zeichen)');

// Eigenes Passwort für den destruktiven Komplett-Reset (getrennt vom Admin-Login).
// Nicht gesetzt => fällt auf ADMIN_PASSWORD zurück (bestehende Setups bleiben lauffähig).
// Gilt für beide Bereiche; der Reset löscht immer nur den Bereich, in dem er
// ausgelöst wurde (D-019).
const resetPassword = process.env.RESET_PASSWORD || adminPassword;

export const config = {
  port,
  adminPassword,
  youngstarsAdminPassword,
  resetPassword,
  tokenSecret,
  dbPath: process.env.DB_PATH ?? 'data/partykeller.db',
  youngstarsDbPath: process.env.YOUNGSTARS_DB_PATH ?? 'data/youngstars.db',
};
