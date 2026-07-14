# Getränke-Counter Partykeller 🍺

Gäste zählen ihre Biere und Shots über das Handy, ein Fernseher zeigt die
dauerhafte All-Time-Rangliste. Läuft komplett im lokalen WLAN auf einem
Raspberry Pi — keine Internet-Abhängigkeit.

**Status:** M0–M3 fertig — Server, Design-Basis und das Nutzer-Dashboard
laufen. Noch offen: Login-Feinschliff (M4), TV-Scoreboard (M5), Admin (M6),
Pi-Betrieb (M7). Details in [PROGRESS.md](PROGRESS.md).

## Schnellstart (Entwicklung)

```bash
npm install
cp .env.example .env       # ADMIN_PASSWORD und TOKEN_SECRET setzen
npm run seed               # optional: Testnutzer (PIN 1111)
npm start                  # http://localhost:3000
```

## Screens

| Route | Screen |
|---|---|
| `/` | Nutzer-Login (Name wählen/anlegen + PIN) |
| `/dashboard` | Nutzer-Dashboard: eigene Bier-/Shot-Zähler, Heute & Gesamt, Rang |
| `/tv` | TV-Scoreboard: All-Time-Rangliste, Podest Top 3, QR-Code zum Beitritt |
| `/admin` | Admin: Nutzer & Zähler verwalten, geschützter Komplett-Reset |

## Stack

Node.js · Express · ws (WebSockets) · SQLite (better-sqlite3) ·
statisches Frontend ohne Build-Step. Ein Prozess serviert alles.

## Projekt-Dokumente

- [PLAN.md](PLAN.md) — Architektur, Datenmodell, API-/WS-Contract, Meilensteine
- [PROGRESS.md](PROGRESS.md) — Meilensteine mit Status (wird laufend abgehakt)
- [DECISIONS.md](DECISIONS.md) — Entscheidungen mit Begründung
- [CLAUDE.md](CLAUDE.md) — Projektregeln und Konventionen
- [Prompt.md](Prompt.md) — ursprüngliche Aufgabenstellung

## Später: Betrieb auf dem Raspberry Pi

Geplant (M7): systemd-Service, mDNS-Name `partykeller.local`, TV im
Chromium-Kiosk-Modus auf `/tv`. Konfiguration über `.env`
(siehe `.env.example`).
