'use strict';
// The underground safe room scene and its menu.

/* =========================================================
   Safe room (separate interior scene under each connected node)
   ========================================================= */
const room = { scene: null, camera: null, shelf: {}, gems: [], node: null, section: 'main', t: 0, robotState: 'move', robotT: 0, busy: false, maintUsed: false,
  camPos: new THREE.Vector3(1.5, 1.6, 4.4), camLook: new THREE.Vector3(-0.2, 1.05, 0), sel: null };
const ROOM_CAMS = {
  main: [[1.5, 1.6, 4.4], [-0.25, 1.05, 0]],
  rest: [[2.6, 1.15, 3.2], [0, 0.75, 0]],
  maint: [[2.3, 2.2, 3.5], [0, 1.1, 0]],
  paint: [[0.75, 1.45, 3.0], [0, 1.15, 0]],
  collection: [[-1.2, 1.55, 1.1], [-3.8, 1.35, -1.3]],
};
const roomP = { pos: new THREE.Vector3(0, 0.14, 0), heading: 0.28, speed: 0, state: 'move', stateT: 5, sneak: false, tiltX: 0, tiltZ: 0, grip: [false, false], holding: false, lookYaw: 0.28, battery: 100, sensor: 0, sensorDir: null, sensorAlert: false, groundAt: () => 0.14 };
function itemModel(kind) {
  const g = new THREE.Group();
  const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.5, metalness: 0.2 }, o));
  const add = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; g.add(m); return m; };
  if (kind === 'mug') { add(new THREE.CylinderGeometry(0.055, 0.05, 0.11, 18), M(0xe9e4da, { roughness: 0.3, metalness: 0 }), 0, 0.055); const h = add(new THREE.TorusGeometry(0.03, 0.009, 8, 14), M(0xe9e4da, { roughness: 0.3 }), 0.06, 0.06); h.rotation.y = Math.PI / 2; add(new THREE.CylinderGeometry(0.048, 0.048, 0.005, 18), M(0x3a2a1c), 0, 0.106); }
  else if (kind === 'vane') { add(new THREE.CylinderGeometry(0.035, 0.045, 0.02, 10), M(0x2a2e33), 0, 0.01); add(new THREE.CylinderGeometry(0.004, 0.004, 0.12, 6), M(0x6b5a44, { metalness: 0.7 }), 0, 0.07); const f = add(new THREE.ConeGeometry(0.06, 0.2, 3), M(0x8c6a3a, { metalness: 0.8, roughness: 0.35 }), 0, 0.2); f.scale.z = 0.15; f.rotation.z = -0.3; }
  else if (kind === 'key') { const r = add(new THREE.TorusGeometry(0.035, 0.01, 8, 18), M(0xc9a24a, { metalness: 0.9, roughness: 0.3 }), -0.07, 0.012); r.rotation.x = Math.PI / 2; add(new THREE.BoxGeometry(0.11, 0.012, 0.016), M(0xc9a24a, { metalness: 0.9, roughness: 0.3 }), 0.02, 0.012); add(new THREE.BoxGeometry(0.014, 0.012, 0.03), M(0xc9a24a, { metalness: 0.9 }), 0.06, 0.012, 0.018); add(new THREE.BoxGeometry(0.03, 0.004, 0.05), M(0xd8cfb8, { metalness: 0 }), -0.07, 0.002, 0.06); }
  else if (kind === 'frame') { const fr = add(new THREE.BoxGeometry(0.17, 0.21, 0.018), M(0x4a3526, { metalness: 0 }), 0, 0.11); fr.rotation.x = -0.18; const ph = add(new THREE.PlaneGeometry(0.13, 0.17), M(0xd9d2c0, { metalness: 0, emissive: 0x2a2620, emissiveIntensity: 0.3 }), 0, 0.112, 0.012); ph.rotation.x = -0.18; }
  else if (kind === 'blueprint') { const c = add(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 14), M(0x9cc3de, { metalness: 0, roughness: 0.8 }), 0, 0.025); c.rotation.z = Math.PI / 2; add(new THREE.TorusGeometry(0.026, 0.004, 6, 14), M(0xc8362f), 0.06, 0.025).rotation.y = Math.PI / 2; }
  else if (kind === 'antenna') { const a = add(new THREE.CylinderGeometry(0.012, 0.016, 0.26, 8), M(0x6a7078, { metalness: 0.8 }), 0, 0.1); a.rotation.z = 0.5; add(new THREE.IcosahedronGeometry(0.04, 0), M(0xd9f2ff, { transparent: true, opacity: 0.55, roughness: 0.1, emissive: 0x4a7a90, emissiveIntensity: 0.4 }), 0.05, 0.19); add(new THREE.IcosahedronGeometry(0.028, 0), M(0xd9f2ff, { transparent: true, opacity: 0.55, roughness: 0.1 }), -0.04, 0.03); }
  else if (kind === 'plaque') { const p = add(new THREE.BoxGeometry(0.26, 0.13, 0.016), M(0x8a8f96, { metalness: 0.85, roughness: 0.3 }), 0, 0.075); p.rotation.x = -0.12; const l = add(new THREE.BoxGeometry(0.2, 0.006, 0.004), M(0x111111, { emissive: 0x86e1f2, emissiveIntensity: 1.5 }), 0, 0.075, 0.01); l.rotation.x = -0.12; }
  else if (kind === 'box') { add(new THREE.BoxGeometry(0.12, 0.09, 0.1), M(0x5a524a), 0, 0.045); add(new THREE.BoxGeometry(0.124, 0.018, 0.104), M(0xf2a04b), 0, 0.07); }
  else if (kind === 'badge') { const d = add(new THREE.CylinderGeometry(0.05, 0.05, 0.008, 24), M(0xd9b44a, { metalness: 1, roughness: 0.25 }), 0, 0.06); d.rotation.x = Math.PI / 2 - 0.2; const s = add(new THREE.OctahedronGeometry(0.02), M(0xf2a04b, { metalness: 0.6, emissive: 0xf2a04b, emissiveIntensity: 0.4 }), 0, 0.06, 0.012); s.scale.z = 0.3; add(new THREE.BoxGeometry(0.06, 0.012, 0.03), M(0x2a2e33), 0, 0.006); }
  else if (kind === 'footpad') { add(new THREE.BoxGeometry(0.11, 0.025, 0.21), M(0x2a2d31, { roughness: 0.95 }), 0, 0.013); add(new THREE.BoxGeometry(0.112, 0.008, 0.19), M(0x8a5a3a, { roughness: 0.9 }), 0, 0.028); }
  else if (kind === 'dent') { const sp = add(new THREE.SphereGeometry(0.08, 14, 10, 0, TAU, 0, Math.PI / 2), M(0xcfcbc2, { roughness: 0.55 }), 0, 0); sp.scale.set(1.2, 0.7, 1); add(new THREE.SphereGeometry(0.025, 8, 6), M(0x8a8680), 0.03, 0.05, 0.03); }
  else if (kind === 'stone') { add(new THREE.DodecahedronGeometry(0.045, 0), M(0x3a2f55, { emissive: 0xb99cff, emissiveIntensity: 0.9, roughness: 0.2 }), 0, 0.05); }
  else if (kind === 'knot') { add(new THREE.TorusKnotGeometry(0.045, 0.012, 64, 8), M(0x111111, { emissive: 0x86e1f2, emissiveIntensity: 1.6 }), 0, 0.075); add(new THREE.CylinderGeometry(0.03, 0.035, 0.02, 12), M(0x2a2e33), 0, 0.01); }
  return g;
}
function buildRoom() {
  const S = room.scene = new THREE.Scene();
  S.background = new THREE.Color(0x0a0d10);
  S.fog = new THREE.Fog(0x0a0d10, 9, 20);
  room.camera = new THREE.PerspectiveCamera(48, innerWidth / innerHeight, 0.05, 60);
  S.add(new THREE.HemisphereLight(0x9fb4c4, 0x1d1712, 0.55));
  const warm1 = new THREE.PointLight(0xffd6a8, 9, 9, 1.6); warm1.position.set(-1.8, 2.9, -1.2); S.add(warm1);
  const warm2 = new THREE.PointLight(0xffd6a8, 9, 8, 1.6); warm2.position.set(2.2, 2.8, 1.5); S.add(warm2);
  const cyan = new THREE.PointLight(0x86e1f2, 5, 6, 1.5); cyan.position.set(3.4, 1.6, -0.8); S.add(cyan);
  const shelfLamp = new THREE.PointLight(0xffd6a8, 5, 4, 1.6); shelfLamp.position.set(-3.0, 2.3, -1.3); S.add(shelfLamp);
  const spot = new THREE.SpotLight(0xfff1dc, 14, 9, 0.5, 0.6, 1.2); spot.position.set(0.4, 3.1, 0.8); spot.target.position.set(0, 0.8, 0);
  spot.castShadow = true; spot.shadow.mapSize.set(1024, 1024); spot.shadow.bias = -0.0005; S.add(spot, spot.target);
  const conc = new THREE.MeshStandardMaterial({ color: 0x3e3d3a, roughness: 0.92 });
  const wall = new THREE.MeshStandardMaterial({ color: 0x2b2f33, roughness: 0.8, metalness: 0.2 });
  const strip = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x86e1f2, emissiveIntensity: 1.4 });
  const warmStrip = new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0xffc98a, emissiveIntensity: 1.6 });
  const box = (w, h, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.receiveShadow = true; o.castShadow = true; S.add(o); return o; };
  box(8.4, 0.2, 8.4, conc, 0, -0.1, 0);
  box(8.4, 3.4, 0.2, wall, 0, 1.6, -4.1);
  box(0.2, 3.4, 8.4, wall, -4.1, 1.6, 0);
  box(0.2, 3.4, 8.4, wall, 4.1, 1.6, 0);
  box(8.4, 0.2, 8.4, wall, 0, 3.3, 0);
  for (let i = -3; i <= 3; i += 1.5) { box(0.05, 2.6, 0.03, i === 0 ? warmStrip : strip, i, 1.5, -3.99); }
  for (const z of [-2.5, 2.5]) box(0.03, 2.2, 0.05, strip, 3.99, 1.5, z);
  box(6, 0.04, 0.06, warmStrip, 0, 3.18, -3.9);
  // maintenance platform
  const plat = new THREE.Mesh(new THREE.CylinderGeometry(1.25, 1.35, 0.14, 6), new THREE.MeshStandardMaterial({ color: 0x55524d, roughness: 0.85 }));
  plat.position.y = 0.07; plat.receiveShadow = true; S.add(plat);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.08, 0.025, 6, 6), strip); ring.rotation.x = Math.PI / 2; ring.rotation.z = Math.PI / 6; ring.position.y = 0.15; S.add(ring);
  // ceiling maintenance arms
  room.arms = [];
  for (const s of [-1, 1]) {
    const base = new THREE.Group(); base.position.set(0.75 * s, 3.2, -0.25); S.add(base);
    const m1 = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.18, 10), MAT.metal); base.add(m1);
    const j1 = new THREE.Group(); j1.position.y = -0.1; base.add(j1);
    const a1 = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.8, 0.08), MAT.metal); a1.position.y = -0.4; j1.add(a1);
    const j2 = new THREE.Group(); j2.position.y = -0.8; j1.add(j2);
    const a2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.6, 0.06), MAT.dark); a2.position.y = -0.3; j2.add(a2);
    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 8), warmStrip); tip.position.y = -0.64; tip.rotation.x = Math.PI; j2.add(tip);
    [a1, a2].forEach((m) => { m.castShadow = true; });
    room.arms.push({ base, j1, j2, s, tip });
  }
  // shelf on the left wall
  const wood = new THREE.MeshStandardMaterial({ color: 0x3b3129, roughness: 0.7 });
  const sx = -3.78;
  for (const z of [-2.95, -1.3, 0.35]) box(0.4, 2.2, 0.05, MAT.dark, sx, 1.2, z);
  const levels = [0.75, 1.3, 1.85];
  for (const y of levels) { box(0.42, 0.04, 3.35, wood, sx, y, -1.3); box(0.02, 0.02, 3.3, warmStrip, sx + 0.2, y - 0.03, -1.3); }
  // item slots: bottom + middle shelves hold items, top holds the data shards
  const slots = [];
  for (const y of [levels[1], levels[0]]) for (let k = 0; k < 7; k++) slots.push([sx, y + 0.02, -2.75 + k * 0.48]);
  ITEMS.forEach((it, i) => {
    const m = itemModel(it.model); const [x, y, z] = slots[i];
    m.position.set(x, y, z); m.rotation.y = Math.PI / 2 + rr(-0.25, 0.25);
    m.visible = false; S.add(m); room.shelf[it.id] = m;
  });
  const gemGeo = new THREE.OctahedronGeometry(0.05);
  SHARDS.forEach((sh, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x0b0e10, emissive: 0x86e1f2, emissiveIntensity: 0, transparent: true, opacity: 0.35 });
    const gm = new THREE.Mesh(gemGeo, mat); gm.position.set(sx, levels[2] + 0.1, -2.85 + i * 0.28); S.add(gm);
    room.gems.push({ id: sh.id, m: gm, mat });
  });
  room.selRing = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.13, 32), new THREE.MeshBasicMaterial({ color: 0xf2a04b, transparent: true, opacity: 0.9, side: THREE.DoubleSide, toneMapped: false }));
  room.selRing.rotation.x = -Math.PI / 2; room.selRing.visible = false; S.add(room.selRing);
  // network monitor on the right wall
  const mc = document.createElement('canvas'); mc.width = 640; mc.height = 380;
  room.monCanvas = mc; room.monTex = new THREE.CanvasTexture(mc); room.monTex.colorSpace = THREE.SRGBColorSpace;
  const mon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.43), new THREE.MeshBasicMaterial({ map: room.monTex, toneMapped: false }));
  mon.position.set(3.98, 1.65, -0.8); mon.rotation.y = -Math.PI / 2; S.add(mon);
  box(0.06, 1.55, 2.55, MAT.dark, 4.01, 1.65, -0.8);
  // desk + crate + cables for a lived-in feel
  box(1.2, 0.06, 0.6, wood, 2.9, 0.78, 2.4); box(0.06, 0.76, 0.5, MAT.dark, 2.35, 0.39, 2.4); box(0.06, 0.76, 0.5, MAT.dark, 3.45, 0.39, 2.4);
  box(0.7, 0.5, 0.6, new THREE.MeshStandardMaterial({ color: 0x4b463f, roughness: 0.6 }), -2.6, 0.25, 2.6);
  box(0.72, 0.1, 0.62, new THREE.MeshStandardMaterial({ color: 0xd9cba8, roughness: 0.5 }), -2.6, 0.38, 2.6);
  // light shaft from a vent in the ceiling
  const shaftMat = beamMatBase(); shaftMat.uniforms.uCol.value.setHex(0xfff0d8); shaftMat.uniforms.uA.value = 0.035;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.7, 3.2, 16, 1, true), shaftMat); shaft.position.set(-2.4, 1.6, -3.1); shaft.rotation.x = Math.PI; S.add(shaft);
  room.shaftMat = shaftMat;
  // sparks for maintenance
  const N = 90, sp = new Float32Array(N * 3);
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
  room.sparks = new THREE.Points(sg, new THREE.PointsMaterial({ color: 0xffc070, size: 0.035, transparent: true, opacity: 0, toneMapped: false, depthWrite: false }));
  room.sparkV = Array.from({ length: N }, () => new THREE.Vector3());
  room.sparkLife = new Float32Array(N);
  S.add(room.sparks);
}
function drawRoomMonitor() {
  const c = room.monCanvas, x = c.getContext('2d'), W = c.width, Hh = c.height;
  x.fillStyle = '#081013'; x.fillRect(0, 0, W, Hh);
  const S = Hh - 40, ox = 20, oy = 20;
  x.globalAlpha = 0.85; x.drawImage(mapBase, ox, oy, S, S); x.globalAlpha = 1;
  const wm = (wx, wz) => [ox + (wx + HALF) / WORLD * S, oy + (wz + HALF) / WORLD * S];
  x.strokeStyle = '#86e1f2'; x.lineWidth = 2;
  for (const o of G.orders) if (o.main && NODES[o.to].connected) { const a = wm(NODES[o.from].x, NODES[o.from].z), b = wm(NODES[o.to].x, NODES[o.to].z); x.beginPath(); x.moveTo(...a); x.lineTo(...b); x.stroke(); }
  for (const n of NODES) { const [nx, nz] = wm(n.x, n.z); x.fillStyle = n.connected ? '#86e1f2' : '#ff6b5e'; x.fillRect(nx - 4, nz - 4, 8, 8); if (room.node && n.id === room.node.id) { x.strokeStyle = '#f2a04b'; x.beginPath(); x.arc(nx, nz, 11, 0, TAU); x.stroke(); } }
  const tx = S + 44;
  x.fillStyle = '#86e1f2'; x.font = '600 20px "Chakra Petch", sans-serif'; x.fillText('NETWORK', tx, 50);
  x.fillStyle = '#e6ecef'; x.font = '500 54px "Chakra Petch", sans-serif'; x.fillText(`${NODES.filter((n) => n.connected).length} / ${NODES.length}`, tx, 110);
  x.font = '500 16px "Zen Kaku Gothic New", sans-serif'; x.fillStyle = 'rgba(230,236,239,.7)';
  const lines = [`信頼度 ${G.trust}`, `ACK ${G.stats.acksRecv}`, `配送 ${G.stats.delivered} 件`, `データ片 ${Object.keys(G.shards).length} / ${SHARDS.length}`, `記念品 ${Object.keys(G.items).length} / ${ITEMS.length}`];
  lines.forEach((l, i) => x.fillText(l, tx, 150 + i * 30));
  room.monTex.needsUpdate = true;
}
function refreshRoomShelf() {
  for (const it of ITEMS) room.shelf[it.id].visible = !!G.items[it.id];
  for (const g of room.gems) { const got = !!G.shards[g.id]; g.mat.emissiveIntensity = got ? 2 : 0; g.mat.opacity = got ? 1 : 0.25; }
}
function enterRoom(node) {
  if (!node || !node.connected || G.mode !== 'terminal') return;
  $('terminal').classList.add('hidden'); termNode = null;
  G.mode = 'fade';
  audio.ui(420);
  fadeThen(() => {
    room.node = node; room.section = 'main'; room.maintUsed = false; room.busy = false; room.sel = null;
    room.robotState = 'move'; room.robotT = 5;
    room.scene.add(robot.root);
    robot.heading = roomP.heading;
    refreshRoomShelf(); drawRoomMonitor();
    const [p, l] = ROOM_CAMS.main; room.camPos.set(...p).add(new THREE.Vector3(0.6, 0.3, 1.2)); room.camLook.set(...l);
    G.mode = 'room';
    $('room').classList.remove('hidden');
    renderRoomUI();
    if (!G.flags.roomVisited) { G.flags.roomVisited = true; setTimeout(() => radio('ツムギ', 'ここはノードの地下の整備室。休んだり、機体の手入れをしたりできる。集めたものも、ここに飾っておくね。'), 700); }
  });
}
function exitRoom() {
  if (room.busy) return;
  G.mode = 'fade';
  fadeThen(() => {
    $('room').classList.add('hidden');
    scene.add(robot.root);
    robot.heading = player.heading;
    room.selRing.visible = false;
    G.mode = 'play';
    saveGame(); saveCheckpoint();
    requestLock();
  });
}
function roomBack() { if (room.busy) return; if (room.section !== 'main') { room.section = 'main'; room.sel = null; renderRoomUI(); } else exitRoom(); }
function fadeThen(fn, ms = 450) {
  const f = $('fade'); f.style.transition = `opacity ${ms}ms`; f.style.opacity = 1;
  setTimeout(() => { fn(); f.style.opacity = 0; }, ms + 40);
}
const REST_LINES = ['おやすみ、R-07。起きたら、天気が変わってるといいね。', 'しばらく休んで。外の見張りは、わたしがしておく。', '関節のログを整理しておくね。……今日もよく歩いた。', 'ゆっくり休んで。網は、ちゃんとつながってる。'];
function doRest() {
  if (room.busy) return;
  room.busy = true; room.section = 'rest'; renderRoomUI();
  room.robotState = 'boot'; room.robotT = 0;
  setTimeout(() => radio('ツムギ', pick(REST_LINES)), 600);
  setTimeout(() => {
    fadeThen(() => {
      player.battery = 100;
      // the weather has moved on while resting
      for (const s of G.storms) if (!s.fixed) { s.x = rr(-380, 380); s.z = rr(-380, 380); }
      for (const e of G.echoes) if (e.state === 'gone') { e.respawn = 0; }
      room.robotT = 0.3;
      saveGame(); saveCheckpoint();
    }, 900);
  }, 2600);
  setTimeout(() => { room.busy = false; renderRoomUI(); toast('REST', 'バッテリー満充電 ・ 外の天気が変わった'); }, 6200);
}
function doMaintain() {
  if (room.busy || player.cond >= 100) return;
  room.busy = true; room.section = 'maint'; room.maintT = 0; renderRoomUI();
  audio.maint();
  setTimeout(() => { player.cond = 100; applyWear(); room.busy = false; renderRoomUI(); toast('MAINTENANCE', '機体コンディション 100%'); saveGame(); }, 3000);
}
function doRepairCargo() {
  if (room.busy || room.maintUsed || !player.cargo.length) return;
  room.maintUsed = true;
  for (const c of player.cargo) { if (c.cond < 95) { c.cond = Math.min(95, c.cond + 25); updateCargoLed(c); } }
  audio.pickup(); rumble(0.2, 0.3, 120);
  toast('REPAIR', 'コンテナを補修した');
  renderRoomUI(); saveGame();
}
function setPaint(kind, id) {
  const list = kind === 'accent' ? ACCENTS : VISORS;
  const p = list.find((x) => x.id === id);
  if (!p || G.trust < p.req) { audio.deny(); return; }
  G.paint[kind] = id; applyPaint(); audio.ui(820); renderRoomUI(); saveGame();
}
function roomFocusKey(el) {
  if (!el || !el.dataset || !$('room').contains(el)) return null;
  for (const k of ['rsec', 'ract', 'paint', 'item']) if (el.dataset[k]) return `[data-${k}="${el.dataset[k]}"]`;
  return null;
}
function renderRoomUI() {
  const n = room.node;
  const fk = inputMode === 'pad' ? roomFocusKey(document.activeElement) : null;
  $('rmNode').textContent = n ? n.name : '';
  const condCol = player.cond < 30 ? 'var(--danger)' : player.cond < 60 ? 'var(--warn)' : 'var(--good)';
  $('rmStatus').innerHTML = `<span>機体 <b style="color:${condCol}">${Math.round(player.cond)}%</b></span><span>バッテリー <b>${Math.round(player.battery)}%</b></span><span>信頼度 <b>${G.trust}</b></span>`;
  const sec = room.section;
  const tabs = [['main', 'メニュー'], ['maint', 'メンテナンス'], ['paint', '塗装'], ['collection', 'コレクション']];
  $('rmTabs').innerHTML = tabs.map(([k, l]) => `<button data-rsec="${k}" class="${sec === k || (sec === 'rest' && k === 'main') ? 'on' : ''}" ${room.busy ? 'disabled' : ''}>${l}</button>`).join('');
  let h = '';
  if (sec === 'main' || sec === 'rest') {
    h = `<p class="rm-lead">地下の整備室。外の雨の音は、ここまでは届かない。</p>
      <button class="rm-act" data-ract="rest" ${room.busy ? 'disabled' : ''}><b>休む</b><span>バッテリーを満充電にして、しばらく休止する。外では時間が過ぎ、天気が変わる。</span></button>
      <button class="rm-act" data-rsec="maint" ${room.busy ? 'disabled' : ''}><b>メンテナンス</b><span>機体の摩耗を直し、コンテナを補修する。</span></button>
      <button class="rm-act" data-rsec="paint" ${room.busy ? 'disabled' : ''}><b>塗装</b><span>差し色とバイザーの色を変える。</span></button>
      <button class="rm-act" data-rsec="collection" ${room.busy ? 'disabled' : ''}><b>コレクション</b><span>棚に飾った記念品を見る（${Object.keys(G.items).length} / ${ITEMS.length}）。</span></button>`;
    if (room.busy && sec === 'rest') h = `<p class="rm-lead">休止中……</p>`;
  } else if (sec === 'maint') {
    const c = player.cond;
    h = `<div class="rm-meter"><span>機体コンディション</span><div class="meter"><i style="width:calc(${c.toFixed(1)}% - 4px);background:${c < 30 ? 'var(--danger)' : c < 60 ? 'var(--warn)' : 'var(--good)'}"></i><span>${Math.round(c)}%</span></div></div>
      <p class="rm-note">転倒やエコーの侵入、雨や深い水で少しずつ摩耗する。下がるとバランスを崩しやすくなり、バッテリーの減りも早くなる。</p>
      <button class="btn primary" data-ract="maint" ${room.busy || c >= 100 ? 'disabled' : ''}>${room.busy ? '整備中…' : c >= 100 ? '整備済み' : '機体を整備する'}</button>
      <div class="rm-sub">コンテナ</div>
      ${player.cargo.length ? player.cargo.map((cg) => `<div class="rm-cargo"><span>${cg.name}</span><b style="color:${cg.cond < 30 ? 'var(--danger)' : cg.cond < 60 ? 'var(--warn)' : 'var(--paper)'}">${Math.round(cg.cond)}%</b></div>`).join('') : '<p class="rm-note">背負っている荷物はない。</p>'}
      <button class="btn" data-ract="repair" ${room.busy || room.maintUsed || !player.cargo.length ? 'disabled' : ''}>${room.maintUsed ? '補修済み（この訪問では1回まで）' : 'コンテナを補修する（+25%、最大95%）'}</button>`;
  } else if (sec === 'paint') {
    const sw = (kind, list) => list.map((p) => { const lock = G.trust < p.req; const on = G.paint[kind] === p.id; return `<button class="swatch ${on ? 'on' : ''}" data-paint="${kind}:${p.id}" ${lock ? 'disabled' : ''} title="${p.name}"><i style="background:#${p.hex.toString(16).padStart(6, '0')}"></i><span>${lock ? `信頼度 ${p.req}` : p.name}</span></button>`; }).join('');
    h = `<div class="rm-sub">差し色</div><div class="swatches">${sw('accent', ACCENTS)}</div>
      <div class="rm-sub">バイザー</div><div class="swatches">${sw('visor', VISORS)}</div>
      <p class="rm-note">色は信頼度が上がるほど増える。</p>`;
  } else if (sec === 'collection') {
    const shards = Object.keys(G.shards).length;
    h = `<div class="rm-sub">データ片　${shards} / ${SHARDS.length}</div><p class="rm-note">棚の最上段。読み取ったデータ片が光る。</p>
      <div class="rm-sub">記念品　${Object.keys(G.items).length} / ${ITEMS.length}</div>
      <div class="rm-items">${ITEMS.map((it) => G.items[it.id] ? `<button class="rm-item ${room.sel === it.id ? 'on' : ''}" data-item="${it.id}">${it.name}</button>` : `<div class="rm-item locked">？？？<small>${it.hint}</small></div>`).join('')}</div>
      <div class="rm-desc" id="rmDesc">${room.sel ? `<b>${ITEM_BY_ID[room.sel].name}</b><p>${ITEM_BY_ID[room.sel].desc}</p>` : '<p class="rm-note">記念品を選ぶと、棚の実物を照らします。</p>'}</div>`;
  }
  $('rmBody').innerHTML = h;
  $('rmFoot').innerHTML = fmtKeys(`<span class="note">{back} ${sec === 'main' || sec === 'rest' ? '地上へ戻る' : 'メニューへ'}</span><button class="btn" data-ract="exit" ${room.busy ? 'disabled' : ''}>地上へ戻る</button>`);
  if (inputMode === 'pad' && !room.busy) {
    // after switching sections, move into the new section's content instead of staying on the tab
    const keep = fk && !fk.startsWith('[data-rsec') && $('rmBody').querySelector(fk + ':not(:disabled)');
    const el = keep || $('rmBody').querySelector('button:not(:disabled)') || $('rmFoot').querySelector('button:not(:disabled)');
    if (el) el.focus();
  }
}
function selectItem(id) {
  if (!G.items[id]) return;
  room.sel = id;
  document.querySelectorAll('#rmBody .rm-item').forEach((b) => b.classList.toggle('on', b.dataset.item === id));
  const d = $('rmDesc'); if (d) d.innerHTML = `<b>${ITEM_BY_ID[id].name}</b><p>${ITEM_BY_ID[id].desc}</p>`;
  audio.ui(760);
}
function setupRoomUI() {
  const box = $('room');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b || b.disabled) return;
    if (b.dataset.rsec) { room.section = b.dataset.rsec; room.sel = null; audio.ui(600); renderRoomUI(); }
    else if (b.dataset.ract === 'rest') doRest();
    else if (b.dataset.ract === 'maint') doMaintain();
    else if (b.dataset.ract === 'repair') doRepairCargo();
    else if (b.dataset.ract === 'exit') exitRoom();
    else if (b.dataset.paint) { const [k, id] = b.dataset.paint.split(':'); setPaint(k, id); }
    else if (b.dataset.item) selectItem(b.dataset.item);
  });
  box.addEventListener('focusin', (e) => { const b = e.target.closest('[data-item]'); if (b) selectItem(b.dataset.item); });
}
function updateRoom(dt) {
  room.t += dt;
  // camera
  const key = room.section === 'rest' ? 'rest' : room.section;
  const [p, l] = ROOM_CAMS[key] || ROOM_CAMS.main;
  let tp = new THREE.Vector3(...p), tl = new THREE.Vector3(...l);
  if (key === 'collection' && room.sel && room.shelf[room.sel]) { const it = room.shelf[room.sel].position; tl.set(it.x, it.y + 0.1, it.z); tp.set(-2.4, it.y + 0.35, it.z + 0.9); }
  tp.x += Math.sin(room.t * 0.21) * 0.06; tp.y += Math.sin(room.t * 0.17) * 0.04;
  room.camPos.lerp(tp, 1 - Math.exp(-2.6 * dt)); room.camLook.lerp(tl, 1 - Math.exp(-3 * dt));
  room.camera.position.copy(room.camPos); room.camera.lookAt(room.camLook);
  // keep the robot clear of the side panel (wide) or the bottom sheet (narrow)
  const W = innerWidth, Hh = innerHeight, wide = W > 760;
  const offX = wide ? Math.min(W * 0.2, 260) : 0, offY = wide ? 0 : Hh * 0.17;
  if (room.viewOff !== offX + offY * 1000 || room.viewW !== W || room.viewH !== Hh) {
    room.viewOff = offX + offY * 1000; room.viewW = W; room.viewH = Hh;
    room.camera.setViewOffset(W, Hh, offX, offY, W, Hh);
  }
  // robot pose
  if (room.robotState === 'boot') { room.robotT += room.busy && room.robotT < 0.2 ? 0 : dt; if (room.robotT > 2.6) room.robotState = 'move'; }
  roomP.state = room.robotState; roomP.stateT = room.robotState === 'boot' ? (room.robotT < 0.3 && room.busy ? 0 : room.robotT) : 5;
  roomP.battery = player.battery;
  roomP.grip = room.section === 'maint' && room.busy ? [true, true] : [false, false];
  roomP.lookYaw = room.section === 'collection' ? -1.2 : room.section === 'paint' ? 0.1 : 0.28 + Math.sin(room.t * 0.3) * 0.25;
  robot.update(dt, roomP);
  // arms + sparks while maintaining
  const working = room.section === 'maint' && room.busy;
  for (const a of room.arms) {
    const k = working ? 1 : 0;
    a.j1.rotation.z = damp(a.j1.rotation.z, a.s * lerp(0.15, 0.55 + Math.sin(room.t * 5 + a.s) * 0.08, k), 4, dt);
    a.j2.rotation.z = damp(a.j2.rotation.z, a.s * lerp(0.1, -0.9 + Math.sin(room.t * 7) * 0.1, k), 4, dt);
    a.tip.material.emissiveIntensity = working ? 2 + Math.random() * 3 : 1.2;
  }
  const pos = room.sparks.geometry.attributes.position;
  for (let i = 0; i < room.sparkLife.length; i++) {
    room.sparkLife[i] -= dt;
    if (room.sparkLife[i] <= 0) {
      if (working && Math.random() < 0.3) {
        const a = room.arms[i % 2]; const w = new THREE.Vector3(); a.tip.getWorldPosition(w);
        pos.setXYZ(i, w.x, w.y, w.z); room.sparkV[i].set(rr(-1, 1), rr(0, 1.5), rr(-1, 1)); room.sparkLife[i] = rr(0.3, 0.7);
      } else { pos.setXYZ(i, 0, -10, 0); continue; }
    }
    room.sparkV[i].y -= 6 * dt;
    pos.setXYZ(i, pos.getX(i) + room.sparkV[i].x * dt, Math.max(0.15, pos.getY(i) + room.sparkV[i].y * dt), pos.getZ(i) + room.sparkV[i].z * dt);
  }
  pos.needsUpdate = true;
  room.sparks.material.opacity = damp(room.sparks.material.opacity, working ? 1 : 0, 6, dt);
  // shelf
  for (const g of room.gems) { g.m.rotation.y += dt * 0.8; }
  if (room.section === 'collection' && room.sel && room.shelf[room.sel]) {
    const it = room.shelf[room.sel]; room.selRing.visible = true; room.selRing.position.set(it.position.x, it.position.y + 0.005, it.position.z);
    room.selRing.scale.setScalar(1 + Math.sin(room.t * 4) * 0.08); it.rotation.y += dt * 0.6;
  } else room.selRing.visible = false;
  room.shaftMat.uniforms.uTime.value = room.t;
}
