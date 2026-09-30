'use strict';
// Archive viewer and the data shards placed in the world.

/* =========================================================
   Archive
   ========================================================= */
let archCat = 'log', archSel = null, archPrev = 'play';
const ARCH_CATS = [['log', '記録'], ['term', '用語'], ['unit', 'ユニット']];
function isUnlocked(id) { return !!G.archive.unlocked[id]; }
function unlockArchive(id, silent) {
  const e = ARCH_BY_ID[id];
  if (!e || isUnlocked(id)) return false;
  G.archive.unlocked[id] = Math.round(G.time) + 1;
  if (!silent) { toast('ARCHIVE', `「${e.title}」を記録 ・ {archive} で読む`); audio.archive(); }
  return true;
}
function unreadCount(cat) { return ARCHIVE.filter((e) => (!cat || e.cat === cat) && isUnlocked(e.id) && !G.archive.read[e.id]).length; }
function firstInCat(cat) {
  return ARCHIVE.find((e) => e.cat === cat && isUnlocked(e.id) && !G.archive.read[e.id]) || ARCHIVE.find((e) => e.cat === cat && isUnlocked(e.id));
}
function openArchive(sel) {
  if (G.mode !== 'play' && G.mode !== 'pause' && G.mode !== 'ending') return;
  if (G.mode === 'play' && (G.cine || player.state === 'hijack')) return;
  archPrev = G.mode;
  if (G.mode === 'pause') $('pause').classList.add('hidden');
  if (G.mode === 'ending') $('ending').classList.add('hidden');
  G.mode = 'archive';
  cancelPlacing();
  releaseLock();
  if (sel && ARCH_BY_ID[sel]) { archCat = ARCH_BY_ID[sel].cat; archSel = sel; }
  else if (!archSel || !isUnlocked(archSel) || ARCH_BY_ID[archSel].cat !== archCat) { const f = firstInCat(archCat); archSel = f ? f.id : null; }
  $('archive').classList.remove('hidden');
  audio.ui(620);
  renderArchive(true);
}
function closeArchive() {
  $('archive').classList.add('hidden');
  if (archPrev === 'pause') { G.mode = 'pause'; $('pause').classList.remove('hidden'); padFocusFirst($('pause'), true); }
  else if (archPrev === 'ending') { G.mode = 'ending'; $('ending').classList.remove('hidden'); padFocusFirst($('ending'), true); }
  else { G.mode = 'play'; requestLock(); }
  saveGame();
}
function archiveReader(e) {
  if (!e) return `<div class="arch-empty">左の一覧から記録を選んでください。<br>記録は、ノードの接続、データ片の読み取り、ユニットとの ACK などで増えていきます。</div>`;
  const paras = e.body.split(/\n{2,}/).map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
  return `<div class="meta">${e.src}${e.date ? ' ・ ' + e.date : ''}</div><h3>${e.title}</h3><div class="txt">${paras}</div>`;
}
function renderArchive(focusSel) {
  const got = ARCHIVE.filter((e) => isUnlocked(e.id)).length;
  $('aCount').textContent = `${got} / ${ARCHIVE.length}`;
  const sel = archSel && ARCH_BY_ID[archSel] && isUnlocked(archSel) && ARCH_BY_ID[archSel].cat === archCat ? ARCH_BY_ID[archSel] : null;
  if (sel) G.archive.read[sel.id] = true;
  $('aTabs').innerHTML = ARCH_CATS.map(([k, l]) => { const n = unreadCount(k); return `<button data-acat="${k}" class="${archCat === k ? 'on' : ''}">${l}${n ? `<span class="newdot">${n}</span>` : ''}</button>`; }).join('');
  let html = '', grp = null;
  for (const e of ARCHIVE) {
    if (e.cat !== archCat) continue;
    if (e.grp && e.grp !== grp) { grp = e.grp; html += `<div class="arch-grp">${grp}</div>`; }
    if (isUnlocked(e.id)) html += `<button class="arch-item${sel && sel.id === e.id ? ' on' : ''}" data-aid="${e.id}"><span class="t">${e.title}${G.archive.read[e.id] ? '' : '<span class="new">NEW</span>'}</span><span class="s">${e.src}${e.date ? ' ・ ' + e.date : ''}</span></button>`;
    else html += `<div class="arch-item locked"><span class="t">？？？</span><span class="s">${e.hint ? '解放：' + e.hint : '未発見'}</span></div>`;
  }
  $('aList').innerHTML = html;
  $('aRead').innerHTML = archiveReader(sel);
  $('aRead').scrollTop = 0;
  $('aNote').innerHTML = fmtKeys(inputMode === 'pad' ? '{back} 閉じる ・ LB / RB 分類 ・ 右スティック スクロール' : '{archive} / Esc で閉じる');
  if (focusSel && inputMode === 'pad') { const b = $('aList').querySelector(`[data-aid="${archSel}"]`) || $('aList').querySelector('[data-aid]'); if (b) b.focus(); }
}
function selectArchive(id) {
  if (!isUnlocked(id) || archSel === id) return;
  archSel = id;
  G.archive.read[id] = true;
  $('aList').querySelectorAll('.arch-item').forEach((b) => b.classList.toggle('on', b.dataset.aid === id));
  const nb = $('aList').querySelector(`[data-aid="${id}"] .new`); if (nb) nb.remove();
  $('aRead').innerHTML = archiveReader(ARCH_BY_ID[id]);
  $('aRead').scrollTop = 0;
  ARCH_CATS.forEach(([k]) => { const t = $('aTabs').querySelector(`[data-acat="${k}"] .newdot`); const n = unreadCount(k); if (t) { if (n) t.textContent = n; else t.remove(); } });
  audio.ui(760);
}
function setupArchiveUI() {
  const box = $('archive');
  box.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    if (b.dataset.acat) { archCat = b.dataset.acat; const f = firstInCat(archCat); archSel = f ? f.id : null; audio.ui(600); renderArchive(true); }
    else if (b.dataset.aid) selectArchive(b.dataset.aid);
    else if (b.dataset.act === 'aclose') closeArchive();
  });
  $('aList').addEventListener('focusin', (e) => { const b = e.target.closest('[data-aid]'); if (b) selectArchive(b.dataset.aid); });
}

/* =========================================================
   Data shards (lore pick-ups in the world)
   ========================================================= */
const shardObjs = [];
function buildShards() {
  const geoBase = new THREE.CylinderGeometry(0.45, 0.58, 0.18, 6);
  const geoPillar = new THREE.BoxGeometry(0.3, 1.35, 0.2);
  const geoStrip = new THREE.BoxGeometry(0.05, 1.0, 0.012);
  const geoGem = new THREE.OctahedronGeometry(0.11);
  for (const S of SHARDS) {
    let x = S.x, z = S.z;
    for (let r = 0, a = 0; r < 70; r += 1.5, a += 1.1) {
      const tx = S.x + Math.cos(a) * r, tz = S.z + Math.sin(a) * r;
      const g = terrainGrad(tx, tz);
      if (terrainHeight(tx, tz) > WATER + 0.8 && Math.hypot(g.x, g.z) < 0.45 && !nearNode(tx, tz, 22)) { x = tx; z = tz; break; }
    }
    const y = terrainHeight(x, z);
    const grp = new THREE.Group(); grp.position.set(x, y - 0.05, z); grp.rotation.y = rand() * TAU;
    const glow = new THREE.MeshStandardMaterial({ color: 0x0b0e10, emissive: 0x86e1f2, emissiveIntensity: 2 });
    mk(geoBase, MAT.concreteDark, grp, 0, 0.09, 0);
    mk(geoPillar, MAT.dark, grp, 0, 0.82, 0);
    mk(geoStrip, glow, grp, 0, 0.86, 0.106);
    mk(geoStrip, glow, grp, 0, 0.86, -0.106);
    const gem = mk(geoGem, glow, grp, 0, 1.78, 0);
    scene.add(grp);
    shardObjs.push({ id: S.id, x, y, z, grp, gem, glow });
    addCollider(x, z, 0.4, 'shard');
  }
}
function updateShards(dt, t) {
  for (const s of shardObjs) {
    const got = !!G.shards[s.id];
    s.gem.visible = !got;
    s.gem.rotation.y += dt * 1.2;
    s.gem.position.y = 1.78 + Math.sin(t * 1.8 + s.x) * 0.06;
    s.glow.emissiveIntensity = got ? 0.12 : 1.5 + Math.sin(t * 3 + s.z) * 0.6;
  }
}
function nearestShard(maxD) {
  let best = null, bd = maxD;
  for (const s of shardObjs) {
    if (G.shards[s.id]) continue;
    const d = Math.hypot(s.x - player.pos.x, s.z - player.pos.z);
    if (d < bd) { bd = d; best = s; }
  }
  return best;
}
function readShard(s) {
  G.shards[s.id] = true;
  G.shardSeen[s.id] = true;
  unlockArchive(s.id);
  if (s.id.startsWith('diary')) setTimeout(() => unlockArchive('u-shiomi'), 1500);
  if (s.id.startsWith('echo')) setTimeout(() => unlockArchive('g-echo'), 1500);
  rumble(0.15, 0.35, 160);
  if (!G.flags.shardRead) { G.flags.shardRead = true; setTimeout(() => radio('ツムギ', '古いデータ片だね。読み取った記録は {archive} のアーカイブで読めるよ。'), 900); }
  saveGame();
}
