export function validName(name) {
  return typeof name === 'string' && name.trim().length >= 1 && name.trim().length <= 24;
}

export function validPin(pin) {
  return typeof pin === 'string' && /^\d{4}$/.test(pin);
}

// Eigene Fun-Facts: Titel kurz (wie „Fun Fact"), Text eine Zeile fürs TV-Band
export function validFactTitle(title) {
  return typeof title === 'string' && title.trim().length >= 1 && title.trim().length <= 30;
}

export function validFactText(text) {
  return typeof text === 'string' && text.trim().length >= 1 && text.trim().length <= 160;
}

// Beitritts-Adresse für den QR-Code: leer erlaubt (Fallback auf Server-Adresse),
// sonst zu einer vollständigen http(s)-URL normalisiert. Wirft bei Unsinn.
export function normalizeJoinUrl(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return '';
  const candidate = /^https?:\/\//i.test(s) ? s : `http://${s}`;
  let url;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error('Ungültige Adresse');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Nur http/https erlaubt');
  }
  const out = url.toString();
  if (out.length > 200) throw new Error('Adresse ist zu lang');
  return out;
}
