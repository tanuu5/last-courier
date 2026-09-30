'use strict';
// Global game state, player state and tuning constants.

/* =========================================================
   Game state
   ========================================================= */
const G = {
  mode: 'loading', time: 0, orders: [], cargo: [], structures: [], echoes: [], storms: [],
  unlocks: { ladder: false, charger: false, stabilizer: false, frame: false, scanner: false },
  stats: { delivered: 0, distance: 0, falls: 0, acksRecv: 0, acksSent: 0, grades: { S: 0, A: 0, B: 0, C: 0 }, orders: 0, lostFound: 0 },
  trust: 0, flags: {}, waypoint: null, nextId: 1, ackTimer: 60, autosave: 60, ended: false, cine: null,
  archive: { unlocked: {}, read: {} }, shards: {}, shardSeen: {},
  items: {}, paint: { accent: 'orange', visor: 'cyan' },
};
const player = {
  pos: new THREE.Vector3(), vel: new THREE.Vector3(), heading: 0, vy: 0, grounded: true,
  battery: 100, cond: 100, stuckT: 0, state: 'move', stateT: 0, tilt: { x: 0, z: 0 }, tiltV: { x: 0, z: 0 },
  speed: 0, sneak: false, run: false, cargo: [], tools: { ladder: 0, charger: 0 },
  noiseT: 0, prevVel: new THREE.Vector2(), placing: null, pickT: 0, depth: 0, sliding: 0,
  grip: [false, false], sensor: 0, sensorDir: null, sensorAlert: false, lookYaw: 0, hijack: null, lastNode: 0,
};
let robot;
const input = { keys: {}, mouse: [false, false, false], locked: false, fHeld: false };
const camState = { yaw: 0, pitch: 0.32, dist: 6.2, tDist: 6.2, target: new THREE.Vector3(), cur: new THREE.Vector3() };
const SETTINGS = { vol: 0.7, sens: 1.0 };
const TOOL_MAX = { ladder: 4, charger: 2 };
const BAL = { inst0: 0.8, instH: 1.1, instW: 1.4, k: 2.7, kIdle: 2.6, c: 2.3, side: 0.55, fwd: 0.45, noise: 1.25, accel: 0.075, grip: 9, gripBase: 1.3, wrong: 0.8 };

function capacity() { return G.unlocks.frame ? 90 : 60; }
function totalWeight() { return player.cargo.reduce((s, c) => s + c.w, 0) + (player.tools.ladder * 2.5) + (player.tools.charger * 4); }
function cargoWeight() { return player.cargo.reduce((s, c) => s + c.w, 0); }
function stackHeight() { return robot ? (robot.stackHeight || 0) : 0; }

/* walkable surface height */
function ladderHeightAt(s, x, z) {
  const dx = s.p1.x - s.p0.x, dz = s.p1.z - s.p0.z; const L2 = dx * dx + dz * dz;
  let t = ((x - s.p0.x) * dx + (z - s.p0.z) * dz) / L2;
  if (t < -0.03 || t > 1.03) return null;
  t = clamp(t, 0, 1);
  const px = s.p0.x + dx * t, pz = s.p0.z + dz * t;
  if ((x - px) * (x - px) + (z - pz) * (z - pz) > 0.3) return null;
  return lerp(s.p0.y, s.p1.y, t) + 0.07;
}
let _onLadder = null;
function groundAt(x, z, y) {
  let h = terrainHeight(x, z);
  _onLadder = null;
  for (const n of NODES) {
    const d = Math.hypot(x - n.x, z - n.z);
    if (d < 6.4) h = Math.max(h, n.y + 0.37);
    else if (d < 7.2) h = Math.max(h, n.y + 0.37 - (d - 6.4) * 0.5);
  }
  for (const s of G.structures) {
    if (s.type !== 'ladder' || !s.visible) continue;
    const lh = ladderHeightAt(s, x, z);
    if (lh !== null && lh > h - 0.05 && lh <= y + 0.8) { h = Math.max(h, lh); _onLadder = s; }
  }
  return h;
}
