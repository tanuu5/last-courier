'use strict';
// Node connection and other units' shared structures.

/* =========================================================
   Node connection
   ========================================================= */
function setNodeVisual(n) {
  const m = n.mesh; if (!m) return;
  const col = n.connected ? 0x86e1f2 : 0xff6b5e;
  m.ringMat.emissive.setHex(col); m.lampMat.emissive.setHex(col);
  m.scrMat.emissive.setHex(n.connected ? 0x86e1f2 : 0x553333);
}
function connectNode(n, cinematic) {
  n.connected = true;
  setNodeVisual(n);
  const o = G.orders.find((x) => x.main && x.to === n.id);
  if (o) { const line = buildNetLine(NODES[o.from], n); line.anim = true; }
  for (const s of G.structures) if (s.revealNode === n.id && !s.visible) { s.visible = true; s.mesh.visible = true; s.fadeIn = 0; }
  for (const c of G.cargo) if (c.lost && c.revealNode === n.id && c.loc === 'hidden') { placeCargoOnGround(c, c.pos.x, c.pos.z); }
  const u = UNLOCKS[n.id];
  if (u) { G.unlocks[u.key] = true; if (u.key === 'ladder') player.tools.ladder = TOOL_MAX.ladder; if (u.key === 'charger') player.tools.charger = TOOL_MAX.charger; }
  refreshOrders();
  audio.connect();
  const cnt = NODES.filter((x) => x.connected).length;
  banner('NODE CONNECTED', `${n.name} がネットワークに接続されました（${cnt} / ${NODES.length}）`);
  if (cinematic) G.cine = { type: 'connect', node: n, t: 0, dur: 6.5 };
  const lines = NODE_LINES[n.id] || [];
  lines.forEach((l, i) => setTimeout(() => radio('ツムギ', l), 2600 + i * 5200));
  const hint = nextMainHint();
  if (hint) setTimeout(() => radio('ツムギ', '次のメイン依頼は、' + hint), 2600 + lines.length * 5200);
  if (u) setTimeout(() => toast('UNLOCK', u.text), 3200);
  rumble(0.3, 0.6, 800);
  (NODE_ARCH[n.id] || []).forEach((id, i) => setTimeout(() => unlockArchive(id), 5600 + i * 1400));
  const rev = G.structures.filter((s) => s.revealNode === n.id).length;
  if (rev) setTimeout(() => toast('NETWORK', `他ユニットの設置物 ${rev} 件が同期されました`), 4400);
  if (cnt === NODES.length && !G.ended) { G.ended = true; setTimeout(() => startEnding(), 7500); }
  if (NODE_ITEM[n.id]) setTimeout(() => unlockItem(NODE_ITEM[n.id]), 8200);
  if (cnt === NODES.length) setTimeout(() => unlockItem('knot'), 9000);
  saveCheckpoint();
}
const NODE_LINES = {
  1: ['風見の観測所、接続を確認。風のデータが流れ込んでくる。…ありがとう、R-07。', 'ラダーを送った。{ladder} で構えて、{adjust} で長さを変え、{confirm} で設置。深い川や段差を越えられる。'],
  2: ['第三発電所、再点火。ハブの電力が安定した。', '充電ポストのキットを送った。{charger} で設置すると、周りでバッテリーが回復する。ほかのユニットも使えるよ。'],
  3: ['記録庫ドーム、接続。…古い記録が残ってる。人間たちが最後に交わしたメッセージも。', 'スタビライザーを更新した。重い荷物でも少しだけ楽に歩けるはず。湖畔の工房と北嶺中継塔、二つともつながったら、ここから終端局アマネへの最後の依頼を出せる。'],
  4: ['湖畔の工房、稼働開始。積載フレームを作ってもらった。90kg まで背負える。'],
  5: ['北嶺中継塔、接続。ここからなら、終端局まで信号が届く。', 'スキャナーの出力を上げた。探査範囲は 70m。'],
  6: ['終端局アマネ、接続。…全部のノードが、繋がった。'],
};

/* =========================================================
   Other units' structures (simulated asynchronous network)
   ========================================================= */
function addStructure(s) {
  s.id = s.id || G.nextId++;
  s.acks = s.acks || 0;
  if (s.type === 'ladder') s.mesh = ladderMesh(new THREE.Vector3(s.p0.x, s.p0.y, s.p0.z), new THREE.Vector3(s.p1.x, s.p1.y, s.p1.z), s.owner);
  else if (s.type === 'charger') { s.mesh = chargerMesh(s.owner); s.mesh.position.set(s.pos.x, s.pos.y, s.pos.z); addCollider(s.pos.x, s.pos.z, 0.5, 'charger').struct = s; }
  else if (s.type === 'sign') { s.mesh = signMesh(s.sign, s.owner === 'you' ? 'R-07' : s.owner); s.mesh.position.set(s.pos.x, s.pos.y, s.pos.z); }
  s.mesh.visible = s.visible !== false;
  s.visible = s.visible !== false;
  scene.add(s.mesh);
  G.structures.push(s);
  return s;
}
function planOtherStructures() {
  // seeded, so other units' structures land in the same places (and belong to the same units) on every load
  const R = mulberry32(20261001), pickR = (arr) => arr[Math.floor(R() * arr.length)];
  const plan = [];
  for (const m of MAIN_ORDERS) {
    const A = NODES[m.from], B = NODES[m.to];
    const len = Math.hypot(B.x - A.x, B.z - A.z);
    const dx = (B.x - A.x) / len, dz = (B.z - A.z) / len;
    let inWet = false, s0 = 0, maxDep = 0;
    const owner = (t) => t === 'ladder' ? pickR(['K-11', 'K-11', 'SORA-2', 'TOBI-5']) : t === 'charger' ? pickR(['ISO-1', 'ISO-1', 'HAKO-9']) : 'MIRA-3';
    let bridges = 0;
    for (let s = 20; s < len - 20; s += 1) {
      const x = A.x + dx * s, z = A.z + dz * s;
      const dep = waterDepth(x, z);
      if (dep > 0.05) { if (!inWet) { inWet = true; s0 = s; maxDep = 0; } maxDep = Math.max(maxDep, dep); }
      else if (inWet) {
        inWet = false;
        if (maxDep > 0.85 && bridges < 2) {
          const mid = (s0 + s) / 2, mx = A.x + dx * mid, mz = A.z + dz * mid;
          const rs = nearestRiverSample(mx, mz);
          if (!rs) continue;
          const px = -rs.tz, pz = rs.tx;
          // walk out from the channel until the ground is dry AND gentle enough to stand on (the rim of a gorge, not its foot)
          const bank = (sign) => { for (let t = 0; t < 30; t += 0.5) { const bx = mx + px * t * sign, bz = mz + pz * t * sign; const gb = terrainGrad(bx, bz); if (terrainHeight(bx, bz) > WATER + 0.35 && Math.hypot(gb.x, gb.z) < 0.55) return [bx + px * sign * 0.8, bz + pz * sign * 0.8]; } return null; };
          const b1 = bank(1), b2 = bank(-1);
          if (b1 && b2) {
            const L = Math.hypot(b1[0] - b2[0], b1[1] - b2[1]);
            if (L < 17) {
              const y1 = terrainHeight(b1[0], b1[1]), y2 = terrainHeight(b2[0], b2[1]);
              if (Math.abs(y1 - y2) / L < 0.8) { plan.push({ type: 'ladder', owner: owner('ladder'), p0: { x: b2[0], y: y2, z: b2[1] }, p1: { x: b1[0], y: y1, z: b1[1] }, revealNode: m.to, visible: false, acks: 20 + Math.floor(R() * 300) }); bridges++; }
            }
          }
        }
      }
    }
    if (len > 250) {
      for (let tries = 0; tries < 40; tries++) {
        const t = 0.45 + (R() - 0.5) * 0.3; const off = (R() - 0.5) * 30;
        const x = A.x + dx * len * t - dz * off, z = A.z + dz * len * t + dx * off;
        const g = terrainGrad(x, z);
        if (terrainHeight(x, z) > WATER + 1 && Math.hypot(g.x, g.z) < 0.3) { plan.push({ type: 'charger', owner: owner('charger'), pos: { x, y: terrainHeight(x, z), z }, revealNode: m.to, visible: false, acks: 40 + Math.floor(R() * 400) }); break; }
      }
    }
    let signs = 0;
    for (let s = 40; s < len - 40 && signs < 2; s += 6) {
      const x = A.x + dx * s, z = A.z + dz * s;
      const g = terrainGrad(x, z);
      if (Math.hypot(g.x, g.z) > 0.8 && terrainHeight(x, z) > WATER + 1) {
        const sx = x - dx * 10, sz = z - dz * 10; const g2 = terrainGrad(sx, sz);
        if (Math.hypot(g2.x, g2.z) < 0.4) { plan.push({ type: 'sign', sign: 0, owner: owner('sign'), pos: { x: sx, y: terrainHeight(sx, sz), z: sz }, revealNode: m.to, visible: false, acks: Math.floor(R() * 120) }); signs++; s += 60; }
      }
    }
  }
  // echo warning signs at the zone edge (visible once node 2 is online)
  for (let a = 0; a < 3; a++) {
    const ang = 0.6 + a * 1.9; const x = ECHO_ZONE.x + Math.cos(ang) * (ECHO_ZONE.r + 6), z = ECHO_ZONE.z + Math.sin(ang) * (ECHO_ZONE.r + 6);
    if (terrainHeight(x, z) > WATER + 1) plan.push({ type: 'sign', sign: 3, owner: 'MIRA-3', pos: { x, y: terrainHeight(x, z), z }, revealNode: 2, visible: false, acks: Math.floor(R() * 200) });
  }
  plan.forEach((s) => addStructure(s));
}
function updateAcks(dt) {
  G.ackTimer -= dt;
  if (G.ackTimer > 0) return;
  G.ackTimer = rr(35, 90);
  const mine = G.structures.filter((s) => s.owner === 'you');
  if (!mine.length) return;
  const s = pick(mine);
  const n = 1 + Math.floor(Math.random() * 6);
  s.acks += n; G.stats.acksRecv += n;
  const label = s.type === 'ladder' ? 'ラダー' : s.type === 'charger' ? '充電ポスト' : '標識';
  const from = pick(UNITS);
  toast('ACK', `${from} があなたの${label}に ACK ×${n}`);
  setTimeout(() => { unlockArchive('g-ack'); if (UNIT_ARCH[from]) unlockArchive(UNIT_ARCH[from]); }, 1500);
}
