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
// Woher man kommt, merkt sich die alte Seite in der sessionStorage.
//
// Ersatz (D-081): Firefox und ältere Safari kennen keine View Transitions
// zwischen zwei Seiten. Dort spielt die neue Seite den Übergang selbst nach:
// Blöcke gleiten aus der Richtung herein, Namenskreis, Titel und Logo fliegen
// von ihrer alten Stelle her (FLIP), die Farbe flutet als Kreis. Bei
// „Bewegung reduzieren" passiert in beiden Fällen nichts.
(() => {
  const SEITE = document.currentScript?.dataset.seite ?? '';
  const TIEFE = { start: 0, anmeldung: 1, willkommen: 1.5, dashboard: 2, abende: 3, admin: 3 };
  const KEY = 'vt-von';
  const MAX_ALTER = 8000;   // ms — ältere Einträge stammen nicht vom aktuellen Wechsel
  const html = document.documentElement;
  const bereich = () => html.dataset.area || 'partykeller';
  let tipp = null;          // letzter Tipp in Bildschirm-Koordinaten
  const benannt = new Set();
  const ruhig = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ERSATZ = !('CSSViewTransitionRule' in window) && !ruhig;

  // Erfüllt, sobald der Übergang auf diese Seite fertig ist (oder keiner
  // läuft). Seiten, die benannte Elemente gleich ersetzen würden (die
  // Anmeldeliste), warten darauf: verschwindet ein benanntes Element mitten im
  // Übergang, bricht der Browser ihn ab.
  let fertig;
  window.vtFertig = new Promise((r) => { fertig = r; });
  if (!('onpagereveal' in window) && !ERSATZ) fertig();
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

  // Ersatz: welche Elemente tragen gerade welchen Namen? Feste Namen stehen
  // im CSS — Browser ohne View Transitions kennen die Eigenschaft womöglich
  // gar nicht, deshalb hier noch einmal als Liste. Gesetzte Namen (style)
  // gehen vor, „none" schließt aus.
  const STATISCH = [
    ['.kopf-logo', 'area-logo'], ['.kopf-logos .ys-logo', 'ys-logo'],
    ['.kopf-zurueck', 'kopf-zurueck'], ['.kopf-titel', 'seiten-titel'],
    ['.ident .avatar', 'me-avatar'], ['.ident-name', 'me-name'],
  ];
  function namen() {
    const n = new Map();
    for (const [sel, name] of STATISCH) for (const el of document.querySelectorAll(sel)) n.set(el, name);
    for (const el of document.querySelectorAll('body *')) if (el.style.viewTransitionName) n.set(el, el.style.viewTransitionName);
    const proName = new Map();
    for (const [el, name] of n) if (name !== 'none' && imBild(el)) proName.set(name, el);
    return proName;
  }

  function merken() {
    const von = { seite: SEITE, bereich: bereich(), t: Date.now(), x: tipp?.x, y: tipp?.y };
    if (ERSATZ) {
      von.farbe = getComputedStyle(html).getPropertyValue('--bg').trim();   // Grundfarbe des Bereichs
      von.orte = {};
      for (const [name, el] of namen()) {
        const r = el.getBoundingClientRect();
        von.orte[name] = [r.left, r.top, r.width, r.height];
      }
    }
    try { sessionStorage.setItem(KEY, JSON.stringify(von)); } catch { /* ohne Speicher: nur Überblenden */ }
  }

  function lesen() {
    try {
      const von = JSON.parse(sessionStorage.getItem(KEY));
      return von && Date.now() - von.t <= MAX_ALTER && von.seite !== SEITE ? von : null;
    } catch { return null; }
  }

  function richtung(von) {
    const a = TIEFE[von.seite];
    const b = TIEFE[SEITE];
    if (a != null && b != null && a !== b) html.dataset.vtRichtung = b > a ? 'vor' : 'zurueck';
  }
  function flut(von) {
    if (von.bereich === bereich()) return false;
    html.dataset.vtFlut = '';
    if (von.x != null) {
      html.style.setProperty('--vt-x', `${von.x}px`);
      html.style.setProperty('--vt-y', `${von.y}px`);
    }
    return true;
  }
  function stufen() {
    let i = 0;
    for (const el of document.querySelectorAll('.vt-stufe')) {
      if (!el.getClientRects().length) continue;
      el.style.setProperty('--vt-i', String(Math.min(i++, 8)));
    }
    html.dataset.vtAuftritt = '';
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

  // P4 Rückweg spiegelt den Hinweg: aus dem Archiv gleitet der Titel zurück
  // in seinen Link; data-vt-spiegel="seite[@bereich]:name" nennt weitere
  // Ziele (Namenskreis in der Anmeldeliste, Logo in der Bereichs-Kachel)
  function spiegeln(von) {
    if (von.seite === 'abende') {
      const link = document.querySelector('a[data-vt-titel]');
      if (link && imBild(link)) titelAuf(link);
    }
    for (const el of document.querySelectorAll('[data-vt-spiegel]')) {
      const [wo, name] = el.dataset.vtSpiegel.split(':');
      const [seite, ber] = wo.split('@');
      if (seite === von.seite && (!ber || ber === von.bereich) && imBild(el)) nenne(el, name);
    }
  }

  // --- Ersatz ohne View Transitions ---
  // Teil 1 läuft sofort im <head>, damit die Blöcke schon im ersten Bild
  // unsichtbar starten; Teil 2, sobald die Seite steht.
  function ersatzVorbereiten(von) {
    html.dataset.vtErsatz = '';
    richtung(von);
    // Farbflut: Die alte Farbe liegt hinter der Seite, die neue (der <body>)
    // wird als Kreis aufgedeckt
    if (flut(von) && von.farbe) html.style.backgroundColor = von.farbe;
    html.dataset.vtAuftritt = '';
  }
  function ersatzSpielen(von) {
    spiegeln(von);
    stufen();
    // Fliegende Elemente (FLIP): ein Abbild in eigener, fester Ebene fliegt
    // von der alten an die neue Stelle, das Original wartet unsichtbar. So
    // schneidet kein Rahmen mit overflow: hidden (die Anmeldeliste) den Flug ab.
    const fluege = [];
    for (const [name, el] of namen()) {
      const alt = von.orte?.[name];
      if (!alt) continue;
      // Der Block drumherum gleitet nicht herein, sonst landete das Abbild daneben
      const stufe = el.closest('.vt-stufe');
      if (stufe) stufe.style.animation = 'none';
      fluege.push([name, el, alt, stufe]);
    }
    const ziele = [];
    for (const [name, el, alt, stufe] of fluege) {
      const r = el.getBoundingClientRect();
      const dx = alt[0] - r.left;
      const dy = alt[1] - r.top;
      if (Math.abs(dx) < 1 && Math.abs(dy) < 1) { ziele.push([null, null, stufe]); continue; }   // steht schon da (Kopf)
      // Gleicher Inhalt wird mitskaliert (Logo, Name), wechselnder Text
      // („‹ Bereich" → „‹ Wechseln") nur verschoben
      const s = name === 'kopf-zurueck' || !r.height ? 1 : alt[3] / r.height;
      const cs = getComputedStyle(el);
      const geist = el.cloneNode(true);
      for (const n of [geist, ...geist.querySelectorAll('[id]')]) n.removeAttribute('id');
      for (const prop of ['font-family', 'font-size', 'font-weight', 'line-height', 'letter-spacing',
        'color', 'text-shadow', 'text-transform', 'white-space', 'text-align']) {
        geist.style.setProperty(prop, cs.getPropertyValue(prop));
      }
      Object.assign(geist.style, {
        position: 'fixed', left: `${r.left}px`, top: `${r.top}px`, width: `${r.width}px`, height: `${r.height}px`,
        margin: '0', zIndex: '1000', pointerEvents: 'none', transformOrigin: '0 0', boxSizing: 'border-box',
        display: cs.display === 'inline' ? 'inline-block' : cs.display, viewTransitionName: 'none',
      });
      geist.setAttribute('aria-hidden', 'true');
      document.body.appendChild(geist);
      el.style.visibility = 'hidden';
      ziele.push([el, geist, stufe]);
      geist.animate([
        { transform: `translate(${dx}px, ${dy}px) scale(${s})` },
        { transform: 'none' },
      ], { duration: 420, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)', fill: 'forwards' })
        .finished.catch(() => {}).then(() => { geist.remove(); el.style.visibility = ''; });
    }
    setTimeout(fertig, 480);
    setTimeout(() => {
      delete html.dataset.vtErsatz;
      delete html.dataset.vtRichtung;
      delete html.dataset.vtFlut;
      delete html.dataset.vtAuftritt;
      html.style.backgroundColor = '';
      for (const [el, geist, stufe] of ziele) {
        geist?.remove();
        if (el) el.style.visibility = '';
        if (stufe) stufe.style.animation = '';
      }
      aufraeumen();
    }, 900);
  }
  function ersatz(von, sofort) {
    if (!von) { fertig(); return; }
    ersatzVorbereiten(von);
    if (sofort || document.readyState !== 'loading') ersatzSpielen(von);
    else document.addEventListener('DOMContentLoaded', () => ersatzSpielen(von), { once: true });
  }
  if (ERSATZ) ersatz(lesen(), false);

  // Aus dem Zwischenspeicher zurück (Zurück-Taste): Namen vom letzten Weg
  // weg; ohne View Transitions den Übergang nachspielen
  addEventListener('pageshow', (e) => {
    if (!e.persisted) return;
    aufraeumen();
    if (ERSATZ) ersatz(lesen(), true);
  });

  addEventListener('pagereveal', (e) => {
    if (ERSATZ) return;
    aufraeumen();
    if (!e.viewTransition) { fertig(); return; }
    e.viewTransition.finished.finally(fertig);
    const von = lesen();
    if (!von) return;

    kulisse();
    richtung(von);   // P2
    flut(von);       // P5
    spiegeln(von);   // P4
    stufen();        // P6

    e.viewTransition.finished.finally(() => {
      delete html.dataset.vtRichtung;
      delete html.dataset.vtFlut;
      aufraeumen();
      setTimeout(() => { delete html.dataset.vtAuftritt; }, 700);
    });
  });
})();
