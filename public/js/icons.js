// Gezeichnete Icons statt Emoji (D-028).
//
// Emoji werden vom Betriebssystem gerendert: auf jedem Gerät anders, immer
// mehrfarbig, nie in der eigenen Farbe. Diese Icons sind eine geschlossene
// Serie — 24×24-Raster, 1,8 px Strichstärke, runde Enden — und erben über
// `currentColor` die Farbe der Stelle, an der sie stehen.

const PATHS = {
  // Sieger: Krone
  crown:    'M2.8 8.2 8 11.9 12 5.2l4 6.7 5.2-3.7-1.7 10.6H4.5Z',
  // Erster Trinker: Wimpel
  flag:     'M6.5 21V3.8m0 .7h11l-2.2 3.9 2.2 3.9h-11',
  // Mitternachtsbier: Mondsichel
  moon:     'M20.5 14.6A8.6 8.6 0 0 1 9.4 3.5a8.6 8.6 0 1 0 11.1 11.1Z',
  // Drei in einer Stunde: Blitz
  bolt:     'M13.4 2.8 5.2 13.6h5.6l-.8 7.6 8.4-11.2h-5.7Z',
  // Mischmeister: Cocktailglas
  glass:    'M3.6 4.4h16.8L12 13.2 3.6 4.4ZM12 13.2v6.4M8.4 19.6h7.2',
  // Rekordkurs: steigende Kurve
  pace:     'M3 16.8 9 10.4l3.9 3.6L21 6m0 0h-4.6M21 6v4.6',
  // Download
  download: 'M12 3.4v11.4m0 0-4.4-4.3M12 14.8l4.4-4.3M4 20.2h16',
};

// Liefert ein <svg> als String. `size` in px, Farbe kommt von currentColor.
export function icon(name, size = 18) {
  const d = PATHS[name];
  if (!d) return '';
  return `<svg class="ico" viewBox="0 0 24 24" width="${size}" height="${size}" `
       + `fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" `
       + `stroke-linejoin="round" aria-hidden="true"><path d="${d}"/></svg>`;
}

// Für Stellen, die ein Element statt eines Strings brauchen.
export function iconEl(name, size = 18) {
  const span = document.createElement('span');
  span.className = 'ico-wrap';
  span.innerHTML = icon(name, size);
  return span;
}

// Statisches Markup: jedes Element mit data-ico="name" bekommt sein Icon
// vorangestellt. Wird einmal beim Laden der Seite aufgerufen.
export function paintIcons(root = document) {
  for (const el of root.querySelectorAll('[data-ico]')) {
    if (el.querySelector('.ico')) continue;
    el.insertAdjacentHTML('afterbegin', `${icon(el.dataset.ico, 16)} `);
  }
}
