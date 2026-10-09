// Kleine Bewegungen, die mehrere Seiten teilen (D-079): Zahlen rollen,
// Fehler schütteln, Speichern abhaken, Blatt von unten mit Wischen zum
// Schließen. Alles über CSS-Klassen bzw. die eingebaute Web Animations API,
// ohne Bibliothek. Bei „Bewegung reduzieren" springt alles direkt in den
// Endzustand.

const reduceQuery = matchMedia('(prefers-reduced-motion: reduce)');
export const reduceMotion = () => reduceQuery.matches;

const EASE_OUT = 'cubic-bezier(0.2, 0.8, 0.2, 1)';
const ROLL_MS = 420;
const ROLL_STAGGER = 70;

// --- A1: Zahlen rollen ---
// Geänderte Ziffern drehen sich wie ein Zählwerk nach oben; weiter links
// stehende Stellen rollen kurz versetzt hinterher (9 → 10). Ohne
// overflow: hidden, damit das Leuchten der Zahl (text-shadow) rund bleibt:
// die alte Ziffer gleitet als ::before nach oben weg, die neue kommt von
// unten. textContent enthält dabei immer nur den neuen Wert, und nach dem
// Lauf steht wieder reiner Text im Element.
export function rollNumber(el, value) {
  const next = String(value);
  const prev = el.textContent;
  const run = (el._rollRun = (el._rollRun ?? 0) + 1);
  if (prev === next || reduceMotion() || !/^\d+$/.test(prev) || !/^\d+$/.test(next)) {
    el.textContent = next;
    return;
  }
  const len = Math.max(prev.length, next.length);
  const o = prev.padStart(len, ' ');
  const n = next.padStart(len, ' ');
  el.textContent = '';
  let last = 0;
  for (let i = 0; i < len; i++) {
    if (n[i] === ' ') continue;
    if (o[i] === n[i]) { el.append(n[i]); continue; }
    const delay = (len - 1 - i) * ROLL_STAGGER;
    last = Math.max(last, delay);
    const digit = document.createElement('span');
    digit.className = 'roll-d';
    digit.style.setProperty('--roll-delay', `${delay}ms`);
    if (o[i] !== ' ') digit.dataset.old = o[i];
    const inner = document.createElement('span');
    inner.textContent = n[i];
    digit.append(inner);
    el.append(digit);
  }
  // Danach wieder reiner Text — es sei denn, inzwischen hat jemand anderes
  // eine andere Zahl hineingeschrieben.
  setTimeout(() => { if (el._rollRun === run && el.textContent === next) el.textContent = next; }, ROLL_MS + last + 40);
}

// --- A7: Fehler schütteln, Meldung gleitet ein ---
export function shake(el) {
  if (!el || reduceMotion()) return;
  el.animate([
    { transform: 'translateX(0)' }, { transform: 'translateX(-9px)' }, { transform: 'translateX(8px)' },
    { transform: 'translateX(-5px)' }, { transform: 'translateX(3px)' }, { transform: 'translateX(0)' },
  ], { duration: 400, easing: 'ease-out' });
}

export function revealError(el) {
  if (!el || reduceMotion()) return;
  el.animate([{ opacity: 0, transform: 'translateY(-6px)' }, { opacity: 1, transform: 'none' }],
    { duration: 260, easing: 'ease-out' });
}

// --- A7: Speichern abhaken ---
// Der Knopf zeichnet einen Haken und sagt „Gespeichert"; nach `ms` steht
// wieder die alte Beschriftung da. Gibt ein Promise zurück, das nach dem
// Zeichnen des Hakens erfüllt ist — Dialoge schließen erst danach.
const CHECK_SVG = '<svg class="save-check" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
export function confirmSaved(btn, { ms = 1600, label = 'Gespeichert' } = {}) {
  if (!btn) return Promise.resolve();
  clearTimeout(btn._savedTimer);
  if (!btn.classList.contains('is-saved')) {
    btn._savedHtml = btn.innerHTML;
    btn._savedWidth = btn.style.minWidth;
    btn.style.minWidth = `${btn.offsetWidth}px`;   // Knopf springt nicht in der Breite
  }
  btn.classList.add('is-saved');
  btn.innerHTML = `${CHECK_SVG}<span>${label}</span>`;
  btn._savedTimer = setTimeout(() => {
    btn.classList.remove('is-saved');
    btn.innerHTML = btn._savedHtml;
    btn.style.minWidth = btn._savedWidth;
  }, ms);
  return new Promise((r) => setTimeout(r, reduceMotion() ? 0 : 520));
}

// --- A6: Blatt mit Schwung ---
// backdrop: das .modal-backdrop (wird per hidden ein-/ausgeblendet),
// sheet: das Blatt darin, grips: Flächen, an denen man es nach unten wischt.
// open() fährt es hoch, close() lässt es hinausgleiten; Wischen um mehr als
// 80 px (oder ein schneller Wisch) schließt, sonst federt es zurück.
export function bottomSheet({ backdrop, sheet, grips = [], onClose }) {
  let isOpen = false;
  let drag = null;

  const stop = () => {
    for (const a of [...sheet.getAnimations(), ...backdrop.getAnimations()]) a.cancel();
  };
  // Nur Abdunklung und Unschärfe des Hintergrunds blenden — nicht seine
  // Deckkraft: die wirkte aufs Blatt mit und machte es durchsichtig.
  const scrimFrames = () => {
    const cs = getComputedStyle(backdrop);
    const clear = { backgroundColor: 'transparent' };
    const full = { backgroundColor: cs.backgroundColor };
    if (cs.backdropFilter && cs.backdropFilter !== 'none') {
      clear.backdropFilter = 'blur(0px)';
      full.backdropFilter = cs.backdropFilter;
    }
    return [clear, full];
  };

  function open() {
    if (isOpen) return;
    isOpen = true;
    stop();
    sheet.style.transform = '';
    backdrop.hidden = false;
    if (reduceMotion()) return;
    backdrop.animate(scrimFrames(), { duration: 260, easing: 'ease-out' });
    sheet.animate([{ transform: 'translateY(100%)' }, { transform: 'translateY(0)' }],
      { duration: 380, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.04)' });
  }

  function close(from = 0) {
    if (!isOpen) return;
    isOpen = false;
    drag = null;
    const done = () => {
      stop();
      backdrop.hidden = true;
      sheet.style.transform = '';
      onClose?.();
    };
    if (reduceMotion()) { done(); return; }
    stop();
    backdrop.animate(scrimFrames().reverse(), { duration: 240, easing: 'ease-in', fill: 'forwards' });
    sheet.animate([{ transform: `translateY(${from}px)` }, { transform: 'translateY(100%)' }],
      { duration: 260, easing: 'cubic-bezier(0.4, 0, 0.8, 0.6)', fill: 'forwards' })
      .finished.then(done, () => {});
  }

  for (const grip of grips) {
    grip.style.touchAction = 'none';
    grip.addEventListener('pointerdown', (e) => {
      if (!isOpen || e.button > 0 || e.target.closest('button, a, input')) return;
      stop();
      drag = { y: e.clientY, dy: 0, t: performance.now() };
      grip.setPointerCapture(e.pointerId);
    });
    grip.addEventListener('pointermove', (e) => {
      if (!drag) return;
      drag.dy = Math.max(0, e.clientY - drag.y);
      sheet.style.transform = `translateY(${drag.dy}px)`;
    });
    const end = () => {
      if (!drag) return;
      const { dy, t } = drag;
      drag = null;
      const fast = dy > 30 && dy / (performance.now() - t) > 0.6;   // px pro ms
      if (dy > 80 || fast) { close(dy); return; }
      sheet.style.transform = '';
      if (dy && !reduceMotion()) {
        sheet.animate([{ transform: `translateY(${dy}px)` }, { transform: 'translateY(0)' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.9, 0.3, 1.1)' });
      }
    };
    grip.addEventListener('pointerup', end);
    grip.addEventListener('pointercancel', end);
  }

  return { open, close, get isOpen() { return isOpen; } };
}

// Zeilen einer Liste nacheinander von leicht unten einblenden (Blatt öffnen)
export function staggerIn(rows, { delay = 120, step = 28, max = 10 } = {}) {
  if (reduceMotion()) return;
  [...rows].forEach((row, i) => row.animate(
    [{ opacity: 0, transform: 'translateY(10px)' }, { opacity: 1, transform: 'none' }],
    { duration: 300, delay: delay + Math.min(i, max) * step, easing: EASE_OUT, fill: 'backwards' },
  ));
}
