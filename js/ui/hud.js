'use strict';
// HUD: status, compass, balance gauge, prompts and messages.

/* =========================================================
   HUD
   ========================================================= */
function radio(who, html, sys) {
  html = fmtKeys(html);
  const box = $('radio');
  const el = document.createElement('div');
  el.className = 'msg' + (sys ? ' sys' : '');
  el.innerHTML = `<span class="who">${who}</span>${html}`;
  box.appendChild(el);
  while (box.children.length > 3) box.removeChild(box.firstChild);
  const life = 7000 + html.length * 90;
  setTimeout(() => el.classList.add('fade'), life);
  setTimeout(() => el.remove(), life + 900);
  audio.blip(1180, 0.05, 'sine', 0.04); setTimeout(() => audio.blip(1480, 0.06, 'sine', 0.035), 70);
}
function toast(title, text, warn) {
  text = fmtKeys(text);
  const box = $('toasts');
  const el = document.createElement('div');
  el.className = 'toast' + (warn ? ' warn' : '');
  el.innerHTML = `<b>${title}</b>　${text}`;
  box.appendChild(el);
  while (box.children.length > 4) box.removeChild(box.firstChild);
  setTimeout(() => el.classList.add('fade'), 4200);
  setTimeout(() => el.remove(), 4900);
}
let hintTimer = 0;
function showHint(html, sec) { const h = $('hint'); h.innerHTML = fmtKeys(html); h.classList.add('show'); hintTimer = sec; }
function banner(l1, l2) {
  $('bannerL1').textContent = l1; $('bannerL2').textContent = l2;
  const b = $('banner'); b.classList.add('show');
  clearTimeout(banner._t); banner._t = setTimeout(() => b.classList.remove('show'), 5200);
}
let hudTimer = 0;
function updateHUD(dt) {
  if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').classList.remove('show'); }
  hudTimer -= dt;
  drawCompass();
  drawBalance();
  updatePrompt();
  if (hudTimer > 0) return;
  hudTimer = 0.12;
  const P = player;
  const bm = $('batMeter');
  bm.querySelector('i').style.width = `calc(${P.battery.toFixed(1)}% - 4px)`;
  bm.querySelector('i').style.background = P.battery < 15 ? 'var(--danger)' : P.battery < 35 ? 'var(--warn)' : 'var(--signal)';
  bm.querySelector('span').textContent = Math.round(P.battery) + '%';
  const lv = $('loadVal'); lv.textContent = Math.round(cargoWeight()); lv.className = cargoWeight() > capacity() ? 'over' : '';
  $('capVal').textContent = capacity();
  const cv = $('condVal'); cv.textContent = Math.round(P.cond); cv.style.color = P.cond < 30 ? 'var(--danger)' : P.cond < 60 ? 'var(--warn)' : '';
  const tools = [];
  tools.push(`<span class="tool ${G.unlocks.ladder ? '' : 'off'}">${K('ladder')} ラダー<b>${G.unlocks.ladder ? player.tools.ladder : '—'}</b></span>`);
  tools.push(`<span class="tool ${G.unlocks.charger ? '' : 'off'}">${K('charger')} 充電ポスト<b>${G.unlocks.charger ? player.tools.charger : '—'}</b></span>`);
  tools.push(`<span class="tool">${K('sign')} 標識</span>`);
  const th = tools.join('');
  if ($('tools').innerHTML !== th) $('tools').innerHTML = th;
  const objs = SETTINGS.guide ? mainObjectives() : [];
  const oh = objs.slice(0, 2).map((m) => m.kind === 'deliver'
    ? `<div><b>MAIN</b>届ける：${m.o.title} → ${m.node.name}</div>`
    : `<div><b>MAIN</b>受注：${m.o.title}（${m.node.name}で受け取り）</div>`).join('');
  if ($('objective').innerHTML !== oh) $('objective').innerHTML = oh;
  const cn = NODES.filter((n) => n.connected).length;
  $('netVal').textContent = `${cn} / ${NODES.length}`;
  const dots = NODES.map((n) => `<i class="${n.connected ? 'on' : ''}"></i>`).join('');
  if ($('netDots').innerHTML !== dots) $('netDots').innerHTML = dots;
  $('trustVal').textContent = G.trust; $('ackVal').textContent = G.stats.acksRecv;
  const un = unreadCount();
  const ab = un ? `ARCHIVE <b>${un}</b> 件の新しい記録 ${K('archive')}` : '';
  if ($('archBadge').innerHTML !== ab) $('archBadge').innerHTML = ab;

  // cargo list (top of stack first)
  $('cargoCount').textContent = `${P.cargo.length} 個 ・ ${cargoWeight()}kg`;
  const list = P.cargo.slice().reverse().map((c) => {
    const o = orderOf(c);
    let lim = '';
    if (o && o.limit && !o.done) { const left = o.limit - (G.time - o.acceptedAt); lim = ` ・ <span style="color:${left < 0 ? 'var(--danger)' : 'var(--warn)'}">${left < 0 ? '超過' : fmtTime(left)}</span>`; }
    const cls = c.cond < 30 ? 'bad' : c.cond < 60 ? 'mid' : '';
    return `<div class="citem ${cls}"><span class="sw" style="background:${hex(CTYPES[c.type].band)}"></span><span class="nm">${c.name}<small>→ ${NODES[c.dest].name}${lim}</small></span><span class="cd">${Math.round(c.cond)}%<small>${c.w}kg</small></span></div>`;
  }).join('');
  if ($('cargoList').innerHTML !== list) $('cargoList').innerHTML = list;
  // zone warnings
  const r = rainAt(P.pos.x, P.pos.z), ef = echoFactor(P.pos.x, P.pos.z);
  if (r > 0.25 && !G.flags.rainSeen) { G.flags.rainSeen = true; setTimeout(() => unlockArchive('g-rain'), 800); }
  let z = '';
  if (r > 0.1) z += `<span class="z rain"><b>RAIN</b>腐食雨 ・ 荷物が劣化中</span>`;
  if (ef > 0.3) z += `<span class="z echo"><b>ECHO</b>エコー域</span>`;
  if (P.battery < 15) z += `<span class="z bat"><b>LOW</b>バッテリー残量わずか</span>`;
  if (P.cond < 25) z += `<span class="z bat"><b>DAMAGE</b>機体の損傷が大きい</span>`;
  if ($('zone').innerHTML !== z) $('zone').innerHTML = z;
}

/* compass */
const cmp = { ctx: null };
function bearingTo(x, z) { return Math.atan2(x - player.pos.x, -(z - player.pos.z)); }
function drawCompass() {
  const cv = $('compass'); const x = cmp.ctx || (cmp.ctx = cv.getContext('2d'));
  const W = cv.width, H = cv.height;
  x.clearRect(0, 0, W, H);
  const head = -camState.yaw;
  const fov = Math.PI * 0.7;
  const toX = (b) => W / 2 + angleDiff(head, b) / fov * W;
  const grd = x.createLinearGradient(0, 0, W, 0);
  grd.addColorStop(0, 'rgba(230,236,239,0)'); grd.addColorStop(0.15, 'rgba(230,236,239,.55)'); grd.addColorStop(0.85, 'rgba(230,236,239,.55)'); grd.addColorStop(1, 'rgba(230,236,239,0)');
  x.strokeStyle = grd; x.fillStyle = grd; x.lineWidth = 2;
  x.beginPath(); x.moveTo(0, 40); x.lineTo(W, 40); x.stroke();
  for (let d = 0; d < 360; d += 15) {
    const b = d * Math.PI / 180; const px = toX(b);
    if (px < 0 || px > W) continue;
    const major = d % 90 === 0, mid = d % 45 === 0;
    x.beginPath(); x.moveTo(px, 40); x.lineTo(px, major ? 22 : mid ? 28 : 33); x.stroke();
    if (mid) {
      x.font = `${major ? 600 : 500} ${major ? 24 : 18}px "Chakra Petch", sans-serif`; x.textAlign = 'center';
      x.fillText(['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][d / 45], px, 16);
    }
  }
  const mark = (b, color, label, shape) => {
    let px = toX(b); const off = px < 16 || px > W - 16; px = clamp(px, 16, W - 16);
    x.fillStyle = color; x.strokeStyle = color;
    x.beginPath();
    if (shape === 'diamond') { x.moveTo(px, 44); x.lineTo(px + 9, 56); x.lineTo(px, 68); x.lineTo(px - 9, 56); }
    else { x.moveTo(px - 9, 48); x.lineTo(px + 9, 48); x.lineTo(px, 62); }
    x.closePath(); off ? x.stroke() : x.fill();
    if (label) { x.font = '500 17px "Chakra Petch", sans-serif'; x.textAlign = 'center'; x.fillText(label, px, 86); }
  };
  // destinations of carried cargo
  const dests = [...new Set(player.cargo.map((c) => c.dest))];
  dests.forEach((d) => { const n = NODES[d]; mark(bearingTo(n.x, n.z), '#f2a04b', `${Math.round(Math.hypot(n.x - player.pos.x, n.z - player.pos.z))}m`, 'diamond'); });
  if (!dests.length) {
    // where the next main orders can be picked up (white), other connected nodes faintly
    const origins = new Set(SETTINGS.guide ? mainObjectives().filter((m) => m.kind === 'accept').map((m) => m.node.id) : []);
    NODES.forEach((n) => {
      const d = Math.hypot(n.x - player.pos.x, n.z - player.pos.z);
      if (d < 25) return;
      if (origins.has(n.id)) mark(bearingTo(n.x, n.z), '#e6ecef', `MAIN ${Math.round(d)}m`, 'diamond');
      else if (n.connected) mark(bearingTo(n.x, n.z), 'rgba(134,225,242,.55)', d < 400 ? `${Math.round(d)}m` : '');
    });
  }
  if (G.waypoint) mark(bearingTo(G.waypoint.x, G.waypoint.z), '#86e1f2', `${Math.round(Math.hypot(G.waypoint.x - player.pos.x, G.waypoint.z - player.pos.z))}m`);
  // center tick
  x.fillStyle = '#e6ecef'; x.fillRect(W / 2 - 1.5, 30, 3, 14);
}

/* balance gauge */
const bal = { ctx: null, vis: 0 };
function drawBalance() {
  const cv = $('balance'); const x = bal.ctx || (bal.ctx = cv.getContext('2d'));
  const W = cv.width, H = cv.height;
  const P = player;
  const tx = P.tilt.x, tz = P.tilt.z;
  const want = P.cargo.length && P.state === 'move' && G.mode === 'play' ? (P.speed > 0.2 || Math.abs(tx) > 0.12 || Math.abs(tz) > 0.12 ? 1 : 0.35) : 0;
  bal.vis = damp(bal.vis, want, 6, 1 / 60);
  $('balanceWrap').style.opacity = bal.vis.toFixed(3);
  if (bal.vis < 0.01) return;
  x.clearRect(0, 0, W, H);
  const cx = W / 2, cy = H - 30, R = 170;
  const a0 = -Math.PI / 2 - 1.05, a1 = -Math.PI / 2 + 1.05;
  x.lineCap = 'round';
  const seg = (from, to, color, w) => { x.strokeStyle = color; x.lineWidth = w; x.beginPath(); x.arc(cx, cy, R, -Math.PI / 2 + from * 1.05, -Math.PI / 2 + to * 1.05); x.stroke(); };
  seg(-1, -0.62, 'rgba(255,107,94,.55)', 8); seg(0.62, 1, 'rgba(255,107,94,.55)', 8);
  seg(-0.62, -0.35, 'rgba(245,208,106,.45)', 8); seg(0.35, 0.62, 'rgba(245,208,106,.45)', 8);
  seg(-0.35, 0.35, 'rgba(230,236,239,.35)', 8);
  // indicator
  const a = -Math.PI / 2 + clamp(tx, -1.05, 1.05) * 1.05;
  const m = Math.abs(tx);
  const col = m > 0.62 ? '#ff6b5e' : m > 0.35 ? '#f5d06a' : '#e6ecef';
  x.strokeStyle = col; x.lineWidth = 6;
  x.beginPath(); x.moveTo(cx + Math.cos(a) * (R - 26), cy + Math.sin(a) * (R - 26)); x.lineTo(cx + Math.cos(a) * (R + 16), cy + Math.sin(a) * (R + 16)); x.stroke();
  // forward/back bar
  const bh = 70, bx = cx, by = cy - 40;
  x.fillStyle = 'rgba(230,236,239,.18)'; x.fillRect(bx - 3, by - bh, 6, bh * 2);
  const fz = clamp(tz, -1, 1);
  x.fillStyle = Math.abs(fz) > 0.62 ? '#ff6b5e' : Math.abs(fz) > 0.35 ? '#f5d06a' : '#e6ecef';
  x.fillRect(bx - 9, by - fz * bh - 3, 18, 6);
  // prompts
  x.font = '600 24px "Zen Kaku Gothic New", sans-serif';
  const blink = 0.55 + 0.45 * Math.sin(G.time * 12);
  if (tx > 0.3) { x.textAlign = 'left'; x.fillStyle = `rgba(255,${m > 0.62 ? 107 : 208},${m > 0.62 ? 94 : 106},${m > 0.62 ? blink : 0.9})`; x.fillText('◀ ' + glyph('left'), 8, cy - 4); }
  if (tx < -0.3) { x.textAlign = 'right'; x.fillStyle = `rgba(255,${m > 0.62 ? 107 : 208},${m > 0.62 ? 94 : 106},${m > 0.62 ? blink : 0.9})`; x.fillText(glyph('right') + ' ▶', W - 8, cy - 4); }
  if (Math.abs(tz) > 0.45) { x.textAlign = 'center'; x.fillStyle = '#f5d06a'; x.fillText(tz > 0 ? `前のめり ― ${glyph('both')}で踏ん張る` : `後ろに傾いている ― ${glyph('both')}`, cx, 26); }
  // grip indicators
  x.fillStyle = P.grip[0] ? '#86e1f2' : 'rgba(230,236,239,.25)'; x.fillRect(cx - R - 8, cy + 8, 40, 8);
  x.fillStyle = P.grip[1] ? '#86e1f2' : 'rgba(230,236,239,.25)'; x.fillRect(cx + R - 32, cy + 8, 40, 8);
}

/* context prompt + interaction */
let promptAction = null;
function updatePrompt() {
  const P = player;
  let text = '', act = null;
  if (G.mode === 'play' && P.state === 'move' && !P.placing && !G.cine) {
    const tn = NODES.find((n) => n.terminal && Math.hypot(P.pos.x - n.terminal.x, P.pos.z - n.terminal.z) < 3.2);
    const gc = nearestGroundCargo(2.4);
    const sh = nearestShard(2.3);
    const st = G.structures.find((s) => s.visible && s.owner !== 'you' && !s.acked && Math.hypot(P.pos.x - (s.pos ? s.pos.x : (s.p0.x + s.p1.x) / 2), P.pos.z - (s.pos ? s.pos.z : (s.p0.z + s.p1.z) / 2)) < (s.type === 'ladder' ? 5 : 3));
    if (tn) { text = `${K('interact')} ターミナル ― ${tn.name}`; act = { type: 'terminal', node: tn }; }
    else if (sh) { text = `${K('interact')} 読み取る ― データ片`; act = { type: 'shard', s: sh }; }
    else if (gc) { text = `${K('interact')} 拾う ― ${gc.name}（${gc.w}kg・${Math.round(gc.cond)}%）${gc.lost ? ' <span style="color:var(--signal)">遺失物</span>' : ''}`; act = { type: 'pick', c: gc }; }
    else if (st) { const label = st.type === 'ladder' ? 'ラダー' : st.type === 'charger' ? '充電ポスト' : '標識'; text = `${K('interact')} ACK を送る ― ${st.owner} の${label}（ACK ${st.acks}）`; act = { type: 'ack', s: st }; }
  }
  if (G.mode === 'play' && P.placing) {
    const pl = P.placing;
    const name = pl.type === 'ladder' ? `ラダー ${pl.len.toFixed(1)}m` : pl.type === 'charger' ? '充電ポスト' : `標識「${SIGN_TYPES[pl.sign].text}」`;
    text = pl.valid ? `${name} ― ${K('confirm')} で設置` : `<span style="color:var(--danger)">${name} ― ${pl.reason || '設置できない場所です'}</span>`;
    act = null;
  }
  promptAction = act;
  const el = $('prompt');
  if (text) { if (el.innerHTML !== text) el.innerHTML = text; el.classList.add('show'); } else el.classList.remove('show');
}
function doInteract() {
  const a = promptAction; if (!a) return;
  if (a.type === 'terminal') openTerminal(a.node);
  else if (a.type === 'pick') tryPickup(a.c);
  else if (a.type === 'ack') {
    a.s.acked = true; a.s.acks++; G.stats.acksSent++; audio.ack(); rumble(0.1, 0.3, 120); toast('ACK', `${a.s.owner} に ACK を送った`);
    setTimeout(() => { unlockArchive('g-ack'); if (UNIT_ARCH[a.s.owner]) unlockArchive(UNIT_ARCH[a.s.owner]); }, 1200);
  }
  else if (a.type === 'shard') readShard(a.s);
}
