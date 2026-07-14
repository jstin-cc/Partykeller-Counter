const TOKEN_KEY = 'pk_token';
const PLAYER_KEY = 'pk_player_id';

export function getSession() {
  return {
    token: localStorage.getItem(TOKEN_KEY),
    playerId: localStorage.getItem(PLAYER_KEY),
  };
}

export function setSession(token, playerId) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(PLAYER_KEY, playerId);
}

export function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(PLAYER_KEY);
}

export async function post(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error ?? `Fehler ${res.status}`);
  return data;
}

export async function fetchState() {
  const res = await fetch('/api/state');
  if (!res.ok) throw new Error('State konnte nicht geladen werden');
  return res.json();
}
