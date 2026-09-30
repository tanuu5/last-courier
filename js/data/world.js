'use strict';
// World layout: nodes, rivers, cargo types, main orders and unlocks.

/* =========================================================
   World definition
   ========================================================= */
const WORLD = 1024, HALF = WORLD / 2, GRID = 512, CELL = WORLD / GRID, VN = GRID + 1;
const WATER = 12;
const WALK = 2.3, RUN = 4.6, SNEAK = 1.05;

const NODES = [
  { id: 0, name: 'ハブ・ゼロ', en: 'HUB ZERO', x: 0, z: 330, kind: 'hub' },
  { id: 1, name: '風見の観測所', en: 'KAZAMI OBSERVATORY', x: -235, z: 185, kind: 'dome' },
  { id: 2, name: '第三発電所', en: 'POWER PLANT No.3', x: 245, z: 128, kind: 'plant' },
  { id: 3, name: '記録庫ドーム', en: 'ARCHIVE DOME', x: -40, z: -70, kind: 'dome' },
  { id: 4, name: '湖畔の工房', en: 'LAKESIDE WORKSHOP', x: 262, z: -238, kind: 'plant' },
  { id: 5, name: '北嶺中継塔', en: 'NORTH RIDGE RELAY', x: -292, z: -262, kind: 'tower' },
  { id: 6, name: '終端局アマネ', en: 'TERMINUS AMANE', x: 55, z: -398, kind: 'tower' },
];
for (const n of NODES) { n.connected = n.id === 0; n.y = 0; }

const RIVERS = [
  { seed: 3, pts: [[-480, -175], [-362, -62], [-252, 38], [-152, 118], [-118, 228], [-160, 338], [-232, 440], [-292, 560]] },
  { seed: 9, pts: [[352, -140], [288, -48], [196, 26], [132, 116], [136, 226], [182, 338], [214, 450], [232, 560]] },
];
const ECHO_ZONE = { x: 100, z: 30, r: 92 };
// shallow crossings (depth forced low) and deliberately deep stretches
const FORDS = [{ x: -122, z: 205, r: 26, d: 0.45 }, { x: -268, z: 18, r: 24, d: 0.5 }, { x: -170, z: 110, r: 20, d: 0.55 }, { x: 178, z: 330, r: 24, d: 0.5 }, { x: 205, z: 30, r: 22, d: 0.55 }];
const DEEPS = [{ x: 134, z: 205, r: 70, d: 2.8, bank: 1.9 }];
const NARROWS = [{ x: 135.5, z: 219, r: 9, w: 2.3, bank: 6.5, d: 2.4 }];

const CTYPES = {
  core:    { label: '接続コア', color: 0x24343d, band: 0x86e1f2, impact: 1.4, rain: 1.0, water: 1.0 },
  parts:   { label: '資材', color: 0x4b463f, band: 0xd9cba8, impact: 0.8, rain: 0.8, water: 0.5 },
  fragile: { label: '精密機器', color: 0x3b4047, band: 0xf5d06a, impact: 3.0, rain: 1.0, water: 1.2, tag: 'frag' },
  heavy:   { label: '重量物', color: 0x57514a, band: 0xf2a04b, impact: 0.5, rain: 0.6, water: 0.3 },
  data:    { label: '記憶媒体', color: 0x37314c, band: 0xb99cff, impact: 1.2, rain: 2.2, water: 5.0, tag: 'dry' },
  med:     { label: '医療セル', color: 0xd9d6cf, band: 0xff6b5e, impact: 1.6, rain: 1.2, water: 1.6 },
};
const MAIN_ORDERS = [
  { id: 'M1', from: 0, to: 1, title: '観測所を目覚めさせる', desc: '風見の観測所へ接続コアと交換部品を届ける。途中の川は浅瀬を選んで渡ること。',
    items: [['core', '接続コア 01', 8], ['parts', '風速計の交換部品', 13]], req: [] },
  { id: 'M2', from: 0, to: 2, title: '発電所の再点火', desc: '東の第三発電所へ燃料セルを運ぶ。途中に深い渓谷がある。ラダーを使えば渡れる。',
    items: [['core', '接続コア 02', 8], ['heavy', '燃料セル', 24]], req: ['M1'] },
  { id: 'M3', from: 2, to: 3, title: '記録庫への精密機器', desc: '記録庫ドームへ読取装置を届ける。ルートはエコー域を通る。精密機器は衝撃に弱い。',
    items: [['core', '接続コア 03', 8], ['fragile', '記録読取装置', 12]], req: ['M2'] },
  { id: 'M4', from: 3, to: 4, title: '工房の火を灯す', desc: '湖畔の工房へ工作機械の部材を届ける。',
    items: [['core', '接続コア 04', 8], ['parts', '工作機械の部材', 17], ['parts', '潤滑剤', 9]], req: ['M3'] },
  { id: 'M5', from: 1, to: 5, title: '北嶺にアンテナを', desc: '雪の残る北嶺中継塔へアンテナ部材を運び上げる。登りは長い。',
    items: [['core', '接続コア 05', 8], ['heavy', 'アンテナ部材', 21]], req: ['M3'] },
  { id: 'M6', from: 3, to: 6, title: '最後の結び目', desc: '北の稜線を越えて終端局アマネへ。人類の記憶アーカイブは水に弱い。これで全ノードが繋がる。',
    items: [['core', '接続コア 06', 8], ['data', '人類の記憶アーカイブ', 10], ['med', '保存用冷却セル', 12]], req: ['M4', 'M5'] },
];
const UNLOCKS = {
  1: { key: 'ladder', text: 'ラダーを支給。{ladder} で設置して、川や崖を越えられる。' },
  2: { key: 'charger', text: '充電ポストを支給。{charger} で設置すると、周囲でバッテリーが回復する。' },
  3: { key: 'stabilizer', text: 'スタビライザーを導入。荷物が傾きにくくなった。' },
  4: { key: 'frame', text: '積載フレームを拡張。最大積載量が 90kg になった。' },
  5: { key: 'scanner', text: 'スキャナーを強化。探査範囲が 70m に広がった。' },
};
const UNITS = ['K-11', 'MIRA-3', 'SORA-2', 'HAKO-9', 'TOBI-5', 'ISO-1'];
