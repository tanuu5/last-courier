'use strict';
// Gamepad polling, in-game controls and menu navigation.

/* =========================================================
   Gamepad (standard mapping: Xbox / PlayStation)
   ========================================================= */
const pad = { gp: null, prev: [], lx: 0, ly: 0, rx: 0, ry: 0, lt: 0, rt: 0, runToggle: false, sneakToggle: false, navT: 0, navDir: null, cu: 0.5, cv: 0.5, hijackBuzz: 0 };
const UI_ROOTS = { title: 'title', terminal: 'terminal', result: 'result', pause: 'pause', ending: 'ending', archive: 'archive', room: 'room' };
function setInputMode(m) {
  if (inputMode === m) return;
  inputMode = m;
  document.body.classList.toggle('pad', m === 'pad');
  if (m === 'pad' && document.pointerLockElement) releaseLock();
  renderControlLists();
  applyStaticGlyphs();
  if (G.mode === 'terminal') renderTerminal();
  if (G.mode === 'archive') renderArchive(false);
  if (G.mode === 'map') updateMapLegend();
}
function refreshPadLabels() {
  renderControlLists();
  applyStaticGlyphs();
  if (G.mode === 'terminal') renderTerminal();
  if (G.mode === 'archive') renderArchive(false);
  if (G.mode === 'map') updateMapLegend();
  if (G.mode === 'room') renderRoomUI();
  syncPauseUI();
}
function applyStaticGlyphs() {
  document.querySelectorAll('[data-g]').forEach((el) => { el.textContent = glyph(el.dataset.g); el.classList.toggle('pad', inputMode === 'pad'); });
}
function deadzone(x, y, d = 0.2) {
  const m = Math.hypot(x, y);
  if (m < d) return [0, 0];
  const k = Math.min(1, (m - d) / (1 - d)) / m;
  return [x * k, y * k];
}
function rumble(strong, weak, ms) {
  const gp = pad.gp;
  if (!gp || inputMode !== 'pad') return;
  const va = gp.vibrationActuator;
  if (!va || !va.playEffect) return;
  try { const p = va.playEffect('dual-rumble', { startDelay: 0, duration: ms, strongMagnitude: clamp(strong, 0, 1), weakMagnitude: clamp(weak, 0, 1) }); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not supported */ }
}
function pollPad(dt) {
  const list = navigator.getGamepads ? navigator.getGamepads() : [];
  let gp = null;
  for (const g of list) { if (g && g.connected) { gp = g; break; } }
  if (gp && gp !== pad.gp && gp.id !== pad.lastId) {
    pad.lastId = gp.id;
    const st = detectPadStyle(gp.id);
    if (st !== PAD_STYLE.detected) { PAD_STYLE.detected = st; refreshPadLabels(); }
  }
  pad.gp = gp;
  if (!gp) { pad.lx = pad.ly = pad.rx = pad.ry = pad.lt = pad.rt = 0; pad.prev = []; return; }
  const now = gp.buttons.map((b) => !!b && (b.pressed || b.value > 0.5));
  const pr = (i) => !!now[i] && !pad.prev[i];
  [pad.lx, pad.ly] = deadzone(gp.axes[0] || 0, gp.axes[1] || 0);
  [pad.rx, pad.ry] = deadzone(gp.axes[2] || 0, gp.axes[3] || 0);
  pad.lt = gp.buttons[6] ? gp.buttons[6].value : 0;
  pad.rt = gp.buttons[7] ? gp.buttons[7].value : 0;
  const active = now.some(Boolean) || Math.abs(pad.lx) + Math.abs(pad.ly) + Math.abs(pad.rx) + Math.abs(pad.ry) > 0.1;
  if (active && inputMode !== 'pad') setInputMode('pad');
  if (active) audio.init();
  const dir = padNavDir(now, dt);
  const m = G.mode;
  if (m === 'play') padPlay(now, pr, dt);
  else if (m === 'map') padMap(pr, dt);
  else if (m === 'intro') { if (pr(0) || pr(1) || pr(9)) skipIntro(); }
  else if (UI_ROOTS[m]) padUI(m, pr, dir, dt);
  pad.prev = now;
}
function padNavDir(now, dt) {
  let d = null;
  if (now[12] || pad.ly < -0.6) d = 'up';
  else if (now[13] || pad.ly > 0.6) d = 'down';
  else if (now[14] || pad.lx < -0.6) d = 'left';
  else if (now[15] || pad.lx > 0.6) d = 'right';
  if (!d) { pad.navDir = null; return null; }
  if (d !== pad.navDir) { pad.navDir = d; pad.navT = 0.38; return d; }
  pad.navT -= dt;
  if (pad.navT <= 0) { pad.navT = 0.12; return d; }
  return null;
}
function padPlay(now, pr, dt) {
  const P = player;
  camState.yaw -= pad.rx * 2.5 * SETTINGS.sens * dt;
  camState.pitch = clamp(camState.pitch + pad.ry * 1.6 * SETTINGS.sens * dt, -0.35, 1.25);
  if (G.cine) return;
  if (P.state === 'hijack') { if (pr(0) || pr(1) || pr(2) || pr(3)) hijackPress(); return; }
  if (pr(9)) { openPause(); return; }
  if (pr(8)) { openMap(); return; }
  if (pr(3)) { openArchive(); return; }
  if (P.placing) {
    if (pr(0)) confirmPlacing();
    else if (pr(1)) cancelPlacing();
    else if (pr(4)) adjustPlacing(-1);
    else if (pr(5)) adjustPlacing(1);
    else if (pr(12)) startPlacing('ladder');
    else if (pr(15)) startPlacing('charger');
    else if (pr(13)) startPlacing('sign');
    return;
  }
  if (pr(0)) { doInteract(); input.lastPick = performance.now(); }
  if (pr(5)) startScan();
  if (pr(2)) { pad.sneakToggle = !pad.sneakToggle; if (pad.sneakToggle) pad.runToggle = false; }
  if (pr(10)) { pad.runToggle = !pad.runToggle; if (pad.runToggle) pad.sneakToggle = false; }
  if (pr(11)) camState.yaw = P.heading + Math.PI;
  if (pr(12)) startPlacing('ladder');
  else if (pr(15)) startPlacing('charger');
  else if (pr(13)) startPlacing('sign');
  else if (pr(14)) dropTopCargo();
}
function padMap(pr, dt) {
  if (pad.lx || pad.ly) { pad.cu = clamp(pad.cu + pad.lx * 0.4 * dt, 0, 1); pad.cv = clamp(pad.cv + pad.ly * 0.4 * dt, 0, 1); mapRedraw = 0; }
  if (pr(0)) setWaypoint(pad.cu, pad.cv);
  if (pr(2)) clearWaypoint();
  if (pr(1) || pr(8) || pr(9)) closeMap();
}
function padUI(m, pr, dir, dt) {
  const root = $(UI_ROOTS[m]);
  if (dir) uiNav(root, dir);
  if (pr(0)) {
    const el = document.activeElement;
    if (el && root.contains(el) && el.tagName === 'BUTTON' && !el.disabled) el.click();
    else padFocusFirst(root, true);
  }
  if (pr(1)) padBack(m);
  if (pr(9) && m === 'pause') resumeGame();
  if (pr(3) && m === 'archive') closeArchive();
  if (pr(4) || pr(5)) cycleTab(m, pr(5) ? 1 : -1);
  if (Math.abs(pad.ry) > 0.05) { const sc = m === 'archive' ? $('aRead') : m === 'room' ? root.querySelector('.room-panel') : root.querySelector('.panel'); if (sc) sc.scrollTop += pad.ry * 700 * dt; }
}
function padBack(m) {
  if (m === 'terminal') closeTerminal();
  else if (m === 'result') closeResult();
  else if (m === 'pause') resumeGame();
  else if (m === 'archive') closeArchive();
  else if (m === 'ending') closeEnding();
  else if (m === 'room') roomBack();
}
function cycleTab(m, d) {
  const box = m === 'terminal' ? $('tTabs') : m === 'archive' ? $('aTabs') : m === 'room' ? $('rmTabs') : null;
  if (!box) return;
  const bs = [...box.querySelectorAll('button')];
  if (bs.length < 2) return;
  const i = Math.max(0, bs.findIndex((b) => b.classList.contains('on')));
  bs[(i + d + bs.length) % bs.length].click();
}
function focusables(root) { return [...root.querySelectorAll('button, input[type=range]')].filter((el) => !el.disabled && el.offsetParent !== null); }
function padFocusFirst(root, force) {
  if (inputMode !== 'pad' || !root) return;
  if (!force && root.contains(document.activeElement)) return;
  const el = root.querySelector('.btn.primary:not(:disabled)') || focusables(root)[0];
  if (el) el.focus();
}
function focusKey(el) {
  if (!el || !el.dataset) return null;
  if (el.dataset.tab) return `[data-tab="${el.dataset.tab}"]`;
  if (el.dataset.act) return el.dataset.id ? `[data-act="${el.dataset.act}"][data-id="${el.dataset.id}"]` : `[data-act="${el.dataset.act}"]`;
  return null;
}
function refocus(root, key) {
  if (inputMode !== 'pad') return;
  const el = key && root.querySelector(key);
  if (el && !el.disabled) el.focus(); else padFocusFirst(root, true);
}
function uiNav(root, dir) {
  const els = focusables(root);
  if (!els.length) return;
  const cur = document.activeElement;
  if (!els.includes(cur)) { padFocusFirst(root, true); return; }
  if (cur.type === 'range' && (dir === 'left' || dir === 'right')) {
    const step = (+cur.max - +cur.min) / 20;
    cur.value = clamp(+cur.value + (dir === 'right' ? step : -step), +cur.min, +cur.max);
    cur.dispatchEvent(new Event('input', { bubbles: true }));
    return;
  }
  const r0 = cur.getBoundingClientRect();
  const cx = r0.left + r0.width / 2, cy = r0.top + r0.height / 2;
  const v = { up: [0, -1], down: [0, 1], left: [-1, 0], right: [1, 0] }[dir];
  let best = null, bs = Infinity;
  for (const el of els) {
    if (el === cur) continue;
    const r = el.getBoundingClientRect();
    const dx = r.left + r.width / 2 - cx, dy = r.top + r.height / 2 - cy;
    const along = dx * v[0] + dy * v[1];
    if (along <= 4) continue;
    const score = along + Math.abs(dx * v[1] - dy * v[0]) * 2.2;
    if (score < bs) { bs = score; best = el; }
  }
  if (best) {
    best.focus(); best.scrollIntoView({ block: 'nearest' }); audio.ui(880);
    if (best.dataset && best.dataset.aid) selectArchive(best.dataset.aid);
  }
}
function adjustPlacing(dir) {
  const pl = player.placing; if (!pl) return;
  if (pl.type === 'ladder') pl.len = clamp(pl.len + dir * 0.5, 3, 12);
  else if (pl.type === 'sign') { pl.sign = (pl.sign + (dir > 0 ? 1 : SIGN_TYPES.length - 1)) % SIGN_TYPES.length; showHint(`標識：${SIGN_TYPES[pl.sign].icon} ${SIGN_TYPES[pl.sign].text}`, 2); }
  audio.ui(pl.type === 'ladder' ? 400 + pl.len * 40 : 700);
}
