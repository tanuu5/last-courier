'use strict';
// Meshes for cargo, stations, structures, echoes, scan markers and network lines.

/* =========================================================
   Cargo
   ========================================================= */
const SIZES = { S: [0.44, 0.28, 0.38], M: [0.56, 0.36, 0.46], L: [0.66, 0.46, 0.52] };
const cargoGeoCache = {};
function cargoMesh(type, sizeKey) {
  const ct = CTYPES[type];
  const sz = SIZES[sizeKey];
  const g = new THREE.Group();
  const key = sizeKey;
  if (!cargoGeoCache[key]) {
    cargoGeoCache[key] = {
      box: new THREE.BoxGeometry(sz[0], sz[1], sz[2]),
      band: new THREE.BoxGeometry(sz[0] + 0.012, sz[1] * 0.22, sz[2] + 0.012),
      edge: new THREE.BoxGeometry(0.03, sz[1] + 0.01, 0.03),
      led: new THREE.BoxGeometry(0.05, 0.03, 0.01),
    };
  }
  const G = cargoGeoCache[key];
  const mBody = new THREE.MeshStandardMaterial({ color: ct.color, roughness: 0.55, metalness: 0.25 });
  const mBand = new THREE.MeshStandardMaterial({ color: ct.band, roughness: 0.5, metalness: 0.1 });
  const mLed = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x9be8b4, emissiveIntensity: 2.6 });
  mk(G.box, mBody, g);
  mk(G.band, mBand, g, 0, sz[1] * 0.12, 0);
  for (const sx of [-1, 1]) for (const sz2 of [-1, 1]) mk(G.edge, MAT.dark, g, sx * sz[0] / 2, 0, sz2 * sz[2] / 2);
  const led = mk(G.led, mLed, g, sz[0] * 0.3, -sz[1] * 0.22, sz[2] / 2 + 0.006);
  const led2 = mk(G.led, mLed, g, -sz[0] * 0.3, -sz[1] * 0.22, -sz[2] / 2 - 0.006);
  g.userData.mats = { body: mBody, band: mBand, led: mLed };
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function sizeFor(w) { return w < 10 ? 'S' : w < 19 ? 'M' : 'L'; }
function condColor(c) { return c > 60 ? 0x9be8b4 : c > 30 ? 0xf5d06a : 0xff6b5e; }

/* =========================================================
   Stations
   ========================================================= */
const beamMatBase = () => new THREE.ShaderMaterial({
  uniforms: { uCol: { value: new THREE.Color(0x86e1f2) }, uA: { value: 0.0 }, uTime: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `uniform vec3 uCol; uniform float uA, uTime; varying vec2 vUv;
    void main(){ float a = uA * pow(max(1.0 - vUv.y, 0.0), 1.6) * (0.75 + 0.25*sin(vUv.y*80.0 - uTime*3.0));
      gl_FragColor = vec4(uCol * 2.0, clamp(a, 0.0, 1.0)); }`,
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
});
function textSprite(lines, opts = {}) {
  const w = opts.w || 512, h = opts.h || 128;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const x = c.getContext('2d');
  x.clearRect(0, 0, w, h);
  if (opts.bg) { x.fillStyle = opts.bg; x.fillRect(0, 0, w, h); x.strokeStyle = opts.border || 'rgba(134,225,242,.8)'; x.lineWidth = 3; x.strokeRect(2, 2, w - 4, h - 4); }
  x.textAlign = 'center'; x.textBaseline = 'middle';
  lines.forEach((l, i) => {
    x.font = l.font || `500 ${l.size || 40}px "Zen Kaku Gothic New", "Hiragino Sans", sans-serif`;
    x.fillStyle = l.color || '#e6ecef';
    x.fillText(l.text, w / 2, l.y != null ? l.y : h / 2 + (i - (lines.length - 1) / 2) * (l.size || 40) * 1.2);
  });
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 4;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, fog: false });
  const s = new THREE.Sprite(mat);
  s.scale.set(opts.sx || 6, (opts.sx || 6) * h / w, 1);
  return s;
}
function buildStation(node) {
  const g = new THREE.Group();
  g.position.set(node.x, node.y, node.z);
  // face toward world centre-ish
  const face = Math.atan2(-node.x, -node.z);
  g.rotation.y = face;
  node.face = face;
  // pad
  const pad = mk(new THREE.CylinderGeometry(7, 7.4, 0.5, 6), MAT.concrete, g, 0, 0.12, 0); pad.receiveShadow = true;
  mk(new THREE.CylinderGeometry(4.2, 4.2, 0.52, 6), MAT.concreteDark, g, 0, 0.13, 0).receiveShadow = true;
  const ringMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff6b5e, emissiveIntensity: 1.6 });
  const ring = new THREE.Mesh(new THREE.TorusGeometry(5.6, 0.06, 6, 6), ringMat);
  ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.y = 0.39; g.add(ring);
  // building behind pad (local -z)
  const bz = -13;
  const kind = node.kind;
  if (kind === 'hub') {
    mk(new THREE.BoxGeometry(14, 6, 8), MAT.panel, g, 0, 3, bz);
    mk(new THREE.BoxGeometry(14.4, 0.6, 8.4), MAT.dark, g, 0, 6.2, bz);
    mk(new THREE.BoxGeometry(5, 4, 0.3), MAT.dark, g, 0, 2, bz + 4.05);
    mk(new THREE.BoxGeometry(5.2, 0.15, 0.4), MAT.accent, g, 0, 4.1, bz + 4.1);
    mk(new THREE.CylinderGeometry(2.2, 2.6, 9, 16), MAT.panel, g, 7.5, 4.5, bz - 1);
    addLocalCollider(node, g, 0, bz, 7.6); addLocalCollider(node, g, 7.5, bz - 1, 2.8); addLocalCollider(node, g, -5, bz, 5);
  } else if (kind === 'dome') {
    const d = mk(new THREE.SphereGeometry(6.5, 28, 14, 0, TAU, 0, Math.PI / 2), MAT.panel, g, 0, 0, bz);
    d.receiveShadow = true;
    mk(new THREE.TorusGeometry(6.55, 0.18, 6, 32), MAT.dark, g, 0, 0.4, bz).rotation.x = Math.PI / 2;
    mk(new THREE.BoxGeometry(3, 3, 3), MAT.panel, g, 0, 1.5, bz + 6);
    mk(new THREE.BoxGeometry(2, 2.4, 0.1), MAT.dark, g, 0, 1.2, bz + 7.55);
    mk(new THREE.BoxGeometry(2.2, 0.12, 0.2), MAT.accent, g, 0, 2.6, bz + 7.6);
    addLocalCollider(node, g, 0, bz, 6.8); addLocalCollider(node, g, 0, bz + 6, 2.2);
  } else if (kind === 'plant') {
    mk(new THREE.BoxGeometry(10, 5, 7), MAT.panel, g, -2, 2.5, bz);
    mk(new THREE.CylinderGeometry(1.4, 1.8, 14, 14), MAT.concrete, g, 5, 7, bz - 1);
    mk(new THREE.CylinderGeometry(2.4, 2.4, 4.5, 16), MAT.metal, g, 5, 2.25, bz + 3.5);
    mk(new THREE.BoxGeometry(10.4, 0.4, 7.4), MAT.dark, g, -2, 5.1, bz);
    mk(new THREE.BoxGeometry(3, 3.2, 0.2), MAT.dark, g, -2, 1.6, bz + 3.55);
    addLocalCollider(node, g, -2, bz, 6); addLocalCollider(node, g, 5, bz - 1, 2); addLocalCollider(node, g, 5, bz + 3.5, 2.6);
  } else {
    mk(new THREE.BoxGeometry(6, 4, 6), MAT.panel, g, 0, 2, bz + 2);
    mk(new THREE.BoxGeometry(6.3, 0.35, 6.3), MAT.dark, g, 0, 4.1, bz + 2);
    mk(new THREE.BoxGeometry(2, 2.6, 0.12), MAT.dark, g, 0, 1.3, bz + 5.06);
    addLocalCollider(node, g, 0, bz + 2, 4.3);
  }
  // mast
  const mastH = kind === 'tower' ? 30 : 18;
  const mx = kind === 'tower' ? 0 : -6, mz = kind === 'tower' ? bz - 3 : bz + 5;
  mk(new THREE.CylinderGeometry(0.16, 0.3, mastH, 8), MAT.metal, g, mx, mastH / 2, mz);
  for (let y = 4; y < mastH; y += 4.5) mk(new THREE.BoxGeometry(1.4, 0.08, 0.08), MAT.metal, g, mx, y, mz);
  const lampMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xff6b5e, emissiveIntensity: 5 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.32, 12, 8), lampMat); lamp.position.set(mx, mastH + 0.3, mz); g.add(lamp);
  addLocalCollider(node, g, mx, mz, 0.6);
  // terminal pillar at pad edge (+z side facing player approach)
  const tx = 3.2, tz = 3.6;
  mk(new THREE.BoxGeometry(0.7, 1.35, 0.45), MAT.panel, g, tx, 0.95, tz);
  const scrMat = new THREE.MeshStandardMaterial({ color: 0x0a0d10, emissive: 0x86e1f2, emissiveIntensity: 1.8 });
  const scr = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.36, 0.02), scrMat); scr.position.set(tx, 1.35, tz + 0.235); g.add(scr);
  mk(new THREE.BoxGeometry(0.74, 0.06, 0.5), MAT.accent, g, tx, 1.64, tz);
  // light beam
  const beamMat = beamMatBase();
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 1.4, 420, 16, 1, true), beamMat);
  beam.position.set(0, 210, 0); beam.renderOrder = 6; g.add(beam);
  // name sprite
  const label = textSprite([{ text: node.en, size: 30, color: '#86e1f2', font: '600 30px "Chakra Petch", sans-serif' }, { text: node.name, size: 44 }], { w: 512, h: 150, sx: 7 });
  label.position.set(0, 6.5, 0); label.material.opacity = 0; g.add(label);
  scene.add(g);
  g.updateMatrixWorld(true);
  const tp = new THREE.Vector3(tx, 0, tz + 0.9).applyMatrix4(g.matrixWorld);
  node.terminal = { x: tp.x, z: tp.z };
  node.mesh = { g, ringMat, lampMat, scrMat, beamMat, label, beam };
}
function addLocalCollider(node, g, lx, lz, r) {
  const c = Math.cos(g.rotation.y), s = Math.sin(g.rotation.y);
  const wx = node.x + lx * c + lz * s, wz = node.z - lx * s + lz * c;
  addCollider(wx, wz, r, 'station');
}

/* =========================================================
   Structures (ladders, chargers, signs)
   ========================================================= */
function ladderMesh(p0, p1, owner) {
  const g = new THREE.Group();
  const d = new THREE.Vector3().subVectors(p1, p0);
  const len = d.length();
  const mat = owner === 'you' ? new THREE.MeshStandardMaterial({ color: 0xd9d6cf, roughness: 0.45, metalness: 0.4 }) : new THREE.MeshStandardMaterial({ color: 0x9aa4ab, roughness: 0.5, metalness: 0.5 });
  const accent = owner === 'you' ? MAT.accent : new THREE.MeshStandardMaterial({ color: 0x86e1f2, emissive: 0x86e1f2, emissiveIntensity: 0.6 });
  for (const s of [-1, 1]) mk(new THREE.BoxGeometry(0.06, 0.1, len), mat, g, s * 0.42, 0, 0);
  const rungs = Math.floor(len / 0.32);
  const rg = new THREE.BoxGeometry(0.84, 0.035, 0.06);
  for (let i = 0; i <= rungs; i++) mk(rg, mat, g, 0, 0.02, -len / 2 + i * (len / rungs));
  for (const e of [-1, 1]) for (const s of [-1, 1]) mk(new THREE.BoxGeometry(0.08, 0.16, 0.12), accent, g, s * 0.42, 0, e * len / 2);
  g.position.copy(p0).add(p1).multiplyScalar(0.5);
  g.lookAt(p1.x, p1.y, p1.z);
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  return g;
}
function chargerMesh(owner) {
  const g = new THREE.Group();
  mk(new THREE.CylinderGeometry(0.5, 0.65, 0.3, 8), MAT.dark, g, 0, 0.15, 0);
  mk(new THREE.BoxGeometry(0.34, 2.0, 0.34), owner === 'you' ? MAT.shell : MAT.panel, g, 0, 1.2, 0);
  mk(new THREE.BoxGeometry(0.4, 0.1, 0.4), MAT.accent, g, 0, 2.25, 0);
  const coreMat = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x9be8b4, emissiveIntensity: 3 });
  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.2), coreMat); core.position.y = 2.65; g.add(core);
  const ringMat = new THREE.MeshBasicMaterial({ color: 0x9be8b4, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(11.6, 12, 64), ringMat); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.15; g.add(ring);
  g.userData.core = core; g.userData.ring = ring;
  g.traverse((o) => { if (o.isMesh && o !== ring) o.castShadow = true; });
  return g;
}
const SIGN_TYPES = [
  { icon: '⚠', text: '急斜面 注意', color: '#f5d06a' },
  { icon: '⚡', text: '充電ポストあり', color: '#9be8b4' },
  { icon: '👍', text: 'がんばれ', color: '#86e1f2' },
  { icon: '◎', text: 'エコー 注意', color: '#b99cff' },
  { icon: '≈', text: 'この先 浅瀬', color: '#86e1f2' },
];
function signMesh(typeIdx, owner) {
  const t = SIGN_TYPES[typeIdx];
  const g = new THREE.Group();
  mk(new THREE.CylinderGeometry(0.05, 0.07, 1.6, 6), MAT.dark, g, 0, 0.8, 0);
  const s = textSprite([{ text: t.icon, size: 70, color: t.color, y: 62 }, { text: t.text, size: 30, y: 128 }, { text: owner, size: 20, color: 'rgba(230,236,239,.6)', y: 166 }], { w: 256, h: 192, sx: 1.6, bg: 'rgba(10,15,20,.55)', border: t.color });
  s.position.y = 2.3; g.add(s);
  g.userData.sprite = s;
  return g;
}

/* =========================================================
   Echo entities
   ========================================================= */
let echoMat, echoGeo, threadMat;
function buildEchoAssets() {
  const pts = [];
  const prof = [[0, 0], [0.18, 0.1], [0.24, 0.5], [0.3, 1.2], [0.36, 1.6], [0.3, 1.85], [0.12, 1.95], [0.1, 2.02], [0, 2.02]];
  prof.forEach(([r, y]) => pts.push(new THREE.Vector2(r, y)));
  const body = new THREE.LatheGeometry(pts, 14);
  const head = new THREE.SphereGeometry(0.2, 14, 10); head.scale(0.9, 1.15, 0.9); head.translate(0, 2.28, 0);
  const armL = new THREE.CylinderGeometry(0.05, 0.035, 1.5, 6); armL.translate(0.4, 1.1, 0); armL.rotateZ(0.08);
  const armR = new THREE.CylinderGeometry(0.05, 0.035, 1.5, 6); armR.translate(-0.4, 1.1, 0); armR.rotateZ(-0.08);
  echoGeo = mergeGeometries([body.toNonIndexed(), head.toNonIndexed(), armL.toNonIndexed(), armR.toNonIndexed()].map((g) => { g.deleteAttribute('uv'); return g; }));
  echoGeo.scale(1.3, 1.5, 1.3);
  echoMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uA: { value: 0 }, uAlert: { value: 0 } },
    vertexShader: `varying vec3 vN; varying vec3 vV; varying float vY; uniform float uTime;
      void main(){ vec3 p = position; float g = step(0.93, fract(sin(floor(p.y*14.0) + floor(uTime*12.0))*437.5)); p.x += g*0.12*sin(uTime*50.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; vY = position.y; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime, uA, uAlert; varying vec3 vN; varying vec3 vV; varying float vY;
      void main(){ float nv = abs(dot(normalize(vN), normalize(vV)));
        float rim = pow(clamp(1.0 - nv, 0.0, 1.0), 2.0);
        float scan = 0.7 + 0.3*step(0.5, fract(vY*16.0 - uTime*2.5));
        vec3 col = mix(vec3(0.03, 0.02, 0.05), mix(vec3(0.62, 0.52, 1.0), vec3(1.0, 0.4, 0.35), uAlert), rim);
        float a = uA * (0.3 + rim*0.9) * scan * smoothstep(-0.2, 0.6, vY);
        gl_FragColor = vec4(col*(1.0 + rim*1.5), clamp(a, 0.0, 1.0)); }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
  });
  threadMat = new THREE.ShaderMaterial({
    uniforms: { uA: { value: 0 }, uTime: { value: 0 } },
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `uniform float uA, uTime; varying vec2 vUv; void main(){ float a = uA * pow(max(1.0 - vUv.y, 0.0), 2.0) * (0.6 + 0.4*sin(vUv.y*120.0 - uTime*6.0)); gl_FragColor = vec4(vec3(0.7, 0.6, 1.0)*1.5, clamp(a, 0.0, 1.0)); }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
  });
}
function makeEcho(x, z) {
  const mat = echoMat.clone();
  const tmat = threadMat.clone();
  const m = new THREE.Mesh(echoGeo, mat);
  const thread = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 60, 4, 1, true), tmat);
  thread.position.y = 33.6; m.add(thread);
  m.renderOrder = 4;
  scene.add(m);
  const h = terrainHeight(x, z);
  m.position.set(x, h + 0.4, z);
  return { mesh: m, mat, tmat, anchor: new THREE.Vector2(x, z), pos: new THREE.Vector3(x, h + 0.4, z), target: new THREE.Vector2(x, z), wanderT: 0, alert: 0, state: 'idle', alpha: 0, respawn: 0 };
}

/* =========================================================
   Scanner markers
   ========================================================= */
let markerMesh;
const MARK_MAX = 900;
function buildMarkers() {
  const geo = new THREE.ConeGeometry(0.16, 0.42, 3, 1); geo.rotateX(Math.PI); geo.translate(0, 0.21, 0);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.95, toneMapped: false, depthWrite: false });
  markerMesh = new THREE.InstancedMesh(geo, mat, MARK_MAX);
  markerMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  markerMesh.count = 0; markerMesh.frustumCulled = false; markerMesh.renderOrder = 7;
  for (let i = 0; i < MARK_MAX; i++) markerMesh.setColorAt(i, new THREE.Color(1, 1, 1));
  scene.add(markerMesh);
}

/* waypoint */
let waypointMesh;
function buildWaypoint() {
  const mat = beamMatBase(); mat.uniforms.uCol.value.setHex(0x86e1f2); mat.uniforms.uA.value = 0.6;
  waypointMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 160, 8, 1, true), mat);
  waypointMesh.visible = false; waypointMesh.renderOrder = 6;
  scene.add(waypointMesh);
}

/* network lines between connected nodes */
const NET_LINES = [];
function buildNetLine(a, b) {
  const A = new THREE.Vector3(a.x, a.y + 30, a.z), B = new THREE.Vector3(b.x, b.y + 30, b.z);
  const mid = A.clone().add(B).multiplyScalar(0.5); mid.y += A.distanceTo(B) * 0.22 + 40;
  const curve = new THREE.QuadraticBezierCurve3(A, mid, B);
  const geo = new THREE.TubeGeometry(curve, 80, 0.5, 6, false);
  const mat = new THREE.MeshBasicMaterial({ color: 0x86e1f2, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, fog: true });
  mat.color.multiplyScalar(2.2);
  const m = new THREE.Mesh(geo, mat);
  geo.setDrawRange(0, 0);
  m.renderOrder = 6;
  scene.add(m);
  const line = { mesh: m, total: geo.index.count, t: 0 };
  NET_LINES.push(line);
  return line;
}
