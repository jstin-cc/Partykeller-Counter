// Minimaler Service Worker: macht die App auch auf älteren Android-Chromes
// installierbar (dort ist ein fetch-Handler Pflicht für „Zum Startbildschirm").
// Bewusst KEIN Caching: Die App läuft nur im lokalen WLAN, und nach einem
// Update auf dem Pi darf nie eine veraltete Datei ausgeliefert werden.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* Netz durchreichen (kein respondWith) */ });
