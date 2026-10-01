'use strict';
// Full-screen map.

/* =========================================================
   Map
   ========================================================= */
let mapBase = null;
function buildMapBase() {
  const S = 512;
  const c = document.createElement('canvas'); c.width = c.height = S;
  const x = c.getContext('2d');
  const img = x.createImageData(S, S);
  const d = img.data;
  const L = [-0.6, 0.55, -0.58]; const ll = Math.hypot(...L); L[0] /= ll; L[1] /= ll; L[2] /= ll;
  for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
    const k = j * VN + i;
    const h = H[k];
    const hl = H[j * VN + Math.max(i - 1, 0)], hr = H[j * VN + Math.min(i + 1, GRID)];
    const hu = H[Math.max(j - 1, 0) * VN + i], hd = H[Math.min(j + 1, GRID) * VN + i];
    let nx = -(hr - hl) / (2 * CELL), ny = 1, nz = -(hd - hu) / (2 * CELL); const nl = Math.hypot(nx, ny, nz); nx /= nl; ny /= nl; nz /= nl;
    const shade = clamp(nx * L[0] + ny * L[1] + nz * L[2], 0, 1);
    let r, g, b;
    if (h < WATER) {
      const dep = clamp((WATER - h) / 3, 0, 1);
      r = lerp(40, 14, dep); g = lerp(78, 40, dep); b = lerp(92, 60, dep);
    } else {
      const t = clamp((h - WATER) / 100, 0, 1);
      r = lerp(34, 120, t); g = lerp(52, 138, t); b = lerp(58, 140, t);
      const s = 0.45 + shade * 0.85; r *= s; g *= s; b *= s;
      const c10 = Math.floor(h / 10), cn = Math.floor(hr / 10), cd = Math.floor(hd / 10);
      if (c10 !== cn || c10 !== cd) { const major = (Math.max(c10, cn, cd) % 5) === 0; r += major ? 55 : 28; g += major ? 60 : 32; b += major ? 60 : 32; }
    }
    const p = (j * S + i) * 4; d[p] = r; d[p + 1] = g; d[p + 2] = b; d[p + 3] = 255;
  }
  x.putImageData(img, 0, 0);
  mapBase = c;
}
function worldToMap(x, z, S) { return [(x + HALF) / WORLD * S, (z + HALF) / WORLD * S]; }
function openMap() {
  if (G.mode !== 'play' || G.cine) return;
  G.mode = 'map'; $('mapView').classList.remove('hidden'); releaseLock();
  pad.cu = (player.pos.x + HALF) / WORLD; pad.cv = (player.pos.z + HALF) / WORLD;
  updateMapLegend(); drawMap(); audio.ui(760);
}
function updateMapLegend() {
  $('mapCtl').innerHTML = inputMode === 'pad' ? fmtKeys('左スティック：カーソル ／ {interact} 目印を置く ／ {sneak} 消す ／ {back} 閉じる') : 'クリック：目印を置く ／ 右クリック：消す ／ <kbd>M</kbd> 閉じる';
}
function closeMap() { $('mapView').classList.add('hidden'); G.mode = 'play'; requestLock(); }
function drawMap() {
  const cv = $('mapCanvas'); const x = cv.getContext('2d'); const S = cv.width;
  x.imageSmoothingEnabled = true;
  x.drawImage(mapBase, 0, 0, S, S);
  x.fillStyle = 'rgba(8,14,18,.18)'; x.fillRect(0, 0, S, S);
  // grid
  x.strokeStyle = 'rgba(230,236,239,.07)'; x.lineWidth = 1;
  for (let g = 0; g <= 8; g++) { const p = g / 8 * S; x.beginPath(); x.moveTo(p, 0); x.lineTo(p, S); x.moveTo(0, p); x.lineTo(S, p); x.stroke(); }
  // echo zone
  const [ex, ez] = worldToMap(ECHO_ZONE.x, ECHO_ZONE.z, S);
  x.setLineDash([8, 6]); x.strokeStyle = 'rgba(185,156,255,.8)'; x.lineWidth = 2; x.beginPath(); x.arc(ex, ez, ECHO_ZONE.r / WORLD * S, 0, TAU); x.stroke(); x.setLineDash([]);
  x.fillStyle = 'rgba(185,156,255,.1)'; x.fill();
  // storms
  for (const s of G.storms) { if (s.fixed) continue; const [sx, sz] = worldToMap(s.x, s.z, S); x.fillStyle = 'rgba(245,208,106,.12)'; x.strokeStyle = 'rgba(245,208,106,.45)'; x.beginPath(); x.arc(sx, sz, s.r / WORLD * S, 0, TAU); x.fill(); x.stroke(); }
  // network lines
  x.strokeStyle = 'rgba(134,225,242,.85)'; x.lineWidth = 3; x.shadowColor = '#86e1f2'; x.shadowBlur = 10;
  for (const o of G.orders) if (o.main && NODES[o.to].connected) { const [ax, az] = worldToMap(NODES[o.from].x, NODES[o.from].z, S), [bx, bz] = worldToMap(NODES[o.to].x, NODES[o.to].z, S); x.beginPath(); x.moveTo(ax, az); x.lineTo(bx, bz); x.stroke(); }
  x.shadowBlur = 0;
  // structures
  for (const s of G.structures) {
    if (!s.visible) continue;
    const p = s.pos || { x: (s.p0.x + s.p1.x) / 2, z: (s.p0.z + s.p1.z) / 2 };
    const [sx, sz] = worldToMap(p.x, p.z, S);
    x.fillStyle = s.owner === 'you' ? '#f2a04b' : 'rgba(230,236,239,.75)';
    if (s.type === 'ladder') x.fillRect(sx - 5, sz - 1.5, 10, 3);
    else if (s.type === 'charger') { x.beginPath(); x.arc(sx, sz, 4, 0, TAU); x.fill(); }
    else x.fillRect(sx - 2, sz - 2, 4, 4);
  }
  // cargo on ground
  for (const c of G.cargo) if (c.loc === 'ground' || c.loc === 'water') { const [cx, cz] = worldToMap(c.pos.x, c.pos.z, S); x.fillStyle = '#f2a04b'; x.fillRect(cx - 3, cz - 3, 6, 6); }
  // nodes
  const dests = new Set(player.cargo.map((c) => c.dest));
  const mainOrigins = new Set(SETTINGS.guide ? mainObjectives().filter((m) => m.kind === 'accept').map((m) => m.node.id) : []);
  for (const n of NODES) {
    const [nx, nz] = worldToMap(n.x, n.z, S);
    const col = n.connected ? '#86e1f2' : '#ff6b5e';
    if (dests.has(n.id)) { x.strokeStyle = '#f2a04b'; x.lineWidth = 3; x.beginPath(); x.arc(nx, nz, 16 + Math.sin(performance.now() / 200) * 2, 0, TAU); x.stroke(); }
    x.save(); x.translate(nx, nz); x.rotate(Math.PI / 4); x.fillStyle = col; x.fillRect(-7, -7, 14, 14); x.restore();
    x.font = '600 17px "Zen Kaku Gothic New", sans-serif'; x.fillStyle = '#e6ecef'; x.textAlign = 'center';
    x.fillText(n.name, nx, nz - 16);
    x.font = '500 12px "Chakra Petch", sans-serif'; x.fillStyle = col; x.fillText(n.connected ? 'ONLINE' : 'OFFLINE', nx, nz + 24);
    if (mainOrigins.has(n.id)) { x.font = '700 13px "Zen Kaku Gothic New", sans-serif'; x.fillStyle = '#f2a04b'; x.fillText('メイン依頼あり', nx, nz + 40); }
  }
  // data shards that have been found
  for (const sh of shardObjs) {
    if (!G.shardSeen[sh.id] && !G.shards[sh.id]) continue;
    const [hx, hz] = worldToMap(sh.x, sh.z, S);
    x.save(); x.translate(hx, hz); x.rotate(Math.PI / 4); x.strokeStyle = G.shards[sh.id] ? 'rgba(230,236,239,.35)' : '#d8f7ff'; x.lineWidth = 2; x.strokeRect(-5, -5, 10, 10); x.restore();
  }
  // gamepad cursor
  if (inputMode === 'pad') {
    const cx = pad.cu * S, cz = pad.cv * S;
    x.strokeStyle = '#ffffff'; x.lineWidth = 1.5;
    x.beginPath(); x.moveTo(cx - 16, cz); x.lineTo(cx - 5, cz); x.moveTo(cx + 5, cz); x.lineTo(cx + 16, cz); x.moveTo(cx, cz - 16); x.lineTo(cx, cz - 5); x.moveTo(cx, cz + 5); x.lineTo(cx, cz + 16); x.stroke();
  }
  // waypoint
  if (G.waypoint) { const [wx, wz] = worldToMap(G.waypoint.x, G.waypoint.z, S); x.strokeStyle = '#86e1f2'; x.lineWidth = 2; x.beginPath(); x.moveTo(wx, wz - 14); x.lineTo(wx, wz + 2); x.stroke(); x.beginPath(); x.arc(wx, wz - 18, 5, 0, TAU); x.stroke(); }
  // player
  const [px, pz] = worldToMap(player.pos.x, player.pos.z, S);
  x.save(); x.translate(px, pz); x.rotate(Math.atan2(Math.sin(player.heading), -Math.cos(player.heading)) + 0);
  x.fillStyle = '#ffffff'; x.beginPath(); x.moveTo(0, -11); x.lineTo(7, 8); x.lineTo(0, 4); x.lineTo(-7, 8); x.closePath(); x.fill(); x.restore();
  // camera view cone
  x.strokeStyle = 'rgba(255,255,255,.3)'; x.lineWidth = 1; const vb = -camState.yaw;
  x.beginPath(); x.moveTo(px, pz); x.lineTo(px + Math.sin(vb - 0.5) * 40, pz - Math.cos(vb - 0.5) * 40); x.moveTo(px, pz); x.lineTo(px + Math.sin(vb + 0.5) * 40, pz - Math.cos(vb + 0.5) * 40); x.stroke();
  // scale bar
  x.fillStyle = 'rgba(230,236,239,.8)'; x.fillRect(24, S - 30, 100 / WORLD * S, 3);
  x.font = '500 13px "Chakra Petch", sans-serif'; x.textAlign = 'left'; x.fillText('100 m', 24, S - 38);
  x.textAlign = 'right'; x.fillText('N ↑', S - 20, 30);
}
function mapClick(ev, clear) {
  ev.preventDefault();
  if (clear) { clearWaypoint(); return; }
  const r = ev.target.getBoundingClientRect();
  setWaypoint((ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height);
}
function setWaypoint(u, v) {
  const x = u * WORLD - HALF, z = v * WORLD - HALF;
  G.waypoint = { x, z };
  waypointMesh.position.set(x, terrainHeight(x, z) + 80, z); waypointMesh.visible = true;
  audio.ui(900);
  drawMap();
}
function clearWaypoint() { G.waypoint = null; waypointMesh.visible = false; audio.ui(500); drawMap(); }
