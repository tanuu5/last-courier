'use strict';
// Rescue (return to node / restart from checkpoint) and lost cargo.

/* =========================================================
   Rescue: return to the last node / restart from the checkpoint
   ========================================================= */
const CHECK_KEY = 'last-courier-checkpoint-v1';
function saveCheckpoint() {
  saveGame();
  try { const d = localStorage.getItem(SAVE_KEY); if (d) localStorage.setItem(CHECK_KEY, d); } catch (e) { /* storage unavailable */ }
}
function hasCheckpoint() { try { return !!localStorage.getItem(CHECK_KEY); } catch (e) { return false; } }
function rescueNode() { const n = NODES[player.lastNode]; return n && n.connected ? n : NODES[0]; }
function returnToNode() {
  const n = rescueNode();
  $('pause').classList.add('hidden');
  G.mode = 'fade';
  fadeThen(() => {
    const P = player;
    cancelPlacing();
    if (P.hijack) { $('qte').classList.add('hidden'); P.hijack.e.state = 'gone'; P.hijack.e.respawn = 30; P.hijack = null; audio.hijack(false); }
    P.pos.set(n.x + Math.sin(n.face) * 2.5, 0, n.z + Math.cos(n.face) * 2.5);
    P.pos.y = groundAt(P.pos.x, P.pos.z, 999);
    P.vel.set(0, 0, 0); P.vy = 0; P.grounded = true; P.tilt.x = P.tilt.z = 0; P.tiltV.x = P.tiltV.z = 0;
    P.heading = n.face; camState.yaw = n.face + Math.PI; camState.target.set(0, 0, 0);
    setState('getup'); P.stateT = 0.3;
    G.echoGrace = G.time + 10;
    G.mode = 'play';
    requestLock();
    setTimeout(() => radio('ツムギ', `回収ドローンで${n.name}まで運んだよ。背中の荷物はそのまま。落とした荷物は、その場に残ってる。`), 900);
    saveGame();
  }, 700);
}
function restartFromCheckpoint() {
  try {
    const d = localStorage.getItem(CHECK_KEY);
    if (!d) return;
    localStorage.setItem(SAVE_KEY, d);
    sessionStorage.setItem('lc-autocontinue', '1');
  } catch (e) { return; }
  const f = $('fade'); f.style.transition = 'opacity .5s'; f.style.opacity = 1;
  setTimeout(() => location.reload(), 520);
}

/* =========================================================
   Lost cargo from other units
   ========================================================= */
const LOST = [
  { x: -150, z: 268, type: 'parts', name: '遺失した工具箱', w: 9, dest: 1, revealNode: 1 },
  { x: 150, z: 70, type: 'fragile', name: '遺失した観測ユニット', w: 7, dest: 3, revealNode: 3 },
  { x: -190, z: -150, type: 'med', name: '遺失した医療セル', w: 8, dest: 5, revealNode: 3 },
  { x: 185, z: -318, type: 'data', name: '遺失した記憶カード', w: 5, dest: 4, revealNode: 4 },
  { x: -30, z: -262, type: 'heavy', name: '遺失した蓄電池', w: 18, dest: 6, revealNode: 5 },
];
function spawnLost() {
  for (const L of LOST) {
    let x = L.x, z = L.z;
    for (let r = 0; r < 60 && terrainHeight(x, z) < WATER + 0.6; r += 2) { const a = r * 0.9; x = L.x + Math.cos(a) * r; z = L.z + Math.sin(a) * r; }
    const c = createCargo({ ...L, lost: true, cond: 70 + Math.floor(Math.random() * 20) });
    c.revealNode = L.revealNode; c.loc = 'hidden'; c.pos.set(x, terrainHeight(x, z) + 0.3, z);
  }
}
