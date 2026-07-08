// -----------------------------------------------------------------------------
// HeroShader — WebGL-Himmel für den Landing-Hero (Parität zum Hero-Editor:
// gleiche FBM-Wolken, freie Wolken-Objekte, Sterne, Licht-Stärke, Presets +
// eigene Farben). Zusätzlich fürs Live-Hero: Sonnenaufgang beim Laden — die
// Sonne steigt in ~9 s von unterm Horizont zur komponierten Position.
// Kein Three.js — ein Fullscreen-Triangle. Pausiert außerhalb des Viewports
// und bei verstecktem Tab; prefers-reduced-motion zeigt ein Standbild am Ziel.
// -----------------------------------------------------------------------------

export type HeroPresetName = 'night' | 'dawn' | 'mono' | 'dusk' | 'ember' | 'storm' | 'custom';

export interface HeroFreeCloud {
  x: number;
  y: number;
  size: number;
  amount: number;
  soft: number;
  drift: number;
  seed: number;
}

export interface HeroSky {
  preset: HeroPresetName;
  sun: { x: number; y: number };
  cloud: number;
  light: number;
  stars: number;
  colors?: { skyTop: string; skyHorizon: string; sun: string; cloud: string };
  clouds: HeroFreeCloud[];
  /** Sonnen-Auftritt: rise = geht auf, set = senkt sich sanft, none = ruht am Ziel */
  sunAnim?: 'rise' | 'set' | 'none';
  /** Dauer der Sonnen-Animation in Sekunden */
  sunAnimSecs?: number;
}

type Rgb = [number, number, number];

interface PresetColors {
  skyTop: Rgb;
  skyHorizon: Rgb;
  sun: Rgb;
  cloud: Rgb;
  fallback: string;
}

export const HERO_PRESETS: Record<Exclude<HeroPresetName, 'custom'>, PresetColors> = {
  night: {
    skyTop: [0.024, 0.075, 0.145], skyHorizon: [0.42, 0.36, 0.30],
    sun: [1.0, 0.74, 0.38], cloud: [0.075, 0.115, 0.175],
    fallback: 'linear-gradient(180deg,#061326 0%,#274058 70%,#6b5c4d 100%)',
  },
  dawn: {
    skyTop: [0.08, 0.19, 0.31], skyHorizon: [0.91, 0.72, 0.47],
    sun: [1.0, 0.80, 0.45], cloud: [0.22, 0.26, 0.33],
    fallback: 'linear-gradient(180deg,#14304f 0%,#4e7ea6 55%,#e8b878 100%)',
  },
  mono: {
    skyTop: [0.71, 0.71, 0.69], skyHorizon: [0.955, 0.945, 0.90],
    sun: [1.0, 0.97, 0.88], cloud: [0.60, 0.60, 0.58],
    fallback: 'linear-gradient(180deg,#b5b5b1 0%,#f4f1e6 100%)',
  },
  dusk: {
    skyTop: [0.10, 0.07, 0.20], skyHorizon: [0.85, 0.45, 0.50],
    sun: [1.0, 0.62, 0.55], cloud: [0.16, 0.11, 0.24],
    fallback: 'linear-gradient(180deg,#1a1233 0%,#6b3a5c 60%,#d97380 100%)',
  },
  ember: {
    skyTop: [0.05, 0.03, 0.06], skyHorizon: [0.75, 0.25, 0.10],
    sun: [1.0, 0.45, 0.15], cloud: [0.12, 0.06, 0.06],
    fallback: 'linear-gradient(180deg,#0d080f 0%,#40160d 60%,#bf4019 100%)',
  },
  storm: {
    skyTop: [0.16, 0.18, 0.22], skyHorizon: [0.55, 0.58, 0.62],
    sun: [0.95, 0.95, 1.0], cloud: [0.10, 0.11, 0.13],
    fallback: 'linear-gradient(180deg,#292e38 0%,#8c949e 100%)',
  },
};

function hexToRgb01(h: string): Rgb {
  const n = parseInt(h.slice(1), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export function heroColors(sky: Pick<HeroSky, 'preset' | 'colors'>): PresetColors {
  if (sky.preset === 'custom' && sky.colors) {
    const c = sky.colors;
    return {
      skyTop: hexToRgb01(c.skyTop), skyHorizon: hexToRgb01(c.skyHorizon),
      sun: hexToRgb01(c.sun), cloud: hexToRgb01(c.cloud),
      fallback: `linear-gradient(180deg,${c.skyTop} 0%,${c.skyHorizon} 100%)`,
    };
  }
  return HERO_PRESETS[(sky.preset in HERO_PRESETS ? sky.preset : 'night') as Exclude<HeroPresetName, 'custom'>];
}

const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p,0.,1.); }';

const FRAG = `
precision highp float;
uniform vec2 u_res; uniform float u_time; uniform vec2 u_sun;
uniform vec3 u_skyTop; uniform vec3 u_skyHorizon; uniform vec3 u_sunCol; uniform vec3 u_cloudCol;
uniform float u_cloud; uniform float u_stars; uniform float u_boost;
uniform vec4 u_fc[8]; uniform vec4 u_fc2[8];
float hash(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
float noise(vec2 p){ vec2 i=floor(p),f=fract(p);
  float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));
  vec2 u=f*f*(3.-2.*f); return mix(a,b,u.x)+(c-a)*u.y*(1.-u.x)+(d-b)*u.x*u.y; }
float fbm(vec2 p){ float v=0.,a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.02; a*=.5; } return v; }
void main(){
  vec2 uv=gl_FragCoord.xy/u_res.xy; float aspect=u_res.x/u_res.y;
  vec2 st=vec2(uv.x*aspect,uv.y); vec2 sun=vec2(u_sun.x*aspect,u_sun.y);
  vec3 col=mix(u_skyHorizon,u_skyTop,smoothstep(0.02,1.0,pow(uv.y,0.9)));
  float d=distance(st,sun);
  float glow=exp(-d*4.6);
  float halo=exp(-abs(uv.y-u_sun.y)*7.0)*exp(-abs(st.x-sun.x)*1.1);
  col+=u_sunCol*(glow*0.9+halo*0.35)*u_boost;
  float t=u_time*0.010;
  float band=smoothstep(0.98,0.70,uv.y)*smoothstep(0.12,0.40,uv.y);
  vec2 cp=vec2(st.x*1.45-t,uv.y*4.0);
  float q=fbm(cp*1.9+t);
  float dens=fbm(cp+q*0.55);
  float cloud=smoothstep(0.50,0.80,dens)*band*u_cloud;
  vec2 toSun=normalize(sun-st+vec2(1e-4));
  float densL=fbm(cp+toSun*0.18+q*0.55);
  float rim=clamp(dens-densL,0.0,1.0);
  col=mix(col,u_cloudCol,cloud*0.85);
  col+=u_sunCol*rim*cloud*2.4*exp(-d*1.6);
  float disc=smoothstep(0.030,0.022,d);
  col+=u_sunCol*disc*(1.0-cloud*0.9)*min(u_boost,1.5);
  vec2 sg=st*vec2(300.,190.);
  vec2 scell=floor(sg);
  float sr=hash(scell);
  vec2 sp=vec2(hash(scell+vec2(7.1,1.3)),hash(scell+vec2(3.7,9.2)))*0.6+0.2;
  float sd=length(fract(sg)-sp);
  float tw=0.65+0.35*sin(u_time*2.0+sr*40.0);
  float star=step(1.0-0.0028*u_stars,sr)*smoothstep(0.36,0.08,sd)*smoothstep(0.30,0.65,uv.y)*(1.0-cloud)*tw;
  col+=vec3(0.85,0.90,1.0)*star*0.85;
  for(int i=0;i<8;i++){
    if(u_fc2[i].w<0.5) continue;
    vec4 fc=u_fc[i];
    float cx=fract(fc.x + u_time*u_fc2[i].y*0.008 + 8.0)*1.4-0.2;
    vec2 center=vec2(cx*aspect, fc.y);
    vec2 rel=st-center; rel.y*=2.1;
    float m=smoothstep(fc.z, fc.z*0.2, length(rel));
    if(m<0.004) continue;
    vec2 cp2=rel*(2.2/max(fc.z,0.03)) + vec2(u_fc2[i].x*19.0);
    cp2.x-=u_time*0.04*max(u_fc2[i].y,0.15);
    float q2=fbm(cp2*1.7 + u_time*0.02);
    float dn=fbm(cp2 + q2*0.6);
    float edge=mix(0.60,0.40,u_fc2[i].z);
    float cl=smoothstep(edge,edge+0.24,dn*0.72+m*0.42)*fc.w*m;
    if(cl<=0.002) continue;
    float dl=fbm(cp2 + normalize(sun-st+vec2(1e-4))*0.22 + q2*0.6);
    float rim2=clamp(dn-dl,0.,1.);
    col=mix(col,u_cloudCol,cl*0.9);
    col+=u_sunCol*rim2*cl*2.0*exp(-distance(st,sun)*1.6)*u_boost;
  }
  col+=(hash(gl_FragCoord.xy+u_time)-0.5)*0.018;
  gl_FragColor=vec4(col,1.0);
}
`;

export interface HeroShaderHandle {
  destroy(): void;
}

export function createHeroShader(canvas: HTMLCanvasElement, sky: HeroSky): HeroShaderHandle | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  const reduce =
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  if (!gl) {
    canvas.style.background = heroColors(sky).fallback;
    return { destroy() {} };
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

  const U = (n: string) => gl.getUniformLocation(prog, n);
  const uRes = U('u_res'), uTime = U('u_time'), uSun = U('u_sun'),
    uSkyTop = U('u_skyTop'), uSkyHor = U('u_skyHorizon'), uSunCol = U('u_sunCol'),
    uCloudCol = U('u_cloudCol'), uCloud = U('u_cloud'), uStars = U('u_stars'),
    uBoost = U('u_boost'), uFc = U('u_fc'), uFc2 = U('u_fc2');

  const colors = heroColors(sky);
  const fcA = new Float32Array(32);
  const fcB = new Float32Array(32);
  sky.clouds.slice(0, 8).forEach((c, i) => {
    fcA[i * 4] = c.x; fcA[i * 4 + 1] = c.y; fcA[i * 4 + 2] = c.size; fcA[i * 4 + 3] = c.amount;
    fcB[i * 4] = c.seed; fcB[i * 4 + 1] = c.drift; fcB[i * 4 + 2] = c.soft; fcB[i * 4 + 3] = 1;
  });

  const sunAnim = reduce ? 'none' : (sky.sunAnim ?? 'rise');
  const sunAnimSecs = sky.sunAnimSecs ?? (sunAnim === 'set' ? 12 : 9);
  const sunStartY =
    sunAnim === 'set' ? sky.sun.y + 0.12 : Math.min(-0.06, sky.sun.y - 0.5);

  let raf = 0;
  let running = false;
  let inView = true;
  const DPR = Math.min(window.devicePixelRatio || 1, 1.6);
  const start = performance.now();

  function sunY(elapsed: number) {
    if (sunAnim === 'none' || sunAnimSecs <= 0) return sky.sun.y;
    const p = Math.min(1, elapsed / sunAnimSecs);
    const eased = 1 - Math.pow(1 - p, 3);
    return sunStartY + (sky.sun.y - sunStartY) * eased;
  }

  function renderFrame(now: number) {
    const w = Math.round(canvas.clientWidth * DPR);
    const h = Math.round(canvas.clientHeight * DPR);
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
    }
    gl!.viewport(0, 0, canvas.width, canvas.height);
    const elapsed = (now - start) / 1000;
    gl!.uniform2f(uSun, sky.sun.x, sunY(elapsed));
    gl!.uniform3f(uSkyTop, ...colors.skyTop);
    gl!.uniform3f(uSkyHor, ...colors.skyHorizon);
    gl!.uniform3f(uSunCol, ...colors.sun);
    gl!.uniform3f(uCloudCol, ...colors.cloud);
    gl!.uniform1f(uCloud, sky.cloud);
    gl!.uniform1f(uStars, sky.stars);
    gl!.uniform1f(uBoost, sky.light);
    gl!.uniform4fv(uFc, fcA);
    gl!.uniform4fv(uFc2, fcB);
    gl!.uniform2f(uRes, canvas.width, canvas.height);
    gl!.uniform1f(uTime, reduce ? 40.0 : elapsed);
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
    destroy() {
      setRunning(false);
      io.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      gl!.getExtension('WEBGL_lose_context')?.loseContext();
    },
  };
}
