const F=`
attribute vec2 a_pos;
void main() {
  gl_Position = vec4(a_pos, 0.0, 1.0);
}
`,S=`
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

vec3 permute(vec3 x) { return mod(((x * 34.0) + 1.0) * x, 289.0); }

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
  p += drift * 0.38 + (ptr - p) * pi * 0.35;

  float f = snoise(p * 1.15 + t * 0.5) * 0.62 + snoise(p * 2.6 - t * 0.9) * 0.38;
  f = f * 0.5 + 0.5;

  vec3 col = mix(u_c0, u_c1, smoothstep(0.05, 0.45, f));
  col = mix(col, u_c2, smoothstep(0.40, 0.72, f));
  col = mix(col, u_c3, smoothstep(0.68, 0.98, f));

  // Composition: the light lives top-right (where the orb lived) and
  // melts into the page background elsewhere; the cursor drags a little
  // extra light with it wherever it goes.
  vec2 focus = vec2(0.78 * aspect, 0.92);
  float d = distance(vec2(uv.x * aspect, uv.y), focus);
  float mask = 1.0 - smoothstep(0.05, 1.15, d);
  mask += snoise(p * 0.75 - t) * 0.08;
  mask = clamp(mask + pi * 0.30, 0.0, 1.0);
  mask *= smoothstep(0.0, 0.30, uv.y);

  vec3 outc = mix(u_bg, col, mask * u_strength);

  // Blue-noise-ish dither so the soft ramps never band.
  float dn = fract(sin(dot(gl_FragCoord.xy, vec2(12.9898, 78.233))) * 43758.5453);
  outc += (dn - 0.5) * 0.012;

  gl_FragColor = vec4(outc, 1.0);
}
`;function u(t,e,f){const l=t.getPropertyValue(e).trim(),a=/^#([0-9a-f]{6})$/i.exec(l);if(!a)return f;const r=parseInt(a[1],16);return[(r>>16&255)/255,(r>>8&255)/255,(r&255)/255]}function C(){const t=getComputedStyle(document.documentElement);return{c0:u(t,"--glow-0",[1,.85,.66]),c1:u(t,"--glow-1",[.97,.52,.61]),c2:u(t,"--glow-2",[.91,.33,.5]),c3:u(t,"--glow-3",[.66,.23,.56]),bg:u(t,"--bg",[.98,.97,.96]),strength:parseFloat(t.getPropertyValue("--glow-strength"))||.5}}function E(){const t=document.querySelector(".hero-canvas");if(!t||window.matchMedia("(prefers-reduced-motion: reduce)").matches)return;const e=t.getContext("webgl",{alpha:!1,depth:!1,stencil:!1,antialias:!1,powerPreference:"low-power"});if(!e)return;function f(o,i){const s=e.createShader(o);return!s||(e.shaderSource(s,i),e.compileShader(s),!e.getShaderParameter(s,e.COMPILE_STATUS))?null:s}const l=f(e.VERTEX_SHADER,F),a=f(e.FRAGMENT_SHADER,S),r=e.createProgram();if(!l||!a||!r||(e.attachShader(r,l),e.attachShader(r,a),e.linkProgram(r),!e.getProgramParameter(r,e.LINK_STATUS)))return;e.useProgram(r);const L=e.createBuffer();e.bindBuffer(e.ARRAY_BUFFER,L),e.bufferData(e.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),e.STATIC_DRAW);const w=e.getAttribLocation(r,"a_pos");e.enableVertexAttribArray(w),e.vertexAttribPointer(w,2,e.FLOAT,!1,0,0);const n={res:e.getUniformLocation(r,"u_res"),time:e.getUniformLocation(r,"u_time"),ptr:e.getUniformLocation(r,"u_ptr"),c0:e.getUniformLocation(r,"u_c0"),c1:e.getUniformLocation(r,"u_c1"),c2:e.getUniformLocation(r,"u_c2"),c3:e.getUniformLocation(r,"u_c3"),bg:e.getUniformLocation(r,"u_bg"),strength:e.getUniformLocation(r,"u_strength")};let c=C();new MutationObserver(()=>{c=C()}).observe(document.documentElement,{attributes:!0,attributeFilter:["class"]});let v=1.4,d=1.2,g=v,h=d;document.addEventListener("pointermove",o=>{const i=t.getBoundingClientRect();i.width===0||i.height===0||(v=(o.clientX-i.left)/i.width,d=1-(o.clientY-i.top)/i.height)},{passive:!0});function b(){const o=t.getBoundingClientRect(),i=Math.min(window.devicePixelRatio||1,1.5)*.5;t.width=Math.max(1,Math.round(o.width*i)),t.height=Math.max(1,Math.round(o.height*i)),e.viewport(0,0,t.width,t.height)}b(),new ResizeObserver(b).observe(t);let p=!0,m=null,y=0,x=performance.now(),A=!0;function R(o){m=null,!(!p||document.hidden)&&(y+=Math.min(o-x,100)/1e3,x=o,g+=(v-g)*.06,h+=(d-h)*.06,e.uniform2f(n.res,t.width,t.height),e.uniform1f(n.time,y),e.uniform2f(n.ptr,g,h),e.uniform3fv(n.c0,c.c0),e.uniform3fv(n.c1,c.c1),e.uniform3fv(n.c2,c.c2),e.uniform3fv(n.c3,c.c3),e.uniform3fv(n.bg,c.bg),e.uniform1f(n.strength,c.strength),e.drawArrays(e.TRIANGLES,0,3),A&&(A=!1,t.classList.add("is-live")),m=requestAnimationFrame(R))}function _(){m===null&&p&&!document.hidden&&(x=performance.now(),m=requestAnimationFrame(R))}new IntersectionObserver(o=>{p=o[0].isIntersecting,_()},{rootMargin:"80px"}).observe(t),document.addEventListener("visibilitychange",_),_()}E();
