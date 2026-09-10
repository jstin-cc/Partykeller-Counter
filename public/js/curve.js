// Verlaufskurve eines Abends (D-029): die Stundenwerte werden als weiche
// Catmull-Rom-Kurve gezeichnet. Archiv-Karte (SVG) und Story-Bild (Canvas,
// D-049) rechnen mit derselben Formel, damit beide Kurven gleich aussehen.
//
// Ergebnis: `xAt`/`yAt` für eigene Marker, `segments` als kubische Béziers
// (jeweils [c1x, c1y, c2x, c2y, x, y]) und `d` als fertiger SVG-Pfad.
export function buildCurve(counts, w, h, padTop) {
  const n = counts.length;
  const max = Math.max(...counts);
  const xAt = (i) => (n === 1 ? w / 2 : (i / (n - 1)) * w);
  const yAt = (v) => padTop + (1 - v / max) * (h - padTop);
  const points = counts.map((v, i) => [xAt(i), yAt(v)]);

  // Kontrollpunkte werden auf die Fläche geklemmt, damit die Kurve bei großen
  // Sprüngen nicht über den Rand hinausschlägt.
  const clamp = (y) => Math.min(h, Math.max(0, y));
  const segments = [];
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(i - 1, 0)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(i + 2, points.length - 1)];
    segments.push([
      p1[0] + (p2[0] - p0[0]) / 6, clamp(p1[1] + (p2[1] - p0[1]) / 6),
      p2[0] - (p3[0] - p1[0]) / 6, clamp(p2[1] - (p3[1] - p1[1]) / 6),
      p2[0], p2[1],
    ]);
  }

  // Eine einzelne Stunde hat keine Kurve, sondern eine waagerechte Linie
  const d = n === 1
    ? `M0 ${points[0][1]} L${w} ${points[0][1]}`
    : `M${points[0][0]} ${points[0][1]}` +
      segments.map((s) => ` C${s[0].toFixed(2)} ${s[1].toFixed(2)} ${s[2].toFixed(2)} ${s[3].toFixed(2)} ${s[4].toFixed(2)} ${s[5].toFixed(2)}`).join('');

  return { max, peak: counts.indexOf(max), xAt, yAt, points, segments, d };
}
