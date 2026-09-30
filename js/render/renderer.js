'use strict';
// Renderer, lights, colliders and sky.

/* =========================================================
   Renderer / scene
   ========================================================= */
let renderer, scene, camera, composer, renderPass, bloomPass, gradePass, sun, hemi;
let skyMesh, skyMat, terrainMesh, terrainMat, waterMesh, waterMat, grassMesh, grassMat, rainMesh, rainMat, heightTex;
const QUALITY = { level: 'high' };
const SUN_DIR = new THREE.Vector3(-0.62, 0.36, 0.38).normalize();
const ENV = {
  clear: { hor: new THREE.Color(0xa6afb3), top: new THREE.Color(0x6c8290), fog: 0.0040, sun: 2.5, hemi: 1.25 },
  storm: { hor: new THREE.Color(0x646b70), top: new THREE.Color(0x444c53), fog: 0.0095, sun: 0.55, hemi: 1.05 },
  echo:  { hor: new THREE.Color(0x5e5b6a), top: new THREE.Color(0x3a3848), fog: 0.0105, sun: 0.35, hemi: 1.0 },
  cur:   { hor: new THREE.Color(), top: new THREE.Color() },
};
const COLLIDERS = [];
const COLL_CELL = 16;
const collGrid = new Map();
function addCollider(x, z, r, tag) {
  const c = { x, z, r, tag };
  COLLIDERS.push(c);
  const i0 = Math.floor((x - r + HALF) / COLL_CELL), i1 = Math.floor((x + r + HALF) / COLL_CELL);
  const j0 = Math.floor((z - r + HALF) / COLL_CELL), j1 = Math.floor((z + r + HALF) / COLL_CELL);
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    const key = j * 1000 + i; let l = collGrid.get(key); if (!l) { l = []; collGrid.set(key, l); } l.push(c);
  }
  return c;
}
function collidersAt(x, z) { return collGrid.get(Math.floor((z + HALF) / COLL_CELL) * 1000 + Math.floor((x + HALF) / COLL_CELL)) || []; }

function initRenderer() {
  renderer = new THREE.WebGLRenderer({ canvas: $('game'), antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.setSize(innerWidth, innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  scene = new THREE.Scene();
  camera = new THREE.PerspectiveCamera(58, innerWidth / innerHeight, 0.1, 2600);
  scene.fog = new THREE.FogExp2(ENV.clear.hor.clone(), ENV.clear.fog);
  scene.background = ENV.clear.hor.clone();

  hemi = new THREE.HemisphereLight(0xc4d2dc, 0x3b3a2e, ENV.clear.hemi);
  scene.add(hemi);
  sun = new THREE.DirectionalLight(0xffe1c2, ENV.clear.sun);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  const sc = sun.shadow.camera; sc.left = -40; sc.right = 40; sc.top = 40; sc.bottom = -40; sc.near = 1; sc.far = 320;
  sun.shadow.bias = -0.0004; sun.shadow.normalBias = 0.05;
  scene.add(sun, sun.target);
}

/* ---------- sky ---------- */
const GLSL_NOISE = `
float h21(vec2 p){ p = fract(p*vec2(233.34, 851.73)); p += dot(p, p + 23.45); return fract(p.x*p.y); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); vec2 u = f*f*(3.0-2.0*f);
  return mix(mix(h21(i), h21(i+vec2(1.0,0.0)), u.x), mix(h21(i+vec2(0.0,1.0)), h21(i+vec2(1.0,1.0)), u.x), u.y); }
float fbm4(vec2 p){ float s = 0.0, a = 0.5; for(int i=0;i<4;i++){ s += a*vn(p); p = p*2.03 + vec2(1.7, 9.2); a *= 0.5; } return s; }
`;
function buildSky() {
  skyMat = new THREE.ShaderMaterial({
    uniforms: { uTop: { value: new THREE.Color() }, uHor: { value: new THREE.Color() }, uSunDir: { value: SUN_DIR }, uSunCol: { value: new THREE.Color(0xffd9b0) }, uTime: { value: 0 }, uStorm: { value: 0 } },
    vertexShader: `varying vec3 vDir; void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uTop, uHor, uSunDir, uSunCol; uniform float uTime, uStorm; varying vec3 vDir;
      ${GLSL_NOISE}
      void main(){
        vec3 d = normalize(vDir);
        float h = d.y;
        vec3 col = mix(uHor, uTop, smoothstep(-0.04, 0.55, h));
        float sd = max(dot(d, uSunDir), 0.0);
        float clear = 1.0 - uStorm*0.85;
        col += uSunCol * (pow(sd, 6.0)*0.16 + pow(sd, 48.0)*0.45 + pow(sd, 900.0)*2.5) * clear;
        if (h > -0.03) {
          float hh = max(h, 0.0);
          vec2 uv = d.xz / (hh + 0.16) * 0.8 + vec2(uTime*0.005, uTime*0.0018);
          float c = fbm4(uv*1.3) * 0.7 + fbm4(uv*4.1 + 3.0)*0.3;
          float cov = mix(0.40, 0.2, uStorm);
          float cm = smoothstep(cov, cov + 0.32, c) * smoothstep(-0.03, 0.16, h);
          vec3 cc = mix(uHor*1.06, uTop*0.7, smoothstep(0.45, 0.95, c));
          cc += uSunCol * pow(sd, 3.0) * 0.12 * clear;
          col = mix(col, cc, cm*0.8);
        }
        gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, depthWrite: false, fog: false,
  });
  skyMesh = new THREE.Mesh(new THREE.SphereGeometry(2000, 32, 16), skyMat);
  skyMesh.renderOrder = -10; skyMesh.frustumCulled = false;
  scene.add(skyMesh);
}
