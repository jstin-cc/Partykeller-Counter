// Abendrückblick als Bild im Story-Format (D-049): 1080 x 1920 auf einem
// Canvas, aus denselben Daten wie die Abend-Karte im Archiv. Alles passiert im
// Browser — kein Server, keine Bibliothek, funktioniert offline im WLAN.
//
// Das Modul wird erst beim Klick auf den Story-Knopf geladen (dynamischer
// Import), damit die Archiv-Seite nicht bei jedem Aufruf mehr JavaScript holt.
import { AREA } from './area.js';
import { buildCurve } from './curve.js';

const W = 1080;
const H = 1920;
const PAD_X = 84;
const PAD_TOP = 145;      // oben und unten bleibt Luft für die Instagram-Bedienelemente
const PAD_BOTTOM = 205;

const SERIF = "'Bitter', serif";
const SANS = "'Work Sans', sans-serif";
const EMOJI = "'Apple Color Emoji', 'Segoe UI Emoji', 'Noto Color Emoji', sans-serif";

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// --- Hilfsmittel -----------------------------------------------------------

// Farben kommen aus dem aktiven Theme, damit Youngstars sein Navy/Orange
// bekommt, ohne dass hier eine zweite Palette gepflegt werden muss.
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const val = (name) => css.getPropertyValue(name).trim();
  return {
    ink: val('--ink'), creme: val('--creme'), muted: val('--ink-muted'),
    green: val('--green'), gold: val('--gold'), amber: val('--amber'),
    brick: val('--brick'), mix: val('--mix'),
    bg: val('--bg'), bgHi: val('--bg-hi'),
    surface: val('--surface'), surface2: val('--surface-2'),
    edge: val('--glass-edge'), hairGold: val('--hair-gold'),
  };
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Bild fehlt: ${file}`));
    img.src = new URL(`../assets/${file}`, import.meta.url).href;
  });
}

// Canvas kennt kein font-variant/letter-spacing über alle Browser hinweg —
// gesperrte Versalien werden deshalb Zeichen für Zeichen gesetzt.
function trackedText(ctx, str, x, y, spacing, align = 'left') {
  const chars = [...str];
  const width = chars.reduce((w, ch) => w + ctx.measureText(ch).width + spacing, -spacing);
  let cx = align === 'right' ? x - width : align === 'center' ? x - width / 2 : x;
  const before = ctx.textAlign;
  ctx.textAlign = 'left';
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  ctx.textAlign = before;
  return width;
}

function eyebrow(ctx, str, x, y, { size = 26, color, align = 'left' }) {
  ctx.font = `600 ${size}px ${SANS}`;
  ctx.fillStyle = color;
  ctx.textBaseline = 'top';
  return trackedText(ctx, str.toUpperCase(), x, y, size * 0.22, align);
}

// Namen dürfen lang sein: erst kleiner setzen, erst danach kürzen.
function fitText(ctx, str, maxWidth, { weight, size, minSize, family = SERIF }) {
  let px = size;
  ctx.font = `${weight} ${px}px ${family}`;
  while (px > minSize && ctx.measureText(str).width > maxWidth) {
    px -= 2;
    ctx.font = `${weight} ${px}px ${family}`;
  }
  let text = str;
  while (text.length > 1 && ctx.measureText(`${text}…`).width > maxWidth) {
    text = text.slice(0, -1);
  }
  return text === str ? str : `${text}…`;
}

// roundRect fehlt auf älteren Geräten noch
function roundRect(ctx, x, y, w, h, r) {
  if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x, y, w, h, r); return; }
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function hairline(ctx, y, color, x = PAD_X, w = W - 2 * PAD_X) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, 1);
}

// --- Bausteine -------------------------------------------------------------

// Kopf: Wochentag, Datum, Abendname und rechts die Logos des Bereichs
function headBlock(night, c, logos) {
  const lines = 31 + 8 + 88 + (night.name ? 6 + 46 : 0);
  const logoW = logos.reduce((w, l) => w + l.width, 0) + 18 * (logos.length - 1);
  const logoH = Math.max(...logos.map((l) => l.height));
  return {
    height: Math.max(lines, logoH),
    draw(ctx, y) {
      eyebrow(ctx, night.weekday, PAD_X, y, { color: c.green });
      ctx.font = `800 84px ${SERIF}`;
      ctx.fillStyle = c.creme;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'top';
      ctx.fillText(night.date, PAD_X, y + 39);
      if (night.name) {
        const name = fitText(ctx, night.name, W - 2 * PAD_X - logoW - 40, { weight: 700, size: 38, minSize: 26 });
        ctx.font = `700 38px ${SERIF}`;
        ctx.fillStyle = c.gold;
        ctx.fillText(name, PAD_X, y + 133);
      }
      let lx = W - PAD_X - logoW;
      for (const l of logos) {
        ctx.drawImage(l.img, lx, y + (logoH - l.height) / 2, l.width, l.height);
        lx += l.width + 18;
      }
    },
  };
}

// Sieger und die weiteren Plätze als Zeilen über Haarlinien (kein Kästchen,
// wie auf den Abend-Karten seit D-044)
function rankBlock(top, c) {
  const [first, ...rest] = top;
  const WINNER_H = 167;
  const ROW_H = 102;
  return {
    height: WINNER_H + ROW_H * rest.length,
    draw(ctx, y) {
      hairline(ctx, y, c.hairGold);
      ctx.textBaseline = 'top';

      // Siegerzeile: Krone, Name, rechts die Anzahl
      ctx.font = `68px ${EMOJI}`;
      ctx.textAlign = 'left';
      ctx.fillStyle = c.gold;
      ctx.fillText('👑', PAD_X + 4, y + 46);
      const numRight = W - PAD_X - 4;
      ctx.font = `800 62px ${SERIF}`;
      const numW = ctx.measureText(String(first.total)).width;
      const nameX = PAD_X + 4 + 94;
      eyebrow(ctx, 'Abendsieger', nameX, y + 34, { size: 21, color: c.muted });
      const wName = fitText(ctx, first.name, numRight - numW - nameX - 40, { weight: 800, size: 64, minSize: 34 });
      ctx.font = `800 64px ${SERIF}`;
      ctx.fillStyle = c.gold;
      ctx.fillText(wName, nameX, y + 63);
      ctx.font = `800 62px ${SERIF}`;
      ctx.textAlign = 'right';
      ctx.fillText(String(first.total), numRight, y + 44);
      eyebrow(ctx, 'Getränke', numRight, y + 112, { size: 19, color: c.muted, align: 'right' });

      // Platz 2 und 3
      rest.forEach((p, i) => {
        const ry = y + WINNER_H + ROW_H * i;
        hairline(ctx, ry, c.edge);
        ctx.font = `800 34px ${SERIF}`;
        ctx.fillStyle = c.muted;
        ctx.textAlign = 'center';
        ctx.fillText(String(i + 2), PAD_X + 38, ry + 36);
        ctx.font = `700 42px ${SERIF}`;
        ctx.textAlign = 'right';
        const w = ctx.measureText(String(p.total)).width;
        ctx.fillText(String(p.total), W - PAD_X - 4, ry + 30);
        const name = fitText(ctx, p.name, W - 2 * PAD_X - 110 - w - 40, { weight: 700, size: 42, minSize: 28 });
        ctx.font = `700 42px ${SERIF}`;
        ctx.fillStyle = c.creme;
        ctx.textAlign = 'left';
        ctx.fillText(name, PAD_X + 76, ry + 30);
      });
    },
  };
}

// Bilanz des Abends als vier Kacheln
function tileBlock(night, c) {
  const tiles = [
    ['Gesamt', night.total, c.gold],
    ['Bier', night.beers, c.amber],
    ['Shots', night.shots, c.brick],
    ['Mischen', night.mixes, c.mix],
  ];
  const GAP = 18;
  const tw = (W - 2 * PAD_X - GAP * (tiles.length - 1)) / tiles.length;
  return {
    height: 152,
    draw(ctx, y) {
      tiles.forEach(([label, value, color], i) => {
        const x = PAD_X + (tw + GAP) * i;
        roundRect(ctx, x, y, tw, 152, 26);
        ctx.fillStyle = c.surface2;
        ctx.fill();
        ctx.strokeStyle = c.edge;
        ctx.lineWidth = 1;
        ctx.stroke();
        ctx.font = `800 66px ${SERIF}`;
        ctx.fillStyle = color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(String(value), x + tw / 2, y + 22);
        eyebrow(ctx, label, x + tw / 2, y + 104, { size: 20, color: c.muted, align: 'center' });
      });
    },
  };
}

// Verlauf pro Stunde, gleiche Kurve wie auf der Abend-Karte
function curveBlock(timeline, c) {
  const CARD_H = 440;
  const PLOT_H = 286;
  const inner = W - 2 * PAD_X - 72;
  const { max, peak, xAt, yAt, segments, points } = buildCurve(timeline.counts, inner, PLOT_H, 30);
  const hour = (h) => `${((h % 24) + 24) % 24} Uhr`;
  return {
    height: CARD_H,
    draw(ctx, y) {
      roundRect(ctx, PAD_X, y, W - 2 * PAD_X, CARD_H, 32);
      ctx.fillStyle = c.surface;
      ctx.fill();
      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 1;
      ctx.stroke();

      const x0 = PAD_X + 36;
      const y0 = y + 90;
      eyebrow(ctx, 'Verlauf pro Stunde', x0, y + 34, { size: 23, color: c.muted });
      ctx.font = `700 27px ${SERIF}`;
      ctx.fillStyle = c.gold;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`Spitze ${hour(timeline.startHour + peak)} · ${max}`, W - PAD_X - 36, y + 32);

      // Fläche unter der Kurve, dann die Linie darüber
      ctx.save();
      ctx.translate(x0, y0);
      const trace = () => {
        ctx.beginPath();
        ctx.moveTo(points[0][0], points[0][1]);
        if (segments.length === 0) ctx.lineTo(inner, points[0][1]);
        for (const s of segments) ctx.bezierCurveTo(s[0], s[1], s[2], s[3], s[4], s[5]);
      };
      trace();
      ctx.lineTo(inner, PLOT_H);
      ctx.lineTo(0, PLOT_H);
      ctx.closePath();
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = c.green;
      ctx.fill();
      ctx.globalAlpha = 1;

      ctx.strokeStyle = c.edge;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, PLOT_H);
      ctx.lineTo(inner, PLOT_H);
      ctx.stroke();

      trace();
      ctx.strokeStyle = c.green;
      ctx.lineWidth = 5;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      ctx.stroke();

      // Spitze: gestrichelte Senkrechte mit Punkt
      const px = xAt(peak);
      const py = yAt(max);
      ctx.globalAlpha = 0.8;
      ctx.strokeStyle = c.gold;
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 10]);
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px, PLOT_H);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1;
      ctx.fillStyle = c.gold;
      ctx.beginPath();
      ctx.arc(px, py, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Zeitachse: erste und letzte Stunde des Abends
      const n = timeline.counts.length;
      ctx.font = `400 25px ${SANS}`;
      ctx.fillStyle = c.muted;
      ctx.textBaseline = 'top';
      ctx.textAlign = 'left';
      ctx.fillText(hour(timeline.startHour), x0, y0 + PLOT_H + 14);
      if (n > 1) {
        ctx.textAlign = 'right';
        ctx.fillText(hour(timeline.startHour + n - 1), W - PAD_X - 36, y0 + PLOT_H + 14);
      }
    },
  };
}

function footBlock(night, c) {
  const people = night.participants === 1 ? '1 Teilnehmer' : `${night.participants} Teilnehmer`;
  return {
    height: 25,
    draw(ctx, y) {
      eyebrow(ctx, `${people} · ${AREA.name}`, W / 2, y, { size: 21, color: c.muted, align: 'center' });
    },
  };
}

// --- Bild bauen ------------------------------------------------------------

// Eine flache Linie sagt nichts: der Verlauf kommt erst ab drei Stunden mit
// unterschiedlichen Werten aufs Bild.
function hasCurve(timeline) {
  const counts = timeline?.counts ?? [];
  return counts.length >= 3 && Math.max(...counts) > Math.min(...counts);
}

export async function buildStoryBlob(night, top) {
  const c = themeColors();
  await Promise.all([
    document.fonts.load(`800 84px ${SERIF}`),
    document.fonts.load(`700 42px ${SERIF}`),
    document.fonts.load(`600 26px ${SANS}`),
  ]);
  const youngstars = AREA.id === 'youngstars';
  const [logoImg, woodsImg, markImg, ysImg] = await Promise.all([
    loadImage('logo.png'),
    youngstars ? null : loadImage('footer-woods.png'),
    loadImage(youngstars ? 'zapfen-bg-navy.svg' : 'zapfen-bg.svg'),
    youngstars ? loadImage('youngstars-logo.png') : null,
  ]);

  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');

  // Grund: derselbe weiche Verlauf wie auf den Seiten
  const grad = ctx.createRadialGradient(W / 2, H * 0.12, 0, W / 2, H * 0.12, 1200);
  grad.addColorStop(0, c.bgHi);
  grad.addColorStop(1, c.bg);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H);

  // Zapfen-Wasserzeichen oben rechts, wie auf der Archiv-Seite
  ctx.save();
  ctx.globalAlpha = 0.12;
  ctx.translate(W + 260 - 430, 240);
  ctx.rotate((18 * Math.PI) / 180);
  ctx.drawImage(markImg, -430, -430, 860, 860);
  ctx.restore();

  // Baum-Footer gehört zum Partykeller-Look (im Youngstars-Bereich weggelassen)
  if (woodsImg) {
    const woodsH = (woodsImg.height / woodsImg.width) * W;
    ctx.globalAlpha = 0.9;
    ctx.drawImage(woodsImg, 0, H - woodsH, W, woodsH);
    ctx.globalAlpha = 1;
  }

  const sized = (img, height) => ({ img, height, width: (img.width / img.height) * height });
  const logos = [sized(logoImg, 96)];
  if (ysImg) logos.push(sized(ysImg, 58));

  // Blöcke stapeln und den freien Platz gleichmäßig auf die Lücken verteilen
  const blocks = [headBlock(night, c, logos), rankBlock(top, c), tileBlock(night, c)];
  if (hasCurve(night.timeline)) blocks.push(curveBlock(night.timeline, c));
  blocks.push(footBlock(night, c));

  const used = blocks.reduce((sum, b) => sum + b.height, 0);
  const free = H - PAD_TOP - PAD_BOTTOM - used;
  const gap = Math.min(free / (blocks.length - 1), 130);
  let y = PAD_TOP + (free - gap * (blocks.length - 1)) / 2;
  for (const block of blocks) {
    block.draw(ctx, y);
    y += block.height + gap;
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Bild konnte nicht erstellt werden'))), 'image/png');
  });
}

// '2026-09-05' -> { date: '05.09.2026', weekday: 'Samstag' }
function fmtDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return {
    date: `${String(d).padStart(2, '0')}.${String(m).padStart(2, '0')}.${y}`,
    weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()],
  };
}

// Story eines Abends bauen und als PNG speichern. `night` ist der Eintrag aus
// /api/archive; die Plätze kommen aus der Tagesliste, die schon nach Menge
// sortiert ist (Personen ohne Getränke bleiben draußen).
export async function downloadStory(night) {
  const res = await fetch(`${AREA.base}/api/archive/${night.day}`);
  if (!res.ok) throw new Error('Abend konnte nicht geladen werden');
  const { players } = await res.json();
  const top = players.filter((p) => p.total > 0).slice(0, 3).map((p) => ({ name: p.name, total: p.total }));
  if (top.length === 0) throw new Error('Dieser Abend hat keine Getränke');

  const blob = await buildStoryBlob({ ...night, ...fmtDay(night.day) }, top);
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${AREA.id}-abend-${night.day}.png`;
  a.click();
  URL.revokeObjectURL(url);
}
