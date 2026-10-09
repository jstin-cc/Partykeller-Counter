// Seitenübergänge als ein Paket (D-080). Klassisches Skript im <head> jeder
// Handy-Seite — es muss vor dem ersten Bild laufen, weil der Browser
// „pagereveal" genau dann auslöst. Die eigentliche Bewegung steht in
// css/theme.css; hier wird nur entschieden, welche davon greift:
//
//  P2 Richtung    tiefer hinein → data-vt-richtung="vor", zurück → "zurueck"
//  P4 Spiegeln    was man antippt, gleitet zum Titel der neuen Seite, und der
//                 Rückweg spiegelt den Hinweg (data-vt-titel, data-vt-spiegel)
//  P5 Farbflut    anderer Bereich → data-vt-flut, Kreis vom letzten Tipp aus
//  P6 Auftritt    .vt-stufe-Blöcke folgen gestaffelt (data-vt-auftritt)
//  P1 Kulisse     der Wald gleitet nur mit, wenn er im Bild ist
//
// Woher man kommt, merkt sich die alte Seite in der sessionStorage. Browser
// ohne View Transitions (oder mit „Bewegung reduzieren") lösen kein
// pagereveal mit viewTransition aus — dort passiert hier nichts.
(() => {
  const SEITE = document.currentScript?.dataset.seite ?? '';
  const TIEFE = { start: 0, anmeldung: 1, willkommen: 1.5, dashboard: 2, abende: 3, admin: 3 };
  const KEY = 'vt-von';
  const MAX_ALTER = 8000;   // ms — ältere Einträge stammen nicht vom aktuellen Wechsel
  const html = document.documentElement;
  const bereich = () => html.dataset.area || 'partykeller';
  let tipp = null;          // letzter Tipp in Bildschirm-Koordinaten
  const benannt = new Set();

  // Erfüllt, sobald der Übergang auf diese Seite fertig ist (oder keiner
  // läuft). Seiten, die benannte Elemente gleich ersetzen würden (die
  // Anmeldeliste), warten darauf: verschwindet ein benanntes Element mitten im
  // Übergang, bricht der Browser ihn ab.
  let fertig;
  window.vtFertig = new Promise((r) => { fertig = r; });
  if (!('onpagereveal' in window)) fertig();
  setTimeout(() => fertig(), 1500);   // Sicherheitsnetz

  const nenne = (el, name) => { el.style.viewTransitionName = name; benannt.add(el); };
  function aufraeumen() {
    for (const el of benannt) el.style.viewTransitionName = '';
    benannt.clear();
  }

  // Nur gleiten lassen, was zu sehen ist: Ist die Seite gescrollt, stünde
  // der Kopf außerhalb des Bildes und flöge von dort herein. Der Wald hat
  // keinen festen Namen und bekommt ihn nur, wenn er im Bild ist.
  const FEST = '.kopf-logo, .kopf-logos .ys-logo, .kopf-zurueck, .kopf-titel, .ident .avatar, .ident-name';
  const imBild = (el) => {
    const r = el.getBoundingClientRect();
    return r.height > 0 && r.bottom > 0 && r.top < innerHeight;
  };
  function kulisse() {
    for (const wald of document.querySelectorAll('.footer-woods')) nenne(wald, imBild(wald) ? 'kulisse-wald' : 'none');
    for (const el of document.querySelectorAll(FEST)) if (!imBild(el)) nenne(el, 'none');
  }

  function merken() {
    try {
      sessionStorage.setItem(KEY, JSON.stringify({ seite: SEITE, bereich: bereich(), t: Date.now(), x: tipp?.x, y: tipp?.y }));
    } catch { /* ohne Speicher: nur Überblenden */ }
  }

  // Ein Titel pro Seite: wer „seiten-titel" bekommt, nimmt ihn dem Kopf weg
  function titelAuf(el) {
    for (const t of document.querySelectorAll('.kopf-titel')) nenne(t, 'none');
    nenne(el, 'seiten-titel');
  }

  addEventListener('click', (e) => {
    tipp = { x: e.clientX, y: e.clientY };
    // P4: „Abend-Archiv" & Co. werden auf der nächsten Seite zum Titel
    const link = e.target.closest?.('a[data-vt-titel]');
    if (link) titelAuf(link);
    kulisse();
    merken();
  }, true);
  addEventListener('pageswap', () => { kulisse(); merken(); });
  addEventListener('pagehide', merken);

  // Aus dem Zwischenspeicher zurück (Zurück-Taste): Namen vom letzten Weg weg
  addEventListener('pageshow', (e) => { if (e.persisted) aufraeumen(); });

  addEventListener('pagereveal', (e) => {
    aufraeumen();
    if (!e.viewTransition) { fertig(); return; }
    e.viewTransition.finished.finally(fertig);
    let von = null;
    try { von = JSON.parse(sessionStorage.getItem(KEY)); } catch { /* egal */ }
    if (!von || Date.now() - von.t > MAX_ALTER || von.seite === SEITE) return;

    kulisse();

    // P2 Richtung
    const a = TIEFE[von.seite];
    const b = TIEFE[SEITE];
    if (a != null && b != null && a !== b) html.dataset.vtRichtung = b > a ? 'vor' : 'zurueck';

    // P5 Farbflut beim Bereichswechsel
    if (von.bereich !== bereich()) {
      html.dataset.vtFlut = '';
      if (von.x != null) {
        html.style.setProperty('--vt-x', `${von.x}px`);
        html.style.setProperty('--vt-y', `${von.y}px`);
      }
    }

    // P4 Rückweg spiegelt den Hinweg: aus dem Archiv gleitet der Titel zurück
    // in seinen Link; data-vt-spiegel="seite[@bereich]:name" nennt weitere
    // Ziele (Namenskreis in der Anmeldeliste, Logo in der Bereichs-Kachel)
    if (von.seite === 'abende') {
      const link = document.querySelector('a[data-vt-titel]');
      if (link && imBild(link)) titelAuf(link);
    }
    for (const el of document.querySelectorAll('[data-vt-spiegel]')) {
      const [wo, name] = el.dataset.vtSpiegel.split(':');
      const [seite, ber] = wo.split('@');
      if (seite === von.seite && (!ber || ber === von.bereich) && imBild(el)) nenne(el, name);
    }

    // P6 Auftritt: sichtbare Blöcke der Reihe nach
    let i = 0;
    for (const el of document.querySelectorAll('.vt-stufe')) {
      if (!el.getClientRects().length) continue;
      el.style.setProperty('--vt-i', String(Math.min(i++, 8)));
    }
    html.dataset.vtAuftritt = '';

    e.viewTransition.finished.finally(() => {
      delete html.dataset.vtRichtung;
      delete html.dataset.vtFlut;
      aufraeumen();
      setTimeout(() => { delete html.dataset.vtAuftritt; }, 700);
    });
  });
})();
