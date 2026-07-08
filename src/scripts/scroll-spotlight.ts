/**
 * Scroll spotlight - the touch-device counterpart of the fine-pointer
 * glow system. Hover doesn't exist under a thumb, so the scroll position
 * becomes the cursor: as each [data-glow] card crosses the viewport
 * center it lights up (border ring + interior sheen via the same
 * pseudo-elements, opacity driven by --spot), the light sweeps
 * diagonally across it in step with its travel, and the card lifts a
 * touch. Loaded from Base.astro only for coarse pointers with motion
 * allowed; the CSS lives behind the matching media query in global.css.
 *
 * Same self-suspending rAF pattern as pointer.ts: wakes on scroll or
 * resize, sleeps half a second after the page settles.
 */

const IDLE_FRAMES = 30;
const CENTER = 0.46; // spotlight focus, slightly above center = thumb zone
const FALLOFF = 2.4;

export function initScrollSpotlight(): void {
  const cards = Array.from(
    document.querySelectorAll<HTMLElement>("[data-glow]"),
  );
  if (!cards.length) return;

  let raf: number | null = null;
  let idle = 0;
  let lastY = -1;

  function wake(): void {
    idle = 0;
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  addEventListener("scroll", wake, { passive: true });
  addEventListener("resize", wake, { passive: true });

  function tick(): void {
    const vh = innerHeight;

    for (const el of cards) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -120 || r.top > vh + 120) {
        if (el.style.getPropertyValue("--spot")) {
          el.style.setProperty("--spot", "0");
        }
        continue;
      }

      // 0 at the top edge of the viewport, 1 at the bottom.
      const pos = (r.top + r.height / 2) / vh;
      const linear = Math.max(0, 1 - Math.abs(pos - CENTER) * FALLOFF);
      const spot = linear * linear * (3 - 2 * linear); // smoothstep

      // The light enters low as the card rises from the fold and exits
      // high - a diagonal sweep tied to the card's own travel.
      el.style.setProperty("--spot", spot.toFixed(3));
      el.style.setProperty("--mx", `${(r.width * (1.05 - pos * 0.85)).toFixed(1)}px`);
      el.style.setProperty("--my", `${(r.height * (pos * 1.1 - 0.05)).toFixed(1)}px`);
    }

    const moved = scrollY !== lastY;
    lastY = scrollY;
    idle = moved ? 0 : idle + 1;

    if (idle < IDLE_FRAMES) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }

  wake();
}
