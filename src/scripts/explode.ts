/**
 * The turbo-scroll easter egg's payoff: after the deck has been held at
 * maximum wheel speed for three seconds (see carousel.ts), the whole site
 * "explodes" - a flash and debris burst from the centre of the screen, every
 * visible piece of the page is flung outward and tumbles away. Then, after a
 * beat of empty page, everything quietly fades back into place by itself -
 * no dialog, no button, the joke just resets.
 *
 * Pure DOM + CSS (styles in the "turbo-scroll easter egg" section of
 * global.css). The scattered elements just get an inline transform/opacity
 * with a transition, so rebuilding is clearing those styles and letting each
 * piece fade home - no layout is ever actually destroyed, and the carousel's
 * own state (scroll position, active card) survives untouched.
 *
 * Loaded lazily by carousel.ts only at the moment of detonation, so regular
 * visitors never download it.
 */

// Everything worth flinging: the hero's pieces, the deck heading, every card
// (clones included - they're visible in the coverflow), the arrows and dots,
// and the floating theme toggle (the only `.fixed` child of body).
const SCATTER_SELECTOR = [
  ".hero-content > img",
  ".hero-content > div > *",
  "#work-heading",
  ".deck-slide",
  ".deck-nav-btn",
  ".deck-dot",
  "body > .fixed",
].join(", ");

const DEBRIS_COUNT = 26;
const FLING_MS = 900; // how long pieces take to leave the screen
const EMPTY_MS = 1100; // beat of bare page before the fade-back starts
const FADE_MS = 700; // the fade-back itself

let active = false;

export function explodeSite(onRebuilt: () => void): void {
  if (active) return;
  active = true;

  const root = document.documentElement;
  root.classList.add("is-exploded"); // locks page scroll while pieces fly

  const pieces = Array.from(
    document.querySelectorAll<HTMLElement>(SCATTER_SELECTOR),
  );
  // Snapshot inline styles so rebuild can restore exactly what was there
  // (slides normally carry none, but the theme toggle etc. must be safe).
  const saved = pieces.map((el) => el.getAttribute("style"));

  // Flash + debris overlay, bursting from the centre of the viewport.
  const overlay = document.createElement("div");
  overlay.className = "boom-overlay";
  overlay.setAttribute("aria-hidden", "true");
  const flash = document.createElement("div");
  flash.className = "boom-flash";
  overlay.appendChild(flash);
  for (let i = 0; i < DEBRIS_COUNT; i++) {
    const bit = document.createElement("span");
    bit.className = "boom-bit";
    const angle = Math.random() * Math.PI * 2;
    const dist = 30 + Math.random() * 55;
    bit.style.setProperty("--bx", `${(Math.cos(angle) * dist).toFixed(1)}vmax`);
    bit.style.setProperty("--by", `${(Math.sin(angle) * dist).toFixed(1)}vmax`);
    bit.style.setProperty("--bd", `${Math.round(Math.random() * 120)}ms`);
    bit.style.setProperty("--bs", (0.5 + Math.random()).toFixed(2));
    overlay.appendChild(bit);
  }
  document.body.appendChild(overlay);
  document.body.classList.add("boom-shake");

  // Fling every piece outward along its line from the viewport centre, with
  // some spin, some shrink, and a downward bias so it reads as gravity.
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const throwBase = window.innerWidth + window.innerHeight;
  for (const el of pieces) {
    const r = el.getBoundingClientRect();
    const ox = r.left + r.width / 2 - cx;
    const oy = r.top + r.height / 2 - cy;
    const len = Math.hypot(ox, oy) || 1;
    const throwDist = throwBase * (0.7 + Math.random() * 0.6);
    const dx = (ox / len) * throwDist + (Math.random() - 0.5) * 200;
    const dy = (oy / len) * throwDist + (Math.random() - 0.5) * 200 + 220;
    const rot = ((Math.random() - 0.5) * 720).toFixed(0);
    const scale = (0.4 + Math.random() * 0.4).toFixed(2);
    el.style.transition = `transform ${FLING_MS}ms cubic-bezier(0.3, 0, 0.9, 0.4), opacity ${FLING_MS}ms ease-in`;
    el.style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px) rotate(${rot}deg) scale(${scale})`;
    el.style.opacity = "0";
    el.style.pointerEvents = "none";
  }

  window.setTimeout(() => {
    document.body.classList.remove("boom-shake");
  }, 700);

  // After a beat of empty page, fade everything back where it was: transforms
  // clear instantly (the pieces are invisible, so no visible jump) and only
  // opacity animates, with a light stagger so the page reassembles softly.
  window.setTimeout(rebuild, FLING_MS + EMPTY_MS);

  function rebuild(): void {
    overlay.remove();
    document.body.classList.remove("boom-shake");

    for (const el of pieces) {
      el.style.transition = `opacity ${FADE_MS}ms ease ${Math.round(Math.random() * 250)}ms`;
      el.style.transform = "";
      el.style.opacity = "";
      el.style.pointerEvents = "";
    }
    window.setTimeout(() => {
      pieces.forEach((el, i) => {
        const s = saved[i];
        if (s === null) el.removeAttribute("style");
        else el.setAttribute("style", s);
      });
      root.classList.remove("is-exploded");
      active = false;
      onRebuilt();
    }, FADE_MS + 300);
  }
}
