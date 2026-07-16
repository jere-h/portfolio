/**
 * FIFA-style coverflow carousel.
 *
 * The horizontal row itself is a native CSS scroll-snap container (see the
 * .fifa-* rules in global.css) - so swipe, trackpad, and keyboard scrolling
 * all work with zero JS, and no-JS visitors still get a scrollable deck.
 *
 * This module layers the "pack" feel on top:
 *   - coverflow transform: the card nearest the centre sits flat and full
 *     size; neighbours scale down, dim, and rotate away in 3D (the "cards
 *     rotate as you swipe" effect), recomputed each frame while scrolling.
 *   - active tracking drives the dot indicators, the prev/next buttons'
 *     disabled state, and per-slide aria-current.
 *   - drag-to-scroll for mouse users (touch already drags natively).
 *   - prev / next buttons, dot buttons, and Arrow/Home/End keys, all of
 *     which snap a chosen card to centre.
 *
 * One self-suspending rAF loop, same pattern as pointer.ts: it wakes on
 * scroll / drag / resize and sleeps ~half a second after the deck settles,
 * so an idle page costs nothing.
 *
 * Reduced-motion visitors keep the plain snap deck: no coverflow transform,
 * no smooth scroll - the script guards every motion path.
 */

const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IDLE_FRAMES = 30;

export function initCarousel(): void {
  document
    .querySelectorAll<HTMLElement>("[data-carousel]")
    .forEach((root) => setupCarousel(root));
}

function setupCarousel(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>("[data-carousel-track]");
  if (!track) return;

  const slides = Array.from(
    track.querySelectorAll<HTMLElement>("[data-slide]"),
  );
  if (!slides.length) return;

  const inners = slides.map(
    (s) => s.querySelector<HTMLElement>("[data-slide-inner]") ?? s,
  );
  const prevBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-carousel-prev]"),
  );
  const nextBtns = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-carousel-next]"),
  );
  const dots = Array.from(
    root.querySelectorAll<HTMLButtonElement>("[data-dot]"),
  );

  let raf: number | null = null;
  let idle = 0;
  let lastLeft = -1;
  let active = -1;

  function wake(): void {
    idle = 0;
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  // Centre-to-centre distance between neighbouring slides, in px. Read live so
  // it stays right across responsive width / font changes.
  function unitPx(): number {
    return slides.length > 1
      ? slides[1].offsetLeft - slides[0].offsetLeft
      : slides[0].offsetWidth || 1;
  }

  function tick(): void {
    const rect = track.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    const unit = unitPx();

    let best = 0;
    let bestDist = Infinity;

    for (let i = 0; i < slides.length; i++) {
      const r = slides[i].getBoundingClientRect();
      const delta = r.left + r.width / 2 - centre;
      if (Math.abs(delta) < bestDist) {
        bestDist = Math.abs(delta);
        best = i;
      }

      if (!REDUCE) {
        // Distance from centre, in card-widths, capped so far cards don't
        // collapse to nothing.
        const d = delta / unit;
        const ad = Math.min(Math.abs(d), 2.4);
        const scale = 1 - ad * 0.085; // centre 1.0 -> ~0.8 at the far edges
        const rot = Math.max(-46, Math.min(46, -d * 20)); // rotate toward centre
        const opacity = Math.max(0.4, 1 - ad * 0.32);
        const el = inners[i];
        el.style.transform = `perspective(1400px) rotateY(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
        el.style.opacity = opacity.toFixed(3);
        el.style.zIndex = String(100 - Math.round(ad * 10));
      }
    }

    if (best !== active) setActive(best);

    const moved = track.scrollLeft !== lastLeft;
    lastLeft = track.scrollLeft;
    idle = moved ? 0 : idle + 1;

    if (idle < IDLE_FRAMES) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  function setActive(i: number): void {
    active = i;
    for (let k = 0; k < slides.length; k++) {
      const on = k === i;
      slides[k].classList.toggle("is-active", on);
      if (on) slides[k].setAttribute("aria-current", "true");
      else slides[k].removeAttribute("aria-current");
    }
    for (let k = 0; k < dots.length; k++) {
      dots[k].classList.toggle("is-active", k === i);
    }
    const atStart = i <= 0;
    const atEnd = i >= slides.length - 1;
    prevBtns.forEach((b) => (b.disabled = atStart));
    nextBtns.forEach((b) => (b.disabled = atEnd));
  }

  function goTo(i: number): void {
    const idx = Math.max(0, Math.min(slides.length - 1, i));
    slides[idx].scrollIntoView({
      behavior: REDUCE ? "auto" : "smooth",
      inline: "center",
      block: "nearest",
    });
    wake();
  }

  // --- navigation controls -------------------------------------------------
  prevBtns.forEach((b) =>
    b.addEventListener("click", () => goTo(active - 1)),
  );
  nextBtns.forEach((b) =>
    b.addEventListener("click", () => goTo(active + 1)),
  );
  dots.forEach((dot, i) => dot.addEventListener("click", () => goTo(i)));

  // Keyboard: the track is focusable, arrows step one card.
  track.tabIndex = 0;
  track.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        goTo(active - 1);
        break;
      case "ArrowRight":
        e.preventDefault();
        goTo(active + 1);
        break;
      case "Home":
        e.preventDefault();
        goTo(0);
        break;
      case "End":
        e.preventDefault();
        goTo(slides.length - 1);
        break;
    }
  });

  // Tabbing to a link inside an off-centre card pulls that card to centre.
  slides.forEach((slide, i) => {
    slide.addEventListener("focusin", () => {
      if (i !== active) goTo(i);
    });
  });

  // --- drag-to-scroll (mouse only; touch drags the scroller natively) ------
  let dragging = false;
  let startX = 0;
  let startLeft = 0;
  let travelled = 0;

  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    dragging = true;
    travelled = 0;
    startX = e.clientX;
    startLeft = track.scrollLeft;
    // Free-drag: turn mandatory snap off so scrollLeft isn't fought, restore
    // it (and snap to the nearest card) on release.
    track.style.scrollSnapType = "none";
    track.classList.add("is-dragging");
    track.setPointerCapture(e.pointerId);
  });

  track.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    travelled = Math.max(travelled, Math.abs(dx));
    track.scrollLeft = startLeft - dx;
    wake();
  });

  function endDrag(e: PointerEvent): void {
    if (!dragging) return;
    dragging = false;
    track.classList.remove("is-dragging");
    track.style.scrollSnapType = "";
    try {
      track.releasePointerCapture(e.pointerId);
    } catch {
      /* pointer already released */
    }
    goTo(active); // settle onto the nearest card
  }

  track.addEventListener("pointerup", endDrag);
  track.addEventListener("pointercancel", endDrag);

  // Suppress the click that ends a real drag so a drag never fires a link.
  track.addEventListener(
    "click",
    (e) => {
      if (travelled > 6) {
        e.preventDefault();
        e.stopPropagation();
        travelled = 0;
      }
    },
    true,
  );

  // --- wake sources --------------------------------------------------------
  track.addEventListener("scroll", wake, { passive: true });
  window.addEventListener("resize", wake, { passive: true });

  // First paint, then again after fonts/layout settle so the opening frame
  // already shows the centre card flat and its neighbours turned away.
  wake();
  requestAnimationFrame(() => requestAnimationFrame(wake));
}
