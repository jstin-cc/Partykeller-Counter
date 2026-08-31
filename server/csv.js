// CSV-Übergabedateien fürs Abend-Archiv (D-025).
//
// Zielprogramm ist in der Regel Excel/LibreOffice auf einem deutschen System:
// deshalb Semikolon als Trennzeichen, CRLF als Zeilenende und ein UTF-8-BOM,
// damit Umlaute beim Doppelklick nicht zerfallen. Keine Summenzeile — die
// Datei bleibt eine saubere Tabelle und lässt sich direkt als Pivot auswerten.

const SEP = ';';

// Excel wertet Zellen aus, die mit = + - @ beginnen, als Formel aus. Namen
// kommen von Gästen, also solche Zellen mit einem ' entschärfen.
function escapeCell(value) {
  let s = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  if (/["\r\n;]/.test(s) || s !== s.trim()) s = `"${s.replaceAll('"', '""')}"`;
  return s;
}

export function buildCsv(header, rows) {
  const lines = [header, ...rows].map((cells) => cells.map(escapeCell).join(SEP));
  return `﻿${lines.join('\r\n')}\r\n`;
}

const WEEKDAYS = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

// '2026-09-25' -> { date: '25.09.2026', weekday: 'Freitag' }
export function formatDay(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  const p = (n) => String(n).padStart(2, '0');
  return { date: `${p(d)}.${p(m)}.${y}`, weekday: WEEKDAYS[new Date(y, m - 1, d).getDay()] };
}

export const ARCHIVE_HEADER = [
  'Tag', 'Datum', 'Wochentag', 'Name', 'Bier', 'Shots', 'Mischen', 'Gesamt',
];

// Langformat: eine Zeile je Party-Tag und Person. Für einen einzelnen Abend
// ist das genau die Teilnehmerliste dieses Abends.
export function archiveCsv(rows) {
  return buildCsv(ARCHIVE_HEADER, rows.map((r) => {
    const { date, weekday } = formatDay(r.day);
    return [r.day, date, weekday, r.name, r.beers, r.shots, r.mixes, r.total];
  }));
}
