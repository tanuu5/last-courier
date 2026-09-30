'use strict';
// Cargo entities: carrying, dropping, damage and ground physics.

/* =========================================================
   Cargo entities
   ========================================================= */
function createCargo(spec) {
  const size = sizeFor(spec.w);
  const c = {
    id: G.nextId++, type: spec.type, name: spec.name, w: spec.w, dest: spec.dest, orderId: spec.orderId || null, itemIdx: spec.itemIdx ?? -1,
    cond: spec.cond ?? 100, lost: !!spec.lost, size: SIZES[size], sizeKey: size, loc: 'none',
    mesh: cargoMesh(spec.type, size), pos: new THREE.Vector3(), vel: new THREE.Vector3(), spin: new THREE.Vector3(), resting: true, revealed: 0,
  };
  G.cargo.push(c);
  updateCargoLed(c);
  return c;
}
function carryCargo(c) {
  if (c.loc === 'ground' || c.loc === 'water') scene.remove(c.mesh);
  c.loc = 'carried';
  player.cargo.push(c);
  player.cargo.sort((a, b) => b.w - a.w);
  robot.setCargoVisual(player.cargo);
}
function removeCargo(c) {
  if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
  c.loc = 'gone';
  G.cargo = G.cargo.filter((x) => x !== c);
  player.cargo = player.cargo.filter((x) => x !== c);
}
function placeCargoOnGround(c, x, z) {
  c.loc = 'ground'; c.resting = false;
  c.pos.set(x, terrainHeight(x, z) + 2, z);
  c.vel.set(0, 0, 0); c.spin.set(0, 0, 0);
  c.mesh.position.copy(c.pos);
  c.mesh.rotation.set(0, Math.random() * TAU, 0);
  scene.add(c.mesh);
}
function updateCargoLed(c) {
  const m = c.mesh.userData.mats;
  m.led.emissive.setHex(condColor(c.cond));
  const rust = 1 - c.cond / 100;
  m.body.color.setHex(CTYPES[c.type].color).lerp(new THREE.Color(0x5a3b24), rust * 0.55);
  m.body.roughness = 0.55 + rust * 0.4;
}
function orderOf(c) { return c.orderId ? G.orders.find((o) => o.id === c.orderId) : null; }
function damageCargo(c, amt, why) {
  if (amt <= 0 || c.cond <= 0) return;
  c.cond = Math.max(0, c.cond - amt);
  updateCargoLed(c);
  if (c.cond <= 0) destroyCargo(c, why);
}
function destroyCargo(c, why) {
  const o = orderOf(c);
  const wasCarried = c.loc === 'carried';
  removeCargo(c);
  if (wasCarried) robot.setCargoVisual(player.cargo);
  audio.crash();
  if (o && c.itemIdx >= 0) {
    const it = o.items[c.itemIdx];
    o.losses = (o.losses || 0) + 1;
    if (o.main) {
      it.status = 'pending'; it.cond = 100;
      radio('ツムギ', `「${c.name}」が大破した。${NODES[o.from].name}のターミナルで再発行しておくね。`);
    } else {
      it.status = 'lost';
      toast('依頼失敗', `「${c.name}」が大破`, true);
    }
  } else toast('大破', `「${c.name}」が壊れた`, true);
}
const _q = new THREE.Quaternion(), _e = new THREE.Euler(), _up = new THREE.Vector3(0, 1, 0), _n = new THREE.Vector3();
function updateGroundCargo(dt, rainAt) {
  for (const c of G.cargo) {
    if (c.loc === 'carried') {
      const r = rainAt(player.pos.x, player.pos.z);
      if (r > 0.01) damageCargo(c, dt * 0.22 * r * CTYPES[c.type].rain, 'rain');
      if (player.depth > 0.6 && c.stackY < player.depth - 0.9) damageCargo(c, dt * 1.0 * CTYPES[c.type].water, 'water');
      continue;
    }
    if (c.loc !== 'ground' && c.loc !== 'water') continue;
    const r = rainAt(c.pos.x, c.pos.z);
    if (r > 0.01) damageCargo(c, dt * 0.22 * r * CTYPES[c.type].rain, 'rain');
    if (c.loc === 'gone') continue;
    const th = terrainHeight(c.pos.x, c.pos.z);
    const depth = WATER - th;
    if (depth > 0.35 && c.pos.y < WATER + 0.3) {
      // floating / drifting
      c.loc = 'water'; c.resting = false;
      c.pos.y = damp(c.pos.y, WATER - c.size[1] * 0.25 + Math.sin(G.time * 2 + c.id) * 0.03, 4, dt);
      const fx = sampleArr(FLOWX, c.pos.x, c.pos.z), fz = sampleArr(FLOWZ, c.pos.x, c.pos.z);
      const e2 = 2.0, gdx = waterDepth(c.pos.x + e2, c.pos.z) - waterDepth(c.pos.x - e2, c.pos.z), gdz = waterDepth(c.pos.x, c.pos.z + e2) - waterDepth(c.pos.x, c.pos.z - e2);
      const gl = Math.hypot(gdx, gdz) || 1;
      c.vel.x = damp(c.vel.x, fx * 0.9 - gdx / gl * 0.45, 1.5, dt); c.vel.z = damp(c.vel.z, fz * 0.9 - gdz / gl * 0.45, 1.5, dt); c.vel.y = 0;
      c.pos.x += c.vel.x * dt; c.pos.z += c.vel.z * dt;
      c.mesh.rotation.y += c.vel.length() * dt * 0.3;
      c.mesh.rotation.x = damp(c.mesh.rotation.x, 0, 2, dt); c.mesh.rotation.z = damp(c.mesh.rotation.z, Math.sin(G.time + c.id) * 0.08, 2, dt);
      c.mesh.position.copy(c.pos);
      damageCargo(c, dt * 0.6 * CTYPES[c.type].water, 'water');
      continue;
    }
    if (c.loc === 'water') { c.loc = 'ground'; c.resting = false; }
    if (c.resting) continue;
    c.vel.y -= 9.8 * dt;
    c.pos.addScaledVector(c.vel, dt);
    c.mesh.rotation.x += c.spin.x * dt; c.mesh.rotation.y += c.spin.y * dt; c.mesh.rotation.z += c.spin.z * dt;
    const gh = groundAt(c.pos.x, c.pos.z, c.pos.y) ;
    const half = c.size[1] / 2;
    if (c.pos.y - half <= gh) {
      c.pos.y = gh + half;
      const impact = -c.vel.y;
      if (impact > 3) { damageCargo(c, (impact - 3) * 3.2 * CTYPES[c.type].impact, 'impact'); audio.thud(Math.min(1, impact / 8)); }
      c.vel.y = impact > 2 ? impact * 0.22 : 0;
      c.vel.x *= Math.exp(-5 * dt); c.vel.z *= Math.exp(-5 * dt);
      c.spin.multiplyScalar(Math.exp(-6 * dt));
      const g = terrainGrad(c.pos.x, c.pos.z); const s = Math.hypot(g.x, g.z);
      if (s > 0.62) { c.vel.x -= g.x / s * 9.8 * (s - 0.55) * 0.5 * dt; c.vel.z -= g.z / s * 9.8 * (s - 0.55) * 0.5 * dt; }
      // settle upright-ish
      _n.set(-g.x, 1, -g.z).normalize();
      _q.setFromUnitVectors(_up, _n);
      _e.set(0, c.mesh.rotation.y, 0);
      const target = new THREE.Quaternion().setFromEuler(_e).premultiply(_q);
      c.mesh.quaternion.slerp(target, 1 - Math.exp(-5 * dt));
      if (Math.hypot(c.vel.x, c.vel.z) < 0.15 && s < 0.62 && c.vel.y === 0) { c.resting = true; c.mesh.quaternion.copy(target); }
    }
    c.mesh.position.copy(c.pos);
  }
}
function nearestGroundCargo(maxD) {
  let best = null, bd = maxD;
  for (const c of G.cargo) {
    if (c.loc !== 'ground' && c.loc !== 'water') continue;
    const d = Math.hypot(c.pos.x - player.pos.x, c.pos.z - player.pos.z);
    if (d < bd && Math.abs(c.pos.y - player.pos.y) < 2.5) { bd = d; best = c; }
  }
  return best;
}
function tryPickup(c) {
  if (cargoWeight() + c.w > capacity() + 0.01) { toast('積載超過', `最大 ${capacity()}kg まで`, true); return false; }
  if (c.lost && !c.found) { c.found = true; G.stats.lostFound++; radio('ツムギ', `遺失物「${c.name}」を回収。宛先は${NODES[c.dest].name}。届けてあげて。`); setTimeout(() => unlockArchive('u-hako9'), 2500); }
  carryCargo(c);
  audio.pickup();
  rumble(0.15, 0.3, 90);
  return true;
}
function dropTopCargo() {
  if (!player.cargo.length || player.state !== 'move') return;
  const c = player.cargo[player.cargo.length - 1];
  player.cargo.pop();
  robot.stack.updateMatrixWorld(true);
  const wp = new THREE.Vector3(); c.mesh.getWorldPosition(wp);
  robot.stack.remove(c.mesh);
  robot.setCargoVisual(player.cargo);
  const bx = -Math.sin(player.heading) * 0.9, bz = -Math.cos(player.heading) * 0.9;
  c.loc = 'ground'; c.resting = false;
  c.pos.set(player.pos.x + bx, wp.y, player.pos.z + bz);
  c.vel.set(bx, 0.5, bz); c.spin.set(0, 1, 0);
  c.mesh.position.copy(c.pos);
  scene.add(c.mesh);
  audio.thud(0.4);
}
