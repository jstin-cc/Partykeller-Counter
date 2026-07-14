# Getränke-Counter Partykeller 🍺

Gäste zählen ihre Biere und Shots über das Handy, ein Fernseher zeigt die
dauerhafte All-Time-Rangliste. Läuft komplett im lokalen WLAN auf einem
Raspberry Pi — keine Internet-Abhängigkeit.

**Status:** Planungsphase abgeschlossen, wartet auf Freigabe. Noch kein
lauffähiger Code. Siehe [PROGRESS.md](PROGRESS.md) für den aktuellen Stand.

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
