const D=`
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`,I=`
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
`;function p(o,e,g){const v=o.getPropertyValue(e).trim(),l=/^#([0-9a-f]{6})$/i.exec(v);if(!l)return g;const n=parseInt(l[1],16);return[(n>>16&255)/255,(n>>8&255)/255,(n&255)/255]}function B(){const o=getComputedStyle(document.documentElement);return{c0:p(o,"--glow-0",[1,.85,.66]),c1:p(o,"--glow-1",[.97,.52,.61]),c2:p(o,"--glow-2",[.91,.33,.5]),c3:p(o,"--glow-3",[.66,.23,.56]),bg:p(o,"--bg",[.98,.97,.96]),strength:parseFloat(o.getPropertyValue("--glow-strength"))||.5}}function Y(){const o=document.querySelector(".hero-canvas");if(!o||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const e=o.getContext("webgl",{alpha:!1,depth:!1,stencil:!1,antialias:!1,powerPreference:"low-power"});if(!e)return;function g(t,r){const c=e.createShader(t);return!c||(e.shaderSource(c,r),e.compileShader(c),!e.getShaderParameter(c,e.COMPILE_STATUS))?null:c}const v=g(e.VERTEX_SHADER,D),l=g(e.FRAGMENT_SHADER,I),n=e.createProgram();if(!v||!l||!n||(e.attachShader(n,v),e.attachShader(n,l),e.linkProgram(n),!e.getProgramParameter(n,e.LINK_STATUS)))return;e.useProgram(n);const O=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,O),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);const C=e.getAttribLocation(n,"a_pos");e.enableVertexAttribArray(C),e.vertexAttribPointer(C,2,e.FLOAT,!1,0,0);const i={res:e.getUniformLocation(n,"u_res"),time:e.getUniformLocation(n,"u_time"),ptr:e.getUniformLocation(n,"u_ptr"),c0:e.getUniformLocation(n,"u_c0"),c1:e.getUniformLocation(n,"u_c1"),c2:e.getUniformLocation(n,"u_c2"),c3:e.getUniformLocation(n,"u_c3"),bg:e.getUniformLocation(n,"u_bg"),strength:e.getUniformLocation(n,"u_strength"),chaos:e.getUniformLocation(n,"u_chaos"),pulse:e.getUniformLocation(n,"u_pulse")};let a=B();new MutationObserver(()=>{a=B()}).observe(document.documentElement,{attributes:!0,attributeFilter:["class"]});let w=1.4,x=1.2,b=w,A=x;document.addEventListener("pointermove",t=>{const r=o.getBoundingClientRect();r.width===0||r.height===0||(w=(t.clientX-r.left)/r.width,x=1-(t.clientY-r.top)/r.height)},{passive:!0});let S=.5,k=.5,f=0,m=[];const F=o.parentElement;F?.addEventListener("pointerdown",t=>{if(t.target?.closest("a, button"))return;const r=o.getBoundingClientRect();if(r.width===0||r.height===0)return;S=(t.clientX-r.left)/r.width,k=1-(t.clientY-r.top)/r.height,f=1;const c=performance.now();m=m.filter(q=>c-q<650),m.push(c),m.length>=3&&(m=[],u=u?0:1),d()});function P(){window.addEventListener("deviceorientation",t=>{t.gamma==null||t.beta==null||(w=.5+t.gamma/90*1.3,x=.5-(t.beta-40)/90*1.3)},{passive:!0})}const _=window.DeviceOrientationEvent;_&&typeof _.requestPermission=="function"?F?.addEventListener("pointerdown",()=>{_.requestPermission().then(t=>{t==="granted"&&P()}).catch(()=>{})},{once:!0}):_&&P();function U(){const t=o.getBoundingClientRect(),r=Math.min(window.devicePixelRatio||1,1.5)*.5;o.width=Math.max(1,Math.round(t.width*r)),o.height=Math.max(1,Math.round(t.height*r)),e.viewport(0,0,o.width,o.height)}U(),new ResizeObserver(U).observe(o);let E=!0,y=null,M=0,L=performance.now(),T=!0,s=0,u=0;const R=["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];let h=0;window.addEventListener("keydown",t=>{if(t.key==="Escape"){u=0;return}const r=t.key.toLowerCase();h=r===R[h]?h+1:r===R[0]?1:0,h===R.length&&(h=0,u=u?0:1,d())}),console.log("%c↑ ↑ ↓ ↓ ← → ← → B A%c — there is more light in here. (Esc to calm it back down)","font-family: monospace; font-weight: bold; color: #e8557f;","color: inherit;");function z(t){if(y=null,!E||document.hidden)return;const r=Math.min(t-L,100)/1e3;L=t,s+=(u-s)*.035,s<.001&&(s=0),f*=Math.pow(.04,r),f<.01&&(f=0),M+=r*(1+s*3),b+=(w-b)*.06,A+=(x-A)*.06,e.uniform2f(i.res,o.width,o.height),e.uniform1f(i.time,M),e.uniform2f(i.ptr,b,A),e.uniform3fv(i.c0,a.c0),e.uniform3fv(i.c1,a.c1),e.uniform3fv(i.c2,a.c2),e.uniform3fv(i.c3,a.c3),e.uniform3fv(i.bg,a.bg),e.uniform1f(i.strength,a.strength),e.uniform1f(i.chaos,s),e.uniform3f(i.pulse,S,k,f),e.drawArrays(e.TRIANGLES,0,3),T&&(T=!1,o.classList.add("is-live")),y=requestAnimationFrame(z)}function d(){y===null&&E&&!document.hidden&&(L=performance.now(),y=requestAnimationFrame(z))}new IntersectionObserver(t=>{E=t[0].isIntersecting,d()},{rootMargin:"80px"}).observe(o),document.addEventListener("visibilitychange",d),d()}Y();
