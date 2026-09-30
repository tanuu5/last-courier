'use strict';
// Delivery orders, grading and delivery handling.

/* =========================================================
   Orders / missions
   ========================================================= */
function nodeDist(a, b) { return Math.hypot(NODES[a].x - NODES[b].x, NODES[a].z - NODES[b].z); }
function initOrders() {
  G.orders = MAIN_ORDERS.map((m) => ({
    id: m.id, main: true, from: m.from, to: m.to, title: m.title, desc: m.desc, req: m.req,
    items: m.items.map(([type, name, w]) => ({ type, name, w, status: 'pending', cond: 100 })),
    locked: true, done: false, acceptedAt: 0, limit: 0, reward: 140, losses: 0,
  }));
  refreshOrders();
}
function orderState(o) {
  if (o.done) return 'done';
  if (o.locked) return 'locked';
  if (o.items.some((i) => i.status === 'pending')) return 'available';
  return 'active';
}
const SIDE_TPL = [
  ['{d}への定期便', '{d}から交換部品の補充要請。'],
  ['{d}の備蓄を補う', '保管庫の在庫が尽きかけている。'],
  ['{d}へ観測データを', '途絶していた間の記録を届けてほしい。'],
  ['{d}の修理資材', 'ノードの劣化が進んでいる。修理資材を急ぎで。'],
  ['{d}への医療セル', '稼働中のユニットの保守に必要な医療セル。'],
];
const SIDE_ITEMS = [['parts', '交換部品', 8, 16], ['parts', '修理資材', 10, 20], ['fragile', '観測機器', 6, 12], ['heavy', '蓄電池', 18, 28], ['med', '医療セル', 6, 12], ['data', '記録メディア', 4, 8]];
function genSideOrder(from, conn) {
  const dests = conn.filter((n) => n.id !== from.id);
  const dest = pick(dests);
  const tpl = pick(SIDE_TPL);
  const n = 1 + Math.floor(Math.random() * 3);
  const items = [];
  for (let i = 0; i < n; i++) { const [type, name, a, b] = pick(SIDE_ITEMS); items.push({ type, name, w: Math.round(rr(a, b)), status: 'pending', cond: 100 }); }
  const dist = nodeDist(from.id, dest.id);
  const urgent = Math.random() < 0.3;
  const W = items.reduce((s, i) => s + i.w, 0);
  return {
    id: 'S' + (G.nextId++), main: false, from: from.id, to: dest.id,
    title: tpl[0].replace('{d}', dest.name), desc: tpl[1], items,
    locked: false, done: false, acceptedAt: 0, limit: urgent ? Math.round(dist * 1.3 / WALK * 1.15 + 50) : 0,
    reward: Math.round(40 + W * 1.2 + dist * 0.12 + (urgent ? 40 : 0)), losses: 0,
  };
}
function refreshOrders() {
  for (const o of G.orders) if (o.main && o.locked && o.req.every((r) => G.orders.find((x) => x.id === r).done)) o.locked = false;
  const conn = NODES.filter((n) => n.connected);
  if (conn.length >= 2) {
    for (const n of conn) {
      const count = G.orders.filter((o) => !o.main && o.from === n.id && orderState(o) === 'available').length;
      for (let k = count; k < 2; k++) G.orders.push(genSideOrder(n, conn));
    }
  }
}
function acceptOrder(o) {
  const pend = o.items.map((it, idx) => ({ it, idx })).filter((x) => x.it.status === 'pending');
  const w = pend.reduce((s, x) => s + x.it.w, 0);
  if (cargoWeight() + w > capacity() + 0.01) { toast('積載超過', `この依頼は ${w}kg。最大 ${capacity()}kg まで`, true); audio.deny(); return; }
  pend.forEach(({ it, idx }) => {
    const c = createCargo({ type: it.type, name: it.name, w: it.w, dest: o.to, orderId: o.id, itemIdx: idx, cond: 100 });
    it.status = 'carrying';
    carryCargo(c);
  });
  if (!o.acceptedAt) o.acceptedAt = G.time;
  audio.pickup();
  G.stats.orders++;
  tutorialOnAccept(o);
  renderTerminal();
  saveGame();
}
function gradeOrder(o) {
  const items = o.items.filter((i) => i.status === 'delivered');
  const avg = items.length ? items.reduce((s, i) => s + i.cond, 0) / items.length : 0;
  const par = o.limit || (nodeDist(o.from, o.to) * 1.4 / WALK + 60);
  const t = G.time - o.acceptedAt;
  const timeScore = t <= par ? 1 : clamp(1 - (t - par) / par, 0, 1);
  const W = items.reduce((s, i) => s + i.w, 0);
  const lostPart = o.items.length ? o.items.filter((i) => i.status === 'lost').length / o.items.length : 0;
  let score = (avg / 100) * 0.62 + timeScore * 0.28 + clamp(W / 45, 0, 1) * 0.1 - (o.losses || 0) * 0.07 - lostPart * 0.4;
  let grade = score >= 0.9 ? 'S' : score >= 0.76 ? 'A' : score >= 0.56 ? 'B' : 'C';
  if (o.limit && t > o.limit && (grade === 'S' || grade === 'A')) grade = 'B';
  const trust = Math.round(o.reward * { S: 1.5, A: 1.2, B: 1, C: 0.7 }[grade]);
  const acks = { S: 50, A: 26, B: 12, C: 4 }[grade] + Math.floor(Math.random() * 10);
  return { grade, avg, t, par, W, trust, acks };
}
function deliverHere(node) {
  const items = player.cargo.filter((c) => c.dest === node.id);
  if (!items.length) return;
  const touched = new Set();
  let lostBonus = [];
  let coreForNode = false;
  for (const c of items) {
    const o = orderOf(c);
    if (o && c.itemIdx >= 0) { const it = o.items[c.itemIdx]; it.status = 'delivered'; it.cond = c.cond; touched.add(o); if (o.main && c.type === 'core' && o.to === node.id) coreForNode = true; }
    else if (c.lost) lostBonus.push(c);
    removeCargo(c);
  }
  robot.setCargoVisual(player.cargo);
  const reports = [];
  for (const o of touched) {
    const resolved = o.items.every((i) => i.status === 'delivered' || i.status === 'lost');
    if (resolved) {
      o.done = true;
      const r = gradeOrder(o);
      G.trust += r.trust; G.stats.acksRecv += r.acks; G.stats.grades[r.grade]++; G.stats.delivered++;
      if (r.grade === 'S') setTimeout(() => unlockItem('badge'), 2500);
      reports.push({ o, r, full: true });
    } else reports.push({ o, full: false });
  }
  for (const c of lostBonus) { G.trust += 60; G.stats.acksRecv += 20; reports.push({ lost: c }); }
  if (lostBonus.length) setTimeout(() => unlockItem('hakobox'), 2500);
  const connect = coreForNode && !node.connected;
  refreshOrders();
  audio.deliver();
  rumble(0.2, 0.5, 220);
  showResult(reports, node, connect);
  saveGame();
}
