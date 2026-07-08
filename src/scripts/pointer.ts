/**
 * Pointer physics - one document-level pointermove listener and one shared
 * rAF loop powering three effects:
 *
 *   [data-glow]     cards get card-relative --mx/--my custom properties every
 *                   frame, painting the cursor-tracked border glow + sheen
 *                   defined in global.css. Set on ALL in-view cards so the
 *                   light bleeds across neighboring borders.
 *   [data-tilt]     the hovered card lerps toward a small 3D tilt and
 *                   elastically settles back on leave.
 *   [data-magnetic] buttons within reach are pulled toward the cursor and
 *                   spring back when it leaves; pressing squashes them.
 *
 * Loaded from Base.astro only when (pointer: fine) and motion is allowed.
 * The loop self-suspends after ~half a second of stillness and wakes on
 * pointer or scroll activity, so idle cost is zero.
 */

const LERP = 0.16;
const TILT_MAX_DEG = 5.5;
const MAGNET_RADIUS = 110;
const MAGNET_PULL = 0.26;
const IDLE_FRAMES = 30;

interface TiltState {
  el: HTMLElement;
  rx: number;
  ry: number;
  hover: boolean;
}

interface MagnetState {
  el: HTMLElement;
  x: number;
  y: number;
  pressed: boolean;
}

export function initPointer(): void {
  const glowEls = Array.from(
    document.querySelectorAll<HTMLElement>("[data-glow]"),
  );
  const tilts: TiltState[] = Array.from(
    document.querySelectorAll<HTMLElement>("[data-tilt]"),
  ).map((el) => ({ el, rx: 0, ry: 0, hover: false }));
  const magnets: MagnetState[] = Array.from(
    document.querySelectorAll<HTMLElement>("[data-magnetic]"),
  ).map((el) => ({ el, x: 0, y: 0, pressed: false }));

  if (!glowEls.length && !tilts.length && !magnets.length) return;

  let px = -1e4;
  let py = -1e4;
  let lastPx = px;
  let lastPy = py;
  let raf: number | null = null;
  let idle = 0;

  function wake(): void {
    idle = 0;
    if (raf === null) raf = requestAnimationFrame(tick);
  }

  document.addEventListener(
    "pointermove",
    (e) => {
      px = e.clientX;
      py = e.clientY;
      wake();
    },
    { passive: true },
  );
  // Scrolling moves the cards under a stationary cursor; refresh the glow.
  document.addEventListener("scroll", wake, { passive: true, capture: true });

  for (const t of tilts) {
    t.el.addEventListener("pointerenter", () => {
      t.hover = true;
      wake();
    });
    t.el.addEventListener("pointerleave", () => {
      t.hover = false;
      wake();
    });
  }

  for (const m of magnets) {
    m.el.addEventListener("pointerdown", () => {
      m.pressed = true;
      wake();
    });
    for (const ev of ["pointerup", "pointerleave", "pointercancel"] as const) {
      m.el.addEventListener(ev, () => {
        m.pressed = false;
        wake();
      });
    }
  }

  function tick(): void {
    let settled = true;

    for (const el of glowEls) {
      const r = el.getBoundingClientRect();
      if (r.bottom < -320 || r.top > innerHeight + 320) continue;
      el.style.setProperty("--mx", `${(px - r.left).toFixed(1)}px`);
      el.style.setProperty("--my", `${(py - r.top).toFixed(1)}px`);
    }

    for (const t of tilts) {
      const r = t.el.getBoundingClientRect();
      const targetRy = t.hover
        ? ((px - (r.left + r.width / 2)) / (r.width / 2)) * TILT_MAX_DEG
        : 0;
      const targetRx = t.hover
        ? (-(py - (r.top + r.height / 2)) / (r.height / 2)) * TILT_MAX_DEG
        : 0;
      t.ry += (targetRy - t.ry) * LERP;
      t.rx += (targetRx - t.rx) * LERP;

      if (t.hover || Math.abs(t.rx) > 0.02 || Math.abs(t.ry) > 0.02) {
        settled = false;
        t.el.style.transform = `perspective(950px) rotateX(${t.rx.toFixed(3)}deg) rotateY(${t.ry.toFixed(3)}deg)`;
      } else if (t.el.style.transform) {
        t.el.style.transform = "";
      }
    }

    for (const m of magnets) {
      const r = m.el.getBoundingClientRect();
      // Rect moves with the transform; subtract the current offset to get
      // the resting center, or the pull feeds back on itself.
      const cx = r.left + r.width / 2 - m.x;
      const cy = r.top + r.height / 2 - m.y;
      const dx = px - cx;
      const dy = py - cy;
      const within = Math.hypot(dx, dy) < MAGNET_RADIUS;
      const tx = within ? dx * MAGNET_PULL : 0;
      const ty = within ? dy * MAGNET_PULL : 0;
      m.x += (tx - m.x) * LERP;
      m.y += (ty - m.y) * LERP;

      const scale = m.pressed ? 0.96 : 1;
      if (within || m.pressed || Math.abs(m.x) > 0.05 || Math.abs(m.y) > 0.05) {
        settled = false;
        m.el.style.transform = `translate(${m.x.toFixed(2)}px, ${m.y.toFixed(2)}px) scale(${scale})`;
      } else if (m.el.style.transform) {
        m.el.style.transform = "";
      }
    }

    const moved = px !== lastPx || py !== lastPy;
    lastPx = px;
    lastPy = py;
    idle = !settled || moved ? 0 : idle + 1;

    if (idle < IDLE_FRAMES) {
      raf = requestAnimationFrame(tick);
    } else {
      raf = null;
    }
  }
}
