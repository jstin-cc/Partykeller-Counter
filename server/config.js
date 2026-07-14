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

const tokenSecret = process.env.TOKEN_SECRET;
if (!tokenSecret || tokenSecret.length < 16) fail('TOKEN_SECRET fehlt oder ist zu kurz (min. 16 Zeichen)');

export const config = {
  port,
  adminPassword,
  tokenSecret,
  dbPath: process.env.DB_PATH ?? 'data/partykeller.db',
};
