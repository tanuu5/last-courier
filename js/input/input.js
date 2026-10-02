'use strict';
// Keyboard / mouse input, UI buttons, controls list and pause menu.

/* =========================================================
   Input
   ========================================================= */
let expectUnlock = false;
function requestLock() {
  if (input.lockFailed || inputMode === 'pad') return;
  const cv = $('game');
  // a rejected request is often temporary (e.g. clicked right after leaving the lock); only give up after repeated failures
  const fail = () => { input.lockFails = (input.lockFails || 0) + 1; if (input.lockFails >= 3) input.lockFailed = true; };
  try { const r = cv.requestPointerLock(); if (r && r.catch) r.catch(fail); } catch (e) { fail(); }
}
function releaseLock() { if (document.pointerLockElement) { expectUnlock = true; document.exitPointerLock(); } }
function setupInput() {
  const cv = $('game');
  addEventListener('keydown', (e) => {
    if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    if (e.repeat && e.code !== 'Space') { input.keys[e.code] = true; return; }
    input.keys[e.code] = true;
    audio.init();
    setInputMode('kb');
    const m = G.mode;
    if (m === 'play') {
      if (e.code === 'Space') { if (player.state === 'hijack') hijackPress(); else if (!e.repeat) startScan(); }
      else if (e.code === 'KeyF') { input.fHeld = true; if (player.placing) confirmPlacing(); else { doInteract(); input.lastPick = performance.now(); } }
      else if (e.code === 'Digit1') startPlacing('ladder');
      else if (e.code === 'Digit2') startPlacing('charger');
      else if (e.code === 'Digit3') startPlacing('sign');
      else if (e.code === 'KeyM') openMap();
      else if (e.code === 'KeyG') dropTopCargo();
      else if (e.code === 'KeyH') showHint(CONTROLS.map(([l, k]) => `<kbd>${k}</kbd> ${l}`).join('　'), 10);
      else if (e.code === 'KeyJ') openArchive();
      else if (e.code === 'Escape' && player.placing) cancelPlacing();
      else if (e.code === 'Escape' && !document.pointerLockElement) openPause();
    } else if (m === 'map') { if (e.code === 'KeyM' || e.code === 'Escape') closeMap(); }
    else if (m === 'terminal') { if (e.code === 'Escape') closeTerminal(); }
    else if (m === 'result') { if (e.code === 'Escape' || e.code === 'Enter' || e.code === 'Space' || e.code === 'KeyF') closeResult(); }
    else if (m === 'pause') { if (e.code === 'Escape') resumeGame(); else if (e.code === 'KeyJ') openArchive(); }
    else if (m === 'ending') { if (e.code === 'Enter') closeEnding(); }
    else if (m === 'archive') { if (e.code === 'Escape' || e.code === 'KeyJ') closeArchive(); }
    else if (m === 'room') { if (e.code === 'Escape') roomBack(); }
    else if (m === 'intro') { if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') skipIntro(); }
  });
  addEventListener('keyup', (e) => { input.keys[e.code] = false; if (e.code === 'KeyF') input.fHeld = false; });
  addEventListener('blur', () => { input.keys = {}; input.mouse = [false, false, false]; input.fHeld = false; });
  cv.addEventListener('mousedown', (e) => {
    audio.init();
    setInputMode('kb');
    if (G.mode !== 'play') return;
    if (!document.pointerLockElement && !input.lockFailed) { requestLock(); return; }
    input.mouse[e.button] = true;
    if (player.placing) { if (e.button === 0) confirmPlacing(); else if (e.button === 2) cancelPlacing(); input.mouse[e.button] = false; }
  });
  addEventListener('mouseup', (e) => { input.mouse[e.button] = false; });
  addEventListener('mousemove', (e) => {
    if (document.pointerLockElement === cv && G.mode === 'play' && !G.cine) {
      if (Math.abs(e.movementX) + Math.abs(e.movementY) > 4) setInputMode('kb');
      camState.yaw -= e.movementX * 0.0024 * SETTINGS.sens;
      camState.pitch = clamp(camState.pitch + e.movementY * 0.002 * SETTINGS.sens, -0.35, 1.25);
    }
  });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (G.mode !== 'play') return;
    const s = Math.sign(e.deltaY);
    if (player.placing) adjustPlacing(-s);
    else camState.tDist = clamp(camState.tDist + s * 0.6, 3, 13);
  }, { passive: false });
  addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('pointerlockchange', () => {
    input.locked = document.pointerLockElement === cv;
    if (input.locked) { input.everLocked = true; input.lockFails = 0; return; }
    input.mouse = [false, false, false];
    if (expectUnlock) { expectUnlock = false; return; }
    if (G.mode === 'play' && inputMode !== 'pad') openPause();
  });
  document.addEventListener('pointerlockerror', () => { input.lockFails = (input.lockFails || 0) + 1; if (input.lockFails >= 3) input.lockFailed = true; });
  // terminal / result / ending buttons
  $('terminal').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.tab) { termTab = b.dataset.tab; audio.ui(600); renderTerminal(); return; }
    const act = b.dataset.act;
    if (act === 'close') closeTerminal();
    else if (act === 'deliver') deliverHere(termNode);
    else if (act === 'accept') { const o = G.orders.find((x) => x.id === b.dataset.id); if (o) acceptOrder(o); }
    else if (act === 'refill') refillTools();
    else if (act === 'room') enterRoom(termNode);
  });
  $('result').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b && b.dataset.act === 'rclose') closeResult(); });
  $('ending').addEventListener('click', (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.act === 'endclose') closeEnding(); else if (b.dataset.act === 'endarchive') openArchive('final'); });
  setupArchiveUI();
  addEventListener('gamepadconnected', (e) => {
    const st = PAD_STYLE.setting === 'auto' ? detectPadStyle(e.gamepad && e.gamepad.id) : PAD_STYLE.setting;
    toast('INPUT', `ゲームパッドを検出しました（ボタン表示：タイプ${st}。一時停止メニューで切り替えられます）`);
  });
  $('mapCanvas').addEventListener('click', (e) => mapClick(e, false));
  $('mapCanvas').addEventListener('contextmenu', (e) => mapClick(e, true));
  $('mapView').addEventListener('click', (e) => { if (e.target.id === 'mapView') closeMap(); });
  // pause
  $('pause').addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.guide) {
      SETTINGS.guide = b.dataset.guide === '1';
      try { localStorage.setItem('last-courier-guide', SETTINGS.guide ? '1' : '0'); } catch (er) { /* ignore */ }
      syncPauseUI(); hudTimer = 0; audio.ui(700); return;
    }
    if (b.dataset.pad) {
      PAD_STYLE.setting = b.dataset.pad;
      try { localStorage.setItem('last-courier-padstyle', PAD_STYLE.setting); } catch (er) { /* ignore */ }
      refreshPadLabels(); audio.ui(700); return;
    }
    if (b.dataset.q) { QUALITY.level = b.dataset.q; QUALITY.userSet = true; applyQuality(); syncPauseUI(); try { localStorage.setItem('last-courier-quality', QUALITY.level); } catch (er) { /* ignore */ } return; }
    const act = b.dataset.act;
    if (act === 'resume') resumeGame();
    else if (act === 'rescue-return' || act === 'rescue-restart') {
      if (b.dataset.confirm) { if (act === 'rescue-return') returnToNode(); else restartFromCheckpoint(); return; }
      const label = b.textContent;
      b.dataset.confirm = '1'; b.textContent = 'もう一度押して実行'; b.style.borderColor = 'var(--warn)';
      setTimeout(() => { delete b.dataset.confirm; b.textContent = label; b.style.borderColor = ''; }, 3000);
    }
    else if (act === 'archive') openArchive();
    else if (act === 'totitle') { saveGame(); location.reload(); }
    else if (act === 'wipe') {
      if (b.dataset.confirm) { wipeSave(); location.reload(); }
      else { b.dataset.confirm = '1'; b.textContent = 'もう一度押すと消去'; b.style.borderColor = 'var(--danger)'; setTimeout(() => { delete b.dataset.confirm; b.textContent = 'セーブを消去'; b.style.borderColor = ''; }, 3000); }
    }
  });
  $('volRange').addEventListener('input', (e) => { audio.setVol(e.target.value / 100); $('volVal').textContent = e.target.value; });
  $('sensRange').addEventListener('input', (e) => { SETTINGS.sens = e.target.value / 100; $('sensVal').textContent = e.target.value; });
  $('intro').addEventListener('click', skipIntro);
  $('btnNew').addEventListener('click', () => { audio.init(); wipeSave(); startIntro(); });
  $('btnCont').addEventListener('click', () => { audio.init(); continueGame(); });
  addEventListener('resize', () => {
    camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
    if (room.camera) { room.camera.aspect = innerWidth / innerHeight; room.camera.updateProjectionMatrix(); }
    renderer.setSize(innerWidth, innerHeight);
    if (composer) composer.setSize(innerWidth, innerHeight);
  });
}
// [action, keyboard, gamepad]
const CONTROLS = [
  ['移動', 'W A S D', '左スティック'], ['カメラ', 'マウス', '右スティック'], ['走る', 'Shift', 'L3（切替）'], ['忍び足', 'C 長押し', 'X（切替）'],
  ['重心を左へ（右への傾きを戻す）', '左クリック / Q', 'LT'], ['重心を右へ（左への傾きを戻す）', '右クリック / E', 'RT'], ['踏ん張って安定歩行', '左右同時', 'LT + RT'],
  ['調べる・拾う（長押しで連続）', 'F', 'A'], ['地形スキャン', 'Space', 'RB'], ['ラダー / 充電ポスト / 標識', '1 / 2 / 3', '十字 ↑ / → / ↓'],
  ['一番上の荷物を降ろす', 'G', '十字 ←'], ['地図', 'M', 'View'], ['アーカイブ', 'J', 'Y'], ['設置物の調整', 'ホイール', 'LB / RB'],
  ['自分の設置物を撤去・回収', 'F 長押し', 'A 長押し'],
  ['カメラ距離', 'ホイール', '—'], ['カメラを背後に戻す', '—', 'R3'], ['一時停止', 'Esc', 'Menu'],
];
function renderControlLists() {
  const pd = inputMode === 'pad';
  $('titleCtl').innerHTML = CONTROLS.slice(0, 13).map(([l, k, p]) => `<span><kbd${pd ? ' class="pad"' : ''}>${pd ? padLabel(p) : k}</kbd> ${l}</span>`).join('');
  $('pauseCtl').innerHTML = `<div class="ctlhead"><span>操作</span><span>キーボード・マウス</span><span>ゲームパッド</span></div>` +
    CONTROLS.map(([l, k, p]) => `<div><span>${l}</span><span><kbd>${k}</kbd></span><span><kbd class="pad">${padLabel(p)}</kbd></span></div>`).join('');
}
function openPause() {
  if (G.mode !== 'play') return;
  G.mode = 'pause';
  cancelPlacing();
  $('pause').classList.remove('hidden');
  syncPauseUI();
  const rn = rescueNode();
  $('rsReturn').textContent = `最後に立ち寄った「${rn.name}」まで運んでもらう。進行も背中の荷物もそのまま。落とした荷物はその場に残る。`;
  $('rsRestartBtn').disabled = !hasCheckpoint();
  $('rsReturnBtn').disabled = !!G.cine;
  padFocusFirst($('pause'), true);
}
function syncPauseUI() {
  document.querySelectorAll('#qualSeg button').forEach((b) => b.classList.toggle('on', b.dataset.q === QUALITY.level));
  document.querySelectorAll('#guideSeg button').forEach((b) => b.classList.toggle('on', (b.dataset.guide === '1') === SETTINGS.guide));
  document.querySelectorAll('#padSeg button').forEach((b) => b.classList.toggle('on', b.dataset.pad === PAD_STYLE.setting));
  const auto = document.querySelector('#padSeg [data-pad="auto"]');
  if (auto) auto.textContent = PAD_STYLE.setting === 'auto' ? `自動（いまはタイプ${PAD_STYLE.detected}）` : '自動';
}
function resumeGame() {
  $('pause').classList.add('hidden');
  G.mode = 'play';
  requestLock();
}
