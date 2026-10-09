# Übergänge zwischen den Seiten: Entwürfe P1–P6 (Stand 2026-10-09)

**Status:** Entwürfe, noch nichts umgesetzt — wartet auf Auswahl.

Ziel: Startseite, Anmeldung, Dashboard und Archiv sollen wie **eine App**
wirken statt wie vier Seiten. Die Demo `docs/animationen/uebergaenge.html`
im Browser öffnen (Chrome oder Safari, nutzt `public/assets/`, braucht
keinen Server). Sie zeigt ein klickbares Handy. Oben schaltet „Heute“
gegen „Gesamtpaket“, jede Idee lässt sich einzeln zu- und abschalten.
Dazu gibt es eine Zeitlupe und einen automatischen Rundgang.

## Stand heute (D-068, D-078)

- Jeder Seitenwechsel blendet die ganze Seite in 0,22 s über.
- Das Logo gleitet mit. Weil jede Seite ihren Kopf anders baut, springt es
  dabei quer übers Bild: groß mittig (Anmeldung), mittig mit Zurück links
  (Dashboard), klein links (Archiv, Admin).
- Namenskreis und Name gleiten beim Anmelden und bei „Weiter zählen ›“ ins
  Dashboard, aber nur auf dem Hinweg.
- Der Zapfen liegt auf jeder Seite woanders. Zurück-Links stehen mal oben,
  mal unten, und „‹ Zur Anmeldung“ im Archiv führt nicht dorthin, wo man
  herkam.

## Die Ideen

| # | Name | Was passiert | Aufwand |
|---|------|--------------|---------|
| P1 | Feste Kulisse | Hintergrund, Zapfen und Wald stehen auf jeder Seite an derselben Stelle und bleiben beim Wechsel stehen; nur der Inhalt tauscht. | klein |
| P2 | Richtung | Tiefer hinein (Start → Anmeldung → Dashboard → Archiv) kommt der Inhalt von rechts, zurück von links — dieselbe Regel wie Zählen/Profil (D-069). Die Seite merkt sich beim Verlassen, wohin es geht (`pageswap`/`pagereveal`). | mittel |
| P3 | Ein Kopf für alle Seiten | Zurück links, Logo mittig, Titel darunter — auf Anmeldung, Dashboard, Archiv und Admin (am Handy) gleich. Logo und Zurück bleiben stehen, nur der Titel wechselt. „Zurück“ führt dorthin, wo man herkam. | mittel |
| P4 | Was du antippst, wird zur Überschrift | Das angetippte Element gleitet an seinen Platz: neu „Abend-Archiv“ → Archiv-Titel. Der Rückweg spiegelt den Hinweg: bei „‹ Wechseln“ fliegt der Namenskreis zurück in seine Zeile, bei „‹ Bereich“ das Logo in seine Kachel. | klein–mittel |
| P5 | Bereichsfarbe flutet | Startseite → Youngstars: Navy läuft als Kreis vom Finger aus über den Bildschirm, zurück das Grün. | klein |
| P6 | Inhalt setzt sich | Nach dem Wechsel folgen die Blöcke mit 45 ms Versatz (leichte Fassung von A5, nur beim Seitenwechsel). | klein |

## Vorschlag

- **Fundament: P1, P3, P4.** Dieselbe Kulisse, derselbe Kopf, und was man
  antippt, kommt mit. Erst das macht aus den Seiten ein Paket.
- Dazu **P2 und P5** für das Gefühl von Weg und Ort, **P6** optional.
- Technik wie D-068: Cross-Document View Transitions, keine Bibliothek.
  Browser ohne diese Technik wechseln hart wie heute. „Bewegung reduzieren“
  schaltet alles ab. TV und Admin am Laptop bleiben unberührt.
