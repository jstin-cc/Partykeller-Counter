# Animationen und Übergänge: Entwürfe A1–A9 (Stand 2026-10-09)

**Status:** Entwürfe, noch nichts umgesetzt — wartet auf Auswahl.

Bewegung lässt sich in Standbildern schlecht zeigen, deshalb sind die
Entwürfe eine **lauffähige Demo-Seite**: `docs/animationen/entwuerfe.html`
im Browser öffnen (nutzt `public/assets/` und die vendorten Schriften,
braucht keinen Server). Jeder Entwurf spielt einmal ab, sobald er ins Bild
kommt, und lässt sich mit „Nochmal“ wiederholen oder direkt antippen. Oben
rechts schaltet die Seite zwischen Partykeller- und Youngstars-Look um.

---

## Stand heute

| Bewegt sich schon | Springt noch hart |
|-------------------|-------------------|
| Namenskreis gleitet von der Anmeldung ins Dashboard (D-068) | Zahlen wechseln schlagartig, auch zweistellig |
| Zählen/Profil schieben sich seitlich herein (D-069) | Tipp aufs Getränk fühlt sich überall gleich an |
| Zahl ploppt kurz auf (`pk-pop`) | TV-Rangliste: Zeilen werden neu gebaut und springen beim Überholen |
| TV-Zeile leuchtet auf, Podest blinkt bei neuem Namen | Neuer Spitzenreiter fällt am TV kaum auf |
| Ranglisten-Blatt fährt hoch, Lorbeer wächst herein | Seiten erscheinen auf einen Schlag |
| Saison-Deko (Wimpel, Kürbis) | Blatt verschwindet beim Schließen ohne Übergang (`hidden = true`) |
| | Kein Moment für Abzeichen, keine Rückmeldung bei Fehlern und beim Speichern |

## Die Entwürfe

| # | Name | Wo | Was passiert | Dauer | Aufwand |
|---|------|----|--------------|-------|---------|
| A1 | Zahlen rollen | Handy, TV, Startseite | Geänderte Ziffern drehen sich wie ein Zählwerk nach oben; bei 9 → 10 rollt die Zehnerstelle versetzt mit. Ersetzt den Pop. | 0,42 s | klein |
| A2 | Einschenken | Dashboard | Helle Welle vom Finger aus übers Getränkefeld, „+1“ steigt an der Tippstelle auf, das Plus dreht sich. | 0,6 s | klein |
| A3 | Getränke-Charakter | Dashboard | Bier schäumt und Bläschen steigen, Shot kippt wie beim Anstoßen, Mischen wirbelt. | 0,5–1,1 s | mittel |
| A4 | Abzeichen-Moment | Dashboard | Kronkorken springen aus dem Feld, goldene Meldung „Abzeichen erreicht“ fährt für 3 s herein. Nur bei neuem Abzeichen des Abends oder Tagessieg. | 1,1 s + 3 s | mittel |
| A5 | Gestaffelter Auftritt | alle Handy-Seiten | Blöcke kommen beim ersten Öffnen nacheinander von leicht unten (50 ms Versatz). Nicht beim Zurückblättern, nicht bei Live-Updates. | 0,38 s je Block | klein |
| A6 | Blatt mit Schwung | Profil, Admin-Dialoge | Blatt fährt hoch, Zeilen gestaffelt, Liste rollt weich zur eigenen Zeile; am Griff nach unten wischen schließt, das Blatt gleitet hinaus. | 0,38 s / 0,26 s | mittel |
| A7 | Fehler schütteln, Speichern abhaken | Anmeldung, Admin | Falsches Passwort: Feld schüttelt, Meldung gleitet ein. Speichern: Haken zeichnet sich in den Knopf. | 0,4 s / 1,4 s | klein |
| A8 | Überholen sichtbar machen | TV-Rangliste | Zeilen werden umgehängt statt neu gebaut und gleiten von der alten Stelle (FLIP); der Überholer mit Goldschein, daneben kurz „▲ 2“. Muss mit dem Durchlauf der Liste verzahnt werden. | 0,7 s | groß |
| A9 | Neuer Spitzenreiter | TV-Podest | Die Namen tauschen im Bogen die Plätze, Goldschimmer über die Siegerkarte, Banner „Neuer Spitzenreiter · Name“. Ersetzt das Blinken. | 0,8 s + 2,6 s | mittel |

## Vorschlag

- **Grundpaket (Empfehlung): A1, A2, A5, A6, A7** — jeder Tipp und jede
  Seite wird lebendiger, ohne aufzufallen; wenig Code, kein Risiko am TV.
- **TV-Momente: A8, A9** — Überholen und Führungswechsel werden zum
  Ereignis im Raum; A8 braucht Sorgfalt mit dem automatischen Durchlauf.
- **Party-Extras: A3, A4** — verspielter, gut als zweiter Schritt.

## Regeln für alle Entwürfe

- Animiert werden nur `transform` und `opacity` (läuft flüssig auf dem Pi
  am TV); keine Dauer-Animationen auf Schatten oder Größen.
- `prefers-reduced-motion: reduce` schaltet alles ab, wie bei den
  bestehenden Animationen.
- Live-Updates anderer Handys (WebSocket) rollen nur die Zahl (A1), lösen
  aber keine Welle, keine Kronkorken und keinen Auftritt aus.
- Keine neue Bibliothek: CSS und die eingebaute Web Animations API
  (`element.animate`) reichen.
