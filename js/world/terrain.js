'use strict';
// Heightmap generation, rivers, station flattening and terrain sampling.

/* =========================================================
   Terrain generation
   ========================================================= */
const H = new Float32Array(VN * VN);
const ROCK = new Float32Array(VN * VN);
const FLOWX = new Float32Array(VN * VN);
const FLOWZ = new Float32Array(VN * VN);
const RIVER_SAMPLES = []; // {x,z,tx,tz,w,dep,river}

function baseHeight(x, z) {
  const wx = x + 55 * fbm(N2, x * 0.0017 + 3.1, z * 0.0017 - 1.7, 3);
  const wz = z + 55 * fbm(N2, x * 0.0017 - 8.3, z * 0.0017 + 5.9, 3);
  let h = 25 + 19 * fbm(N1, wx * 0.0021, wz * 0.0021, 5);
  const mask = smoothstep(0.08, 0.6, N3(x * 0.0016 + 20, z * 0.0016 - 14));
  const r = ridged(N1, wx * 0.0036 + 50, wz * 0.0036 + 50, 5);
  h += mask * r * r * 62;
  h += 62 * gauss(x, z, -300, -285, 105);
  const ridgeZ = Math.exp(-((z + 318) * (z + 318)) / (2 * 40 * 40));
  const ridgeX = smoothstep(-230, -130, x) * (1 - smoothstep(260, 360, x));
  const pass = 1 - 0.74 * Math.exp(-((x - 55) * (x - 55)) / (2 * 36 * 36));
  h += 50 * ridgeZ * ridgeX * pass * (0.8 + 0.4 * r);
  h += 28 * gauss(x, z, -10, 150, 62);
  h -= 34 * gauss(x, z, 352, -150, 64);
  h -= 9 * gauss(x, z, ECHO_ZONE.x, ECHO_ZONE.z, 70);
  h += 1.25 * fbm(N3, x * 0.045, z * 0.045, 3);
  const e = Math.max(Math.abs(x), Math.abs(z));
  h += smoothstep(392, 505, e) * (95 + 30 * N2(x * 0.008, z * 0.008));
  return h;
}

function catmull(p0, p1, p2, p3, t) {
  const t2 = t * t, t3 = t2 * t;
  return 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3);
}

function sampleRivers() {
  RIVERS.forEach((rv, ri) => {
    const P = rv.pts;
    const pts = [];
    for (let k = 0; k < P.length - 1; k++) {
      const p0 = P[Math.max(k - 1, 0)], p1 = P[k], p2 = P[k + 1], p3 = P[Math.min(k + 2, P.length - 1)];
      const segLen = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
      const n = Math.ceil(segLen / 2);
      for (let s = 0; s < n; s++) {
        const t = s / n;
        pts.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
      }
    }
    pts.push(P[P.length - 1]);
    let sAcc = 0;
    for (let k = 0; k < pts.length; k++) {
      const a = pts[Math.max(k - 1, 0)], b = pts[Math.min(k + 1, pts.length - 1)];
      let tx = b[0] - a[0], tz = b[1] - a[1]; const l = Math.hypot(tx, tz) || 1; tx /= l; tz /= l;
      if (k > 0) sAcc += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      let w = 7 + 4.5 * (0.5 + 0.5 * N3(sAcc * 0.006, rv.seed * 11.3));
      const dep = lerp(0.5, 2.9, smoothstep(-0.3, 0.3, N2(sAcc * 0.0095, rv.seed * 7.1)));
      let bank = lerp(0.2, 1.7, smoothstep(0.1, 0.6, N1(sAcc * 0.0045, rv.seed * 3.7)));
      let depF = dep;
      for (const f of FORDS) { const kk = gauss(pts[k][0], pts[k][1], f.x, f.z, f.r); depF = lerp(depF, f.d, kk); bank = lerp(bank, 0.3, kk); }
      for (const f of DEEPS) { const kk = gauss(pts[k][0], pts[k][1], f.x, f.z, f.r); depF = lerp(depF, f.d, kk); bank = lerp(bank, f.bank, kk); }
      for (const f of NARROWS) { const kk = gauss(pts[k][0], pts[k][1], f.x, f.z, f.r); depF = lerp(depF, f.d, kk); bank = lerp(bank, f.bank, kk); w = lerp(w, f.w, kk); }
      RIVER_SAMPLES.push({ x: pts[k][0], z: pts[k][1], tx, tz, w, dep: depF, bank, river: ri, s: sAcc });
    }
  });
}

function generateTerrain() {
  for (let j = 0; j < VN; j++) {
    const z = -HALF + j * CELL;
    for (let i = 0; i < VN; i++) {
      const x = -HALF + i * CELL;
      H[j * VN + i] = baseHeight(x, z);
    }
  }
  // --- rivers: nearest sample per vertex (rasterised) ---
  sampleRivers();
  const R = 72;
  const best = new Float32Array(VN * VN).fill(1e9);
  const bestIdx = new Int32Array(VN * VN).fill(-1);
  const rc = Math.ceil(R / CELL);
  RIVER_SAMPLES.forEach((s, si) => {
    const ci = Math.round((s.x + HALF) / CELL), cj = Math.round((s.z + HALF) / CELL);
    for (let j = Math.max(0, cj - rc); j <= Math.min(GRID, cj + rc); j++) {
      const z = -HALF + j * CELL; const dz = z - s.z;
      for (let i = Math.max(0, ci - rc); i <= Math.min(GRID, ci + rc); i++) {
        const x = -HALF + i * CELL; const dx = x - s.x;
        const d2 = dx * dx + dz * dz;
        const k = j * VN + i;
        if (d2 < best[k]) { best[k] = d2; bestIdx[k] = si; }
      }
    }
  });
  for (let k = 0; k < VN * VN; k++) {
    const si = bestIdx[k]; if (si < 0) continue;
    const s = RIVER_SAMPLES[si];
    const d = Math.sqrt(best[k]);
    if (d > R) continue;
    let target;
    if (d < s.w) target = WATER - s.dep * (1 - (d / s.w) * (d / s.w));
    else target = WATER + (d - s.w) * s.bank;
    const t = smoothstep(R * 0.62, R, d);
    const h = H[k];
    H[k] = lerp(Math.min(h, target), h, t);
    if (d < s.w + 3) {
      const sp = 1.3 * (1 - clamp(d / (s.w + 3), 0, 1));
      FLOWX[k] = s.tx * sp; FLOWZ[k] = s.tz * sp;
    }
  }
  // --- flatten station sites ---
  for (const n of NODES) {
    let sum = 0, cnt = 0;
    for (let a = 0; a < 24; a++) { const ang = a / 24 * TAU; for (const rad of [0, 6, 12]) { sum += rawH(n.x + Math.cos(ang) * rad, n.z + Math.sin(ang) * rad); cnt++; } }
    n.y = Math.max(sum / cnt, WATER + 3.2);
    const ci = Math.round((n.x + HALF) / CELL), cj = Math.round((n.z + HALF) / CELL), rc2 = Math.ceil(48 / CELL);
    for (let j = cj - rc2; j <= cj + rc2; j++) for (let i = ci - rc2; i <= ci + rc2; i++) {
      if (i < 0 || j < 0 || i > GRID || j > GRID) continue;
      const x = -HALF + i * CELL, z = -HALF + j * CELL;
      const d = Math.hypot(x - n.x, z - n.z);
      const t = smoothstep(20, 47, d);
      const k = j * VN + i;
      H[k] = lerp(n.y, H[k], t);
      if (d < 22) { FLOWX[k] = 0; FLOWZ[k] = 0; }
    }
  }
  // --- rockiness ---
  for (let j = 0; j < VN; j++) for (let i = 0; i < VN; i++) {
    const k = j * VN + i;
    const hl = H[j * VN + Math.max(i - 1, 0)], hr = H[j * VN + Math.min(i + 1, GRID)];
    const hu = H[Math.max(j - 1, 0) * VN + i], hd = H[Math.min(j + 1, GRID) * VN + i];
    const gx = (hr - hl) / (2 * CELL), gz = (hd - hu) / (2 * CELL);
    const slope = Math.hypot(gx, gz);
    const x = -HALF + i * CELL, z = -HALF + j * CELL;
    const outcrop = smoothstep(0.35, 0.75, N3(x * 0.021 + 3, z * 0.021 - 9) * 0.5 + 0.5 + 0.35 * N1(x * 0.07, z * 0.07)) * smoothstep(0.12, 0.35, slope);
    ROCK[k] = clamp(smoothstep(0.55, 0.95, slope) + 0.75 * outcrop, 0, 1);
  }
}
function rawH(x, z) { // bilinear on grid while generating
  const gx = clamp((x + HALF) / CELL, 0, GRID - 1e-4), gz = clamp((z + HALF) / CELL, 0, GRID - 1e-4);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const a = H[j * VN + i], b = H[j * VN + i + 1], c = H[(j + 1) * VN + i], d = H[(j + 1) * VN + i + 1];
  return lerp(lerp(a, b, fx), lerp(c, d, fx), fz);
}
function terrainHeight(x, z) { // matches mesh triangulation exactly
  const gx = clamp((x + HALF) / CELL, 0, GRID - 1e-4), gz = clamp((z + HALF) / CELL, 0, GRID - 1e-4);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const k = j * VN + i;
  const a = H[k], b = H[k + 1], c = H[k + VN], d = H[k + VN + 1];
  if (fx + fz < 1) return a + (b - a) * fx + (c - a) * fz;
  return d + (c - d) * (1 - fx) + (b - d) * (1 - fz);
}
function sampleArr(arr, x, z) {
  const gx = clamp((x + HALF) / CELL, 0, GRID - 1e-4), gz = clamp((z + HALF) / CELL, 0, GRID - 1e-4);
  const i = Math.floor(gx), j = Math.floor(gz), fx = gx - i, fz = gz - j;
  const k = j * VN + i;
  return lerp(lerp(arr[k], arr[k + 1], fx), lerp(arr[k + VN], arr[k + VN + 1], fx), fz);
}
const _grad = { x: 0, z: 0 };
function terrainGrad(x, z, e = 1.2) {
  _grad.x = (terrainHeight(x + e, z) - terrainHeight(x - e, z)) / (2 * e);
  _grad.z = (terrainHeight(x, z + e) - terrainHeight(x, z - e)) / (2 * e);
  return _grad;
}
function waterDepth(x, z) { return WATER - terrainHeight(x, z); }
function nearestRiverSample(x, z) {
  let best = null, bd = 1e18;
  for (const s of RIVER_SAMPLES) { const d = (s.x - x) ** 2 + (s.z - z) ** 2; if (d < bd) { bd = d; best = s; } }
  return best;
}
