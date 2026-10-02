'use strict';
// Third-person / cinematic cameras and per-frame visual updates.

/* =========================================================
   Camera
   ========================================================= */
let shakeAmt = 0;
function camShake(a) { shakeAmt = Math.max(shakeAmt, a); }
camState.curD = 6.2;
const _tgt = new THREE.Vector3(), _dir = new THREE.Vector3();
function updateCamera(dt) {
  if (G.cine) { updateCine(dt); return; }
  if (G.mode === 'ending') { endT += dt; aerialCamera(1, endT); return; }
  if (G.mode === 'title' || G.mode === 'intro' || G.mode === 'loading') { titleCamera(dt); return; }
  const P = player, K = input.keys;
  if (G.mode === 'play') {
    const kr = (K.ArrowLeft ? 1 : 0) - (K.ArrowRight ? 1 : 0), ku = (K.ArrowUp ? 1 : 0) - (K.ArrowDown ? 1 : 0);
    camState.yaw += kr * dt * 1.9; camState.pitch = clamp(camState.pitch - ku * dt * 1.2, -0.35, 1.25);
    if (input.lockFailed && P.speed > 0.4 && !kr) camState.yaw += angleDiff(camState.yaw, P.heading + Math.PI) * (1 - Math.exp(-0.9 * dt));
  }
  const sh = stackHeight();
  _tgt.set(P.pos.x, P.pos.y + 1.45 + sh * 0.3 - (P.state === 'fallen' ? 0.7 : 0), P.pos.z);
  if (camState.target.lengthSq() === 0) camState.target.copy(_tgt);
  camState.target.lerp(_tgt, 1 - Math.exp(-9 * dt));
  camState.dist = damp(camState.dist, camState.tDist + sh * 0.9 + (P.run ? 0.5 : 0), 3, dt);
  const cp = Math.cos(camState.pitch), sp = Math.sin(camState.pitch);
  _dir.set(Math.sin(camState.yaw) * cp, sp, Math.cos(camState.yaw) * cp);
  let d = camState.dist;
  const T = camState.target;
  for (let i = 1; i <= 12; i++) {
    const t = i / 12 * d;
    const x = T.x + _dir.x * t, y = T.y + _dir.y * t, z = T.z + _dir.z * t;
    if (y < terrainHeight(x, z) + 0.4) { d = Math.max(1.1, t - 0.5); break; }
  }
  camState.curD = damp(camState.curD, d, d < camState.curD ? 18 : 3, dt);
  camera.position.set(T.x + _dir.x * camState.curD, T.y + _dir.y * camState.curD, T.z + _dir.z * camState.curD);
  const floor = terrainHeight(camera.position.x, camera.position.z) + 0.35;
  if (camera.position.y < floor) camera.position.y = floor;
  camera.lookAt(T);
  if (shakeAmt > 0.001) {
    camera.position.x += (Math.random() - 0.5) * shakeAmt * 0.3; camera.position.y += (Math.random() - 0.5) * shakeAmt * 0.3;
    shakeAmt = Math.max(0, shakeAmt - dt * 1.8);
  }
}
let titleT = 0, endT = 0;
const _from = new THREE.Vector3(), _to = new THREE.Vector3();
function aerialCamera(k, t) {
  // rise from behind the robot to a slow orbit high above the map
  const P = player.pos;
  _from.set(P.x + Math.sin(camState.yaw) * 8, P.y + 4, P.z + Math.cos(camState.yaw) * 8);
  const a = 0.35 + t * 0.012;
  _to.set(Math.sin(a) * 560, 380, 520 + Math.cos(a) * 60);
  camera.position.lerpVectors(_from, _to, k);
  const look = new THREE.Vector3(P.x, P.y + 1, P.z).lerp(new THREE.Vector3(0, 30, -60), smoothstep(0, 0.6, k));
  camera.lookAt(look);
}
function titleCamera(dt) {
  titleT += dt;
  const n = NODES[0];
  // slow drift behind-left of the kneeling robot, framing it on the right third, looking out over the land
  const a = n.face + Math.PI + 0.75 + Math.sin(titleT * 0.05) * 0.18;
  const r = 6.2 + Math.sin(titleT * 0.07) * 0.6;
  camera.position.set(player.pos.x + Math.sin(a) * r, player.pos.y + 1.7 + Math.sin(titleT * 0.09) * 0.25, player.pos.z + Math.cos(a) * r);
  const fwdX = Math.sin(n.face), fwdZ = Math.cos(n.face);
  const look = new THREE.Vector3(player.pos.x + fwdX * 14, player.pos.y + 2.2, player.pos.z + fwdZ * 14);
  camera.lookAt(look);
  // shift the view so the robot sits right of centre
  const right = new THREE.Vector3(1, 0, 0).applyQuaternion(camera.quaternion);
  camera.position.addScaledVector(right, -4.2);
}
function updateCine(dt) {
  const c = G.cine; c.t += dt;
  if (c.type === 'connect') {
    const n = c.node;
    const a = n.face + 0.6 + c.t * 0.12;
    const r = 34 - c.t * 1.5;
    camera.position.set(n.x + Math.sin(a) * r, n.y + 12 + c.t * 1.2, n.z + Math.cos(a) * r);
    camera.lookAt(n.x, n.y + 10 + c.t * 3, n.z);
  } else if (c.type === 'ending') {
    aerialCamera(smoothstep(0, c.dur, c.t), c.t);
  }
  if (c.t >= c.dur) {
    const done = c.type;
    G.cine = null;
    if (done === 'ending') showEnding();
  }
}

/* =========================================================
   Per-frame visuals
   ========================================================= */
function updateVisuals(dt) {
  const t = G.time + titleT;
  terrainUniforms.uTime.value = t;
  waterMat.uniforms.uTime.value = t;
  grassUniforms.uTime.value = t;
  skyMat.uniforms.uTime.value = t;
  rainMat.uniforms.uTime.value = t;
  rainMat.uniforms.uCam.value.copy(camera.position);
  grassUniforms.uCenter.value.set(camera.position.x * 0.5 + player.pos.x * 0.5, 0, camera.position.z * 0.5 + player.pos.z * 0.5);
  skyMesh.position.copy(camera.position);
  // sun + shadow camera follow the player (snapped to texel grid)
  const snap = 80 / 2048;
  const fx = Math.round(player.pos.x / snap) * snap, fz = Math.round(player.pos.z / snap) * snap;
  sun.target.position.set(fx, player.pos.y, fz);
  sun.position.set(fx + SUN_DIR.x * 150, player.pos.y + SUN_DIR.y * 150, fz + SUN_DIR.z * 150);
  // stations
  const dests = new Set(player.cargo.map((c) => c.dest));
  for (const n of NODES) {
    const m = n.mesh; if (!m) continue;
    const d = Math.hypot(camera.position.x - n.x, camera.position.z - n.z);
    const isDest = dests.has(n.id);
    m.beamMat.uniforms.uTime.value = t;
    const finale = G.mode === 'ending' || (G.cine && G.cine.type === 'ending');
    const wantA = finale ? 0.7 : isDest ? 0.55 : n.connected ? 0.16 : 0.0;
    m.beamMat.uniforms.uA.value = damp(m.beamMat.uniforms.uA.value, wantA * smoothstep(20, 60, d), 3, dt);
    m.beamMat.uniforms.uCol.value.setHex(isDest ? 0xf2a04b : 0x86e1f2);
    m.beam.visible = m.beamMat.uniforms.uA.value > 0.005;
    m.lampMat.emissiveIntensity = n.connected ? 5 : 2 + 3 * (Math.sin(t * 2.5) > 0.6 ? 1 : 0);
    m.label.material.opacity = damp(m.label.material.opacity, d < 45 && G.mode !== 'title' ? 1 : 0, 4, dt);
    m.label.visible = m.label.material.opacity > 0.01;
  }
  for (const tb of TURBINES) tb.rotor.rotation.z += tb.spd * dt * (1 + envRain);
  updateShards(dt, t);
  updateDyingStructs(dt);
  for (const s of G.structures) {
    if (!s.visible) continue;
    if (s.fadeIn !== undefined && s.fadeIn < 1) { s.fadeIn = Math.min(1, s.fadeIn + dt * 0.8); s.mesh.scale.setScalar(0.3 + 0.7 * smoothstep(0, 1, s.fadeIn)); }
    if (s.type === 'charger') { const core = s.mesh.userData.core; core.rotation.y += dt * 1.5; core.position.y = 2.65 + Math.sin(t * 2) * 0.06; s.mesh.userData.ring.material.opacity = 0.2 + 0.15 * Math.sin(t * 2); }
  }
  for (const L of NET_LINES) {
    if (L.t < 1) { L.t = Math.min(1, L.t + dt * 0.35); L.mesh.geometry.setDrawRange(0, Math.floor(L.total * smoothstep(0, 1, L.t) / 3) * 3); }
    L.mesh.material.opacity = 0.45 + 0.15 * Math.sin(t * 1.5);
  }
  if (waypointMesh.visible) {
    waypointMesh.material.uniforms.uTime.value = t;
    const d = G.waypoint ? Math.hypot(player.pos.x - G.waypoint.x, player.pos.z - G.waypoint.z) : 0;
    waypointMesh.material.uniforms.uA.value = 0.6 * smoothstep(8, 30, d);
  }
  // revealed/lost cargo glow
  for (const c of G.cargo) {
    if (c.loc !== 'ground' && c.loc !== 'water') continue;
    const m = c.mesh.userData.mats;
    const rv = G.time - c.revealed < 10 ? 2.5 : 0;
    m.led.emissiveIntensity = 2.6 + rv + Math.sin(t * 4) * 0.8;
  }
  if (gradePass) {
    gradePass.uniforms.uTime.value = t;
    const hij = player.state === 'hijack' ? 0.6 + Math.random() * 0.4 : 0;
    gradePass.uniforms.uGlitch.value = damp(gradePass.uniforms.uGlitch.value, Math.max(hij, envEcho * 0.05 + (player.sensor || 0) * 0.08), 8, dt);
    $('glitch').style.opacity = (gradePass.uniforms.uGlitch.value * 0.8).toFixed(3);
  }
}

function robotParams() {
  const P = player;
  return {
    pos: P.pos, heading: P.heading, speed: P.speed, state: P.state, stateT: P.stateT, sneak: P.sneak,
    tiltX: P.tilt.x, tiltZ: P.tilt.z, grip: P.grip, holding: P.cargo.length > 2 && !P.run, lookYaw: P.lookYaw,
    battery: P.battery, sensor: P.sensor, sensorDir: P.sensorDir, sensorAlert: P.sensorAlert, groundAt,
  };
}
