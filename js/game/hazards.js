'use strict';
// Echoes, hijack QTE, storms and environment lighting.

/* =========================================================
   Echoes & hijack
   ========================================================= */
function spawnEchoes() {
  const n = 9;
  for (let i = 0; i < n; i++) {
    for (let t = 0; t < 30; t++) {
      const a = Math.random() * TAU, r = Math.sqrt(Math.random()) * (ECHO_ZONE.r - 12);
      const x = ECHO_ZONE.x + Math.cos(a) * r, z = ECHO_ZONE.z + Math.sin(a) * r;
      if (terrainHeight(x, z) < WATER + 0.5) continue;
      G.echoes.push(makeEcho(x, z)); break;
    }
  }
}
function playerNoise() {
  const P = player;
  if (P.speed < 0.1) return 0.1;
  return P.sneak ? 0.2 : P.run ? 1.0 : 0.55;
}
function updateEchoes(dt) {
  const P = player;
  let nearest = null, nd = 1e9;
  const noise = playerNoise();
  const detectR = 3 + noise * 13;
  const revealAge = G.time - scan.reveal;
  for (const e of G.echoes) {
    e.mat.uniforms.uTime.value = G.time; e.tmat.uniforms.uTime.value = G.time;
    if (e.state === 'gone') {
      e.respawn -= dt;
      e.alpha = damp(e.alpha, 0, 3, dt);
      if (e.respawn <= 0) { e.state = 'idle'; e.alert = 0; e.pos.x = e.anchor.x; e.pos.z = e.anchor.y; }
    } else {
      const dx = P.pos.x - e.pos.x, dz = P.pos.z - e.pos.z, d = Math.hypot(dx, dz);
      if (d < nd) { nd = d; nearest = e; }
      if (e.state === 'idle') {
        e.wanderT -= dt;
        if (e.wanderT <= 0) { e.wanderT = rr(4, 9); const a = Math.random() * TAU, r = Math.random() * 14; e.target.set(e.anchor.x + Math.cos(a) * r, e.anchor.y + Math.sin(a) * r); }
        const tx = e.target.x - e.pos.x, tz = e.target.y - e.pos.z, tl = Math.hypot(tx, tz);
        if (tl > 0.5) { e.pos.x += tx / tl * 0.6 * dt; e.pos.z += tz / tl * 0.6 * dt; }
        if (d < detectR && P.state === 'move' && G.time > (G.echoGrace || 0)) e.alert += dt * (1.2 - d / detectR) * 1.3;
        else e.alert = Math.max(0, e.alert - dt * 0.35);
        if (e.alert > 1) { e.state = 'chase'; audio.echoAlert(); }
      } else if (e.state === 'chase') {
        if (d > 32 || P.state !== 'move') { e.state = 'idle'; e.alert = 0.4; }
        else if (d > 0.01) { const sp = 2.6; e.pos.x += dx / d * sp * dt; e.pos.z += dz / d * sp * dt; }
        if (d < 1.2 && P.state === 'move' && G.time > (G.echoGrace || 0)) startHijack(e);
      } else if (e.state === 'hold') {
        e.pos.x = damp(e.pos.x, P.pos.x - Math.sin(P.heading) * 0.5, 6, dt); e.pos.z = damp(e.pos.z, P.pos.z - Math.cos(P.heading) * 0.5, 6, dt);
      }
      const prox = 1 - smoothstep(5, 13, d);
      const rv = revealAge < 9 ? (1 - smoothstep(6, 9, revealAge)) : 0;
      const want = e.state === 'hold' ? 1 : Math.max(prox * 0.85, rv * 0.95 * (d < scan.R + 10 ? 1 : 0), e.state === 'chase' ? 0.8 : 0);
      e.alpha = damp(e.alpha, want, 3, dt);
    }
    const gh = terrainHeight(e.pos.x, e.pos.z);
    e.pos.y = Math.max(gh, WATER) + 0.35 + Math.sin(G.time * 1.3 + e.anchor.x) * 0.15;
    e.mesh.position.copy(e.pos);
    e.mesh.rotation.y = Math.atan2(P.pos.x - e.pos.x, P.pos.z - e.pos.z);
    e.mat.uniforms.uA.value = e.alpha;
    e.mat.uniforms.uAlert.value = damp(e.mat.uniforms.uAlert.value, e.state === 'chase' || e.state === 'hold' ? 1 : clamp(e.alert, 0, 1) * 0.6, 4, dt);
    e.tmat.uniforms.uA.value = e.alpha * 0.8;
    e.mesh.visible = e.alpha > 0.01;
  }
  // sensor fin
  if (nearest && nd < 34) {
    P.sensor = 1 - nd / 34;
    P.sensorDir = Math.atan2(nearest.pos.x - P.pos.x, nearest.pos.z - P.pos.z);
    P.sensorAlert = nearest.state === 'chase' || nearest.alert > 0.5;
    audio.sensorTick(P.sensor, P.sensorAlert);
  } else { P.sensor = 0; P.sensorDir = null; P.sensorAlert = false; }
  if (P.sensor > 0.05 && !G.flags.echoSeen) { G.flags.echoSeen = true; radio('ツムギ', 'センサーが反応してる。近くにエコーがいる。{sneak} で忍び足にして、静かに進んで。{scan} のスキャンで姿が見える。'); setTimeout(() => unlockArchive('g-echo'), 4000); }
}
function startHijack(e) {
  const P = player;
  setState('hijack');
  P.vel.set(0, 0, 0); P.speed = 0;
  P.hijack = { e, prog: 0.15, t: 0, limit: 5 };
  e.state = 'hold';
  $('qte').classList.remove('hidden');
  audio.hijack(true);
  rumble(1, 1, 700);
  if (!G.flags.hijacked) { G.flags.hijacked = true; }
}
function updateHijack(dt) {
  const P = player, h = P.hijack;
  h.t += dt;
  h.prog = Math.max(0, h.prog - dt * 0.16);
  $('qteFill').style.width = (h.prog * 100).toFixed(1) + '%';
  $('qteTime').style.width = ((1 - h.t / h.limit) * 100).toFixed(1) + '%';
  P.tilt.x = Math.sin(h.t * 23) * 0.15; P.tilt.z = Math.sin(h.t * 17) * 0.1;
  P.battery = Math.max(0, P.battery - dt * 1.2);
  pad.hijackBuzz -= dt; if (pad.hijackBuzz <= 0) { pad.hijackBuzz = 0.45; rumble(0.3, 0.7, 220); }
  if (h.prog >= 1) endHijack(true);
  else if (h.t >= h.limit) endHijack(false);
}
function hijackPress() {
  const h = player.hijack; if (!h) return;
  h.prog = Math.min(1, h.prog + 0.085);
  audio.blip(300 + h.prog * 500, 0.04, 'square', 0.05);
  rumble(0.2, 0.4, 60);
  if (h.prog >= 1) endHijack(true);
}
function endHijack(ok) {
  const P = player, h = P.hijack;
  $('qte').classList.add('hidden');
  audio.hijack(false);
  h.e.state = 'gone'; h.e.respawn = 45; h.e.alpha = 1;
  // the burst of the disconnect scatters every echo nearby, and gives a short grace period
  for (const e of G.echoes) if (e !== h.e && e.state !== 'gone' && Math.hypot(e.pos.x - P.pos.x, e.pos.z - P.pos.z) < 22) { e.state = 'gone'; e.respawn = 25 + Math.random() * 20; }
  G.echoGrace = G.time + 12;
  P.hijack = null;
  P.tilt.x = P.tilt.z = 0;
  if (ok) {
    setState('move');
    P.battery = Math.max(0, P.battery - 6);
    wear(2);
    G.stats.hijackOk = (G.stats.hijackOk || 0) + 1;
    if (G.stats.hijackOk >= 3) setTimeout(() => unlockItem('echostone'), 1500);
    toast('切断成功', 'エコーを振りほどいた');
  } else {
    setState('move');
    P.battery = Math.max(0, P.battery - 18);
    wear(6);
    P.tilt.x = 1.1 * (Math.random() < 0.5 ? -1 : 1);
    triggerFall('hijack');
    toast('侵入', 'システムに侵入され、転倒した', true);
  }
}

/* =========================================================
   Storms
   ========================================================= */
function initStorms() {
  G.storms = [
    { x: ECHO_ZONE.x, z: ECHO_ZONE.z, r: ECHO_ZONE.r + 18, vx: 0, vz: 0, str: 1, fixed: true },
    { x: -260, z: -40, r: 110, vx: 1.5, vz: 0.8, str: 0.9 },
    { x: 260, z: -260, r: 120, vx: -1.1, vz: 1.3, str: 0.85 },
    { x: -120, z: 360, r: 95, vx: 0.9, vz: -1.2, str: 0.8 },
  ];
}
function updateStorms(dt) {
  G.storms.forEach((s, i) => {
    if (!s.fixed) {
      s.x += s.vx * dt; s.z += s.vz * dt;
      if (Math.abs(s.x) > 420) s.vx = -Math.sign(s.x) * Math.abs(s.vx);
      if (Math.abs(s.z) > 420) s.vz = -Math.sign(s.z) * Math.abs(s.vz);
      s.str = 0.75 + 0.2 * Math.sin(G.time * 0.01 + i * 2);
    }
    terrainUniforms.uStorms.value[i].set(s.x, s.z, s.r, s.str);
  });
}
function rainAt(x, z) {
  let r = 0;
  for (const s of G.storms) { const d = Math.hypot(x - s.x, z - s.z); r = Math.max(r, s.str * (1 - smoothstep(s.r * 0.72, s.r, d))); }
  return r;
}
function echoFactor(x, z) { const d = Math.hypot(x - ECHO_ZONE.x, z - ECHO_ZONE.z); return 1 - smoothstep(ECHO_ZONE.r * 0.8, ECHO_ZONE.r + 10, d); }

let envRain = 0, envEcho = 0, flash = 0, nextThunder = 5;
function updateEnvironment(dt) {
  const px = camera.position.x, pz = camera.position.z;
  envRain = damp(envRain, rainAt(px, pz), 1.5, dt);
  envEcho = damp(envEcho, echoFactor(px, pz), 1.5, dt);
  const c = ENV.clear, s = ENV.storm, e = ENV.echo, cur = ENV.cur;
  cur.hor.copy(c.hor).lerp(s.hor, envRain).lerp(e.hor, envEcho);
  cur.top.copy(c.top).lerp(s.top, envRain).lerp(e.top, envEcho);
  scene.fog.color.copy(cur.hor);
  scene.background.copy(cur.hor);
  const aerial = (G.cine && G.cine.type === 'ending') ? smoothstep(0, G.cine.dur * 0.7, G.cine.t) : G.mode === 'ending' ? 1 : 0;
  scene.fog.density = lerp(lerp(lerp(c.fog, s.fog, envRain), e.fog, envEcho), 0.0011, aerial);
  skyMat.uniforms.uHor.value.copy(cur.hor);
  skyMat.uniforms.uTop.value.copy(cur.top);
  skyMat.uniforms.uStorm.value = Math.max(envRain, envEcho);
  const dim = 1 - Math.max(envRain * 0.62, envEcho * 0.72);
  sun.intensity = c.sun * dim;
  hemi.intensity = lerp(lerp(c.hemi, s.hemi, envRain), e.hemi, envEcho) + flash * 4;
  waterMat.uniforms.uSky.value.copy(cur.hor).lerp(cur.top, 0.3);
  waterMat.uniforms.uDim.value = dim;
  rainMat.uniforms.uI.value = envRain;
  rainMesh.visible = envRain > 0.02;
  // lightning
  flash = Math.max(0, flash - dt * 5);
  if (envRain > 0.55) {
    nextThunder -= dt;
    if (nextThunder <= 0) { nextThunder = rr(8, 22); flash = 1; setTimeout(() => audio.thunder(), rr(400, 2200)); }
  }
  if (gradePass) { gradePass.uniforms.uEcho.value = envEcho; gradePass.uniforms.uFlash.value = flash * 0.05; }
}
