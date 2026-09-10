import { AREA } from './area.js';

// Storage-Keys pro Bereich: 'pk_*' (Partykeller, unverändert zu vorher — Logins
// überleben das Update) bzw. 'ys_*' (Youngstars). So kann dasselbe Handy in
// beiden Bereichen getrennt angemeldet sein.
const TOKEN_KEY = `${AREA.keyPrefix}_token`;
const PLAYER_KEY = `${AREA.keyPrefix}_player_id`;
// Wer sich an diesem Handy zuletzt angemeldet hat — überlebt das Abmelden
// bewusst, damit die Anmeldeliste den eigenen Namen oben zeigen kann (D-041).
const LAST_PLAYER_KEY = `${AREA.keyPrefix}_last_player_id`;

export function getSession() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    playerId: localStorage.getItem(PLAYER_KEY),
  };
}

export function setSession(token, playerId) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PLAYER_KEY, playerId);
  localStorage.setItem(LAST_PLAYER_KEY, playerId);
}

// Abmelden löscht die Sitzung, nicht die Erinnerung ans letzte Konto.
export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PLAYER_KEY);
}

export function getLastPlayerId() {
  return localStorage.getItem(LAST_PLAYER_KEY);
}

export async function post(path, body) {
  const res = await fetch(AREA.base + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}

export async function get(path) {
  return fetch(AREA.base + path);
}

// Anmeldeliste: nur die Konten, nicht der ganze State (D-047)
export async function fetchPlayers() {
  const res = await get('/api/players');
  if (!res.ok) throw new Error('Konten konnten nicht geladen werden');
  return res.json();
}

export async function fetchState() {
  const res = await get('/api/state');
  if (!res.ok) throw new Error('State konnte nicht geladen werden');
  return res.json();
}
