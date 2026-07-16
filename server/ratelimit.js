// Einfaches In-Memory-Rate-Limit für die Login-Endpunkte (keine Dependency).
// Gezählt werden nur FEHLGESCHLAGENE Versuche pro Schlüssel (z. B. IP):
// nach `maxFails` Fehlversuchen innerhalb `windowMs` wird der Schlüssel für
// `blockMs` gesperrt. Ein erfolgreicher Login setzt den Zähler zurück.
// In-Memory reicht: ein Prozess, lokales WLAN; Neustart hebt Sperren auf.
export function createLoginLimiter({ maxFails = 5, windowMs = 60_000, blockMs = 60_000 } = {}) {
  const entries = new Map(); // key -> { fails: number[], blockedUntil: number }

  function prune(entry, now) {
    entry.fails = entry.fails.filter((t) => now - t < windowMs);
  }

  return {
    // null = erlaubt, sonst Restsperre in Sekunden
    blockedFor(key, now = Date.now()) {
      const entry = entries.get(key);
      if (!entry) return null;
      if (entry.blockedUntil > now) return Math.ceil((entry.blockedUntil - now) / 1000);
      return null;
    },

    fail(key, now = Date.now()) {
      let entry = entries.get(key);
      if (!entry) { entry = { fails: [], blockedUntil: 0 }; entries.set(key, entry); }
      prune(entry, now);
      entry.fails.push(now);
      if (entry.fails.length >= maxFails) {
        entry.blockedUntil = now + blockMs;
        entry.fails = [];
      }
      // Speicher begrenzen (LAN: praktisch nie relevant)
      if (entries.size > 1000) {
        for (const [k, e] of entries) {
          if (e.blockedUntil <= now && e.fails.length === 0) entries.delete(k);
          if (entries.size <= 500) break;
        }
      }
    },

    clear(key) {
      entries.delete(key);
    },
  };
}

// Zählt JEDEN Versuch pro Schlüssel (nicht nur Fehlversuche) und lässt in einem
// gleitenden Fenster höchstens `max` zu. Für Aktionen, die auch bei Erfolg nicht
// beliebig oft passieren sollen (z. B. neue Konten anlegen). In-Memory, ein Prozess.
export function createRateLimiter({ max = 6, windowMs = 60_000 } = {}) {
  const hits = new Map(); // key -> number[] (Zeitstempel im Fenster)
  return {
    // true = erlaubt (und gezählt), false = Limit im Fenster erreicht
    take(key, now = Date.now()) {
      const arr = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
      if (arr.length >= max) { hits.set(key, arr); return false; }
      arr.push(now);
      hits.set(key, arr);
      if (hits.size > 1000) {
        for (const [k, v] of hits) {
          if (v.every((t) => now - t >= windowMs)) hits.delete(k);
          if (hits.size <= 500) break;
        }
      }
      return true;
    },
  };
}
