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
 *   - turbo wheel: a desktop scroll wheel drives the deck sideways, ramping
 *     faster the longer it spins - hold max speed for three seconds and the
 *     site explodes (the easter egg lives in explode.ts).
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

// Turbo wheel tuning (see the wheel section in setupCarousel).
const TURBO_MAX = 9; // top ramp multiplier
// A pause longer than this resets the ramp. Generous on purpose: spinning
// a physical wheel hard means flick - regrip - flick, with 200-500ms
// between flicks, and those must all read as one sustained gesture.
const TURBO_GAP_MS = 600;
const TURBO_SETTLE_MS = 450; // wheel quiet this long -> snap to a card
const TURBO_HOLD_MS = 3000; // time pinned at max before the site gives up
const TURBO_GAIN = 0.35; // wheel px -> velocity bump
// Speed is bounded by a cap that GROWS with the ramp, from FLOOR (a relaxed
// one-notch pace) up to VEL_MAX (~11000px/s - several viewport widths per
// second). Tying the cap to the ramp is what makes the acceleration visible:
// sustained spinning always saturates the cap, so if the cap were flat the
// deck would hit terminal velocity on the second notch and the whole ramp
// would be imperceptible.
const TURBO_VEL_MAX = 185; // px per 60fps-frame at full ramp
const TURBO_VEL_FLOOR = 60; // px per 60fps-frame cap at 1x
const TURBO_FRICTION = 0.92; // per-frame decay -> ~1s coast after release

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
  let lastTick = 0; // rAF timestamp of the previous frame (0 = loop was asleep)
  let activeSlide = -1;
  let current = base; // logical centred slide index (drives navigation)
  let dragging = false;
  let turboVel = 0; // turbo-wheel velocity, px per 60fps-frame (see below)

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

  // Slide midpoints and track width in scroll coordinates, cached so the
  // per-frame work below never queries layout (27 getBoundingClientRect
  // calls per frame forced a reflow mid-scroll and read as jank). The
  // coverflow transforms never affect layout, so these only change on
  // resize; card widths are fixed by CSS, so image loads don't move them.
  let slideMid: number[] = [];
  let slideUnit = 1;
  let trackW = 0;
  let bandW = 0; // width of one full deck of cards - the invisible-jump unit
  let bandHome = 0; // scroll offset that centres the first real slide
  function cacheGeometry(): void {
    slideMid = slides.map((s) => s.offsetLeft + s.offsetWidth / 2);
    slideUnit =
      slides.length > 1
        ? Math.abs(slideMid[1] - slideMid[0])
        : slides[0].offsetWidth || 1;
    trackW = track.clientWidth;
    if (LOOP) {
      bandW = slideMid[base + n] - slideMid[base];
      bandHome = centreOffset(base);
    }
  }
  cacheGeometry();

  function nearestIndex(): number {
    const centre = track.scrollLeft + trackW / 2;
    let best = 0;
    let bestDist = Infinity;
    for (let i = 0; i < slideMid.length; i++) {
      const dist = Math.abs(slideMid[i] - centre);
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
    const centre = track.scrollLeft + trackW / 2;

    // Speed styling: as turbo velocity climbs, the 3D rotation flattens out
    // and the cards stretch and shear along the direction of travel - the
    // classic motion-streak cue. This is what makes "too fast" *look* too
    // fast, and it costs nothing: the same transform string was being
    // written every frame anyway.
    const speed = Math.min(1, Math.abs(turboVel) / TURBO_VEL_MAX);
    const flat = 1 - 0.75 * speed;
    const stretch = (1 + 0.22 * speed).toFixed(3);
    const skew = Math.max(-8, Math.min(8, -turboVel * 0.045)).toFixed(2);

    for (let i = 0; i < slides.length; i++) {
      const d = (slideMid[i] - centre) / slideUnit;
      const ad = Math.min(Math.abs(d), 2.4);
      const scale = 1 - ad * 0.085; // centre 1.0 -> ~0.8 at the far edges
      const rot = Math.max(-46, Math.min(46, -d * 20)) * flat;
      // Dim the wings less at speed so passing cards don't strobe.
      const opacity = Math.max(0.4, 1 - ad * 0.32 * (1 - 0.5 * speed));
      const el = inners[i];
      el.style.transform = `perspective(1400px) rotateY(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)}) scaleX(${stretch}) skewX(${skew}deg)`;
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

  // Advance the turbo-wheel glide by one frame: move by the current velocity
  // (frame-rate normalised - `dt` is in 60fps-frame units so a 144Hz screen
  // isn't 2.4x faster), wrap back into the middle clone band whenever the
  // flight crosses it, and bleed the velocity off with friction. Moving the
  // deck here, in the same frame that recomputes the coverflow, is what keeps
  // fast scrolling smooth: wheel events only ever adjust the velocity.
  function turboStep(dt: number): void {
    if (turboVel === 0) return;
    track.scrollLeft += turboVel * dt;
    if (LOOP) {
      while (track.scrollLeft > bandHome + bandW / 2)
        track.scrollLeft -= bandW;
      while (track.scrollLeft < bandHome - bandW / 2)
        track.scrollLeft += bandW;
    }
    turboVel *= Math.pow(TURBO_FRICTION, dt);
    if (Math.abs(turboVel) < 0.4) turboVel = 0;
  }

  function tick(now: number): void {
    // Frames vary (display refresh, jank, waking from sleep); clamp so a
    // long gap can never turn into one giant position jump.
    const dt = lastTick ? Math.min(3, (now - lastTick) / (1000 / 60)) : 1;
    lastTick = now;
    turboStep(dt);

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
      lastTick = 0;
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

  // --- turbo wheel (desktop) + easter egg ----------------------------------
  // A wheel over the deck scrolls the cards sideways, and keeping the wheel
  // spinning ramps the speed higher and higher. Pin it at the ceiling for
  // three full seconds and the site explodes (see explode.ts). Pausing for a
  // beat drops the ramp back to 1x, so casual scrolling stays calm.
  //
  // Wheel events never move the deck directly - a notch teleporting the
  // scroll position hundreds of px between paints reads as chop, and at top
  // speed outruns the compositor's rasterised tiles (cards blink out into
  // blank checkerboard). Instead each notch feeds a velocity, capped at
  // TURBO_VEL_MAX, and turboStep() in the rAF loop integrates it every frame
  // with a friction glide - continuous motion the compositor can keep painted.
  //
  // Skipped under reduced motion (the deck keeps native scrolling) and for
  // single-card decks (nothing to race through). Tuning constants live at
  // the top of this module.
  if (!REDUCE && LOOP) {
    let boost = 1;
    let lastWheel = 0;
    let maxSince = 0; // timestamp the ramp first hit TURBO_MAX (0 = not at max)
    let settleTimer = 0;
    let exploding = false;

    // Wheel gone quiet: once the glide has bled off too, re-enable snap and
    // settle onto the nearest card, same as the end of a drag. Deliberately
    // does NOT reset the ramp - whether the pause was long enough to lose
    // the boost is judged by the gap check on the next wheel event, so one
    // threshold owns that call.
    const settleWheel = () => {
      if (turboVel !== 0) {
        // Still gliding - a smooth scrollTo now would fight turboStep's
        // per-frame writes and stutter. Check back shortly.
        settleTimer = window.setTimeout(settleWheel, 120);
        return;
      }
      root.classList.remove("is-redline");
      track.style.scrollSnapType = "";
      current = nearestIndex();
      scrollToIndex(current);
    };

    track.addEventListener(
      "wheel",
      (e) => {
        if (exploding || dragging) return;
        const raw =
          Math.abs(e.deltaY) >= Math.abs(e.deltaX) ? e.deltaY : e.deltaX;
        if (!raw) return;
        e.preventDefault();
        // Normalise line/page deltas (Firefox) to pixels.
        const px =
          e.deltaMode === 1
            ? raw * 16
            : e.deltaMode === 2
              ? raw * track.clientWidth
              : raw;

        const now = performance.now();
        if (now - lastWheel > TURBO_GAP_MS) {
          boost = 1;
          maxSince = 0;
        } else {
          boost = Math.min(TURBO_MAX, boost * 1.09 + 0.15);
        }
        lastWheel = now;

        // turboStep's direct scrollLeft writes fight mandatory snap -
        // disable it for the gesture, exactly like drag, restore on settle.
        track.style.scrollSnapType = "none";
        // The cap climbs with the ramp (see TURBO_VEL_MAX) so the deck
        // audibly shifts gears the longer the wheel keeps spinning.
        const velCap = Math.max(
          TURBO_VEL_FLOOR,
          (boost / TURBO_MAX) * TURBO_VEL_MAX,
        );
        turboVel = Math.max(
          -velCap,
          Math.min(velCap, turboVel + px * boost * TURBO_GAIN),
        );

        if (boost >= TURBO_MAX) {
          if (!maxSince) maxSince = now;
          root.classList.add("is-redline");
          if (now - maxSince >= TURBO_HOLD_MS) {
            exploding = true;
            clearTimeout(settleTimer);
            root.classList.remove("is-redline");
            track.style.scrollSnapType = "";
            boost = 1;
            maxSince = 0;
            turboVel = 0; // freeze the deck for the blast
            import("./explode").then((m) =>
              m.explodeSite(() => {
                exploding = false;
              }),
            );
          }
        } else {
          maxSince = 0;
          root.classList.remove("is-redline");
        }

        clearTimeout(settleTimer);
        settleTimer = window.setTimeout(settleWheel, TURBO_SETTLE_MS);
        wake();
      },
      { passive: false },
    );
  }

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
    cacheGeometry();
    track.scrollLeft = centreOffset(current);
    wake();
  });

  // Open already flanked by cards: centre the first real slide, no page jump.
  if (LOOP) track.scrollLeft = centreOffset(base);

  wake();
  requestAnimationFrame(() => requestAnimationFrame(wake));
}
