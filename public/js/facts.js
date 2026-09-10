// Fun-Facts für das TV-Band — von tv.html und admin.html gemeinsam benutzt,
// damit die Übersicht im Admin garantiert dieselbe Liste in derselben
// Reihenfolge zeigt wie der Fernseher (D-043).
//
// Jeder Eintrag ist { kind, title, text }: berechnete Facts (Rekorde,
// Tages-Bestleistungen, Momente, Bilanz) plus die vom Admin gepflegten eigenen
// Meldungen. „Heute" = Party-Tag 06:00–05:59 (kommt schon aggregiert vom
// Server). `kind` ist nur für die Admin-Übersicht da; das Band zeigt es nicht.

export const FUNFACT_FALLBACK = { kind: 'leer', title: 'Fun Fact', text: 'Heute noch nichts getrunken – auf geht’s!' };

// Beschriftung der Herkunft in der Admin-Übersicht
export const FACT_KIND_LABEL = {
  rekord: 'Rekord',
  eigene: 'Eigene',
  heute: 'Heute',
  statistik: 'Statistik',
  moment: 'Moment',
  bilanz: 'Bilanz',
  leer: 'Platzhalter',
};

// Nie eine leere Liste: das Band braucht immer etwas zum Anzeigen.
export function factList(players, records, customFacts, funStats) {
  const list = computeFacts(players ?? [], records, customFacts, funStats);
  return list.length ? list : [FUNFACT_FALLBACK];
}

function leaderBy(players, key) {
  let best = null;
  for (const p of players) {
    const v = p[key] || 0;
    if (v > 0 && (!best || v > (best[key] || 0))) best = p;
  }
  return best;
}

// Pausenlänge in Worten: ab zwei Monaten in Monaten, sonst in Tagen
function fmtGap(days) {
  if (days >= 60) return `${Math.round(days / 30)} Monaten`;
  return days === 1 ? 'einem Tag' : `${days} Tagen`;
}

// Wortform für Meilensteine: 'Max steht jetzt bei 100 Bier insgesamt'
const MILESTONE_WORDS = { beer: 'Bier', shot: 'Shots', mix: 'Mischen', total: 'Getränken' };

// '2026-09-25' -> '25.09.2026'
export function fmtDay(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function computeFacts(players, records, customFacts, funStats) {
  const out = [];
  // kind = Herkunft der Meldung; das TV-Band zeigt sie nicht, die
  // Admin-Übersicht gruppiert danach (D-043).
  let kind = 'rekord';
  const fact = (text) => out.push({ kind, title: 'Fun Fact', text });

  // All-Time-Rekorde: meiste Getränke an einem einzelnen Abend, schön formuliert
  if (records) {
    if (records.beer) fact(`Bier-Rekord: Die meisten Biere an einem Abend hat ${records.beer.name} am ${fmtDay(records.beer.day)} geschafft – ganze ${records.beer.n} Stück.`);
    if (records.shot) fact(`Shot-Rekord: ${records.shot.name} kippte am ${fmtDay(records.shot.day)} sagenhafte ${records.shot.n} Shots an einem Abend.`);
    if (records.mix) fact(`Mische-Rekord: ${records.mix.name} mixte am ${fmtDay(records.mix.day)} ${records.mix.n} Mischgetränke an einem Abend.`);
  }

  // Eigene Meldungen aus dem Admin (mit eigenem Titel)
  for (const f of customFacts ?? []) out.push({ kind: 'eigene', title: f.title, text: f.text });

  // Tages-Bestleistungen (heute)
  kind = 'heute';
  const b = leaderBy(players, 'beersToday');
  if (b) fact(`Bier-König des Abends: ${b.name} mit ${b.beersToday} Bier.`);
  const s = leaderBy(players, 'shotsToday');
  if (s) fact(`Shot-Meister des Abends: ${s.name} mit ${s.shotsToday} Shots.`);
  const m = leaderBy(players, 'mixesToday');
  if (m) fact(`Misch-Meister des Abends: ${m.name} mit ${m.mixesToday} Mischen.`);
  let top = null, topN = 0;
  for (const p of players) {
    const n = (p.beersToday || 0) + (p.shotsToday || 0) + (p.mixesToday || 0);
    if (n > topN) { topN = n; top = p; }
  }
  if (top) fact(`Fleißigster heute: ${top.name} mit ${topN} Getränken.`);

  // Statistik-Facts aus dem Archiv (Server: funStats); erst zeigen, wenn die
  // Zahlen etwas hergeben, damit das Band nicht mit Banalem langweilt.
  const fs = funStats ?? {};
  kind = 'statistik';
  if (fs.firstToday) {
    const t = new Date(fs.firstToday.ts);
    const hm = `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`;
    fact(`Frühstart: Das erste Getränk heute ging um ${hm} Uhr an ${fs.firstToday.name}.`);
  }
  if (fs.topHourToday && fs.topHourToday.n >= 3) {
    fact(`Durstigste Stunde heute: zwischen ${fs.topHourToday.hour} und ${(fs.topHourToday.hour + 1) % 24} Uhr – ${fs.topHourToday.n} Getränke.`);
  }
  if (fs.recordNight && fs.nights >= 2) {
    fact(`Rekord-Abend: Am ${fmtDay(fs.recordNight.day)} flossen zusammen ${fs.recordNight.total} Getränke.`);
  }
  if (fs.pace && fs.pace.onPace && fs.pace.todayTotal >= 3) {
    fact(`Rekordkurs: Schon ${fs.pace.todayTotal} Getränke heute – der Rekord-Abend vom ${fmtDay(fs.pace.recordDay)} (${fs.pace.recordTotal} gesamt) stand nach der gleichen Zeit erst bei ${fs.pace.recordAtSameTime}.`);
  }
  if (fs.regular && fs.regular.nights >= 3) {
    fact(`Stammgast: ${fs.regular.name} war schon an ${fs.regular.nights} Abenden dabei.`);
  }
  if (fs.topWinner && fs.topWinner.wins >= 2) {
    fact(`Seriensieger: ${fs.topWinner.name} hat schon ${fs.topWinner.wins} Abende gewonnen.`);
  }
  // Momente des Abends (D-036): Rückkehr, runde Marken, Führungswechsel
  kind = 'moment';
  if (fs.comeback) {
    fact(`Comeback: ${fs.comeback.name} ist nach ${fmtGap(fs.comeback.days)} wieder dabei – zuletzt am ${fmtDay(fs.comeback.lastDay)}.`);
  }
  if (fs.milestone) {
    const word = MILESTONE_WORDS[fs.milestone.kind] ?? 'Getränken';
    fact(`Runde Sache: ${fs.milestone.name} steht jetzt bei ${fs.milestone.n} ${word} insgesamt.`);
  }
  if (fs.houseMilestone) {
    fact(`Hausmarke: Hier wurden insgesamt schon ${fs.houseMilestone.total} Getränke gezählt.`);
  }
  if (fs.newLeader) {
    fact(`Neu an der Spitze: ${fs.newLeader.name} hat ${fs.newLeader.previous} in der All-Time-Liste überholt.`);
  }

  kind = 'bilanz';
  if (fs.nights >= 2) {
    const beers = players.reduce((sum, p) => sum + (p.beers || 0), 0);
    const shots = players.reduce((sum, p) => sum + (p.shots || 0), 0);
    const mixes = players.reduce((sum, p) => sum + (p.mixes || 0), 0);
    fact(`Gesamtbilanz: ${beers} Bier, ${shots} Shots und ${mixes} Mischen in ${fs.nights} Abenden.`);
  }
  return out;
}
