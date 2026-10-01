'use strict';
// Player movement, collisions, balance and falling.

/* =========================================================
   Player update
   ========================================================= */
function setState(s) { player.state = s; player.stateT = 0; }
const _v2 = new THREE.Vector2();
function camForward() { return { x: -Math.sin(camState.yaw), z: -Math.cos(camState.yaw) }; }

function updatePlayer(dt) {
  const P = player;
  P.stateT += dt;
  P.lookYaw = camState.yaw + Math.PI;
  if (P.state === 'fallen') {
    P.vel.multiplyScalar(Math.exp(-4 * dt));
    if (waterDepth(P.pos.x, P.pos.z) > 0.9) {
      let best = null, bd = 1e9;
      for (let a = 0; a < 12; a++) { const x = P.pos.x + Math.cos(a / 12 * TAU) * 7, z = P.pos.z + Math.sin(a / 12 * TAU) * 7; const d = waterDepth(x, z); if (d < bd) { bd = d; best = [x, z]; } }
      const fx = sampleArr(FLOWX, P.pos.x, P.pos.z), fz = sampleArr(FLOWZ, P.pos.x, P.pos.z);
      const bx = best[0] - P.pos.x, bz = best[1] - P.pos.z, bl = Math.hypot(bx, bz) || 1;
      P.vel.x = bx / bl * 1.8 + fx * 0.8; P.vel.z = bz / bl * 1.8 + fz * 0.8;
      if (P.stateT > 1.4) P.stateT = 1.0;
    }
    moveAndCollide(dt, true);
    if (P.stateT > 1.4) setState('getup');
    return;
  }
  if (P.state === 'getup') { if (P.stateT > 1.15) setState('move'); return; }
  if (P.state === 'boot') { if (P.stateT > 2.6) setState('move'); return; }
  if (P.state === 'hijack') { updateHijack(dt); return; }
  if (P.state === 'shutdown') {
    P.vel.set(0, 0, 0); P.speed = 0;
    if (P.stateT > 3.4 && !P.recovering) { P.recovering = true; returnToNode({ recover: true, reason: P.shutdownReason }); }
    return;
  }
  const active = G.mode === 'play' && !G.cine;
  const K = input.keys;
  let ix = 0, iz = 0;
  if (active) {
    ix = (K.KeyD ? 1 : 0) - (K.KeyA ? 1 : 0);
    iz = (K.KeyS ? 1 : 0) - (K.KeyW ? 1 : 0);
  }
  let analog = 1;
  if (active && pad.gp && Math.hypot(pad.lx, pad.ly) > 0.02) { ix = pad.lx; iz = pad.ly; analog = Math.min(1, Math.hypot(ix, iz)); }
  const ilen = Math.hypot(ix, iz);
  if (ilen < 0.05) pad.runToggle = false;
  P.sneak = active && (!!K.KeyC || pad.sneakToggle);
  P.run = active && (K.ShiftLeft || K.ShiftRight || pad.runToggle) && !P.sneak;
  P.grip[0] = active && (input.mouse[0] || !!K.KeyQ || pad.lt > 0.3) && !P.placing;
  P.grip[1] = active && (input.mouse[2] || !!K.KeyE || pad.rt > 0.3) && !P.placing;
  const both = P.grip[0] && P.grip[1];

  const f = camForward();
  const rx = Math.cos(camState.yaw), rz = -Math.sin(camState.yaw);
  let dx = 0, dz = 0;
  if (ilen > 0) { dx = (rx * ix + f.x * -iz) / ilen; dz = (rz * ix + f.z * -iz) / ilen; }

  // terrain context
  const gy = terrainHeight(P.pos.x, P.pos.z);
  // near a ladder's ends the terrain gradient straddles a rim/cliff edge; don't treat that as a slope to slide on
  const nearLadder = G.structures.some((s) => s.type === 'ladder' && s.visible && (Math.hypot(P.pos.x - s.p0.x, P.pos.z - s.p0.z) < 1.8 || Math.hypot(P.pos.x - s.p1.x, P.pos.z - s.p1.z) < 1.8));
  const onLadder = !!(P.grounded && _lastLadder) || nearLadder;
  const g = terrainGrad(P.pos.x, P.pos.z);
  const slopeMag = Math.hypot(g.x, g.z);
  P.depth = onLadder ? 0 : Math.max(0, WATER - gy - Math.max(0, P.pos.y - gy));
  const loadRatio = clamp(cargoWeight() / capacity(), 0, 1.3);

  let target = P.run ? RUN : P.sneak ? SNEAK : WALK;
  if (ilen < 0.01) target = 0;
  else if (analog < 1) target *= clamp(analog * 1.15, 0.3, 1);
  target *= lerp(1, 0.74, loadRatio);
  if (P.battery <= 0) target = Math.min(target, 1.2);
  else if (P.battery < 15) target *= 0.8;
  if (both) target *= 0.72;
  if (P.placing) target *= 0.5;
  const along = onLadder ? 0 : g.x * dx + g.z * dz;
  if (along > 0) target *= clamp(1 - along * 0.85, 0.22, 1);
  else target *= 1 + Math.min(-along, 0.5) * 0.25;
  if (P.depth > 0.25) target *= lerp(1, 0.42, clamp((P.depth - 0.25) / 1.1, 0, 1));

  const desX = dx * target, desZ = dz * target;
  const accel = ilen > 0 ? 4.5 : 6.5;
  const pvx = P.vel.x, pvz = P.vel.z;
  P.vel.x = damp(P.vel.x, desX, accel, dt);
  P.vel.z = damp(P.vel.z, desZ, accel, dt);
  // can't walk up very steep ground
  if (!onLadder && slopeMag > 0.95) {
    const up = (P.vel.x * g.x + P.vel.z * g.z) / slopeMag;
    if (up > 0) { P.vel.x -= g.x / slopeMag * up * 0.9; P.vel.z -= g.z / slopeMag * up * 0.9; }
  }
  // slide down steep slopes
  P.sliding = 0;
  if (!onLadder && P.grounded && slopeMag > 1.05) {
    const s = clamp(slopeMag - 1.05, 0, 1.2);
    P.vel.x -= g.x / slopeMag * 9.8 * s * 0.55 * dt;
    P.vel.z -= g.z / slopeMag * 9.8 * s * 0.55 * dt;
    P.sliding = s;
  }
  // river current
  if (P.depth > 0.35) {
    const fx = sampleArr(FLOWX, P.pos.x, P.pos.z), fz = sampleArr(FLOWZ, P.pos.x, P.pos.z);
    const k = clamp((P.depth - 0.35) / 1.0, 0, 1.5);
    P.vel.x += fx * k * 0.9 * dt * 2; P.vel.z += fz * k * 0.9 * dt * 2;
  }
  // heading
  const hs = Math.hypot(P.vel.x, P.vel.z);
  if (ilen > 0 && hs > 0.05) {
    const want = Math.atan2(dx, dz);
    P.heading += angleDiff(P.heading, want) * (1 - Math.exp(-(P.run ? 7 : 9) * dt));
  }
  P.speed = hs;
  moveAndCollide(dt, false);

  // acceleration (for balance)
  const ax = (P.vel.x - pvx) / Math.max(dt, 1e-3), az = (P.vel.z - pvz) / Math.max(dt, 1e-3);
  updateBalance(dt, { g, along, onLadder, ax, az, both, slopeMag });

  // deep water: swept off feet
  if (P.depth > 1.55 && P.state === 'move') { triggerFall('water'); }

  // battery
  const moving = hs > 0.1;
  let drain = 0.01;
  if (moving) drain += (0.042 + loadRatio * 0.075) * (P.run ? 2.0 : 1) * (1 + Math.max(0, along) * 1.2);
  if (P.depth > 0.3) drain += 0.025;
  drain *= 1 + clamp(1 - P.cond / 100, 0, 1) * 0.3;
  P.battery = Math.max(0, P.battery - drain * dt);
  // slow wear from rain and deep water
  const rn = rainAt(P.pos.x, P.pos.z);
  if (rn > 0.05 || P.depth > 0.6) wear(dt * (rn * 0.012 + (P.depth > 0.6 ? 0.03 : 0)));
  // stuck detection: pushing against something for a long time
  if (ilen > 0.3 && hs < 0.25 && P.state === 'move') P.stuckT += dt; else P.stuckT = Math.max(0, P.stuckT - dt * 2);
  if (P.stuckT > 14 && !G.flags.stuckHint) { G.flags.stuckHint = true; radio('ツムギ', '動けなくなった？ 一時停止メニュー（{pause}）の「拠点へ帰還」で、最後に立ち寄った拠点まで運べるよ。'); }
  // charging
  for (const n of NODES) if (n.connected && Math.hypot(P.pos.x - n.x, P.pos.z - n.z) < 7.5) P.battery = Math.min(100, P.battery + 9 * dt);
  for (const s of G.structures) if (s.type === 'charger' && s.visible && Math.hypot(P.pos.x - s.pos.x, P.pos.z - s.pos.z) < 12) P.battery = Math.min(100, P.battery + 3.2 * dt);
  if (P.state === 'move' && P.battery <= 0) { startShutdown('battery'); return; }
  if (P.state === 'move' && P.cond <= 0) { startShutdown('damage'); return; }
  G.stats.distance += hs * dt;
}
let _lastLadder = null;
function moveAndCollide(dt, passive) {
  const P = player;
  let nx = P.pos.x + P.vel.x * dt, nz = P.pos.z + P.vel.z * dt;
  // circle colliders
  for (let it = 0; it < 2; it++) {
    for (const c of collidersAt(nx, nz)) {
      if (c.struct && !c.struct.visible) continue;
      const ddx = nx - c.x, ddz = nz - c.z, d = Math.hypot(ddx, ddz), min = c.r + 0.38;
      if (d < min && d > 1e-4) { nx = c.x + ddx / d * min; nz = c.z + ddz / d * min; }
    }
  }
  nx = clamp(nx, -HALF + 25, HALF - 25); nz = clamp(nz, -HALF + 25, HALF - 25);
  const gh = groundAt(nx, nz, P.pos.y);
  const ladder = _onLadder;
  if (P.grounded) {
    if (gh > P.pos.y + 0.85 && !ladder) { // wall: block
      nx = P.pos.x; nz = P.pos.z; P.vel.x *= 0.3; P.vel.z *= 0.3;
      P.pos.y = groundAt(nx, nz, P.pos.y);
    } else if (gh < P.pos.y - Math.max(0.55, Math.hypot(P.vel.x, P.vel.z) * dt * 3)) {
      P.grounded = false; P.vy = 0;
      P.pos.x = nx; P.pos.z = nz;
    } else { P.pos.x = nx; P.pos.z = nz; P.pos.y = gh; }
  } else {
    P.pos.x = nx; P.pos.z = nz;
    P.vy -= 9.8 * 1.5 * dt;
    P.pos.y += P.vy * dt;
    const g2 = groundAt(nx, nz, P.pos.y + 0.3);
    if (P.pos.y <= g2) {
      P.pos.y = g2; P.grounded = true;
      const impact = -P.vy; P.vy = 0;
      if (!passive) {
        if (impact > 8.5) { triggerFall('drop'); P.battery = Math.max(0, P.battery - 4); }
        else if (impact > 4) { player.tiltV.x += (Math.random() - 0.5) * impact * 0.35; player.tiltV.z += impact * 0.12; camShake(0.3); audio.thud(0.6); rumble(0.45, 0.25, 140); wear(2); }
        else if (impact > 1.5) audio.thud(0.3);
      }
    }
  }
  _lastLadder = P.grounded ? groundAtLadder(P.pos.x, P.pos.z, P.pos.y) : null;
}
function groundAtLadder(x, z, y) { groundAt(x, z, y); return _onLadder; }

/* =========================================================
   Balance
   ========================================================= */
function updateBalance(dt, c) {
  const P = player;
  const T = P.tilt, V = P.tiltV;
  if (P.cargo.length === 0 || P.state !== 'move') {
    T.x = damp(T.x, 0, 5, dt); T.z = damp(T.z, 0, 5, dt); V.x = 0; V.z = 0; return;
  }
  const W = cargoWeight(), Hs = stackHeight();
  const loadF = clamp(W / capacity(), 0, 1.4);
  const stab = G.unlocks.stabilizer ? 1.35 : 1;
  const spd = P.speed;
  const moving = spd > 0.15;
  const inst = BAL.inst0 + Hs * BAL.instH + loadF * BAL.instW;
  const k = (BAL.k + (moving ? 0 : BAL.kIdle)) * stab;
  const cD = BAL.c * stab;
  const fwX = Math.sin(P.heading), fwZ = Math.cos(P.heading);
  const rtX = -Math.cos(P.heading), rtZ = Math.sin(P.heading);
  let dx = 0, dz = 0;
  if (!c.onLadder) {
    const side = c.g.x * rtX + c.g.z * rtZ;       // + : ground rises to the right
    const fwd = c.g.x * fwX + c.g.z * fwZ;        // + : uphill ahead
    const m = moving ? 1 : 0.35;
    dx += -side * (0.9 + spd * 0.3) * BAL.side * 2 * m;
    dz += -fwd * (0.6 + spd * 0.35) * BAL.fwd * 2 * m;
  }
  // acceleration / turning (load swings opposite to acceleration)
  dx += -(c.ax * rtX + c.az * rtZ) * BAL.accel;
  dz += -(c.ax * fwX + c.az * fwZ) * BAL.accel * 0.7;
  // rough ground
  const rough = sampleArr(ROCK, P.pos.x, P.pos.z) * 0.9 + 0.22 + (P.depth > 0.2 ? P.depth * 0.9 : 0) + (c.onLadder ? 0.35 : 0);
  P.noiseT += dt * (0.35 + spd * 0.22);
  const nAmp = rough * spd * BAL.noise * (P.run ? 1.4 : 1) * (P.sneak ? 0.6 : 1);
  dx += N1(P.noiseT * 1.6, 3.3) * nAmp;
  dz += N1(P.noiseT * 1.2, 9.1) * nAmp * 0.6;
  // river current
  if (P.depth > 0.4) {
    const fx = sampleArr(FLOWX, P.pos.x, P.pos.z), fz = sampleArr(FLOWZ, P.pos.x, P.pos.z);
    dx += (fx * rtX + fz * rtZ) * P.depth * 1.2;
  }
  // sliding
  if (P.sliding > 0) { dz += P.sliding * 3.5 * Math.sign(-(c.g.x * fwX + c.g.z * fwZ) || 1); dx += N1(P.noiseT * 3, 1.7) * P.sliding * 4; }
  const dScale = (0.55 + loadF * 0.55 + Hs * 0.3) * condFactor();
  dx *= dScale; dz *= dScale;
  // grips
  let gx = 0;
  // left button / Q shifts the weight left (fixes a rightward tilt); right button / E shifts it right
  if (P.grip[0] && !P.grip[1]) gx -= T.x > -0.02 ? (T.x * BAL.grip + BAL.gripBase) : BAL.wrong;
  if (P.grip[1] && !P.grip[0]) gx += T.x < 0.02 ? (-T.x * BAL.grip + BAL.gripBase) : BAL.wrong;
  const kk = c.both ? k + 3.2 : k;
  const cc = c.both ? cD * 2.2 + 2.5 : cD + ((P.grip[0] || P.grip[1]) ? 1.2 : 0);
  const axT = (inst - kk) * T.x - cc * V.x + dx + gx;
  const azT = (inst * 0.4 - kk) * T.z - cc * V.z + dz;
  V.x += axT * dt; V.z += azT * dt;
  T.x += V.x * dt; T.z += V.z * dt;
  if (Math.abs(T.x) > 1 || Math.abs(T.z) > 1) triggerFall('balance');
  // warning audio
  const mag = Math.max(Math.abs(T.x), Math.abs(T.z));
  if (mag > 0.62) audio.warn(mag);
}

function triggerFall(reason) {
  const P = player;
  if (P.state !== 'move') return;
  const fwX = Math.sin(P.heading), fwZ = Math.cos(P.heading);
  const rtX = -Math.cos(P.heading), rtZ = Math.sin(P.heading);
  let lx = P.tilt.x, lz = P.tilt.z;
  if (reason === 'water') { const fx = sampleArr(FLOWX, P.pos.x, P.pos.z), fz = sampleArr(FLOWZ, P.pos.x, P.pos.z); lx = fx * rtX + fz * rtZ; lz = fx * fwX + fz * fwZ; }
  if (Math.abs(lx) < 0.05 && Math.abs(lz) < 0.05) lz = 1;
  const l = Math.hypot(lx, lz); lx /= l; lz /= l;
  robot.fallDir.set(lx, lz);
  const wX = rtX * lx + fwX * lz, wZ = rtZ * lx + fwZ * lz;
  setState('fallen');
  P.tilt.x = P.tilt.z = 0; P.tiltV.x = P.tiltV.z = 0;
  P.vel.x = wX * 1.5; P.vel.z = wZ * 1.5;
  G.stats.falls++;
  wear(5);
  if (G.stats.falls >= 20) unlockItem('dent');
  P.battery = Math.max(0, P.battery - 2);
  camShake(0.7);
  audio.fall();
  rumble(0.9, 0.6, 380);
  // scatter cargo
  const list = P.cargo.slice();
  P.cargo = [];
  robot.stack.updateMatrixWorld(true);
  list.forEach((c, i) => {
    const wp = new THREE.Vector3(); c.mesh.getWorldPosition(wp);
    const wq = new THREE.Quaternion(); c.mesh.getWorldQuaternion(wq);
    robot.stack.remove(c.mesh);
    scene.add(c.mesh);
    c.mesh.position.copy(wp); c.mesh.quaternion.copy(wq);
    c.loc = 'ground'; c.resting = false;
    c.pos.copy(wp);
    const sp = 1.6 + Math.random() * 2.2 + i * 0.35;
    c.vel.set(wX * sp + (Math.random() - 0.5) * 2, 1.5 + Math.random() * 2.5, wZ * sp + (Math.random() - 0.5) * 2);
    c.spin.set((Math.random() - 0.5) * 8, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 8);
    damageCargo(c, 4 * CTYPES[c.type].impact, 'fall');
  });
  robot.setCargoVisual(P.cargo);
  if (list.length) {
    if (!G.flags.fellOnce) { G.flags.fellOnce = true; radio('ツムギ', '転んだね。散らばった荷物に近づいて {interact} を長押しすれば、まとめて拾い直せる。'); }
    toast('転倒', `荷物 ${list.length} 個が散乱`, true);
  }
}
