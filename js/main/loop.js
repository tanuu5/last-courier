'use strict';
// Main loop and boot sequence.

/* =========================================================
   Main loop
   ========================================================= */
let lastT = performance.now();
const perf = { acc: 0, n: 0, t: 0 };
function frame(now) {
  requestAnimationFrame(frame);
  const raw = (now - lastT) / 1000;
  const dt = Math.min(0.05, raw); lastT = now;
  tick(dt);
  // drop to low quality automatically if the machine can't keep up (only while actually visible and playing)
  if (G.mode === 'play' && QUALITY.level === 'high' && !QUALITY.userSet && document.visibilityState === 'visible' && raw < 0.2) {
    perf.acc += raw; perf.n++; perf.t += raw;
    if (perf.t > 6) {
      const fps = perf.n / perf.acc;
      if (fps < 30) { QUALITY.level = 'low'; applyQuality(); toast('画質', '動作が重いため「低」に切り替えました（Esc の設定で戻せます）', true); }
      perf.acc = perf.n = perf.t = 0;
    }
  }
}
let crossT = 0;
function updateCrossHint(dt) {
  // show only after the mouse has been free for a moment, and not while the robot is still booting
  const need = G.mode === 'play' && !G.cine && !document.pointerLockElement && !input.lockFailed && player.state !== 'boot' && inputMode !== 'pad';
  crossT = need ? crossT + dt : 0;
  const el = $('crosshint');
  const text = input.everLocked ? 'クリックで操作を再開' : 'クリックで操作を開始';
  if (el.textContent !== text) el.textContent = text;
  el.classList.toggle('show', crossT > 0.5);
}
function tick(dt) {
  if (G.mode === 'loading') return;
  pollPad(dt);
  const playing = G.mode === 'play';
  if (playing) G.time += dt;
  updateStorms(playing ? dt : 0);
  if (playing && !G.cine) {
    updatePlayer(dt);
    updateGroundCargo(dt, rainAt);
    updateEchoes(dt);
    updateAcks(dt);
    contextTutorials(dt);
    if ((input.fHeld || (inputMode === 'pad' && pad.prev[0])) && promptAction && promptAction.type === 'pick' && performance.now() - (input.lastPick || 0) > 380) { input.lastPick = performance.now(); doInteract(); }
    const outdoors = !NODES.some((n) => Math.hypot(player.pos.x - n.x, player.pos.z - n.z) < 45);
    P_walkTime = player.speed > 0.6 && outdoors ? P_walkTime + dt : Math.max(0, P_walkTime - dt * 0.5);
    G.autosave -= dt; if (G.autosave <= 0) { G.autosave = 60; saveGame(); }
  } else {
    // world is paused (menus, map, archive) or a cinematic is running: stop the gait so the robot doesn't walk on the spot
    player.speed = 0; player.vel.set(0, 0, 0);
  }
  if (G.mode === 'room') updateRoom(dt);
  else if (G.mode !== 'fade' || robot.root.parent === scene) robot.update(dt, robotParams());
  updatePlacing();
  updateScan();
  updateCamera(dt);
  updateEnvironment(dt);
  updateVisuals(dt);
  if (G.mode !== 'title' && G.mode !== 'intro') updateHUD(dt);
  updateDismantle(dt);
  updateCrossHint(dt);
  $('hud').classList.toggle('dim', !!G.cine || G.mode === 'title' || G.mode === 'intro' || G.mode === 'ending' || G.mode === 'room');
  if (G.mode === 'map') { mapRedraw -= dt; if (mapRedraw <= 0) { mapRedraw = 0.25; drawMap(); } }
  audio.update(dt);
  const inRoom = robot.root.parent === room.scene;
  const sc = inRoom ? room.scene : scene, cam = inRoom ? room.camera : camera;
  if (inRoom && gradePass) { gradePass.uniforms.uEcho.value = 0; gradePass.uniforms.uGlitch.value = 0; gradePass.uniforms.uFlash.value = 0; }
  if (QUALITY.level === 'high' && composer) { renderPass.scene = sc; renderPass.camera = cam; composer.render(); }
  else renderer.render(sc, cam);
}
let mapRedraw = 0;

/* =========================================================
   Boot
   ========================================================= */
const nextFrame = () => new Promise((r) => setTimeout(r, 16));
async function init() {
  renderControlLists();
  if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) $('mobileNote').classList.remove('hidden');
  try { const q = localStorage.getItem('last-courier-quality'); if (q === 'low' || q === 'high') { QUALITY.level = q; QUALITY.userSet = true; } } catch (e) { /* ignore */ }
  try { SETTINGS.guide = localStorage.getItem('last-courier-guide') === '1'; } catch (e) { /* ignore */ }
  try { const ps = localStorage.getItem('last-courier-padstyle'); if (ps === 'auto' || ps === 'A' || ps === 'B') PAD_STYLE.setting = ps; } catch (e) { /* ignore */ }
  initRenderer();
  initMaterials();
  await nextFrame();
  generateTerrain();
  $('loading').textContent = 'BUILDING WORLD…';
  await nextFrame();
  buildSky(); buildTerrainMesh(); buildHeightTexture(); buildWater(); buildGrass(GRASS_COUNT);
  buildRocks(); buildRuins(); buildRain(); buildEchoAssets(); buildMarkers(); buildWaypoint();
  NODES.forEach((n) => { buildStation(n); setNodeVisual(n); });
  robot = new Robot(); scene.add(robot.root);
  robot.onStep = (s, speed, fx, fz) => {
    const lr = cargoWeight() / capacity();
    audio.step(speed, WATER - terrainHeight(fx, fz), lr);
    if (lr > 0.6) rumble(0.1 * lr, 0, 45);
  };
  planOtherStructures();
  buildShards();
  buildRoom();
  spawnEchoes(); initStorms(); initOrders(); spawnLost();
  buildMapBase();
  initPost();
  const hub = NODES[0];
  player.heading = hub.face;
  player.pos.set(hub.x - Math.sin(hub.face) * 1.5, 0, hub.z - Math.cos(hub.face) * 1.5);
  player.pos.y = groundAt(player.pos.x, player.pos.z, 999);
  setState('boot');
  robot.heading = player.heading;
  camState.yaw = player.heading + Math.PI;
  setupInput();
  applyQuality();
  updateEnvironment(1);
  renderer.compile(scene, camera);
  G.mode = 'title';
  $('loading').textContent = '';
  $('btnNew').disabled = false;
  $('btnCont').disabled = !hasSave();
  setupRoomUI();
  applyPaint();
  requestAnimationFrame(frame);
  try { if (sessionStorage.getItem('lc-autocontinue')) { sessionStorage.removeItem('lc-autocontinue'); continueGame(); } } catch (e) { /* ignore */ }
  window.__LC = { G, player, NODES, camState, terrainHeight, groundAt, robot, BAL, scan, audio, startScan, connectNode, deliverHere, openTerminal, enterRoom, room, COLLIDERS, collidersAt, waterDepth, terrainGrad, nearestGroundCargo, acceptOrder, orderState, closeResult, closeTerminal, renderer, scene, camera, composer, QUALITY, applyQuality, tick, input, terrainMesh, grassMesh, waterMesh, skyMesh, rainMesh, sun };
}
init().catch((e) => { console.error(e); $('loading').textContent = 'ERROR: ' + e.message; });
