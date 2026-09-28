// Saison-Akzente (D-071): kleine Deko zu Oktoberfest, Halloween, Winter,
// Silvester und Fasching, die sich nach dem Datum selbst ein- und ausschaltet.
// Ein Abend zählt bis 6 Uhr früh zum Vortag. Der Admin kann alles abschalten
// (Einstellung „Saison-Akzente“, kommt im State als `seasonal`).
//
// Zum Ausprobieren stellt ?jetzt=2026-12-31T23:58 in der Adresse die Uhr
// dieser Seite; sie läuft von dort aus weiter.

const clockOffset = (() => {
  const v = new URLSearchParams(location.search).get('jetzt');
  const t = v ? Date.parse(v) : NaN;
  return Number.isFinite(t) ? t - Date.now() : 0;
})();
export const now = () => new Date(Date.now() + clockOffset);

const day = (y, m, d) => new Date(y, m - 1, d);
const addDays = (dt, n) => new Date(dt.getFullYear(), dt.getMonth(), dt.getDate() + n);

// Ostersonntag (Gaußsche Osterformel, gregorianisch)
function easter(y) {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), date = ((h + l - 7 * m + 114) % 31) + 1;
  return day(y, month, date);
}

// Wiesn: erster Samstag nach dem 15. September bis zum ersten Sonntag im
// Oktober, mindestens aber bis zum 3. Oktober
function wiesn(y) {
  let start = day(y, 9, 16);
  while (start.getDay() !== 6) start = addDays(start, 1);
  let end = day(y, 10, 1);
  while (end.getDay() !== 0) end = addDays(end, 1);
  if (end.getDate() < 3) end = day(y, 10, 3);
  return [start, end];
}

const within = (d, [a, b]) => d >= a && d <= b;

// Welcher Anlass gilt zum Zeitpunkt t? null = keiner
export function seasonAt(t = now()) {
  const eff = new Date(t.getTime() - 6 * 3600e3);
  const d = day(eff.getFullYear(), eff.getMonth() + 1, eff.getDate());
  const y = d.getFullYear(), m = d.getMonth() + 1, date = d.getDate();
  // Silvester: 31.12. ab 18 Uhr bis 1.1. um 6 Uhr
  if (m === 12 && date === 31 && (t.getDate() !== 31 || t.getHours() >= 18)) return 'silvester';
  if (m === 10 && date === 31) return 'halloween';
  const e = easter(y);
  if (within(d, [addDays(e, -52), addDays(e, -47)])) return 'fasching';   // Weiberfastnacht bis Faschingsdienstag
  if (within(d, wiesn(y))) return 'oktoberfest';
  if (m === 12 || (m === 1 && date <= 6)) return 'winter';
  return null;
}

// Silvester: in der letzten Stunde ein Countdown, nach Mitternacht bis 1 Uhr
// ein Gruß. phase: 'countdown' | 'greeting' | 'after' | 'none'
export function newYear(t = now()) {
  if (t.getMonth() === 11 && t.getDate() === 31) {
    const midnight = new Date(t.getFullYear() + 1, 0, 1);
    const left = Math.ceil((midnight - t) / 1000);
    return left <= 3600 ? { phase: 'countdown', left, year: midnight.getFullYear() } : { phase: 'none' };
  }
  if (t.getMonth() === 0 && t.getDate() === 1 && t.getHours() < 6) {
    const since = t - new Date(t.getFullYear(), 0, 1);
    return { phase: t.getHours() < 1 ? 'greeting' : 'after', since, year: t.getFullYear() };
  }
  return { phase: 'none' };
}
export const mmss = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

// --- Aktiver Anlass: html[data-season] plus Deko in den markierten Flächen ---
// [data-deco-top="phone|tv"]  oben: Wimpelkette, Luftschlangen
// [data-deco-foot="phone|tv"] unten am Baum-Footer: Kürbisse, Schnee
let enabled = null;   // bis der erste State da ist, bleibt alles aus
let current = null;
const listeners = new Set();

export function onSeason(cb) { listeners.add(cb); cb(current); }

export function setSeasonEnabled(on) {
  enabled = on !== false;
  refresh();
}

function refresh() {
  const s = enabled ? seasonAt() : null;
  if (s === current) return;
  current = s;
  if (s) document.documentElement.dataset.season = s;
  else delete document.documentElement.dataset.season;
  decorate();
  for (const cb of listeners) cb(s);
}
setInterval(refresh, 30 * 1000);

let resizeTimer;
window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(decorate, 250); });

function decorate() {
  document.querySelectorAll('.season-deco').forEach((el) => el.remove());
  if (!current) return;
  for (const el of document.querySelectorAll('[data-deco-top]')) {
    const tv = el.dataset.decoTop === 'tv';
    if (current === 'oktoberfest') el.append(bunting(el.offsetWidth, tv));
    if (current === 'fasching') el.append(streamers(tv));
  }
  for (const el of document.querySelectorAll('[data-deco-foot]')) {
    const tv = el.dataset.decoFoot === 'tv';
    if (current === 'halloween') for (const left of tv ? [25, 51, 76] : [27, 70]) el.append(pumpkin(left, tv));
    if (current === 'winter' || current === 'silvester') el.append(snowcap(tv), drift(tv));
  }
}

function deco(cls, html) {
  const el = document.createElement('div');
  el.className = `season-deco ${cls}`;
  el.setAttribute('aria-hidden', 'true');
  el.innerHTML = html;
  return el;
}

// Blau-weiße Wimpelkette, auf dem TV in mehreren Bögen
function bunting(width, tv) {
  const w = Math.max(200, Math.round(width));
  const swags = tv ? Math.max(2, Math.round(w / 640)) : 1;
  const perSwag = tv ? 9 : Math.max(7, Math.round(w / 36));
  const sag = tv ? 12 : 7, flagH = tv ? 30 : 15;
  const sw = w / swags, fw = (sw / perSwag) * 0.74;
  const colors = ['oklch(0.62 0.13 240)', 'oklch(0.97 0.01 240)'];
  let path = 'M0 4 ', flags = '', n = 0;
  for (let s = 0; s < swags; s++) {
    const x0 = s * sw;
    path += `Q${x0 + sw / 2} ${4 + sag * 2} ${x0 + sw} 4 `;
    for (let i = 0; i < perSwag; i++, n++) {
      const t = (i + 0.5) / perSwag;
      const x = x0 + t * sw, y = 4 + 4 * sag * t * (1 - t);
      const slope = (Math.atan2(4 * sag * (1 - 2 * t), sw) * 180) / Math.PI;
      flags += `<g class="season-flag" style="transform-origin:${x.toFixed(1)}px ${y.toFixed(1)}px;animation-delay:${(-n * 0.37).toFixed(2)}s">`
        + `<polygon transform="rotate(${slope.toFixed(1)} ${x.toFixed(1)} ${y.toFixed(1)})" points="${(x - fw / 2).toFixed(1)},${y.toFixed(1)} ${(x + fw / 2).toFixed(1)},${y.toFixed(1)} ${x.toFixed(1)},${(y + flagH).toFixed(1)}" style="fill:${colors[n % 2]}"/></g>`;
    }
  }
  const h = 4 + sag + flagH + 4;
  return deco('season-bunting', `<svg viewBox="0 0 ${w} ${h}"><path d="${path}" fill="none" style="stroke:var(--creme)" stroke-opacity="0.55" stroke-width="${tv ? 2.5 : 1.2}"/>${flags}</svg>`);
}

// Luftschlangen: am Handy in der Ecke rechts oben, auf dem TV zwischen Titel
// und Teilnehmerzahl von oben herab
function streamers(tv) {
  const scale = tv ? 2.4 : 1;
  const anchors = tv
    ? [[40, 80], [140, 110], [240, 72], [340, 104], [440, 78], [540, 112], [630, 86]]
    : [[16, 58], [46, 84], [76, 66], [98, 96]];
  const w = tv ? 680 : 110;
  const colors = ['var(--green)', 'var(--gold)', 'var(--mix)', 'var(--brick)', 'var(--creme)'];
  let paths = '', bits = '';
  anchors.forEach(([x0, len], n) => {
    const r = 5 * scale, k = 2.6 + (n % 3) * 0.5, drift = (n % 2 ? 1 : -1) * 10 * scale;
    let d = '';
    for (let i = 0; i <= 80; i++) {
      const t = i / 80;
      const x = x0 + drift * t + r * Math.sin(2 * Math.PI * k * t);
      const y = t * len + r * 0.8 * (1 - Math.cos(2 * Math.PI * k * t));
      d += `${i ? 'L' : 'M'}${x.toFixed(1)} ${y.toFixed(1)} `;
    }
    paths += `<path d="${d}" fill="none" style="stroke:${colors[n % colors.length]}" stroke-width="${2.2 * scale}" stroke-linecap="round"/>`;
    for (let j = 0; j < 3; j++) {
      const cx = x0 + (j - 1) * 14 * scale + drift, cy = len * (0.3 + 0.3 * j) + 8 * scale;
      bits += `<rect x="${cx.toFixed(1)}" y="${cy.toFixed(1)}" width="${3 * scale}" height="${5 * scale}" rx="${scale}" transform="rotate(${((n * 47 + j * 31) % 90) - 45} ${cx.toFixed(1)} ${cy.toFixed(1)})" style="fill:${colors[(n + j + 1) % colors.length]}"/>`;
    }
  });
  const h = Math.max(...anchors.map((a) => a[1])) + 30 * scale;
  return deco(`season-streamers season-streamers--${tv ? 'tv' : 'phone'}`, `<svg viewBox="0 0 ${w} ${h}">${paths}${bits}</svg>`);
}

const PUMPKIN = '<svg viewBox="0 0 40 36"><path d="M20 7 C21 3 24 2 26 1" stroke="oklch(0.45 0.08 140)" stroke-width="2.4" fill="none" stroke-linecap="round"/>'
  + '<ellipse cx="11" cy="21" rx="9" ry="12" fill="oklch(0.66 0.17 48)"/><ellipse cx="29" cy="21" rx="9" ry="12" fill="oklch(0.66 0.17 48)"/><ellipse cx="20" cy="21" rx="10" ry="13.5" fill="oklch(0.72 0.17 52)"/>'
  + '<path d="M12 16 L16 20 L11 21 Z M28 16 L24 20 L29 21 Z" fill="oklch(0.9 0.15 90)"/>'
  + '<path d="M10 25 L14 28 L17 25.5 L20 29 L23 25.5 L26 28 L30 25 L27 31 L20 32.5 L13 31 Z" fill="oklch(0.9 0.15 90)"/></svg>';

function pumpkin(left, tv) {
  const el = deco(`season-pumpkin season-pumpkin--${tv ? 'tv' : 'phone'}`, PUMPKIN);
  el.style.left = `${left}%`;
  return el;
}

// Schneekappen: das Baum-Bild als Maske, zweimal und um wenige Pixel versetzt
// voneinander abgezogen — übrig bleibt nur die Oberkante (siehe theme.css)
function snowcap(tv) { return deco(`season-snowcap season-snowcap--${tv ? 'tv' : 'phone'}`, ''); }

// Ohne Bäume (Youngstars) liegt stattdessen eine Schneekante am unteren Rand
function drift(tv) {
  return deco(`season-drift season-drift--${tv ? 'tv' : 'phone'}`,
    '<svg viewBox="0 0 400 20" preserveAspectRatio="none"><path d="M0 9 C60 2 110 11 170 6 S290 1 400 8 L400 20 L0 20 Z" fill="oklch(0.95 0.015 250)" fill-opacity="0.9"/></svg>');
}
