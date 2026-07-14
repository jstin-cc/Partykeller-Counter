import crypto from 'node:crypto';
import { config } from './config.js';

const SCRYPT_PARAMS = { N: 16384, r: 8, p: 1 };

export function hashPin(pin) {
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(pin, salt, 32, SCRYPT_PARAMS);
  return `s1:${salt.toString('hex')}:${hash.toString('hex')}`;
}

export function verifyPin(pin, stored) {
  const [version, saltHex, hashHex] = stored.split(':');
  if (version !== 's1') return false;
  const expected = Buffer.from(hashHex, 'hex');
  const actual = crypto.scryptSync(pin, Buffer.from(saltHex, 'hex'), expected.length, SCRYPT_PARAMS);
  return crypto.timingSafeEqual(actual, expected);
}

// Stateless HMAC-Token (D-006): base64url(payload).base64url(hmac)
export function signToken(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', config.tokenSecret).update(body).digest('base64url');
  return `${body}.${sig}`;
}

export function verifyToken(token) {
  if (typeof token !== 'string') return null;
  const [body, sig] = token.split('.');
  if (!body || !sig) return null;
  const expected = crypto.createHmac('sha256', config.tokenSecret).update(body).digest();
  const actual = Buffer.from(sig, 'base64url');
  if (actual.length !== expected.length || !crypto.timingSafeEqual(actual, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString());
  } catch {
    return null;
  }
}

export function playerToken(playerId) {
  return signToken({ sub: playerId, role: 'player', iat: Date.now() });
}

export function adminToken() {
  return signToken({ role: 'admin', iat: Date.now() });
}

export function checkAdminPassword(password) {
  const a = Buffer.from(String(password ?? ''));
  const b = Buffer.from(config.adminPassword);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
