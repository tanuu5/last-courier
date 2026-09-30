'use strict';
// Rain, post-processing and quality settings.

/* ---------- rain ---------- */
function buildRain() {
  const N = 5200;
  const seeds = new Float32Array(N * 2 * 3), ends = new Float32Array(N * 2), pos = new Float32Array(N * 2 * 3);
  for (let i = 0; i < N; i++) {
    const a = rand(), b = rand(), c = rand();
    for (let k = 0; k < 2; k++) { seeds.set([a, b, c], (i * 2 + k) * 3); ends[i * 2 + k] = k; }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 3));
  g.setAttribute('aEnd', new THREE.BufferAttribute(ends, 1));
  rainMat = new THREE.ShaderMaterial({
    uniforms: { uCam: { value: new THREE.Vector3() }, uTime: { value: 0 }, uI: { value: 0 }, uBox: { value: 42 } },
    vertexShader: `uniform vec3 uCam; uniform float uTime, uI, uBox; attribute vec3 aSeed; attribute float aEnd; varying float vA;
      void main(){
        vec3 p = aSeed * uBox;
        float sp = 19.0 + aSeed.x*7.0;
        p.y -= uTime*sp; p.x += uTime*2.2;
        vec3 rel = mod(p - uCam + uBox*0.5, uBox) - uBox*0.5;
        vec3 wp = uCam + rel + vec3(-0.08, 0.75, 0.0)*aEnd;
        vA = uI * (1.0 - smoothstep(uBox*0.25, uBox*0.5, length(rel))) * (0.35 + 0.65*aEnd);
        gl_Position = projectionMatrix * viewMatrix * vec4(wp, 1.0);
      }`,
    fragmentShader: `varying float vA; void main(){ gl_FragColor = vec4(0.75, 0.8, 0.85, vA*0.55); }`,
    transparent: true, depthWrite: false,
  });
  rainMesh = new THREE.LineSegments(g, rainMat);
  rainMesh.frustumCulled = false; rainMesh.visible = false; rainMesh.renderOrder = 5;
  scene.add(rainMesh);
}

/* ---------- post ---------- */
const GradeShader = {
  uniforms: { tDiffuse: { value: null }, uTime: { value: 0 }, uGlitch: { value: 0 }, uVig: { value: 0.75 }, uGrain: { value: 0.035 }, uEcho: { value: 0 }, uFlash: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime, uGlitch, uVig, uGrain, uEcho, uFlash; varying vec2 vUv;
    float hh(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main(){
      vec2 uv = vUv;
      if (uGlitch > 0.001) {
        float band = floor(uv.y*38.0 + floor(uTime*12.0)*3.0);
        float on = step(0.72, hh(vec2(band*1.3, floor(uTime*9.0))));
        uv.x += (hh(vec2(band, floor(uTime*15.0))) - 0.5) * 0.06 * uGlitch * on;
      }
      vec2 dir = uv - 0.5;
      float ca = 0.0012 + uGlitch*0.014;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + dir*ca).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - dir*ca).b;
      col = max(col, vec3(0.0));
      float lum = dot(col, vec3(0.299, 0.587, 0.114));
      col = mix(col, vec3(lum)*vec3(0.86, 0.82, 1.08), clamp(uEcho*0.5 + uGlitch*0.3, 0.0, 1.0));
      float v = smoothstep(0.95, 0.25, length(dir*vec2(1.0, 0.85)));
      col *= mix(1.0, v, uVig);
      col += (hh(uv*vec2(1731.0, 977.0) + fract(uTime*7.1)*91.0) - 0.5) * (uGrain + uGlitch*0.12) * (0.4 + lum);
      col += vec3(uFlash);
      gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
    }`,
};
function initPost() {
  const size = renderer.getDrawingBufferSize(new THREE.Vector2());
  const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
  composer = new EffectComposer(renderer, rt);
  renderPass = new RenderPass(scene, camera);
  composer.addPass(renderPass);
  bloomPass = new UnrealBloomPass(new THREE.Vector2(innerWidth / 2, innerHeight / 2), 0.55, 0.55, 1.05);
  composer.addPass(bloomPass);
  gradePass = new ShaderPass(GradeShader);
  composer.addPass(gradePass);
  composer.addPass(new OutputPass());
}
function applyQuality() {
  const hi = QUALITY.level === 'high';
  renderer.setPixelRatio(hi ? Math.min(devicePixelRatio, 1.5) : 1);
  renderer.setSize(innerWidth, innerHeight);
  if (composer) composer.setSize(innerWidth, innerHeight);
  renderer.shadowMap.enabled = hi;
  sun.castShadow = hi;
  scene.traverse((o) => { if (o.material) { const mats = Array.isArray(o.material) ? o.material : [o.material]; mats.forEach((m) => { m.needsUpdate = true; }); } });
  if (grassMesh) grassMesh.geometry.instanceCount = hi ? GRASS_COUNT : Math.floor(GRASS_COUNT * 0.45);
}
const GRASS_COUNT = 26000;
