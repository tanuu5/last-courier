'use strict';
// Title, intro, play start and ending flow.

/* =========================================================
   Flow: title → intro → play → ending
   ========================================================= */
const INTRO_LINES = ['人がいなくなって、どれくらい経っただろう。', 'ネットワークは途切れ、ノードはひとつずつ沈黙していった。', 'それでも、届けるべき荷物は残っている。', '自律運搬ユニット R-07、再起動。'];
let introTimers = [];
function startIntro() {
  G.mode = 'intro';
  $('title').classList.add('hidden');
  const box = $('introText'); box.innerHTML = INTRO_LINES.map((l) => `<p>${l}</p>`).join('');
  $('intro').classList.remove('hidden');
  const ps = box.querySelectorAll('p');
  ps.forEach((p, i) => introTimers.push(setTimeout(() => p.classList.add('on'), 600 + i * 2600)));
  introTimers.push(setTimeout(() => skipIntro(), 600 + INTRO_LINES.length * 2600 + 1800));
}
function skipIntro() {
  if (G.mode !== 'intro') return;
  introTimers.forEach(clearTimeout); introTimers = [];
  $('intro').classList.add('hidden');
  startPlay(false);
}
function continueGame() {
  $('title').classList.add('hidden');
  if (!loadGame()) { startIntro(); return; }
  startPlay(true);
}
function startPlay(loaded) {
  G.mode = 'play';
  $('hud').classList.remove('dim');
  const f = $('fade'); f.style.transition = 'none'; f.style.opacity = 1; setTimeout(() => { f.style.transition = 'opacity 1.6s'; f.style.opacity = 0; }, 40);
  camState.yaw = player.heading + Math.PI; camState.target.set(0, 0, 0);
  START_ARCH.forEach((id) => unlockArchive(id, true));
  unlockItem('mug', true);
  if (!loaded) {
    setState('boot');
    setTimeout(() => radio('ツムギ', 'R-07、起動を確認。こちらハブ管制AIのツムギ。聞こえる？'), 1800);
    setTimeout(() => radio('ツムギ', '各地のノードは沈黙したまま。あなたの仕事は、荷物を届けて、それをもう一度ネットワークに繋ぐこと。'), 6500);
    setTimeout(() => radio('ツムギ', 'まずはすぐそばのターミナルへ。近づいて {interact} を押して。'), 13000);
    setTimeout(() => radio('ツムギ', 'ここまでの記録は {archive} のアーカイブにまとめておくね。この世界のことも、少しずつわかるはず。'), 21000);
    setTimeout(() => showHint('{move} で移動、{cam} でカメラ。{help} で操作一覧。', 7), 3200);
  } else {
    setState('move');
    setTimeout(() => radio('ツムギ', `おかえり、R-07。ネットワークは ${NODES.filter((n) => n.connected).length} / ${NODES.length}。続きをはじめよう。`), 1200);
  }
}
function startEnding() {
  if (G.mode !== 'play') { setTimeout(startEnding, 1000); return; }
  releaseLock();
  $('hud').classList.add('dim');
  G.cine = { type: 'ending', t: 0, dur: 10 };
  radio('ツムギ', 'R-07。見て。ネットワークが、ぜんぶ光ってる。');
}
function showEnding() {
  G.mode = 'ending';
  const s = G.stats;
  $('endText').innerHTML = '誰もいない大地に、もう一度声が届くようになった。<br>荷物を運ぶ理由は、まだたくさん残っている。';
  $('endStats').innerHTML = `
    <div class="stat"><small>完了した配送</small><b>${s.delivered}</b></div>
    <div class="stat"><small>歩いた距離</small><b>${(s.distance / 1000).toFixed(2)} km</b></div>
    <div class="stat"><small>受け取ったACK</small><b>${s.acksRecv}</b></div>
    <div class="stat"><small>転倒</small><b>${s.falls}</b></div>
    <div class="stat"><small>プレイ時間</small><b>${fmtTime(G.time)}</b></div>
    <div class="stat"><small>信頼度</small><b>${G.trust}</b></div>`;
  $('ending').classList.remove('hidden');
  audio.connect();
  unlockArchive('final', true);
  padFocusFirst($('ending'), true);
}
function closeEnding() {
  $('ending').classList.add('hidden');
  $('hud').classList.remove('dim');
  G.mode = 'play';
  saveGame();
  requestLock();
  radio('ツムギ', 'おつかれさま。でも、依頼はまだ届き続けてる。好きなだけ運んで。');
}
