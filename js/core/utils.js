'use strict';
// Math helpers, seeded random and simplex noise.

/* =========================================================
   Utilities
   ========================================================= */
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smoothstep = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, lambda, dt) => lerp(a, b, 1 - Math.exp(-lambda * dt));
const TAU = Math.PI * 2;
const $ = (id) => document.getElementById(id);
function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function angleDiff(a, b) { let d = (b - a) % TAU; if (d > Math.PI) d -= TAU; if (d < -Math.PI) d += TAU; return d; }
const rand = mulberry32(20260930);
const rr = (a, b) => a + (b - a) * rand();
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeSimplex(seed) {
  const rnd = mulberry32(seed);
  const p = new Uint8Array(256); for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); const t = p[i]; p[i] = p[j]; p[j] = t; }
  const perm = new Uint8Array(512), pm12 = new Uint8Array(512);
  for (let i = 0; i < 512; i++) { perm[i] = p[i & 255]; pm12[i] = perm[i] % 12; }
  const g = [1, 1, -1, 1, 1, -1, -1, -1, 1, 0, -1, 0, 1, 0, -1, 0, 0, 1, 0, -1, 0, 1, 0, -1];
  const F2 = 0.5 * (Math.sqrt(3) - 1), G2 = (3 - Math.sqrt(3)) / 6;
  return function (xin, yin) {
    let n0 = 0, n1 = 0, n2 = 0;
    const s = (xin + yin) * F2; const i = Math.floor(xin + s), j = Math.floor(yin + s);
    const t = (i + j) * G2; const x0 = xin - (i - t), y0 = yin - (j - t);
    let i1, j1; if (x0 > y0) { i1 = 1; j1 = 0; } else { i1 = 0; j1 = 1; }
    const x1 = x0 - i1 + G2, y1 = y0 - j1 + G2, x2 = x0 - 1 + 2 * G2, y2 = y0 - 1 + 2 * G2;
    const ii = i & 255, jj = j & 255;
    let t0 = 0.5 - x0 * x0 - y0 * y0; if (t0 > 0) { const gi = pm12[ii + perm[jj]] * 2; t0 *= t0; n0 = t0 * t0 * (g[gi] * x0 + g[gi + 1] * y0); }
    let t1 = 0.5 - x1 * x1 - y1 * y1; if (t1 > 0) { const gi = pm12[ii + i1 + perm[jj + j1]] * 2; t1 *= t1; n1 = t1 * t1 * (g[gi] * x1 + g[gi + 1] * y1); }
    let t2 = 0.5 - x2 * x2 - y2 * y2; if (t2 > 0) { const gi = pm12[ii + 1 + perm[jj + 1]] * 2; t2 *= t2; n2 = t2 * t2 * (g[gi] * x2 + g[gi + 1] * y2); }
    return 70 * (n0 + n1 + n2);
  };
}
const N1 = makeSimplex(1337), N2 = makeSimplex(7331), N3 = makeSimplex(4242);
function fbm(n, x, y, oct) { let a = 1, f = 1, s = 0, norm = 0; for (let i = 0; i < oct; i++) { s += a * n(x * f, y * f); norm += a; a *= 0.5; f *= 2.02; } return s / norm; }
function ridged(n, x, y, oct) { let a = 1, f = 1, s = 0, norm = 0, w = 1; for (let i = 0; i < oct; i++) { let v = 1 - Math.abs(n(x * f, y * f)); v *= v; v *= w; w = clamp(v * 1.6, 0, 1); s += a * v; norm += a; a *= 0.5; f *= 2.03; } return s / norm; }
function gauss(x, z, cx, cz, s) { const dx = x - cx, dz = z - cz; return Math.exp(-(dx * dx + dz * dz) / (2 * s * s)); }
