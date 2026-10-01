'use strict';
// Save / load and contextual tutorials.

/* =========================================================
   Save / load
   ========================================================= */
const SAVE_KEY = 'last-courier-save-v1';
function hasSave() { try { return !!localStorage.getItem(SAVE_KEY); } catch (e) { return false; } }
function saveGame() {
  if (G.mode === 'title' || G.mode === 'intro' || G.mode === 'loading') return;
  const data = {
    v: 1, time: G.time, trust: G.trust, stats: G.stats, unlocks: G.unlocks, flags: G.flags, nextId: G.nextId, ended: G.ended,
    nodes: NODES.map((n) => n.connected),
    player: { x: player.pos.x, y: player.pos.y, z: player.pos.z, heading: player.heading, battery: player.battery, tools: player.tools, lastNode: player.lastNode },
    orders: G.orders.map((o) => ({ ...o, items: o.items.map((i) => ({ ...i })) })),
    cargo: G.cargo.filter((c) => c.loc !== 'gone').map((c) => ({ type: c.type, name: c.name, w: c.w, dest: c.dest, orderId: c.orderId, itemIdx: c.itemIdx, cond: c.cond, lost: c.lost, found: !!c.found, revealNode: c.revealNode, loc: c.loc, x: c.pos.x, y: c.pos.y, z: c.pos.z })),
    structures: G.structures.map((s) => ({ type: s.type, owner: s.owner, p0: s.p0, p1: s.p1, pos: s.pos, sign: s.sign, acks: s.acks, acked: !!s.acked, visible: s.visible, revealNode: s.revealNode })),
    waypoint: G.waypoint,
    archive: G.archive, shards: G.shards, shardSeen: G.shardSeen, items: G.items, paint: G.paint, cond: player.cond,
  };
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch (e) { /* storage unavailable */ }
}
function loadGame() {
  let d;
  try { d = JSON.parse(localStorage.getItem(SAVE_KEY)); } catch (e) { return false; }
  if (!d || d.v !== 1) return false;
  G.time = d.time; G.trust = d.trust; Object.assign(G.stats, d.stats); Object.assign(G.unlocks, d.unlocks); G.flags = d.flags || {}; G.nextId = d.nextId; G.ended = d.ended;
  NODES.forEach((n, i) => { n.connected = !!d.nodes[i]; setNodeVisual(n); });
  G.orders = d.orders;
  // structures
  for (const s of G.structures) { scene.remove(s.mesh); s.visible = false; }
  G.structures = [];
  d.structures.filter((s) => s.owner === 'you').forEach((s) => addStructure(s));
  // other units' structures are rebuilt from the current world layout (keeps old saves in sync with fixes)
  const savedOthers = d.structures.filter((s) => s.owner !== 'you');
  planOtherStructures();
  for (const s of G.structures) {
    if (s.owner === 'you') continue;
    s.visible = !!(NODES[s.revealNode] && NODES[s.revealNode].connected); s.mesh.visible = s.visible;
    const prev = savedOthers.find((p) => !p.used && p.type === s.type && p.revealNode === s.revealNode && p.owner === s.owner);
    if (prev) { prev.used = true; s.acked = !!prev.acked; s.acks = Math.max(s.acks, prev.acks || 0); }
  }
  // cargo
  for (const c of G.cargo) if (c.mesh.parent) c.mesh.parent.remove(c.mesh);
  G.cargo = []; player.cargo = [];
  d.cargo.forEach((cd) => {
    const c = createCargo(cd);
    c.found = cd.found; c.revealNode = cd.revealNode;
    c.pos.set(cd.x, cd.y, cd.z);
    if (cd.loc === 'carried') carryCargo(c);
    else if (cd.loc === 'hidden') c.loc = 'hidden';
    else { c.loc = 'ground'; c.resting = false; c.mesh.position.copy(c.pos); scene.add(c.mesh); }
  });
  robot.setCargoVisual(player.cargo);
  player.pos.set(d.player.x, d.player.y, d.player.z); player.heading = d.player.heading; player.battery = d.player.battery; player.tools = d.player.tools; player.lastNode = d.player.lastNode || 0;
  camState.yaw = player.heading + Math.PI;
  // network lines
  for (const o of G.orders) if (o.main && NODES[o.to].connected) { const l = buildNetLine(NODES[o.from], NODES[o.to]); l.mesh.geometry.setDrawRange(0, l.total); l.t = 1; }
  if (d.waypoint) { G.waypoint = d.waypoint; waypointMesh.position.set(d.waypoint.x, terrainHeight(d.waypoint.x, d.waypoint.z) + 80, d.waypoint.z); waypointMesh.visible = true; }
  G.archive = d.archive || { unlocked: {}, read: {} };
  G.shards = d.shards || {}; G.shardSeen = d.shardSeen || {};
  G.items = d.items || {}; G.paint = Object.assign({ accent: 'orange', visor: 'cyan' }, d.paint || {});
  player.cond = d.cond ?? 100;
  NODES.forEach((n) => { if (n.connected && NODE_ITEM[n.id]) unlockItem(NODE_ITEM[n.id], true); });
  applyPaint();
  NODES.forEach((n) => { if (n.connected) (NODE_ARCH[n.id] || []).forEach((id) => unlockArchive(id, true)); });
  Object.keys(G.shards).forEach((id) => unlockArchive(id, true));
  if (G.ended) unlockArchive('final', true);
  refreshOrders();
  return true;
}
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); localStorage.removeItem('last-courier-checkpoint-v1'); } catch (e) { /* ignore */ } }

/* =========================================================
   Tutorial hooks
   ========================================================= */
function tutorialOnAccept(o) {
  if (o.id === 'M1' && !G.flags.tutAccept) {
    G.flags.tutAccept = true;
    setTimeout(() => radio('ツムギ', '荷物は背中のラックに積まれる。歩くと揺れて、傾きが大きくなると転ぶ。'), 800);
    setTimeout(() => radio('ツムギ', '右に傾いたら {left}、左に傾いたら {right}。反対側に重心を移せば立て直せる。{both} で押すと、ゆっくりだけど安定して歩ける。'), 6500);
    setTimeout(() => radio('ツムギ', '目的地はコンパスの橙色の印。{map} で地図、{scan} で地形スキャン。青は安全、黄は注意、赤は危険。'), 14000);
  }
  if (o.id === 'M3' && !G.flags.tutEcho) {
    G.flags.tutEcho = true;
    setTimeout(() => radio('ツムギ', '記録庫へのルートは"エコー"がいる区域を通る。昔のネットワークの残響で、近くのユニットに無理やり接続してくる。'), 800);
    setTimeout(() => radio('ツムギ', '走ると気づかれやすい。{sneak} で忍び足にすれば音を抑えられる。捕まったら {mash} を連打して切断して。'), 7500);
  }
  if (o.id === 'M2' && !G.flags.tutM2) { G.flags.tutM2 = true; setTimeout(() => radio('ツムギ', '発電所までの間には深い渓谷がある。スキャンで浅い場所を探すか、{ladder} のラダーを架けて渡って。'), 800); }
}
let riverHintT = 0;
function contextTutorials(dt) {
  const P = player;
  if (!G.flags.riverHint && P.cargo.length) {
    riverHintT -= dt;
    if (riverHintT <= 0) {
      riverHintT = 1;
      for (let a = 0; a < 8; a++) { const x = P.pos.x + Math.cos(a / 8 * TAU) * 18, z = P.pos.z + Math.sin(a / 8 * TAU) * 18; if (waterDepth(x, z) > 0.4) { G.flags.riverHint = true; radio('ツムギ', '川だ。流れのある深い場所では足をとられる。{scan} でスキャンして、青い印の浅瀬を渡って。'); break; } }
    }
  }
  if (!G.flags.shardNear && G.mode === 'play') { const sh = nearestShard(16); if (sh) { G.flags.shardNear = true; radio('ツムギ', 'この近くに古いデータ片の信号がある。光る石柱を探して、{interact} で読み取って。'); } }
  if (G.stats.distance > 10000 && !G.items.footpad) unlockItem('footpad');
  if (!G.flags.lowBat && P.battery < 25) { G.flags.lowBat = true; radio('ツムギ', 'バッテリーが減ってきた。接続済みのノードか充電ポストの近くで回復できる。'); }
  if (!G.flags.heavy && cargoWeight() > capacity() * 0.75) { G.flags.heavy = true; radio('ツムギ', 'かなり重い。荷物が高く積まれるほど、揺れは大きくなる。坂の途中で立ち止まるのも手だよ。'); }
}
