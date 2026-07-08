const P=`
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`,U=`
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
  mask = clamp(mask + pi * 0.30 + u_chaos * 0.55, 0.0, 1.0);
  mask *= smoothstep(0.0, max(0.30 * (1.0 - u_chaos), 0.001), uv.y);

  vec3 outc = mix(u_bg, col, mask * mix(u_strength, 0.9, u_chaos));

  // Blue-noise-ish dither so the soft ramps never band.
  float dn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  outc += (dn - 0.5) * 0.012;

  gl_FragColor = vec4(outc, 1.0);
}
`;function f(t,e,m){const h=t.getPropertyValue(e).trim(),s=/^#([0-9a-f]{6})$/i.exec(h);if(!s)return m;const o=parseInt(s[1],16);return[(o>>16&255)/255,(o>>8&255)/255,(o&255)/255]}function E(){const t=getComputedStyle(document.documentElement);return{c0:f(t,"--glow-0",[1,.85,.66]),c1:f(t,"--glow-1",[.97,.52,.61]),c2:f(t,"--glow-2",[.91,.33,.5]),c3:f(t,"--glow-3",[.66,.23,.56]),bg:f(t,"--bg",[.98,.97,.96]),strength:parseFloat(t.getPropertyValue("--glow-strength"))||.5}}function M(){const t=document.querySelector(".hero-canvas");if(!t||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const e=t.getContext("webgl",{alpha:!1,depth:!1,stencil:!1,antialias:!1,powerPreference:"low-power"});if(!e)return;function m(c,r){const l=e.createShader(c);return!l||(e.shaderSource(l,r),e.compileShader(l),!e.getShaderParameter(l,e.COMPILE_STATUS))?null:l}const h=m(e.VERTEX_SHADER,P),s=m(e.FRAGMENT_SHADER,U),o=e.createProgram();if(!h||!s||!o||(e.attachShader(o,h),e.attachShader(o,s),e.linkProgram(o),!e.getProgramParameter(o,e.LINK_STATUS)))return;e.useProgram(o);const F=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,F),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);const L=e.getAttribLocation(o,"a_pos");e.enableVertexAttribArray(L),e.vertexAttribPointer(L,2,e.FLOAT,!1,0,0);const n={res:e.getUniformLocation(o,"u_res"),time:e.getUniformLocation(o,"u_time"),ptr:e.getUniformLocation(o,"u_ptr"),c0:e.getUniformLocation(o,"u_c0"),c1:e.getUniformLocation(o,"u_c1"),c2:e.getUniformLocation(o,"u_c2"),c3:e.getUniformLocation(o,"u_c3"),bg:e.getUniformLocation(o,"u_bg"),strength:e.getUniformLocation(o,"u_strength"),chaos:e.getUniformLocation(o,"u_chaos")};let i=E();new MutationObserver(()=>{i=E()}).observe(document.documentElement,{attributes:!0,attributeFilter:["class"]});let p=1.4,x=1.2,w=p,_=x;document.addEventListener("pointermove",c=>{const r=t.getBoundingClientRect();r.width===0||r.height===0||(p=(c.clientX-r.left)/r.width,x=1-(c.clientY-r.top)/r.height)},{passive:!0});function C(){const c=t.getBoundingClientRect(),r=Math.min(window.devicePixelRatio||1,1.5)*.5;t.width=Math.max(1,Math.round(c.width*r)),t.height=Math.max(1,Math.round(c.height*r)),e.viewport(0,0,t.width,t.height)}C(),new ResizeObserver(C).observe(t);let y=!0,d=null,R=0,b=performance.now(),k=!0,a=0,v=0;const A=["arrowup","arrowup","arrowdown","arrowdown","arrowleft","arrowright","arrowleft","arrowright","b","a"];let u=0;window.addEventListener("keydown",c=>{if(c.key==="Escape"){v=0;return}const r=c.key.toLowerCase();u=r===A[u]?u+1:r===A[0]?1:0,u===A.length&&(u=0,v=v?0:1,g())}),console.log("%c↑ ↑ ↓ ↓ ← → ← → B A%c — there is more light in here. (Esc to calm it back down)","font-family: monospace; font-weight: bold; color: #e8557f;","color: inherit;");function S(c){if(d=null,!y||document.hidden)return;const r=Math.min(c-b,100)/1e3;b=c,a+=(v-a)*.035,a<.001&&(a=0),R+=r*(1+a*3),w+=(p-w)*.06,_+=(x-_)*.06,e.uniform2f(n.res,t.width,t.height),e.uniform1f(n.time,R),e.uniform2f(n.ptr,w,_),e.uniform3fv(n.c0,i.c0),e.uniform3fv(n.c1,i.c1),e.uniform3fv(n.c2,i.c2),e.uniform3fv(n.c3,i.c3),e.uniform3fv(n.bg,i.bg),e.uniform1f(n.strength,i.strength),e.uniform1f(n.chaos,a),e.drawArrays(e.TRIANGLES,0,3),k&&(k=!1,t.classList.add("is-live")),d=requestAnimationFrame(S)}function g(){d===null&&y&&!document.hidden&&(b=performance.now(),d=requestAnimationFrame(S))}new IntersectionObserver(c=>{y=c[0].isIntersecting,g()},{rootMargin:"80px"}).observe(t),document.addEventListener("visibilitychange",g),g()}M();
