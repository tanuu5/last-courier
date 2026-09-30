'use strict';
// Placing ladders / chargers / signs, and the terrain scanner.

/* =========================================================
   Placement of tools
   ========================================================= */
let previewMesh = null;
function startPlacing(type) {
  if (player.state !== 'move' || G.mode !== 'play') return;
  if (player.placing && player.placing.type === type) { cancelPlacing(); return; }
  if (type === 'ladder' && (!G.unlocks.ladder || player.tools.ladder <= 0)) { toast('ラダー', G.unlocks.ladder ? '残りがありません。ノードで補給を' : 'まだ支給されていません', true); audio.deny(); return; }
  if (type === 'charger' && (!G.unlocks.charger || player.tools.charger <= 0)) { toast('充電ポスト', G.unlocks.charger ? 'キットがありません。ノードで補給を' : 'まだ支給されていません', true); audio.deny(); return; }
  cancelPlacing();
  player.placing = { type, len: 6, sign: 2, valid: false };
  const mat = new THREE.MeshBasicMaterial({ color: 0x86e1f2, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false });
  if (type === 'ladder') {
    previewMesh = new THREE.Group();
    for (const s of [-1, 1]) { const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.1, 1), mat); r.position.x = s * 0.42; previewMesh.add(r); }
    const plane = new THREE.Mesh(new THREE.BoxGeometry(0.84, 0.02, 1), mat.clone()); plane.material.opacity = 0.18; previewMesh.add(plane);
  } else if (type === 'charger') {
    previewMesh = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(0.4, 2.4, 0.4), mat); p.position.y = 1.2; previewMesh.add(p);
    const ring = new THREE.Mesh(new THREE.RingGeometry(11.6, 12, 64), mat.clone()); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.2; previewMesh.add(ring);
  } else {
    previewMesh = new THREE.Group();
    const p = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.0, 0.05), mat); p.position.y = 2.2; previewMesh.add(p);
    const pole = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.7, 0.06), mat); pole.position.y = 0.85; previewMesh.add(pole);
  }
  previewMesh.userData.mat = mat;
  scene.add(previewMesh);
  audio.ui(520);
  const help = type === 'ladder' ? '{adjust} で長さ調整 ／ {confirm} で設置 ／ {cancel} でやめる' : type === 'sign' ? '{adjust} で種類を変更 ／ {confirm} で設置 ／ {cancel} でやめる' : '{confirm} で設置 ／ {cancel} でやめる';
  showHint(help, 4);
}
function cancelPlacing() {
  if (previewMesh) { scene.remove(previewMesh); previewMesh = null; }
  player.placing = null;
}
function updatePlacing() {
  const pl = player.placing; if (!pl || !previewMesh) return;
  const f = camForward();
  const P = player.pos;
  const mat = previewMesh.userData.mat;
  if (pl.type === 'ladder') {
    const sx = P.x + f.x * 0.6, sz = P.z + f.z * 0.6;
    const sy = P.y;
    let ex = sx + f.x * pl.len, ez = sz + f.z * pl.len;
    let ey = terrainHeight(ex, ez);
    const dy = ey - sy;
    const pitch = Math.atan2(Math.abs(dy), pl.len);
    const endDepth = WATER - ey, startDepth = WATER - terrainHeight(sx, sz);
    // the far end must land on ground you can step onto (also check just beyond it)
    const beyond = Math.max(terrainHeight(ex + f.x * 0.8, ez + f.z * 0.8) - ey, (terrainHeight(ex + f.x * 1.6, ez + f.z * 1.6) - ey) * 0.6);
    pl.reason = pitch >= 0.98 ? '角度が急すぎます' : endDepth >= 0.25 ? '先端が水中です' : startDepth >= 0.8 ? '足元が深すぎます' : beyond > 0.65 ? '先端が崖の斜面にかかっています。長さを変えてください' : '';
    pl.valid = !pl.reason;
    pl.p0 = { x: sx, y: sy, z: sz }; pl.p1 = { x: ex, y: ey, z: ez };
    const len3 = Math.hypot(pl.len, dy);
    previewMesh.position.set((sx + ex) / 2, (sy + ey) / 2 + 0.05, (sz + ez) / 2);
    previewMesh.lookAt(ex, ey + 0.05, ez);
    previewMesh.children.forEach((ch) => { ch.scale.z = len3; });
  } else {
    const x = P.x + f.x * 2.2, z = P.z + f.z * 2.2;
    const y = terrainHeight(x, z);
    const g = terrainGrad(x, z);
    pl.valid = WATER - y < 0.1 && Math.hypot(g.x, g.z) < 0.6;
    pl.reason = pl.valid ? '' : (WATER - y >= 0.1 ? '水の上には置けません' : '地面が傾きすぎています');
    pl.pos = { x, y, z };
    previewMesh.position.set(x, y, z);
    previewMesh.rotation.y = camState.yaw;
  }
  mat.color.setHex(pl.valid ? 0x86e1f2 : 0xff5a4f);
}
function confirmPlacing() {
  const pl = player.placing; if (!pl) return;
  if (!pl.valid) { toast('設置できません', pl.type === 'ladder' ? (pl.reason || '場所を変えてください') : '平らな地面を選んでください', true); audio.deny(); return; }
  if (pl.type === 'ladder') { addStructure({ type: 'ladder', owner: 'you', p0: pl.p0, p1: pl.p1, visible: true }); player.tools.ladder--; }
  else if (pl.type === 'charger') { addStructure({ type: 'charger', owner: 'you', pos: pl.pos, visible: true }); player.tools.charger--; }
  else addStructure({ type: 'sign', owner: 'you', sign: pl.sign, pos: pl.pos, visible: true });
  audio.place();
  rumble(0.5, 0.2, 160);
  const t = pl.type;
  cancelPlacing();
  if (t === 'ladder' && !G.flags.placedLadder) { G.flags.placedLadder = true; radio('ツムギ', '設置したものはネットワークで共有される。ほかのユニットの役にも立つよ。'); }
}

/* =========================================================
   Scanner
   ========================================================= */
const scan = { t: -99, origin: new THREE.Vector3(), R: 40, marks: [], reveal: -99 };
const MARK_COL = { safe: new THREE.Color(0x5fd4ff), warn: new THREE.Color(0xf5d06a), bad: new THREE.Color(0xff5a4f), cargo: new THREE.Color(0xf2a04b), shard: new THREE.Color(0xd8f7ff) };
function startScan() {
  if (G.time - scan.t < 2.4 || player.state === 'hijack') return;
  scan.t = G.time; scan.origin.copy(player.pos); scan.R = G.unlocks.scanner ? 70 : 40;
  scan.reveal = G.time;
  rumble(0, 0.25, 120);
  const R = scan.R, step = R > 50 ? 3.2 : 2.5;
  const marks = [];
  for (let z = -R; z <= R; z += step) for (let x = -R; x <= R; x += step) {
    const px = scan.origin.x + x + (Math.random() - 0.5) * step * 0.8, pz = scan.origin.z + z + (Math.random() - 0.5) * step * 0.8;
    const d = Math.hypot(px - scan.origin.x, pz - scan.origin.z);
    if (d > R || d < 1.5) continue;
    const h = terrainHeight(px, pz);
    const dep = WATER - h;
    let cls;
    if (dep > 1.3) cls = 'bad';
    else if (dep > 0.45) cls = 'warn';
    else if (dep > 0.05) cls = 'safe';
    else {
      const g = terrainGrad(px, pz); const s = Math.hypot(g.x, g.z);
      const rk = sampleArr(ROCK, px, pz);
      if (s > 0.95) cls = 'bad'; else if (s > 0.55 || rk > 0.7) cls = 'warn'; else cls = 'safe';
    }
    if (cls === 'safe' && Math.random() > 0.3) continue;
    if (cls === 'warn' && Math.random() > 0.75) continue;
    marks.push({ x: px, y: Math.max(h, WATER), z: pz, d, col: MARK_COL[cls] });
  }
  for (const c of G.cargo) if ((c.loc === 'ground' || c.loc === 'water') && c.pos.distanceTo(scan.origin) < R) { c.revealed = G.time; marks.push({ x: c.pos.x, y: c.pos.y + 0.6, z: c.pos.z, d: c.pos.distanceTo(scan.origin), col: MARK_COL.cargo, big: true }); }
  for (const sh of shardObjs) {
    const d = Math.hypot(sh.x - scan.origin.x, sh.z - scan.origin.z);
    if (d < R && !G.shards[sh.id]) { G.shardSeen[sh.id] = true; marks.push({ x: sh.x, y: sh.y + 2.2, z: sh.z, d, col: MARK_COL.shard, big: true }); }
  }
  marks.sort((a, b) => a.d - b.d);
  scan.marks = marks.slice(0, MARK_MAX);
  terrainUniforms.uScanO.value.copy(scan.origin);
  audio.scan();
}
const _m4 = new THREE.Matrix4(), _p3 = new THREE.Vector3(), _s3 = new THREE.Vector3(), _q4 = new THREE.Quaternion(), _eul = new THREE.Euler();
function updateScan() {
  const e = G.time - scan.t;
  const speed = scan.R / 1.5;
  const r = e * speed;
  terrainUniforms.uScanR.value = Math.min(r, scan.R + 6);
  terrainUniforms.uScanA.value = e < 1.5 ? 1 : Math.max(0, 1 - (e - 1.5) / 1.6);
  if (e > 10) { markerMesh.count = 0; return; }
  let n = 0;
  _eul.set(0, camState.yaw, 0); _q4.setFromEuler(_eul);
  for (const m of scan.marks) {
    if (m.d > r) break;
    const age = (r - m.d) / speed;
    let s = Math.min(1, age * 5) * (1 - smoothstep(7.5, 9.5, e));
    if (s <= 0.001) continue;
    s *= m.big ? 2.2 : 1;
    _p3.set(m.x, m.y + 0.35 + Math.sin(G.time * 2 + m.x) * 0.05, m.z);
    _s3.set(s, s, s);
    _m4.compose(_p3, _q4, _s3);
    markerMesh.setMatrixAt(n, _m4);
    markerMesh.setColorAt(n, m.col);
    n++;
  }
  markerMesh.count = n;
  markerMesh.instanceMatrix.needsUpdate = true;
  if (markerMesh.instanceColor) markerMesh.instanceColor.needsUpdate = true;
}
