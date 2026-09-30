'use strict';
// Grass, rocks and ruins (power lines, wind turbines, monoliths).

/* ---------- grass (GPU-wrapped field around the camera) ---------- */
const grassUniforms = { uCenter: { value: new THREE.Vector3() }, uW: { value: 96 }, uTime: { value: 0 }, uHeight: { value: null }, uNodes: terrainUniforms.uNodes };
function buildGrass(count) {
  const blades = [];
  for (let b = 0; b < 3; b++) {
    const ang = b / 3 * Math.PI + rr(-0.3, 0.3);
    const h = rr(0.2, 0.4), w = 0.05;
    const off = [rr(-0.12, 0.12), rr(-0.12, 0.12)];
    const lean = rr(-0.12, 0.12);
    const verts = [[-w, 0], [w, 0], [-w * 0.6, h * 0.55], [w * 0.6, h * 0.55], [0, h]];
    const pts = verts.map(([x, y]) => {
      const lx = x + lean * (y / h) * (y / h);
      return [off[0] + Math.cos(ang) * lx, y, off[1] + Math.sin(ang) * lx, y / h];
    });
    blades.push(pts);
  }
  const P = [], A = [], I = [];
  blades.forEach((pts) => {
    const base = P.length / 3;
    pts.forEach((p) => { P.push(p[0], p[1], p[2]); A.push(p[3]); });
    I.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4);
  });
  const geo = new THREE.InstancedBufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(new Array(P.length).fill(0).map((_, i) => i % 3 === 1 ? 1 : 0), 3));
  geo.setAttribute('aH', new THREE.Float32BufferAttribute(A, 1));
  geo.setIndex(I);
  const off = new Float32Array(count * 2), rnd = new Float32Array(count * 3);
  const W = grassUniforms.uW.value;
  for (let i = 0; i < count; i++) { off[i * 2] = rand() * W; off[i * 2 + 1] = rand() * W; rnd[i * 3] = rand(); rnd[i * 3 + 1] = rand(); rnd[i * 3 + 2] = rand(); }
  geo.setAttribute('aOff', new THREE.InstancedBufferAttribute(off, 2));
  geo.setAttribute('aRnd', new THREE.InstancedBufferAttribute(rnd, 3));
  geo.instanceCount = count;
  grassUniforms.uHeight.value = heightTex;
  grassMat = new THREE.MeshLambertMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  grassMat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, grassUniforms);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uCenter; uniform float uW; uniform float uTime; uniform vec4 uNodes[${NODES.length}];
        attribute vec2 aOff; attribute vec3 aRnd; attribute float aH;
        varying vec3 vGCol; varying float vGH;
        ${GLSL_NOISE}
        ${GLSL_HDATA}`)
      .replace('#include <begin_vertex>', `
        vec2 rel = mod(aOff - uCenter.xz + uW*0.5, uW) - uW*0.5;
        vec2 wp = uCenter.xz + rel;
        vec4 hd = hData(wp);
        float gh = hd.r;
        float hx = hData(wp + vec2(1.5, 0.0)).r - hData(wp - vec2(1.5, 0.0)).r;
        float hz = hData(wp + vec2(0.0, 1.5)).r - hData(wp - vec2(0.0, 1.5)).r;
        float gslope = length(vec2(hx, hz)) / 3.0;
        float gmask = vn(wp*0.035)*0.65 + vn(wp*0.13 + 4.0)*0.35;
        float gs = (0.5 + aRnd.x*0.65) * smoothstep(0.28, 0.5, gmask);
        gs *= 1.0 - smoothstep(0.32, 0.55, gslope);
        gs *= 1.0 - smoothstep(0.3, 0.6, hd.g);
        gs *= smoothstep(${(WATER + 0.9).toFixed(1)}, ${(WATER + 2.2).toFixed(1)}, gh);
        gs *= 1.0 - smoothstep(76.0, 88.0, gh);
        for (int i = 0; i < ${NODES.length}; i++) { float dn = length(wp - uNodes[i].xy); gs *= smoothstep(uNodes[i].z - 1.0, uNodes[i].z + 5.0, dn); }
        gs *= 1.0 - smoothstep(uW*0.34, uW*0.48, length(rel));
        vec3 transformed = position;
        float ga = aRnd.y*6.2831; float ca = cos(ga), sa = sin(ga);
        transformed.xz = mat2(ca, -sa, sa, ca) * transformed.xz;
        transformed *= gs;
        float wind = sin(uTime*1.6 + wp.x*0.21 + wp.y*0.17)*0.55 + sin(uTime*2.7 + wp.x*0.47)*0.25;
        transformed.x += wind*0.16*aH*aH*gs; transformed.z += wind*0.07*aH*aH*gs;
        transformed += vec3(wp.x, gh - 0.04, wp.y);
        float dry = smoothstep(0.5, 0.72, vn(wp*0.011 + 7.0)*0.9);
        vGCol = mix(mix(vec3(0.24,0.32,0.14), vec3(0.36,0.4,0.19), aRnd.z), vec3(0.47,0.45,0.3), dry*0.8);
        vGH = aH;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vGCol; varying float vGH;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb = vGCol*vGCol*mix(0.42, 1.08, vGH);')
      .replace('#include <normal_fragment_begin>', '#include <normal_fragment_begin>\nnormal = normalize(vNormal);');
  };
  grassMesh = new THREE.Mesh(geo, grassMat);
  grassMesh.frustumCulled = false;
  scene.add(grassMesh);
}

/* ---------- rocks ---------- */
function rockGeometry(seed, detail) {
  const g = new THREE.IcosahedronGeometry(1, detail);
  const n = makeSimplex(seed);
  const p = g.attributes.position;
  const v = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const d = 1 + 0.28 * n(v.x * 1.3 + seed, v.y * 1.3 + v.z) + 0.1 * n(v.x * 3.1, v.z * 3.1 + v.y);
    v.multiplyScalar(d); v.y *= 0.72;
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.deleteAttribute('uv');
  const ng = g.toNonIndexed(); ng.computeVertexNormals();
  const col = new Float32Array(ng.attributes.position.count * 3);
  const nm = ng.attributes.normal;
  const c1 = new THREE.Color(0x6d6a64), c2 = new THREE.Color(0x4f5a34), c = new THREE.Color();
  for (let i = 0; i < nm.count; i++) {
    const up = nm.getY(i);
    c.copy(c1).lerp(c2, smoothstep(0.55, 0.9, up) * 0.85);
    const s = 0.85 + 0.3 * ((i * 7919) % 97) / 97;
    col[i * 3] = c.r * s; col[i * 3 + 1] = c.g * s; col[i * 3 + 2] = c.b * s;
  }
  ng.setAttribute('color', new THREE.BufferAttribute(col, 3));
  return ng;
}
function nearNode(x, z, r) { for (const n of NODES) if (Math.hypot(x - n.x, z - n.z) < r) return true; return false; }
function buildRocks() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.93 });
  const geos = [rockGeometry(11, 1), rockGeometry(29, 1), rockGeometry(47, 2)];
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3(), e = new THREE.Euler();
  const smallCount = 2600, bigCount = 300;
  geos.forEach((geo, gi) => {
    const small = new THREE.InstancedMesh(geo, mat, Math.ceil(smallCount / 3));
    const big = new THREE.InstancedMesh(geo, mat, Math.ceil(bigCount / 3));
    let si = 0, bi = 0, guard = 0;
    while ((si < small.count || bi < big.count) && guard++ < 60000) {
      const x = rr(-HALF + 30, HALF - 30), z = rr(-HALF + 30, HALF - 30);
      const h = terrainHeight(x, z); if (h < WATER + 0.3) continue;
      if (nearNode(x, z, 32)) continue;
      const rk = sampleArr(ROCK, x, z);
      const g = terrainGrad(x, z); const sl = Math.hypot(g.x, g.z);
      const wantBig = bi < big.count && rand() < 0.35;
      const prob = 0.12 + rk * 0.9 + sl * 0.4;
      if (rand() > prob) continue;
      if (wantBig) {
        if (h > 88 && rand() < 0.5) continue;
        const sc = rr(1.3, 3.6) * (0.8 + rk * 0.6);
        e.set(rr(-0.3, 0.3), rand() * TAU, rr(-0.3, 0.3)); q.setFromEuler(e);
        s.set(sc * rr(0.8, 1.3), sc * rr(0.7, 1.2), sc * rr(0.8, 1.3));
        p.set(x, h - sc * 0.25, z);
        m.compose(p, q, s); big.setMatrixAt(bi++, m);
        addCollider(x, z, sc * 0.95, 'rock');
      } else if (si < small.count) {
        const sc = rr(0.12, 0.7);
        e.set(rand() * TAU, rand() * TAU, rand() * TAU); q.setFromEuler(e);
        s.set(sc, sc * rr(0.6, 1.1), sc); p.set(x, h - sc * 0.2, z);
        m.compose(p, q, s); small.setMatrixAt(si++, m);
      }
    }
    small.count = si; big.count = bi;
    big.castShadow = true; big.receiveShadow = true; small.receiveShadow = true;
    scene.add(small, big);
  });
}

/* ---------- ruins: power line, wind turbines, monoliths ---------- */
function beamGeo(a, b, t) {
  const d = new THREE.Vector3().subVectors(b, a); const len = d.length();
  const g = new THREE.BoxGeometry(t, len, t);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  g.applyMatrix4(new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, 1, 1)));
  return g;
}
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
function pylonGeometry() {
  const parts = [];
  const H0 = 24, levels = [0, 6, 12, 17, 21, H0];
  const halfW = (y) => lerp(2.4, 0.55, Math.pow(y / H0, 0.8));
  const corners = (y) => { const w = halfW(y); return [V3(-w, y, -w), V3(w, y, -w), V3(w, y, w), V3(-w, y, w)]; };
  for (let l = 0; l < levels.length - 1; l++) {
    const A = corners(levels[l]), B = corners(levels[l + 1]);
    for (let c = 0; c < 4; c++) {
      parts.push(beamGeo(A[c], B[c], 0.2));
      const n = (c + 1) % 4;
      parts.push(beamGeo(A[c], B[n], 0.07)); parts.push(beamGeo(A[n], B[c], 0.07));
      parts.push(beamGeo(B[c], B[n], 0.1));
    }
  }
  for (const y of [18.5, 22.5]) {
    const w = y > 20 ? 5 : 7;
    parts.push(beamGeo(V3(-w, y, 0), V3(w, y, 0), 0.22));
    parts.push(beamGeo(V3(-w, y, 0), V3(0, y + 2, 0), 0.08)); parts.push(beamGeo(V3(w, y, 0), V3(0, y + 2, 0), 0.08));
    for (const sx of [-w, w]) parts.push(beamGeo(V3(sx, y, 0), V3(sx, y - 1.6, 0), 0.12));
  }
  return mergeGeometries(parts);
}
function buildRuins() {
  const metal = new THREE.MeshStandardMaterial({ color: 0x3e4247, roughness: 0.75, metalness: 0.6 });
  const pylon = pylonGeometry();
  const route = [[-440, 400], [-300, 250], [-180, 120], [-60, 20], [60, -110], [170, -200], [300, -300], [440, -400]];
  const spots = [];
  for (let k = 0; k < route.length - 1; k++) {
    const [ax, az] = route[k], [bx, bz] = route[k + 1];
    const len = Math.hypot(bx - ax, bz - az), n = Math.floor(len / 72);
    for (let s = 0; s < n; s++) { const t = s / n; spots.push([lerp(ax, bx, t) + rr(-8, 8), lerp(az, bz, t) + rr(-8, 8), Math.atan2(bx - ax, bz - az)]); }
  }
  const inst = new THREE.InstancedMesh(pylon, metal, spots.length);
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  const tops = [];
  let c = 0;
  spots.forEach(([x, z, yaw], i) => {
    const h = terrainHeight(x, z);
    if (h < WATER + 0.5 || nearNode(x, z, 40)) { tops.push(null); return; }
    const broken = rand() < 0.28;
    e.set(broken ? rr(-0.35, 0.35) : rr(-0.03, 0.03), yaw + Math.PI / 2, broken ? rr(0.15, 0.5) * (rand() < 0.5 ? -1 : 1) : rr(-0.03, 0.03));
    q.setFromEuler(e);
    m.compose(V3(x, h - (broken ? 1.5 : 0.3), z), q, V3(1, 1, 1));
    inst.setMatrixAt(c++, m);
    addCollider(x, z, 2.6, 'pylon');
    if (!broken) {
      const arm = new THREE.Vector3(1, 0, 0).applyQuaternion(q);
      const up = new THREE.Vector3(0, 1, 0).applyQuaternion(q);
      tops.push([-5, 5].map((w) => V3(x, h - 0.3, z).addScaledVector(up, 21).addScaledVector(arm, w)).concat([-7, 7].map((w) => V3(x, h - 0.3, z).addScaledVector(up, 17).addScaledVector(arm, w))));
    } else tops.push(null);
  });
  inst.count = c; inst.castShadow = true; inst.receiveShadow = true;
  scene.add(inst);
  // wires between consecutive intact pylons
  const wirePts = [];
  for (let i = 0; i < tops.length - 1; i++) {
    const a = tops[i], b = tops[i + 1]; if (!a || !b) continue;
    for (let w = 0; w < 4; w++) {
      const A = a[w], B = b[w]; const segs = 14; const sag = A.distanceTo(B) * 0.045;
      for (let s = 0; s < segs; s++) {
        const t0 = s / segs, t1 = (s + 1) / segs;
        const p0 = A.clone().lerp(B, t0); p0.y -= sag * 4 * t0 * (1 - t0);
        const p1 = A.clone().lerp(B, t1); p1.y -= sag * 4 * t1 * (1 - t1);
        wirePts.push(p0, p1);
      }
    }
  }
  const wires = new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(wirePts), new THREE.LineBasicMaterial({ color: 0x22262a, transparent: true, opacity: 0.8 }));
  scene.add(wires);

  // wind turbines near the observatory
  const tMat = new THREE.MeshStandardMaterial({ color: 0xc9c7c1, roughness: 0.55, metalness: 0.15 });
  TURBINES.length = 0;
  [[-318, 128, 0.12], [-282, 88, 0.09], [-350, 205, 0]].forEach(([x, z, spd], i) => {
    const h = terrainHeight(x, z);
    const g = new THREE.Group(); g.position.set(x, h - 0.5, z); g.rotation.y = 0.9 + i * 0.3;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 1.0, 34, 14), tMat); tower.position.y = 17; tower.castShadow = true;
    const nac = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 4.2), tMat); nac.position.set(0, 34.5, 0.4); nac.castShadow = true;
    const rotor = new THREE.Group(); rotor.position.set(0, 34.5, 2.7);
    rotor.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 12, 10), tMat));
    const nBlades = spd === 0 ? 2 : 3;
    for (let b = 0; b < nBlades; b++) {
      const bl = new THREE.Mesh(new THREE.BoxGeometry(0.9, 15, 0.18), tMat);
      bl.geometry.translate(0, 7.8, 0);
      bl.rotation.z = b / 3 * TAU + (spd === 0 ? 0.4 : 0); bl.castShadow = true; rotor.add(bl);
    }
    g.add(tower, nac, rotor); scene.add(g);
    TURBINES.push({ rotor, spd });
    addCollider(x, z, 1.4, 'turbine');
  });

  // concrete monoliths / collapsed slabs
  const conc = new THREE.MeshStandardMaterial({ color: 0x77736b, roughness: 0.95 });
  let placed = 0, guard = 0;
  while (placed < 26 && guard++ < 3000) {
    const x = rr(-420, 420), z = rr(-420, 420);
    const h = terrainHeight(x, z); if (h < WATER + 1 || nearNode(x, z, 45)) continue;
    const g = terrainGrad(x, z); if (Math.hypot(g.x, g.z) > 0.35) continue;
    const w = rr(1.5, 4), hh = rr(3, 9), d = rr(0.6, 1.4);
    const slab = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), conc);
    slab.position.set(x, h + hh * 0.4, z);
    slab.rotation.set(rr(-0.25, 0.25), rand() * TAU, rr(-0.2, 0.2));
    slab.castShadow = slab.receiveShadow = true;
    scene.add(slab);
    addCollider(x, z, Math.max(w, d) * 0.55, 'slab');
    placed++;
  }
}
const TURBINES = [];
