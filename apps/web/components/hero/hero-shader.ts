// -----------------------------------------------------------------------------
// HeroShader — leichtgewichtiger WebGL-Himmel für den Landing-Hero.
// Basiert auf dem FBM-Ansatz aus Zaurs Shader-Preview (serlo-shader-hero-
// preview_2.html), umgebaut von „abstraktes Lichtfeld" zu einer Szene:
// Himmel-Verlauf + Sonne an steuerbarer Position + hinterleuchtete FBM-Wolken.
// Kein Three.js — ein Fullscreen-Triangle, ~4 KB. Pausiert außerhalb des
// Viewports und bei verstecktem Tab; prefers-reduced-motion rendert ein
// einzelnes Standbild. Ohne WebGL: CSS-Gradient-Fallback.
// -----------------------------------------------------------------------------

export type HeroPresetName = 'night' | 'dawn' | 'mono';

export interface HeroSky {
  preset: HeroPresetName;
  sun: { x: number; y: number }; // 0..1, y von unten gemessen
  cloud: number; // 0..1 Wolkenmenge
}

interface PresetColors {
  skyTop: [number, number, number];
  skyHorizon: [number, number, number];
  sun: [number, number, number];
  cloud: [number, number, number];
  fallback: string;
}

export const HERO_PRESETS: Record<HeroPresetName, PresetColors> = {
  night: {
    skyTop: [0.024, 0.075, 0.145],
    skyHorizon: [0.42, 0.36, 0.30],
    sun: [1.0, 0.74, 0.38],
    cloud: [0.075, 0.115, 0.175],
    fallback: 'linear-gradient(180deg,#061326 0%,#274058 70%,#6b5c4d 100%)',
  },
  dawn: {
    skyTop: [0.08, 0.19, 0.31],
    skyHorizon: [0.91, 0.72, 0.47],
    sun: [1.0, 0.80, 0.45],
    cloud: [0.22, 0.26, 0.33],
    fallback: 'linear-gradient(180deg,#14304f 0%,#4e7ea6 55%,#e8b878 100%)',
  },
  mono: {
    skyTop: [0.71, 0.71, 0.69],
    skyHorizon: [0.955, 0.945, 0.90],
    sun: [1.0, 0.97, 0.88],
    cloud: [0.60, 0.60, 0.58],
    fallback: 'linear-gradient(180deg,#b5b5b1 0%,#f4f1e6 100%)',
  },
};

const VERT = `attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }`;

const FRAG = `
precision highp float;
uniform vec2  u_res;
uniform float u_time;
uniform vec2  u_sun;
uniform vec3  u_skyTop;
uniform vec3  u_skyHorizon;
uniform vec3  u_sunCol;
uniform vec3  u_cloudCol;
uniform float u_cloud;

float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){
  vec2 i=floor(p), f=fract(p);
  float a=hash(i), b=hash(i+vec2(1.,0.)), c=hash(i+vec2(0.,1.)), d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f);
  return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y;
}
float fbm(vec2 p){
  float v=0., a=.5;
  for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=.5; }
  return v;
}

void main(){
  vec2 uv = gl_FragCoord.xy / u_res.xy;
  float aspect = u_res.x / u_res.y;
  vec2 st  = vec2(uv.x * aspect, uv.y);
  vec2 sun = vec2(u_sun.x * aspect, u_sun.y);

  vec3 col = mix(u_skyHorizon, u_skyTop, smoothstep(0.02, 1.0, pow(uv.y, 0.9)));

  float d = distance(st, sun);
  float glow = exp(-d * 4.6);
  float horizonHalo = exp(-abs(uv.y - u_sun.y) * 7.0) * exp(-abs(st.x - sun.x) * 1.1);
  col += u_sunCol * (glow * 0.9 + horizonHalo * 0.35);

  float t = u_time * 0.010;
  float band = smoothstep(0.98, 0.70, uv.y) * smoothstep(0.12, 0.40, uv.y);
  vec2 cp = vec2(st.x * 1.45 - t, uv.y * 4.0);
  float q = fbm(cp * 1.9 + t);
  float dens = fbm(cp + q * 0.55);
  float cloud = smoothstep(0.50, 0.80, dens) * band * u_cloud;

  vec2 toSun = normalize(sun - st + vec2(1e-4));
  float densTowardSun = fbm(cp + toSun * 0.18 + q * 0.55);
  float rim = clamp(dens - densTowardSun, 0.0, 1.0);

  col = mix(col, u_cloudCol, cloud * 0.85);
  col += u_sunCol * rim * cloud * 2.4 * exp(-d * 1.6);

  float disc = smoothstep(0.030, 0.022, d);
  col += u_sunCol * disc * (1.0 - cloud * 0.9);

  col += (hash(gl_FragCoord.xy + u_time) - 0.5) * 0.018;
  gl_FragColor = vec4(col, 1.0);
}
`;

export interface HeroShaderHandle {
  update(sky: HeroSky): void;
  destroy(): void;
}

export function createHeroShader(canvas: HTMLCanvasElement, sky: HeroSky): HeroShaderHandle | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!gl) {
    canvas.style.background = HERO_PRESETS[sky.preset].fallback;
    return {
      update(next) {
        canvas.style.background = HERO_PRESETS[next.preset].fallback;
      },
      destroy() {},
    };
  }

  const compile = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, compile(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, compile(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const U = (name: string) => gl.getUniformLocation(prog, name);
  const uRes = U('u_res');
  const uTime = U('u_time');
  const uSun = U('u_sun');
  const uSkyTop = U('u_skyTop');
  const uSkyHorizon = U('u_skyHorizon');
  const uSunCol = U('u_sunCol');
  const uCloudCol = U('u_cloudCol');
  const uCloud = U('u_cloud');

  let current = sky;
  let raf = 0;
  let running = false;
  let inView = true;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  const start = performance.now();

  function applyUniforms() {
    const p = HERO_PRESETS[current.preset];
    gl!.uniform2f(uSun, current.sun.x, current.sun.y);
    gl!.uniform3f(uSkyTop, ...p.skyTop);
    gl!.uniform3f(uSkyHorizon, ...p.skyHorizon);
    gl!.uniform3f(uSunCol, ...p.sun);
    gl!.uniform3f(uCloudCol, ...p.cloud);
    gl!.uniform1f(uCloud, current.cloud);
  }

  function resize() {
    const w = Math.round(canvas.clientWidth * DPR);
    const h = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl!.viewport(0, 0, canvas.width, canvas.height);
  }

  function renderFrame(now: number) {
    resize();
    applyUniforms();
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform1f(uTime, reduce ? 40.0 : (now - start) / 1000);
    gl!.drawArrays(gl!.TRIANGLES, 0, 3);
  }

  function loop(now: number) {
    renderFrame(now);
    if (running) raf = requestAnimationFrame(loop);
  }

  function setRunning(next: boolean) {
    if (next === running) return;
    running = next;
    if (running) raf = requestAnimationFrame(loop);
    else cancelAnimationFrame(raf);
  }

  const onVisibility = () => {
    if (reduce) return;
    setRunning(!document.hidden && inView);
  };
  document.addEventListener('visibilitychange', onVisibility);

  const io = new IntersectionObserver((entries) => {
    inView = entries[0]?.isIntersecting ?? true;
    if (reduce) return;
    setRunning(!document.hidden && inView);
  });
  io.observe(canvas);

  const onResize = () => {
    if (!running) requestAnimationFrame(renderFrame);
  };
  window.addEventListener('resize', onResize);

  if (reduce) requestAnimationFrame(renderFrame);
  else setRunning(true);

  return {
    update(next: HeroSky) {
      current = next;
      if (!running) requestAnimationFrame(renderFrame);
    },
    destroy() {
      setRunning(false);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
