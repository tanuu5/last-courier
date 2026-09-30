'use strict';
// Collection items, paint colours and robot wear.

/* =========================================================
   Collection items, paint
   ========================================================= */
const ITEMS = [
  { id: 'mug', name: '汐見のマグカップ', model: 'mug', hint: 'はじめから飾ってある',
    desc: 'ハブ・ゼロの保守室に残されていた、ふちの欠けたマグカップ。底に小さく「N.S.」と書いてある。' },
  { id: 'vane', name: '風見鶏の尾羽', model: 'vane', hint: '風見の観測所を接続する',
    desc: '2203年の嵐で失われた風見鶏の、金属の尾羽。観測所の屋根の隙間に引っかかっていた。' },
  { id: 'key', name: '第3炉の点火キー', model: 'key', hint: '第三発電所を接続する',
    desc: 'ISO-1 が171年間しまっておいた鍵。タグに「次に火をつける誰かへ」と書かれている。' },
  { id: 'frame', name: '色あせた写真立て', model: 'frame', hint: '記録庫ドームを接続する',
    desc: '記録庫の管理室にあった写真立て。写真はすっかり色が抜けて、誰が写っていたのかはもうわからない。' },
  { id: 'blueprint', name: 'R型の設計図', model: 'blueprint', hint: '湖畔の工房を接続する',
    desc: '湖畔の工房に残っていた、R型7号機の図面。脚の欄に手書きで「このままでいい」とある。' },
  { id: 'antenna', name: '凍ったアンテナ片', model: 'antenna', hint: '北嶺中継塔を接続する',
    desc: '北嶺中継塔の、折れたアンテナの破片。部屋に持ち帰っても、なぜか薄く霜がついたままだ。' },
  { id: 'plaque', name: '揺籃の銘板', model: 'plaque', hint: '終端局アマネを接続する',
    desc: '終端局アマネの入口に掲げられていた銘板の複製。「眠る人に、よい朝を」と刻まれている。' },
  { id: 'hakobox', name: 'HAKO-9 の小箱', model: 'box', hint: '遺失物を届ける',
    desc: '遺失物を届けたお礼に、HAKO-9 から届いた小さな箱。中は空っぽ。でも、ていねいに磨かれている。' },
  { id: 'badge', name: 'Sランク記章', model: 'badge', hint: 'Sランクで配送する',
    desc: 'はじめてSランクの配送を記録した証。ツムギが工作室で作ってくれた。' },
  { id: 'footpad', name: 'すり減った足裏パッド', model: 'footpad', hint: '合計10km歩く',
    desc: '歩いた距離が10kmを超えたときに交換した足裏パッド。よく歩いた。' },
  { id: 'dent', name: 'へこんだ肩パッド', model: 'dent', hint: '20回転ぶ',
    desc: '20回転んだ記念。へこみの形が、なんとなくハートに見える。' },
  { id: 'echostone', name: '残響石', model: 'stone', hint: 'エコーを3回振りほどく',
    desc: 'エコーを振りほどいたとき、機体に残った微弱な信号を結晶にしたもの。近づけると、かすかに声がする気がする。' },
  { id: 'knot', name: '結び目の糸', model: 'knot', hint: 'すべてのノードを接続する',
    desc: 'すべてのノードがつながった日に、ツムギから届いた一本の糸。ほどけないように、固く結ばれている。' },
];
const ITEM_BY_ID = Object.fromEntries(ITEMS.map((i) => [i.id, i]));
const NODE_ITEM = { 1: 'vane', 2: 'key', 3: 'frame', 4: 'blueprint', 5: 'antenna', 6: 'plaque' };
const ACCENTS = [
  { id: 'orange', name: 'オレンジ', hex: 0xe0712c, req: 0 }, { id: 'cyan', name: 'シアン', hex: 0x3fb6c9, req: 300 },
  { id: 'red', name: 'レッド', hex: 0xc8362f, req: 700 }, { id: 'yellow', name: 'イエロー', hex: 0xe0b42c, req: 1200 },
  { id: 'white', name: 'ホワイト', hex: 0xe8e6e0, req: 1800 }, { id: 'black', name: 'ブラック', hex: 0x1f2226, req: 2600 },
];
const VISORS = [
  { id: 'cyan', name: 'シアン', hex: 0x86e1f2, req: 0 }, { id: 'amber', name: 'アンバー', hex: 0xffb45a, req: 400 },
  { id: 'green', name: 'グリーン', hex: 0x8cf5a0, req: 1000 }, { id: 'white', name: 'ホワイト', hex: 0xf4f7ff, req: 1600 },
  { id: 'violet', name: 'バイオレット', hex: 0xb99cff, req: 2200 },
];
const SHELL_BASE = new THREE.Color(0xdcd9d2), SHELL2_BASE = new THREE.Color(0xb9b6ae), GRIME = new THREE.Color(0x6b5a44);
function visorHex() { return (VISORS.find((v) => v.id === G.paint.visor) || VISORS[0]).hex; }
function applyPaint() {
  MAT.accent.color.setHex((ACCENTS.find((a) => a.id === G.paint.accent) || ACCENTS[0]).hex);
  applyWear();
}
function applyWear() {
  const w = clamp(1 - player.cond / 100, 0, 1) * 0.55;
  MAT.shell.color.copy(SHELL_BASE).lerp(GRIME, w);
  MAT.shell2.color.copy(SHELL2_BASE).lerp(GRIME, w);
  MAT.shell.roughness = 0.42 + w * 0.5;
}
function unlockItem(id, silent) {
  const it = ITEM_BY_ID[id];
  if (!it || G.items[id]) return false;
  G.items[id] = Math.round(G.time) + 1;
  if (room.shelf[id]) room.shelf[id].visible = true;
  if (!silent) { toast('COLLECTION', `「${it.name}」をセーフルームの棚に飾った`); audio.archive(); }
  return true;
}
function wear(amount) {
  const before = player.cond;
  player.cond = clamp(player.cond - amount, 0, 100);
  if (Math.floor(before / 5) !== Math.floor(player.cond / 5)) applyWear();
  if (player.cond < 50 && !G.flags.wearHint) { G.flags.wearHint = true; radio('ツムギ', '機体の摩耗が進んでる。接続したノードの地下にセーフルームがあるから、そこで整備していって。'); }
}
function condFactor() { return 1 + clamp(1 - player.cond / 100, 0, 1) * 0.45; }
