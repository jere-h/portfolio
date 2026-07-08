/**
 * Living hero light - a raw-WebGL fragment shader that flows the exact
 * four-stop ramp of the original CSS orb (read at runtime from the
 * --glow-* custom properties) through layered simplex noise, and leans
 * toward the cursor.
 *
 * Progressive enhancement contract:
 *   - the CSS .hero-orb stays in the DOM underneath as the permanent
 *     fallback; the canvas fades in over it only after the first frame
 *     actually renders.
 *   - reduced-motion, no-JS, and no-WebGL visitors never see the canvas.
 *   - colors re-read on theme change (class mutation on <html>), so the
 *     View Transition theme wipe re-lights the canvas along with the page.
 *
 * Perf budget: renders at half resolution (the soft look hides it) with
 * DPR capped at 1.5, pauses when the hero scrolls offscreen or the tab
 * is hidden.
 */

const VERT = `
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`;

// snoise = Ashima Arts / Ian McEwan 2D simplex noise (public domain).
const FRAG = `
precision highp float;

uniform vec2 u_res;
uniform float u_time;
uniform vec2 u_ptr;
uniform vec3 u_c0;
uniform vec3 u_c1;
uniform vec3 u_c2;
uniform vec3 u_c3;
uniform vec3 u_bg;
uniform float u_strength;
uniform float u_chaos;
uniform vec3 u_pulse; // xy = uv origin of the last tap, z = remaining energy

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

// Rodrigues rotation of a color around the luminance diagonal = hue spin.
vec3 hueSpin(vec3 color, float a) {
  const vec3 k = vec3(0.57735);
  float c = cos(a);
  return color * c + cross(k, color) * sin(a) + k * dot(k, color) * (1.0 - c);
}

float snoise(vec2 v) {
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
                      -0.577350269189626, 0.024390243902439);
  vec2 i = floor(v + dot(v, C.yy));
  vec2 x0 = v - i + dot(i, C.xx);
  vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute(permute(i.y + vec3(0.0, i1.y, 1.0)) + i.x + vec3(0.0, i1.x, 1.0));
  vec3 m = max(0.5 - vec3(dot(x0, x0), dot(x12.xy, x12.xy), dot(x12.zw, x12.zw)), 0.0);
  m = m * m;
  m = m * m;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * (a0 * a0 + h * h);
  vec3 g;
  g.x = a0.x * x0.x + h.x * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}

void main() {
  vec2 uv = gl_FragCoord.xy / u_res;
  float aspect = u_res.x / u_res.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 ptr = vec2(u_ptr.x * aspect, u_ptr.y);
  float t = u_time * 0.045;

  // Cursor influence: a soft well the light flows toward.
  float pd = distance(p, ptr);
  float pi = exp(-pd * pd * 4.5);

  vec2 drift = vec2(
    snoise(p * 0.9 + vec2(t, -t * 0.7)),
    snoise(p * 0.9 + vec2(-t * 0.8, t) + 7.3)
  );
  p += drift * (0.38 + u_chaos * 0.55) + (ptr - p) * pi * 0.35;

  float freq = 1.0 + u_chaos * 1.4;
  float f = snoise(p * 1.15 * freq + t * 0.5) * 0.62 + snoise(p * 2.6 * freq - t * 0.9) * 0.38;
  f = f * 0.5 + 0.5;

  vec3 col = mix(u_c0, u_c1, smoothstep(0.05, 0.45, f));
  col = mix(col, u_c2, smoothstep(0.40, 0.72, f));
  col = mix(col, u_c3, smoothstep(0.68, 0.98, f));

  // Chaos mode: cycle the whole ramp around the hue wheel.
  col = hueSpin(col, u_chaos * u_time * 1.4);

  // Composition: the light lives top-right (where the orb lived) and
  // melts into the page background elsewhere; the cursor drags a little
  // extra light with it wherever it goes.
  vec2 focus = vec2(0.78 * aspect, 0.92);
  float d = distance(vec2(uv.x * aspect, uv.y), focus);
  float mask = 1.0 - smoothstep(0.05, 1.15, d);
  mask += snoise(p * 0.75 - t) * 0.08;

  // Tap ripple: a ring of light expanding out from the touch point,
  // fading as its energy decays.
  vec2 pulseAt = vec2(u_pulse.x * aspect, u_pulse.y);
  float pulseDist = distance(p, pulseAt);
  float ringRadius = (1.0 - u_pulse.z) * 1.3;
  float ring = exp(-pow((pulseDist - ringRadius) * 5.5, 2.0)) * u_pulse.z;

  mask = clamp(mask + pi * 0.30 + ring * 0.85 + u_chaos * 0.55, 0.0, 1.0);
  mask *= smoothstep(0.0, max(0.30 * (1.0 - u_chaos), 0.001), uv.y);

  vec3 outc = mix(u_bg, col, mask * mix(u_strength, 0.9, u_chaos));

  // Blue-noise-ish dither so the soft ramps never band.
  float dn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  outc += (dn - 0.5) * 0.012;

  gl_FragColor = vec4(outc, 1.0);
}
`;

type RGB = [number, number, number];

function cssColor(styles: CSSStyleDeclaration, name: string, fallback: RGB): RGB {
  const raw = styles.getPropertyValue(name).trim();
  const m = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!m) return fallback;
  const n = parseInt(m[1], 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

function readPalette() {
  const styles = getComputedStyle(document.documentElement);
  return {
    c0: cssColor(styles, "--glow-0", [1, 0.85, 0.66]),
    c1: cssColor(styles, "--glow-1", [0.97, 0.52, 0.61]),
    c2: cssColor(styles, "--glow-2", [0.91, 0.33, 0.5]),
    c3: cssColor(styles, "--glow-3", [0.66, 0.23, 0.56]),
    bg: cssColor(styles, "--bg", [0.98, 0.97, 0.96]),
    strength: parseFloat(styles.getPropertyValue("--glow-strength")) || 0.5,
  };
}

export function initHeroGradient(): void {
  const canvas = document.querySelector<HTMLCanvasElement>(".hero-canvas");
  if (!canvas) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const gl = canvas.getContext("webgl", {
    alpha: false,
    depth: false,
    stencil: false,
    antialias: false,
    powerPreference: "low-power",
  });
  if (!gl) return;

  function compile(type: number, src: string): WebGLShader | null {
    const s = gl!.createShader(type);
    if (!s) return null;
    gl!.shaderSource(s, src);
    gl!.compileShader(s);
    if (!gl!.getShaderParameter(s, gl!.COMPILE_STATUS)) return null;
    return s;
  }

  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  const prog = gl.createProgram();
  if (!vs || !fs || !prog) return;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;
  gl.useProgram(prog);

  // One triangle that covers clip space.
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "a_pos");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(prog, "u_res"),
    time: gl.getUniformLocation(prog, "u_time"),
    ptr: gl.getUniformLocation(prog, "u_ptr"),
    c0: gl.getUniformLocation(prog, "u_c0"),
    c1: gl.getUniformLocation(prog, "u_c1"),
    c2: gl.getUniformLocation(prog, "u_c2"),
    c3: gl.getUniformLocation(prog, "u_c3"),
    bg: gl.getUniformLocation(prog, "u_bg"),
    strength: gl.getUniformLocation(prog, "u_strength"),
    chaos: gl.getUniformLocation(prog, "u_chaos"),
    pulse: gl.getUniformLocation(prog, "u_pulse"),
  };

  let palette = readPalette();
  new MutationObserver(() => {
    palette = readPalette();
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });

  // Pointer target in canvas uv space (y up); parked offscreen until the
  // first move so page load starts fully ambient.
  let ptrX = 1.4;
  let ptrY = 1.2;
  let curX = ptrX;
  let curY = ptrY;
  document.addEventListener(
    "pointermove",
    (e) => {
      const r = canvas.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      ptrX = (e.clientX - r.left) / r.width;
      ptrY = 1 - (e.clientY - r.top) / r.height;
    },
    { passive: true },
  );

  // Tap = a ripple of light from the touch point. Three quick taps on the
  // light toggle chaos mode - the touch counterpart of the Konami code.
  let pulseX = 0.5;
  let pulseY = 0.5;
  let pulseE = 0;
  let taps: number[] = [];
  const heroSection = canvas.parentElement;
  heroSection?.addEventListener("pointerdown", (e) => {
    if ((e.target as Element | null)?.closest("a, button")) return;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    pulseX = (e.clientX - r.left) / r.width;
    pulseY = 1 - (e.clientY - r.top) / r.height;
    pulseE = 1;
    const now = performance.now();
    taps = taps.filter((t) => now - t < 650);
    taps.push(now);
    if (taps.length >= 3) {
      taps = [];
      chaosTarget = chaosTarget ? 0 : 1;
    }
    start();
  });

  // Device tilt steers the light on phones/tablets. Android exposes the
  // events freely; iOS requires a permission prompt tied to a gesture, so
  // there we ask once on the first touch of the hero and fall back
  // silently if declined.
  function bindOrientation(): void {
    window.addEventListener(
      "deviceorientation",
      (e) => {
        if (e.gamma == null || e.beta == null) return;
        // gamma: side tilt [-90..90]; beta: front tilt, ~40deg is a
        // natural in-hand resting angle.
        ptrX = 0.5 + (e.gamma / 90) * 1.3;
        ptrY = 0.5 - ((e.beta - 40) / 90) * 1.3;
      },
      { passive: true },
    );
  }
  const DOE = (window as unknown as { DeviceOrientationEvent?: { requestPermission?: () => Promise<string> } })
    .DeviceOrientationEvent;
  if (DOE && typeof DOE.requestPermission === "function") {
    heroSection?.addEventListener(
      "pointerdown",
      () => {
        DOE.requestPermission!()
          .then((state) => {
            if (state === "granted") bindOrientation();
          })
          .catch(() => {});
      },
      { once: true },
    );
  } else if (DOE) {
    bindOrientation();
  }

  function fit(): void {
    const r = canvas.getBoundingClientRect();
    const scale = Math.min(window.devicePixelRatio || 1, 1.5) * 0.5;
    canvas.width = Math.max(1, Math.round(r.width * scale));
    canvas.height = Math.max(1, Math.round(r.height * scale));
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }
  // ResizeObserver rather than a load-time measure: it fires once layout
  // has actually settled (the stylesheet may not have applied yet when
  // this module runs) and again on every real resize.
  fit();
  new ResizeObserver(fit).observe(canvas);

  let visible = true;
  let raf: number | null = null;
  let elapsed = 0;
  let last = performance.now();
  let firstFrame = true;
  let chaos = 0;
  let chaosTarget = 0;

  // The "so unnecessary" clause: the Konami code cranks the light into
  // hue-cycling turbulence. Escape (or re-entering the code) calms it.
  const KONAMI = [
    "arrowup", "arrowup", "arrowdown", "arrowdown",
    "arrowleft", "arrowright", "arrowleft", "arrowright", "b", "a",
  ];
  let konamiAt = 0;
  window.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      chaosTarget = 0;
      return;
    }
    const key = e.key.toLowerCase();
    konamiAt = key === KONAMI[konamiAt] ? konamiAt + 1 : key === KONAMI[0] ? 1 : 0;
    if (konamiAt === KONAMI.length) {
      konamiAt = 0;
      chaosTarget = chaosTarget ? 0 : 1;
      start();
    }
  });
  console.log(
    "%c↑ ↑ ↓ ↓ ← → ← → B A%c — there is more light in here. (Esc to calm it back down)",
    "font-family: monospace; font-weight: bold; color: #e8557f;",
    "color: inherit;",
  );

  function frame(now: number): void {
    raf = null;
    if (!visible || document.hidden) return;

    // Clamp the delta so background tabs / long frames don't jump the field.
    const dt = Math.min(now - last, 100) / 1000;
    last = now;
    chaos += (chaosTarget - chaos) * 0.035;
    if (chaos < 0.001) chaos = 0;
    pulseE *= Math.pow(0.04, dt); // ~1.4s ripple decay, frame-rate independent
    if (pulseE < 0.01) pulseE = 0;
    elapsed += dt * (1 + chaos * 3);

    curX += (ptrX - curX) * 0.06;
    curY += (ptrY - curY) * 0.06;

    gl!.uniform2f(u.res, canvas.width, canvas.height);
    gl!.uniform1f(u.time, elapsed);
    gl!.uniform2f(u.ptr, curX, curY);
    gl!.uniform3fv(u.c0, palette.c0);
    gl!.uniform3fv(u.c1, palette.c1);
    gl!.uniform3fv(u.c2, palette.c2);
    gl!.uniform3fv(u.c3, palette.c3);
    gl!.uniform3fv(u.bg, palette.bg);
    gl!.uniform1f(u.strength, palette.strength);
    gl!.uniform1f(u.chaos, chaos);
    gl!.uniform3f(u.pulse, pulseX, pulseY, pulseE);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);

    if (firstFrame) {
      firstFrame = false;
      canvas.classList.add("is-live");
    }
    raf = requestAnimationFrame(frame);
  }

  function start(): void {
    if (raf === null && visible && !document.hidden) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      start();
    },
    { rootMargin: "80px" },
  ).observe(canvas);

  document.addEventListener("visibilitychange", start);
  start();
}
