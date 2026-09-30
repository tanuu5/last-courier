'use strict';
// Keyboard / gamepad button labels used in prompts.

/* =========================================================
   Input glyphs (keyboard / gamepad)
   ========================================================= */
let inputMode = 'kb';
const GLYPH = {
  interact: ['F', 'A'], scan: ['Space', 'RB'], map: ['M', 'View'], back: ['Esc', 'B'], archive: ['J', 'Y'],
  left: ['左クリック / Q', 'LT'], right: ['右クリック / E', 'RT'], both: ['左右同時', 'LT + RT'],
  sneak: ['C', 'X'], run: ['Shift', 'L3'], move: ['W A S D', '左スティック'], cam: ['マウス', '右スティック'],
  ladder: ['1', '十字↑'], charger: ['2', '十字→'], sign: ['3', '十字↓'], drop: ['G', '十字←'],
  adjust: ['ホイール', 'LB / RB'], cancel: ['右クリック', 'B'], confirm: ['F / クリック', 'A'], mash: ['Space', 'A'],
  help: ['H', 'Menu'], pause: ['Esc', 'Menu'], mapClose: ['M', 'B'],
};
// Gamepad labels are written in type A (A / B / X / Y); type B swaps them for the cross / circle / square / triangle layout.
const PAD_STYLE = { setting: 'auto', detected: 'A' };
const PAD_B = { A: '×', B: '○', X: '□', Y: '△', LB: 'L1', RB: 'R1', LT: 'L2', RT: 'R2', View: 'Create', Menu: 'Options' };
function padStyle() { return PAD_STYLE.setting === 'auto' ? PAD_STYLE.detected : PAD_STYLE.setting; }
function padLabel(s) { return padStyle() === 'B' ? String(s).replace(/\b(LB|RB|LT|RT|View|Menu|A|B|X|Y)\b/g, (m) => PAD_B[m]) : s; }
function detectPadStyle(id) { return /054c|dualsense|dualshock|playstation/i.test(id || '') ? 'B' : 'A'; }
function glyph(a) { const g = GLYPH[a]; return g ? (inputMode === 'pad' ? padLabel(g[1]) : g[0]) : a; }
function K(a) { return `<kbd${inputMode === 'pad' ? ' class="pad"' : ''}>${glyph(a)}</kbd>`; }
function fmtKeys(s) { return String(s).replace(/\{(\w+)\}/g, (m, a) => GLYPH[a] ? K(a) : m); }
