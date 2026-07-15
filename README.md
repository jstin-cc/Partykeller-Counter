# Getränke-Counter Partykeller 🍺

Gäste zählen ihre Biere und Shots über das Handy, ein Fernseher zeigt die
dauerhafte All-Time-Rangliste. Läuft komplett im lokalen WLAN auf einem
Raspberry Pi — keine Internet-Abhängigkeit.

**Status:** Funktional komplett (M0–M7) — Login, Nutzer-Dashboard,
TV-Scoreboard mit QR-Code und Admin-Bereich laufen live über WebSocket.
Offene Restpunkte in [PROGRESS.md](PROGRESS.md).

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
| `/tv` | TV-Scoreboard: All-Time-Rangliste, Podest Top 3, QR-Code zum Beitritt, ab Platz 4 rotierende Liste, Fun-Facts-Band |
| `/admin` | Admin: Nutzer & Zähler verwalten, QR-Adresse setzen, geschützter Komplett-Reset |

## Stack

Node.js · Express · ws (WebSockets) · SQLite (better-sqlite3) ·
statisches Frontend ohne Build-Step. Ein Prozess serviert alles.

## Projekt-Dokumente

- [PLAN.md](PLAN.md) — Architektur, Datenmodell, API-/WS-Contract, Meilensteine
- [PROGRESS.md](PROGRESS.md) — Meilensteine mit Status (wird laufend abgehakt)
- [DECISIONS.md](DECISIONS.md) — Entscheidungen mit Begründung
- [CLAUDE.md](CLAUDE.md) — Projektregeln und Konventionen
- [Prompt.md](Prompt.md) — ursprüngliche Aufgabenstellung

## Betrieb auf dem Raspberry Pi

Anleitung in [deploy/PI-SETUP.md](deploy/PI-SETUP.md): systemd-Service
([deploy/partykeller.service](deploy/partykeller.service)), mDNS-Name
`partykeller.local`, TV im Chromium-Kiosk-Modus auf `/tv`, Backup der
`data/partykeller.db`. Konfiguration über `.env` (siehe `.env.example`).
