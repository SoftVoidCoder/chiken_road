/* ============================================================================
   input.js — ввод: клавиатура, свайпы, ТВ-пульт
   ----------------------------------------------------------------------------
   Одна точка входа для всех устройств. На телевизорах пульт даёт редкие
   события, поэтому вперёд можно шагать кнопкой OK, а кнопка Back открывает
   паузу (требования платформы 1.6.3).
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var canvas = C.canvas;
  var GM = CC.game, UI = CC.ui, Sound = CC.audio, Pl = CC.platform;
  /* ==========================================================================
     10. ВВОД
     ========================================================================== */
  var DIRS = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] };
  var held = { dir: null, dc: 0, dr: 0 };
  var stack = [];

  function press(name) {
    var d = DIRS[name];
    if (stack.indexOf(name) < 0) { stack.push(name); }
    held.dir = name; held.dc = d[0]; held.dr = d[1];
    pl.holdTimer = 0;
    Sound.init();
    GM.tryMove(d[0], d[1]);
  }
  function release(name) {
    var i = stack.indexOf(name);
    if (i >= 0) { stack.splice(i, 1); }
    var n = stack[stack.length - 1];
    if (n) { held.dir = n; held.dc = DIRS[n][0]; held.dr = DIRS[n][1]; } else { held.dir = null; }
  }
  var KEYMAP = {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right'
  };

  window.addEventListener('keydown', function (e) {
    if (KEYMAP[e.code]) {
      e.preventDefault();
      if (G.state === 'playing') { press(KEYMAP[e.code]); }
      return;
    }
    if (e.code === 'KeyM') { UI.toggleMute(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (UI.el.ovSkins && UI.el.ovSkins.classList.contains('on')) { UI.closeSkins(); return; }
      UI.togglePause();
      return;
    }
    if (e.code === 'Space' || e.code === 'Enter') {
      if (G.state === 'menu') { GM.startGame(); }
      else if (G.state === 'over') { GM.startGame(); }
      else if (G.state === 'paused') { UI.togglePause(); }
      else if (G.state === 'playing') { GM.tryMove(0, 1); }
      e.preventDefault();
    }
  }, false);

  window.addEventListener('keyup', function (e) {
    if (KEYMAP[e.code]) { release(KEYMAP[e.code]); }
  }, false);

  // свайпы и тапы (мобильные)
  var touch = null;
  canvas.addEventListener('touchstart', function (e) {
    var t = e.changedTouches[0];
    touch = { x: t.clientX, y: t.clientY, t: Date.now() };
    Sound.init();
    if (e.preventDefault) { e.preventDefault(); }
  }, { passive: false });

  canvas.addEventListener('touchend', function (e) {
    if (!touch) { return; }
    var t = e.changedTouches[0];
    var dx = t.clientX - touch.x, dy = t.clientY - touch.y;
    var dist = Math.sqrt(dx * dx + dy * dy);
    if (G.state !== 'playing') { touch = null; return; }
    if (dist < 26) { GM.tryMove(0, 1); }
    else if (Math.abs(dx) > Math.abs(dy)) { GM.tryMove(dx > 0 ? 1 : -1, 0); }
    else { GM.tryMove(0, dy < 0 ? 1 : -1); }
    touch = null;
    if (e.preventDefault) { e.preventDefault(); }
  }, { passive: false });

  canvas.addEventListener('mousedown', function () {
    Sound.init();
    if (G.state === 'playing') { GM.tryMove(0, 1); }
  }, false);

  window.addEventListener('resize', function () { U.resize(); }, false);
  if (window.addEventListener) {
    window.addEventListener('orientationchange', function () { setTimeout(U.resize, 120); }, false);
  }

  U.expose(CC.input, { press: press, release: release, DIRS: DIRS, KEYMAP: KEYMAP });
})(window.CC);
