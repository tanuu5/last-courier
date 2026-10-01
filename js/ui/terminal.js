'use strict';
// Station terminal and delivery result panels.

/* =========================================================
   Terminal UI
   ========================================================= */
let termNode = null, termTab = 'deliver';
function openTerminal(node) {
  termNode = node; G.mode = 'terminal';
  player.vel.set(0, 0, 0); player.speed = 0;
  player.lastNode = node.id;
  const hasDeliv = player.cargo.some((c) => c.dest === node.id);
  termTab = hasDeliv ? 'deliver' : (node.connected ? 'orders' : 'deliver');
  releaseLock();
  $('terminal').classList.remove('hidden');
  audio.ui(660);
  renderTerminal();
}
function closeTerminal() {
  $('terminal').classList.add('hidden');
  if (G.mode === 'terminal') G.mode = 'play';
  termNode = null;
  saveCheckpoint();
  requestLock();
}
function tagHtml(it) { const t = CTYPES[it.type].tag; return t === 'frag' ? '<span class="tag frag">壊れ物</span>' : t === 'dry' ? '<span class="tag dry">防水不可</span>' : ''; }
function hex(c) { return '#' + c.toString(16).padStart(6, '0'); }
function fmtTime(s) { s = Math.max(0, Math.round(s)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; }
function renderTerminal() {
  const n = termNode; if (!n) return;
  const fk = inputMode === 'pad' ? focusKey(document.activeElement) : null;
  $('tEn').textContent = `NODE ${String(n.id).padStart(2, '0')} ・ ${n.en}`;
  $('tName').textContent = n.name;
  const st = $('tState'); st.className = 'state ' + (n.connected ? 'on' : 'off'); st.textContent = n.connected ? 'ONLINE' : 'OFFLINE';
  const tabs = n.connected ? [['deliver', '納品'], ['orders', '依頼'], ['supply', '補給'], ['log', '記録']] : [['deliver', '納品']];
  $('tTabs').innerHTML = tabs.map(([k, l]) => `<button data-tab="${k}" class="${termTab === k ? 'on' : ''}">${l}</button>`).join('');
  let html = '';
  if (termTab === 'deliver') {
    const items = player.cargo.filter((c) => c.dest === n.id);
    if (!items.length) html = `<div class="empty">${n.connected ? 'このノード宛ての荷物は持っていません。' : 'このノードはオフラインです。接続コアを届けるとネットワークに接続されます。'}</div>`;
    else {
      html = `<div class="order main"><div><h3>${items.length} 個の荷物を納品できます</h3>
        <div class="items">${items.map((c) => `<span style="--c:${hex(CTYPES[c.type].band)}">${c.name} ・ ${c.w}kg ・ 状態 ${Math.round(c.cond)}%</span>`).join('')}</div></div>
        <button class="btn primary" data-act="deliver">納品する</button></div>`;
    }
    const other = player.cargo.filter((c) => c.dest !== n.id);
    if (other.length) html += `<div class="specs">ほかの宛先の荷物：${other.map((c) => `${c.name} → ${NODES[c.dest].name}`).join('、')}</div>`;
  } else if (termTab === 'orders') {
    const list = G.orders.filter((o) => o.from === n.id && orderState(o) === 'available');
    if (!list.length) html = '<div class="empty">現在このノードで受けられる依頼はありません。</div>';
    list.sort((a, b) => (b.main ? 1 : 0) - (a.main ? 1 : 0));
    html += list.map((o) => {
      const pend = o.items.filter((i) => i.status === 'pending');
      const W = pend.reduce((s, i) => s + i.w, 0);
      const over = cargoWeight() + W > capacity();
      const re = o.items.some((i) => i.status !== 'pending');
      return `<div class="order ${o.main ? 'main' : ''}"><div>
        <h3>${o.main ? '<span class="tag main">MAIN</span>' : ''}${o.limit ? '<span class="tag urgent">至急</span>' : ''}${re ? '<span class="tag lost">再発行</span>' : ''}${o.title}</h3>
        <p>${o.desc.replace('{d}', NODES[o.to].name)}</p>
        <div class="specs"><span>宛先<b>${NODES[o.to].name}</b></span><span>直線距離<b>${Math.round(nodeDist(o.from, o.to))} m</b></span><span>重量<b>${W} kg</b></span>${o.limit ? `<span>制限時間<b>${fmtTime(o.limit)}</b></span>` : ''}<span>報酬<b>${o.reward}</b></span></div>
        <div class="items">${pend.map((it) => `<span style="--c:${hex(CTYPES[it.type].band)}">${it.name} ${it.w}kg</span>${tagHtml(it)}`).join('')}</div>
      </div><button class="btn ${o.main ? 'primary' : ''}" data-act="accept" data-id="${o.id}" ${over ? 'disabled' : ''}>${over ? '積載超過' : '受注する'}</button></div>`;
    }).join('');
  } else if (termTab === 'supply') {
    const canL = G.unlocks.ladder, canC = G.unlocks.charger;
    html = `<div class="order"><div><h3>バッテリー</h3><p>ノードのパッド上では自動で充電されます。</p><div class="specs"><span>現在<b>${Math.round(player.battery)} %</b></span></div></div><span></span></div>
      <div class="order"><div><h3>ツール補給</h3><p>ラダーは1本 2.5kg、充電ポスト用キットは1個 4kg として積載重量に含まれます。</p>
      <div class="specs"><span>ラダー<b>${canL ? `${player.tools.ladder} / ${TOOL_MAX.ladder}` : '未支給'}</b></span><span>充電キット<b>${canC ? `${player.tools.charger} / ${TOOL_MAX.charger}` : '未支給'}</b></span></div></div>
      <button class="btn sig" data-act="refill" ${(canL || canC) ? '' : 'disabled'}>上限まで補給</button></div>`;
  } else if (termTab === 'log') {
    const s = G.stats;
    html = `<div class="stats">
      <div class="stat"><small>完了した配送</small><b>${s.delivered}</b></div>
      <div class="stat"><small>歩いた距離</small><b>${(s.distance / 1000).toFixed(2)} km</b></div>
      <div class="stat"><small>転倒</small><b>${s.falls}</b></div>
      <div class="stat"><small>回収された回数</small><b>${s.recoveries || 0}</b></div>
      <div class="stat"><small>受け取ったACK</small><b>${s.acksRecv}</b></div>
      <div class="stat"><small>送ったACK</small><b>${s.acksSent}</b></div>
      <div class="stat"><small>評価 S / A / B / C</small><b>${s.grades.S}/${s.grades.A}/${s.grades.B}/${s.grades.C}</b></div>
      </div><p style="color:var(--mute);font-size:12.5px;margin:0">記録はノードに立ち寄るたびに自動で保存されます。</p>`;
  }
  $('tBody').innerHTML = html;
  $('tNote').textContent = `積載 ${cargoWeight()} / ${capacity()} kg ・ バッテリー ${Math.round(player.battery)}%`;
  $('tRoom').classList.toggle('hidden', !n.connected);
  if (inputMode === 'pad') refocus($('terminal'), fk);
}
function refillTools() {
  if (G.unlocks.ladder) player.tools.ladder = TOOL_MAX.ladder;
  if (G.unlocks.charger) player.tools.charger = TOOL_MAX.charger;
  audio.pickup(); renderTerminal();
}

/* result */
let pendingConnect = null;
function showResult(reports, node, connect) {
  G.mode = 'result';
  pendingConnect = connect ? node : null;
  $('rTitle').textContent = `${node.name} へ納品`;
  let html = '';
  for (const rep of reports) {
    if (rep.lost) { html += `<div class="rrow"><span>遺失物「${rep.lost.name}」を届けた</span><b>信頼度 +60 ・ ACK +20</b></div>`; continue; }
    const o = rep.o;
    if (!rep.full) { html += `<div class="rrow"><span>${o.title}（一部納品）</span><b>残り ${o.items.filter((i) => i.status !== 'delivered').length} 個</b></div>`; continue; }
    const r = rep.r;
    html += `<div class="grade"><div class="g ${r.grade}">${r.grade}</div><div style="flex:1;min-width:0">
      <div style="font-size:17px;margin-bottom:6px">${o.title}</div>
      <div class="rrow"><span>荷物の状態</span><b>${Math.round(r.avg)} %</b></div>
      <div class="rrow"><span>所要時間</span><b>${fmtTime(r.t)} ${o.limit ? `／ 制限 ${fmtTime(o.limit)}` : `／ 目安 ${fmtTime(r.par)}`}</b></div>
      <div class="rrow"><span>運んだ重量</span><b>${r.W} kg</b></div>
      <div class="rrow"><span>信頼度</span><b>+${r.trust}</b></div>
      <div class="rrow"><span>ACK</span><b>+${r.acks}</b></div></div></div>`;
  }
  $('rBody').innerHTML = html || '<div class="empty">記録なし</div>';
  $('rNote').textContent = connect ? 'このあとノードがネットワークに接続されます' : '';
  $('result').classList.remove('hidden');
  $('terminal').classList.add('hidden');
  padFocusFirst($('result'), true);
}
function closeResult() {
  $('result').classList.add('hidden');
  const n = pendingConnect; pendingConnect = null;
  if (n) {
    $('terminal').classList.add('hidden'); termNode = null;
    G.mode = 'play';
    connectNode(n, true);
    requestLock();
  } else { G.mode = 'terminal'; $('terminal').classList.remove('hidden'); renderTerminal(); }
}
