// Bereichs-Erkennung (D-019): /youngstars/* ist der Youngstars-Bereich, alles
// andere (auch Alt-Pfade) der Partykeller. Der Bereich bestimmt API-/WS-Präfix,
// eigene Storage-Keys (getrennte Logins) und das Theme (html[data-area]).
const isYoungstars =
  location.pathname === '/youngstars' || location.pathname.startsWith('/youngstars/');

export const AREA = isYoungstars
  ? { id: 'youngstars', base: '/youngstars', name: 'Partykeller Youngstars', keyPrefix: 'ys' }
  : { id: 'partykeller', base: '/partykeller', name: 'SV Partykeller', keyPrefix: 'pk' };

// Theme-Attribut setzt schon das Inline-Skript im <head> (gegen Farb-Flackern);
// hier nur zur Sicherheit nachziehen, falls eine Seite es vergisst.
document.documentElement.dataset.area = AREA.id;

if (isYoungstars) {
  document.title = document.title.replace('SV Partykeller', 'Youngstars');
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', '#020817');
  document.querySelector('link[rel="apple-touch-icon"]')?.setAttribute('href', 'assets/icon-ys-192.png');
  document.querySelector('link[rel="icon"]')?.setAttribute('href', 'assets/icon-ys-192.png');
}
