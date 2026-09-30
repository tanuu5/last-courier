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
function glyph(a) { const g = GLYPH[a]; return g ? g[inputMode === 'pad' ? 1 : 0] : a; }
function K(a) { return `<kbd${inputMode === 'pad' ? ' class="pad"' : ''}>${glyph(a)}</kbd>`; }
function fmtKeys(s) { return String(s).replace(/\{(\w+)\}/g, (m, a) => GLYPH[a] ? K(a) : m); }
