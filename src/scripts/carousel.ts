/**
 * Coverflow card carousel - an endless, swipeable deck of project cards,
 * styled like a pack of collectible trading cards, running the full width
 * of the page.
 *
 * The row is a native CSS scroll-snap container (see the .deck-* rules in
 * global.css), so swipe, trackpad, and keyboard scrolling all work with zero
 * JS, and no-JS visitors still get a scrollable deck.
 *
 * This module layers the "pack" feel on top:
 *   - infinite loop: the real slides are flanked by a full clone of the deck
 *     on each side, and whenever the scroll settles the position is re-centred
 *     into the middle band by whole-deck jumps. Because every band is
 *     identical the jump is invisible - the deck just never runs out, so the
 *     opening frame is already flanked by cards instead of empty space.
 *   - coverflow: the card nearest the centre sits flat and full size; its
 *     neighbours scale down, dim, and rotate away in 3D, recomputed each
 *     frame while scrolling.
 *   - a logical `current` index drives the buttons / dots / keyboard so rapid
 *     input accumulates cleanly instead of fighting the scroll animation.
 *   - drag-to-scroll for mouse users (touch drags natively).
 *
 * One self-suspending rAF loop, same pattern as pointer.ts: it wakes on
 * scroll / drag / resize and sleeps ~half a second after the deck settles.
 *
 * Reduced-motion visitors keep the plain snap deck: no coverflow transform
 * and no smooth auto-scroll (the loop still applies, as its jumps are
 * instant, not animated).
 */

const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const IDLE_FRAMES = 30;
const SETTLE_FRAMES = 3; // frames of stillness before a loop re-centre jump

export function initCarousel(): void {
  document
    .querySelectorAll<HTMLElement>("[data-carousel]")
    .forEach((root) => setupCarousel(root));
}

function cloneForLoop(slide: HTMLElement): HTMLElement {
  const c = slide.cloneNode(true) as HTMLElement;
  c.setAttribute("data-clone", "");
  c.setAttribute("aria-hidden", "true");
  c.removeAttribute("aria-label");
  c.removeAttribute("aria-roledescription");
  // Keep clones out of the tab order (they stay mouse-clickable, with the
  // same hrefs, so a click on a peeking card still works).
  c.querySelectorAll<HTMLElement>("a, button, [tabindex]").forEach((el) =>
    el.setAttribute("tabindex", "-1"),
  );
  return c;
}

function setupCarousel(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>("[data-carousel-track]");
  if (!track) return;

  const realSlides = Array.from(
    track.querySelectorAll<HTMLElement>("[data-slide]"),
  );
  const n = realSlides.length;
  if (!n) return;

  const LOOP = n > 1;
  // Flank the real deck with a full clone on each side: [clones][real][clones].
  if (LOOP) {
    const head = document.createDocumentFragment();
    const tail = document.createDocumentFragment();
    for (const s of realSlides) head.appendChild(cloneForLoop(s));
    for (const s of realSlides) tail.appendChild(cloneForLoop(s));
    track.insertBefore(head, realSlides[0]);
    track.appendChild(tail);
  }

  const slides = Array.from(
    track.querySelectorAll<HTMLElement>("[data-slide]"),
  );
  const inners = slides.map(
    (s) => s.querySelector<HTMLElement>("[data-slide-inner]") ?? s,
  );
  const base = LOOP ? n : 0; // index of the first real slide within `slides`
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
  let activeSlide = -1;
  let current = base; // logical centred slide index (drives navigation)
  let dragging = false;

  function wake(): void {
    idle = 0;
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  // Scroll offset that centres slide i in the viewport.
  function centreOffset(i: number): number {
    const max = track.scrollWidth - track.clientWidth;
    const left =
      slides[i].offsetLeft - (track.clientWidth - slides[i].offsetWidth) / 2;
    return Math.max(0, Math.min(max, left));
  }

  function nearestIndex(): number {
    const rect = track.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < slides.length; i++) {
      const r = slides[i].getBoundingClientRect();
      const dist = Math.abs(r.left + r.width / 2 - centre);
      if (dist < bestDist) {
        bestDist = dist;
        best = i;
      }
    }
    return best;
  }

  function realIndexOf(i: number): number {
    return LOOP ? (((i - base) % n) + n) % n : i;
  }

  // Jump `current` (and the scroll position) back into the real middle band
  // by a whole number of decks. Identical content, so it's invisible.
  function recentre(): void {
    if (!LOOP) return;
    const wrapped = base + realIndexOf(current);
    if (wrapped !== current) {
      track.scrollLeft += slides[wrapped].offsetLeft - slides[current].offsetLeft;
      current = wrapped;
      lastLeft = track.scrollLeft;
    }
  }

  function applyCoverflow(): void {
    if (REDUCE) return;
    const rect = track.getBoundingClientRect();
    const centre = rect.left + rect.width / 2;
    const unit =
      slides.length > 1
        ? Math.abs(slides[1].offsetLeft - slides[0].offsetLeft)
        : slides[0].offsetWidth || 1;

    for (let i = 0; i < slides.length; i++) {
      const r = slides[i].getBoundingClientRect();
      const d = (r.left + r.width / 2 - centre) / unit;
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

  function setActive(best: number): void {
    if (best === activeSlide) return;
    if (activeSlide >= 0) slides[activeSlide]?.classList.remove("is-active");
    slides[best].classList.add("is-active");
    activeSlide = best;

    const real = realIndexOf(best);
    for (let k = 0; k < dots.length; k++) {
      dots[k].classList.toggle("is-active", k === real);
    }
    for (let k = 0; k < slides.length; k++) {
      if (slides[k].hasAttribute("data-clone")) continue;
      if (k === best) slides[k].setAttribute("aria-current", "true");
      else slides[k].removeAttribute("aria-current");
    }
  }

  function tick(): void {
    const best = nearestIndex();
    applyCoverflow();
    setActive(best);

    const moved = track.scrollLeft !== lastLeft;
    lastLeft = track.scrollLeft;
    idle = moved ? 0 : idle + 1;

    // Fully settled: adopt whatever a free scroll / drag landed on, then
    // re-centre into the middle band so the clone buffer is refilled on both
    // sides for the next fling. Waiting SETTLE_FRAMES keeps this from firing
    // mid-animation (which would cancel a smooth scroll).
    if (LOOP && !dragging && idle === SETTLE_FRAMES) {
      current = best;
      recentre();
    }

    if (idle < IDLE_FRAMES) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  function scrollToIndex(i: number): void {
    track.scrollTo({
      left: centreOffset(i),
      behavior: REDUCE ? "auto" : "smooth",
    });
    wake();
  }

  // Step relative to the logical centre. recentre() first so a step never
  // runs off the clone buffer, then move one card and let the loop settle.
  function step(dir: number): void {
    recentre();
    current += dir;
    scrollToIndex(current);
  }

  function goToReal(j: number): void {
    recentre();
    current = base + j;
    scrollToIndex(current);
  }

  // --- navigation controls -------------------------------------------------
  prevBtns.forEach((b) => b.addEventListener("click", () => step(-1)));
  nextBtns.forEach((b) => b.addEventListener("click", () => step(1)));
  dots.forEach((dot, j) => dot.addEventListener("click", () => goToReal(j)));

  track.tabIndex = 0;
  track.addEventListener("keydown", (e) => {
    switch (e.key) {
      case "ArrowLeft":
        e.preventDefault();
        step(-1);
        break;
      case "ArrowRight":
        e.preventDefault();
        step(1);
        break;
      case "Home":
        e.preventDefault();
        goToReal(0);
        break;
      case "End":
        e.preventDefault();
        goToReal(n - 1);
        break;
    }
  });

  // Tabbing to a link inside an off-centre (real) card centres that card.
  realSlides.forEach((slide, i) => {
    slide.addEventListener("focusin", () => {
      if (nearestIndex() !== base + i) goToReal(i);
    });
  });

  // --- drag-to-scroll (mouse only; touch drags the scroller natively) ------
  let startX = 0;
  let startLeft = 0;
  let travelled = 0;

  track.addEventListener("pointerdown", (e) => {
    if (e.pointerType !== "mouse") return;
    // Reset per gesture so a stale value from a previous drag can never
    // suppress a later click.
    travelled = 0;
    // Never hijack a press that lands on an interactive control - links and
    // buttons must stay clickable. Capturing the pointer here would otherwise
    // redirect the follow-up click away from the anchor.
    if ((e.target as HTMLElement).closest("a, button")) return;
    dragging = true;
    startX = e.clientX;
    startLeft = track.scrollLeft;
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
    current = nearestIndex();
    scrollToIndex(current); // settle onto the nearest card
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
  window.addEventListener("resize", () => {
    // Keep the centred card centred as the layout reflows.
    track.scrollLeft = centreOffset(current);
    wake();
  });

  // Open already flanked by cards: centre the first real slide, no page jump.
  if (LOOP) track.scrollLeft = centreOffset(base);

  wake();
  requestAnimationFrame(() => requestAnimationFrame(wake));
}
