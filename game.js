/* ============================================================================
   Crossy Chicken — 2D-игра в стиле Crossy Road для Яндекс Игр
   ----------------------------------------------------------------------------
   Вся графика рисуется процедурно на Canvas 2D: ни одной картинки, ни одного
   внешнего файла. У каждого объекта своя 2D-модель (спрайт) с анимацией:
   курица (шаг, прыжок, squash&stretch), 6 типов машин, брёвна и лилии,
   поезд с вагонами, деревья, камни, монеты, орёл.
   Вид строго сверху. Мир — бесконечная сетка рядов, генерируемых на ходу.
   ========================================================================== */
(function () {
  'use strict';

  var Pl = window.Platform;

  /* ==========================================================================
     1. КОНСТАНТЫ
     ========================================================================== */
  var TS = 48;                 // размер клетки в мировых пикселях
  var COLS = 13;               // ширина поля в клетках
  var FIELD_HALF = COLS * TS / 2;
  var HOP_TIME = 0.135;        // длительность прыжка, сек
  var HOP_HOLD = 0.085;        // автоповтор при удержании клавиши
  var IDLE_LIMIT = 7.5;        // сколько можно стоять до прилёта орла
  var EAGLE_DELAY = 1.25;      // сколько орёл пикирует
  var MIN_ROW = -6;            // докуда можно отойти назад от старта
  var ROWS_AHEAD = 42;         // на сколько рядов генерируем мир вперёд
  var PLAYER_SCREEN_Y = 0.63;  // положение курицы по вертикали экрана

  // 2D-модели машин: длина (в клетках) и множитель скорости
  var KIND = {
    car:    { len: 1.05, sp: 1.00 },
    taxi:   { len: 1.05, sp: 1.00 },
    van:    { len: 1.42, sp: 0.90 },
    bus:    { len: 2.30, sp: 0.76 },
    truck:  { len: 2.75, sp: 0.68 },
    police: { len: 1.05, sp: 1.16 }
  };
  var CAR_COLORS = {
    car:    ['#e05a47', '#3d7ce0', '#59b36b', '#8b5cf6', '#e8792b', '#d94f7d'],
    taxi:   ['#f5c542'],
    van:    ['#e8ecf2', '#6b7c93', '#4aa3a3'],
    bus:    ['#e0574a', '#3f7fd0'],
    truck:  ['#8d99ae', '#b0552e'],
    police: ['#f2f5fa']
  };

  /* ==========================================================================
     2. CANVAS
     ========================================================================== */
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var VW = 800, VH = 600, DPR = 1, scale = 1;
  var camX = 0, camY = 0, camTargetY = 0;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  // детерминированный "шум" для декора клеток
  function hash01(n) {
    n = (n << 13) ^ n;
    n = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff;
    return n / 0x7fffffff;
  }

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    VW = canvas.clientWidth || window.innerWidth || 800;
    VH = canvas.clientHeight || window.innerHeight || 600;
    canvas.width = Math.round(VW * DPR);
    canvas.height = Math.round(VH * DPR);
    // вперёд должно быть видно не меньше 13 рядов, иначе на быстрые машины не хватит реакции
    scale = clamp(Math.min(VW / ((COLS + 1.4) * TS), VH / (13 * TS)), 0.42, 1.75);
    camY = camTargetY = camTargetFor(pl.py);
  }
  function camTargetFor(py) { return py - (PLAYER_SCREEN_Y - 0.5) * VH / scale; }
  function colX(c) { return (c - (COLS - 1) / 2) * TS; }   // центр клетки по X
  function rowY(r) { return -r * TS; }                     // центр ряда по Y

  /* ==========================================================================
     3. СОСТОЯНИЕ
     ========================================================================== */
  var G = {
    state: 'loading',     // loading | menu | playing | paused | over
    t: 0, runTime: 0,
    score: 0, best: 0, maxRow: 0,
    coins: 0, totalCoins: 0,
    rows: {}, genUntil: MIN_ROW - 1, pattern: null,
    particles: [], popups: [],
    shake: 0, flash: 0, flashColor: '255,80,80',
    eagle: null, invuln: 0, deathT: 0, deathReason: '',
    reviveUsed: false, runStart: 0, muted: false,
    hintShown: false
  };

  var pl = {
    px: 0, py: 0, hop: null, log: null,
    facing: 'up', idle: 0, alive: true,
    holdTimer: 0, dust: 0
  };

  function playerCol() { return clamp(Math.round(pl.px / TS + (COLS - 1) / 2), 0, COLS - 1); }
  function playerRow() { return Math.round(-pl.py / TS); }

  /* ==========================================================================
     4. ЧАСТИЦЫ
     ========================================================================== */
  function part(x, y, vx, vy, life, size, color, kind) {
    if (G.particles.length > 260) { return; }
    G.particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, color: color, kind: kind || 'dot', rot: rnd(0, 6.28) });
  }
  function burst(x, y, n, color, kind, power) {
    power = power || 90;
    for (var i = 0; i < n; i++) {
      var a = rnd(0, Math.PI * 2), s = rnd(power * 0.25, power);
      part(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.35, 0.9), rnd(2, 5.5), color, kind);
    }
  }
  function updateParticles(dt) {
    var a = G.particles;
    for (var i = a.length - 1; i >= 0; i--) {
      var p = a[i];
      p.life -= dt;
      if (p.life <= 0) { a.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 3.2 * dt); p.vy *= (1 - 3.2 * dt);
      if (p.kind === 'feather') { p.vy += 60 * dt; p.rot += dt * 6; }
    }
    var b = G.popups;
    for (var j = b.length - 1; j >= 0; j--) {
      b[j].life -= dt; b[j].y -= dt * 26;
      if (b[j].life <= 0) { b.splice(j, 1); }
    }
  }
  function popup(x, y, text, color) {
    if (G.popups.length > 40) { return; }
    G.popups.push({ x: x, y: y, text: text, color: color || '#ffe680', life: 0.9 });
  }

  /* ==========================================================================
     5. ЗВУК (синтез на WebAudio, без файлов)
     ========================================================================== */
  var Sound = (function () {
    var ac = null, master = null, muted = false;
    function init() {
      if (ac) { return; }
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { return; }
        ac = new AC();
        master = ac.createGain();
        master.gain.value = 0.42;
        master.connect(ac.destination);
      } catch (e) { ac = null; }
    }
    function now() { return ac ? ac.currentTime : 0; }
    function beep(f1, f2, dur, type, vol) {
      if (!ac || muted) { return; }
      try {
        var t = now();
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(f1, t);
        if (f2 && f2 !== f1) { o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.03);
      } catch (e) {}
    }
    function noise(dur, vol, freq) {
      if (!ac || muted) { return; }
      try {
        var t = now(), n = Math.floor(ac.sampleRate * dur);
        var buf = ac.createBuffer(1, n, ac.sampleRate), d = buf.getChannelData(0);
        for (var i = 0; i < n; i++) { d[i] = (Math.random() * 2 - 1) * (1 - i / n); }
        var src = ac.createBufferSource(); src.buffer = buf;
        var f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq || 1200;
        var g = ac.createGain(); g.gain.value = vol || 0.3;
        src.connect(f); f.connect(g); g.connect(master);
        src.start(t);
      } catch (e) {}
    }
    return {
      init: init,
      hop:      function () { beep(520, 760, 0.07, 'square', 0.13); },
      land:     function () { beep(300, 200, 0.06, 'triangle', 0.12); },
      coin:     function () { beep(1180, 1180, 0.06, 'square', 0.16); setTimeout(function () { beep(1560, 1560, 0.09, 'square', 0.16); }, 60); },
      splash:   function () { noise(0.35, 0.35, 700); beep(420, 90, 0.3, 'sine', 0.18); },
      crash:    function () { noise(0.4, 0.55, 900); beep(180, 60, 0.35, 'sawtooth', 0.3); },
      horn:     function () { beep(220, 220, 0.5, 'sawtooth', 0.22); setTimeout(function () { beep(165, 165, 0.5, 'sawtooth', 0.2); }, 30); },
      screech:  function () { beep(1800, 700, 0.35, 'sawtooth', 0.16); },
      over:     function () { beep(520, 130, 0.7, 'triangle', 0.26); },
      record:   function () { [660, 880, 1180].forEach(function (f, i) { setTimeout(function () { beep(f, f, 0.14, 'square', 0.18); }, i * 110); }); },
      setMuted: function (m) { muted = m; if (master) { master.gain.value = m ? 0 : 0.42; } },
      suspend:  function () { try { if (ac && ac.state === 'running') { ac.suspend(); } } catch (e) {} },
      resume:   function () { try { if (ac && ac.state === 'suspended') { ac.resume(); } } catch (e) {} }
    };
  })();

  /* ==========================================================================
     6. ГЕНЕРАЦИЯ МИРА
     ========================================================================== */
  function difficulty(row) { return clamp((row - 8) / 240, 0, 1); }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (Math.random() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function cols() { var a = []; for (var i = 0; i < COLS; i++) { a.push(i); } return a; }

  // лента объектов (машины или брёвна): равномерно по кольцу, кольцо шире поля
  function makeLane(row, d, opts) {
    var dir = Math.random() < 0.5 ? 1 : -1;
    var speedT = opts.speedT;                      // клеток в секунду
    var kind = opts.kind ? opts.kind(d) : null;
    var len = opts.len ? opts.len(d, kind) : kind.len;
    var spMul = kind ? KIND[kind].sp : 1;
    var vT = speedT * spMul;
    var gap = Math.max(opts.minGap, vT * opts.gapTime - d * opts.gapTighten);
    var span = COLS + 9;
    var count = Math.max(1, Math.floor(span / (len + gap)));
    var spacing = span / count;
    var slack = Math.max(0, spacing - len - gap);
    var L = span * TS;
    var items = [];
    for (var i = 0; i < count; i++) {
      var x = -L / 2 + i * spacing * TS + Math.random() * slack * TS;
      items.push({ x: x, vx: vT * TS * dir, len: len, kind: kind, color: kind ? pick(CAR_COLORS[kind]) : null, ph: rnd(0, 6.28) });
    }
    return { dir: dir, items: items, loop: L, speed: vT };
  }

  function genGrass(r, d, safe) {
    var row = { type: 'grass', r: r, obstacles: {}, coins: [] };
    if (!safe) {
      var maxObs = Math.min(COLS - 2, Math.round(1 + d * 5 + Math.random() * 2));
      var order = shuffle(cols());
      for (var i = 0; i < maxObs; i++) {
        var c = order[i];
        row.obstacles[c] = hash01(r * 131 + c * 17) < 0.62 ? 'tree' : 'rock';
      }
      if (Math.random() < 0.17) {
        var c0 = (Math.random() * COLS) | 0;
        var n = 1 + ((Math.random() * 3) | 0);
        for (var k = 0; k < n; k++) {
          var cc = c0 + k;
          if (cc < COLS && !(cc in row.obstacles)) { row.coins.push(cc); }
        }
      }
    }
    return row;
  }

  function genRoad(r, d) {
    var row = { type: 'road', r: r };
    var lane = makeLane(r, d, {
      speedT: 1.7 + Math.random() * 2.1 + d * 2.4,
      kind: function () {
        var q = Math.random();
        if (q < 0.40) { return 'car'; }
        if (q < 0.55) { return 'taxi'; }
        if (q < 0.68) { return 'van'; }
        if (q < 0.81) { return 'bus'; }
        if (q < 0.91) { return 'truck'; }
        return 'police';
      },
      minGap: 1.25, gapTime: 0.62, gapTighten: 0.16
    });
    row.dir = lane.dir; row.items = lane.items; row.loop = lane.loop; row.speed = lane.speed;
    return row;
  }

  function genWater(r, d) {
    var row = { type: 'water', r: r, phase: rnd(0, 6.28) };
    var lane = makeLane(r, d, {
      speedT: 0.65 + Math.random() * 1.5,
      len: function () { return 1.8 + Math.random() * 1.4; },
      minGap: 1.15, gapTime: 0.85, gapTighten: 0.05
    });
    for (var i = 0; i < lane.items.length; i++) {
      lane.items[i].kind = Math.random() < 0.78 ? 'log' : 'lily';
      if (lane.items[i].kind === 'lily') { lane.items[i].len = Math.max(1.5, lane.items[i].len - 0.4); }
    }
    row.dir = lane.dir; row.items = lane.items; row.loop = lane.loop; row.speed = lane.speed;
    return row;
  }

  function genRail(r, d) {
    return {
      type: 'rail', r: r, dir: Math.random() < 0.5 ? 1 : -1,
      timer: rnd(1.6, 4.4), warn: 1.15, train: null,
      trainSpeed: (9 + d * 3.5) * TS, trainLen: 8.4, d: d
    };
  }

  function nextPattern(r, d) {
    var prev = G.rows[r - 1] ? G.rows[r - 1].type : 'grass';
    // после воды и рельсов — обязательно передышка (иначе игрок окажется в ловушке)
    if (prev === 'water' || prev === 'rail') { return { kind: 'grass', left: 1 + ((Math.random() * 2) | 0) }; }
    var q = Math.random();
    if (q < 0.44) { return { kind: 'road', left: 1 + ((Math.random() * (1 + d * 3.4)) | 0) }; }
    if (q < 0.62) { return { kind: 'water', left: 1 + ((Math.random() * (1 + d * 2)) | 0) }; }
    if (q < 0.73) { return { kind: 'rail', left: 1 }; }
    return { kind: 'grass', left: 1 + ((Math.random() * 2) | 0) };
  }

  function genNextRow() {
    var r = G.genUntil + 1;
    var d = difficulty(r);
    var row;
    if (r <= 3) {
      row = genGrass(r, d, true);                     // безопасная стартовая зона
    } else {
      if (!G.pattern || G.pattern.left <= 0) { G.pattern = nextPattern(r, d); }
      G.pattern.left--;
      if (G.pattern.kind === 'road') { row = genRoad(r, d); }
      else if (G.pattern.kind === 'water') { row = genWater(r, d); }
      else if (G.pattern.kind === 'rail') { row = genRail(r, d); }
      else { row = genGrass(r, d, false); }
    }
    G.rows[r] = row;
    G.genUntil = r;
  }
  function ensureRows(until) { while (G.genUntil < until) { genNextRow(); } }
  function pruneRows(minKeep) {
    for (var k in G.rows) { if (+k < minKeep) { delete G.rows[k]; } }
  }

  /* ==========================================================================
     7. ХОД ИГРЫ
     ========================================================================== */
  function reset() {
    G.rows = {}; G.genUntil = MIN_ROW - 1; G.pattern = null;
    G.particles = []; G.popups = [];
    G.t = 0; G.runTime = 0; G.score = 0; G.maxRow = 0;
    G.coins = 0; G.shake = 0; G.flash = 0; G.invuln = 0; G.deathT = 0;
    G.eagle = null; G.reviveUsed = false; G.hintShown = false;
    pl.px = colX((COLS - 1) / 2); pl.py = rowY(0);
    pl.hop = null; pl.log = null; pl.facing = 'up';
    pl.idle = 0; pl.alive = true; pl.holdTimer = 0;
    ensureRows(ROWS_AHEAD);
    camY = camTargetY = camTargetFor(pl.py);
    hideHint();
  }

  function startGame() {
    Sound.init();
    reset();
    G.state = 'playing';
    G.runStart = (window.performance && performance.now) ? performance.now() : Date.now();
    showOnly(null);
    Pl.gameplayStart();
    syncHUD(true);
  }

  function tryMove(dc, dr) {
    if (G.state !== 'playing' || !pl.alive || pl.hop) { return false; }
    var col = playerCol(), row = playerRow();
    var tc = col + dc, tr = row + dr;
    if (tc < 0 || tc >= COLS) { return false; }
    var backLimit = Math.max(MIN_ROW, G.maxRow - 12);
    if (tr < backLimit) { return false; }
    if (tr > G.genUntil - 2) { return false; }
    var dest = G.rows[tr];
    if (dest && dest.type === 'grass' && (tc in dest.obstacles)) {
      // тупик: небольшой отскок + облачко пыли
      pl.holdTimer = 0.12;
      burst(colX(tc), rowY(tr) + TS * 0.3, 4, 'rgba(255,255,255,0.75)', 'dust', 60);
      return false;
    }
    pl.hop = { fx: pl.px, fy: pl.py, tx: colX(tc), ty: rowY(tr), t: 0, dc: dc, dr: dr };
    pl.facing = dr > 0 ? 'up' : (dr < 0 ? 'down' : (dc > 0 ? 'right' : 'left'));
    pl.log = null;
    pl.holdTimer = HOP_HOLD;
    Sound.hop();
    return true;
  }

  function logUnder(row, x) {
    var items = row.items;
    if (!items) { return null; }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (Math.abs(x - it.x) <= it.len * TS * 0.5 + TS * 0.18) { return it; }
    }
    return null;
  }

  function onLand() {
    var row = playerRow(), obj = G.rows[row];

    if (obj && obj.type === 'water') {
      var lg = logUnder(obj, pl.px);
      if (lg) {
        pl.log = lg;
        burst(pl.px, pl.py + TS * 0.2, 5, 'rgba(150,220,255,0.9)', 'dot', 70);
      } else {
        die('water');
        return;
      }
    } else {
      burst(pl.px, pl.py + TS * 0.28, 3, 'rgba(230,240,255,0.55)', 'dust', 45);
      Sound.land();
    }

    if (obj && obj.coins && obj.coins.indexOf(playerCol()) >= 0) {
      var idx = obj.coins.indexOf(playerCol());
      obj.coins.splice(idx, 1);
      G.coins++; G.totalCoins++;
      popup(pl.px, pl.py - TS * 0.4, '+1', '#ffd75e');
      burst(pl.px, pl.py, 10, '#ffd75e', 'sparkle', 110);
      Sound.coin();
      syncHUD();
    }

    if (row > G.maxRow) {
      G.maxRow = row;
      G.score = Math.max(0, row);
      pl.idle = 0;
      hideHint();
      syncHUD();
    }
  }

  function edgeOut() { return Math.abs(pl.px) > FIELD_HALF + TS * 0.35; }

  function checkHits() {
    var r = playerRow(), obj = G.rows[r];
    if (!obj) { return; }
    var phw = TS * 0.29, phh = TS * 0.26;

    if (obj.type === 'road' && obj.items) {
      for (var i = 0; i < obj.items.length; i++) {
        var it = obj.items[i];
        if (Math.abs(pl.px - it.x) < it.len * TS * 0.5 + phw * 0.55) { die('car'); return; }
      }
    } else if (obj.type === 'rail' && obj.train) {
      var tr = obj.train;
      if (Math.abs(pl.px - tr.x) < tr.len * TS * 0.5 + phw * 0.6) { die('train'); return; }
    }
  }

  function die(reason) {
    if (!pl.alive || G.state !== 'playing') { return; }
    pl.alive = false;
    G.deathReason = reason;
    G.deathT = 0;
    G.shake = (reason === 'car' || reason === 'train') ? 16 : 10;
    G.flash = 1;
    G.flashColor = (reason === 'water' || reason === 'edge') ? '80,150,255' : '255,70,70';
    if (reason === 'water' || reason === 'edge') {
      Sound.splash();
      burst(pl.px, pl.py, 26, 'rgba(150,220,255,0.95)', 'dot', 150);
    } else if (reason === 'eagle') {
      Sound.screech();
      burst(pl.px, pl.py, 22, '#ffffff', 'feather', 120);
    } else {
      Sound.crash();
      burst(pl.px, pl.py, 24, '#ffffff', 'feather', 170);
      burst(pl.px, pl.py, 14, 'rgba(255,190,80,0.9)', 'dot', 150);
    }
  }

  function updateEagle(dt) {
    if (!pl.alive) { return; }
    if (!G.eagle) {
      if (pl.idle > IDLE_LIMIT) {
        G.eagle = { t: 0, x: pl.px, y: pl.py - 260 };
        Sound.screech();
        showHint(Pl.t('hintEagle'));
      }
      return;
    }
    G.eagle.t += dt;
    G.eagle.x += (pl.px - G.eagle.x) * Math.min(1, dt * 2.4);
    G.eagle.y += ((pl.py - 6) - G.eagle.y) * Math.min(1, dt * 3.2);
    if (G.eagle.t > EAGLE_DELAY) { die('eagle'); }
  }

  function moveWorld(dt) {
    var r, k, row, items, i, it, half;
    for (k in G.rows) {
      row = G.rows[+k];
      if (row.type === 'road' || row.type === 'water') {
        items = row.items; half = row.loop / 2;
        for (i = 0; i < items.length; i++) {
          it = items[i];
          it.x += it.vx * dt;
          if (it.vx > 0 && it.x > half) { it.x -= row.loop; }
          else if (it.vx < 0 && it.x < -half) { it.x += row.loop; }
        }
      } else if (row.type === 'rail') {
        if (row.train) {
          row.train.x += row.trainSpeed * dt * row.dir;
          var lim = (COLS / 2 + 8) * TS;
          if (row.dir > 0 ? row.train.x > lim : row.train.x < -lim) {
            row.train = null;
            row.timer = Math.max(1.5, rnd(2.6, 5.6) - (row.d || 0) * 1.4);
          }
        } else {
          row.timer -= dt;
          if (row.timer <= 0) {
            row.train = { x: -row.dir * (COLS / 2 + 8) * TS, len: row.trainLen };
            row.timer = Infinity;
            Sound.horn();
          }
        }
      }
    }
    // подчистка далёких рядов, чтобы память не росла
    var backLimit = Math.max(MIN_ROW, G.maxRow - 12);
    pruneRows(backLimit - 2);
    ensureRows(playerRow() + ROWS_AHEAD);
  }

  function update(dt) {
    if (G.state !== 'playing') { return; }
    G.runTime += dt;
    moveWorld(dt);

    if (pl.alive) {
      if (G.invuln > 0) { G.invuln -= dt; }
      if (pl.holdTimer > 0) { pl.holdTimer -= dt; }
      if (!pl.hop && held.dir && pl.holdTimer <= 0) { tryMove(held.dc, held.dr); }

      if (pl.hop) {
        pl.hop.t += dt / HOP_TIME;
        var e = Math.min(1, pl.hop.t);
        pl.px = pl.hop.fx + (pl.hop.tx - pl.hop.fx) * e;
        pl.py = pl.hop.fy + (pl.hop.ty - pl.hop.fy) * e;
        if (pl.hop.t >= 1) {
          pl.px = pl.hop.tx; pl.py = pl.hop.ty; pl.hop = null;
          onLand();
        }
      } else if (pl.log) {
        pl.px += pl.log.vx * dt;
        if (edgeOut()) { die('edge'); }
      } else {
        var obj = G.rows[playerRow()];
        if (obj && obj.type === 'water') { die('water'); }
      }

      if (pl.alive && !pl.hop && pl.log === null) { pl.idle += dt; }
      if (pl.alive && G.invuln <= 0) { checkHits(); }
      updateEagle(dt);

      // подсказка про орла заранее
      if (pl.alive && !G.hintShown && pl.idle > IDLE_LIMIT - 3) { showHint(Pl.t('hintEagle')); }
    } else {
      G.deathT += dt;
      if (G.deathT > 0.95) { gameOver(); return; }
    }

    updateParticles(dt);

    camTargetY = camTargetFor(pl.py);
    if (Math.abs(camTargetY - camY) > TS * 6) { camY = camTargetY; }
    else { camY += (camTargetY - camY) * Math.min(1, dt * 9); }
    if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 46); }
    if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt * 2.1); }
    syncHUD();
  }

  /* ==========================================================================
     8. КОНЕЦ ИГРЫ / ПРОДОЛЖЕНИЕ
     ========================================================================== */
  function gameOver() {
    if (G.state === 'over') { return; }
    G.state = 'over';
    Pl.gameplayStop();
    var isRecord = G.score > G.best;
    if (isRecord) { G.best = G.score; }
    Pl.save({ best: G.best, coins: G.totalCoins });
    Pl.submitScore(G.score);
    if (isRecord && G.score > 0) { Sound.record(); }
    UI.over(isRecord);
    showOnly('ovOver');

    var runMs = ((window.performance && performance.now) ? performance.now() : Date.now()) - G.runStart;
    if (Pl.canShowFullscreen(runMs)) {
      setTimeout(function () {
        if (G.state !== 'over') { return; }
        Pl.showFullscreen(function () { if (G.state === 'over') { showOnly('ovOver'); } });
      }, 600);
    }
  }

  function findSafeRow(from) {
    var r;
    for (r = from; r <= from + 10; r++) { if (G.rows[r] && G.rows[r].type === 'grass') { return r; } }
    for (r = from - 1; r >= from - 10; r--) { if (G.rows[r] && G.rows[r].type === 'grass') { return r; } }
    return 0;
  }
  function freeCol(row, want) {
    var obj = G.rows[row];
    if (!obj || !obj.obstacles) { return want; }
    for (var d = 0; d < COLS; d++) {
      var a = want + d, b = want - d;
      if (a < COLS && !(a in obj.obstacles)) { return a; }
      if (b >= 0 && !(b in obj.obstacles)) { return b; }
    }
    return want;
  }

  function revive() {
    var row = findSafeRow(playerRow());
    var col = freeCol(row, playerCol());
    G.reviveUsed = true;
    pl.px = colX(col); pl.py = rowY(row);
    pl.hop = null; pl.log = null; pl.alive = true; pl.idle = 0; pl.facing = 'up';
    G.eagle = null; G.invuln = 2.0; G.deathT = 0; G.shake = 0; G.flash = 0;
    G.state = 'playing';
    hideHint();
    showOnly(null);
    Pl.gameplayStart();
    camY = camTargetY = camTargetFor(pl.py);
    burst(pl.px, pl.py, 20, '#ffe680', 'sparkle', 130);
    syncHUD(true);
  }

  /* ==========================================================================
     9. ОТРИСОВКА — 2D-МОДЕЛИ
     ========================================================================== */
  function rr(x, y, w, h, r) {                       // скруглённый прямоугольник
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function shadow(x, y, rx, ry, a) {
    ctx.fillStyle = 'rgba(0,0,0,' + (a || 0.22) + ')';
    ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); ctx.fill();
  }

  /* --- трава ---------------------------------------------------------------- */
  function drawGrass(row, y) {
    var i, x;
    for (i = 0; i < COLS; i++) {
      var tone = hash01(row.r * 71 + i * 13);
      x = colX(i);
      ctx.fillStyle = tone < 0.5 ? '#7ec850' : (tone < 0.8 ? '#78c24b' : '#86d158');
      ctx.fillRect(x - TS / 2, y - TS / 2, TS, TS);
    }
    // травинки и цветочки (мелочь не рисуем на мелком масштабе — экономия для телефонов)
    if (scale > 0.68) {
      for (i = 0; i < COLS; i++) {
        var h1 = hash01(row.r * 977 + i * 31);
        var h2 = hash01(row.r * 313 + i * 7);
        x = colX(i) - TS / 2 + 6 + h1 * (TS - 12);
        var yy = y - TS / 2 + 6 + h2 * (TS - 12);
        if (h1 > 0.72) {
          ctx.strokeStyle = 'rgba(60,140,60,0.55)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
          ctx.beginPath(); ctx.moveTo(x, yy); ctx.lineTo(x + (h2 - 0.5) * 4, yy - 5); ctx.stroke();
        } else if (h1 < 0.07) {
          ctx.fillStyle = h2 < 0.5 ? '#fff2a8' : '#ffd0e8';
          ctx.beginPath(); ctx.arc(x, yy, 2.4, 0, 6.2832); ctx.fill();
        }
      }
    }
    // тёмная кромка сверху — «толщина» блока
    ctx.fillStyle = 'rgba(0,0,0,0.10)';
    ctx.fillRect(-FIELD_HALF, y - TS / 2, TS * COLS, 3);
  }

  /* --- дорога --------------------------------------------------------------- */
  function drawRoad(row, y) {
    ctx.fillStyle = '#4b5059';
    ctx.fillRect(-FIELD_HALF, y - TS / 2, FIELD_HALF * 2, TS);
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.fillRect(-FIELD_HALF, y - TS / 2 + 1, FIELD_HALF * 2, 2);
    ctx.fillRect(-FIELD_HALF, y + TS / 2 - 3, FIELD_HALF * 2, 2);
    // прерывистая разметка по центру ряда
    ctx.fillStyle = 'rgba(250,250,250,0.55)';
    for (var i = -COLS; i <= COLS; i++) {
      var x = colX(i) + ((G.t * 8) % (TS * 2)) * 0;
      ctx.fillRect(x - TS * 0.28, y - 1.5, TS * 0.56, 3);
    }
  }

  /* --- вода ----------------------------------------------------------------- */
  function drawWater(row, y) {
    var g = ctx.createLinearGradient(0, y - TS / 2, 0, y + TS / 2);
    g.addColorStop(0, '#2b6fc4'); g.addColorStop(0.5, '#3482de'); g.addColorStop(1, '#2a67b8');
    ctx.fillStyle = g;
    ctx.fillRect(-FIELD_HALF, y - TS / 2, FIELD_HALF * 2, TS);
    ctx.strokeStyle = 'rgba(255,255,255,0.20)'; ctx.lineWidth = 2;
    for (var w = 0; w < 3; w++) {
      ctx.beginPath();
      var yy = y - TS * 0.28 + w * TS * 0.28;
      for (var x = -FIELD_HALF; x <= FIELD_HALF; x += 12) {
        var dy = Math.sin((x * 0.06) + G.t * 2.2 + row.phase + w) * 2.2;
        if (x === -FIELD_HALF) { ctx.moveTo(x, yy + dy); } else { ctx.lineTo(x, yy + dy); }
      }
      ctx.stroke();
    }
    // пена у берега
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(-FIELD_HALF, y - TS / 2, FIELD_HALF * 2, 2.5);
    ctx.fillRect(-FIELD_HALF, y + TS / 2 - 2.5, FIELD_HALF * 2, 2.5);
  }

  /* --- рельсы --------------------------------------------------------------- */
  function drawRail(row, y) {
    ctx.fillStyle = '#9a927f';
    ctx.fillRect(-FIELD_HALF, y - TS / 2, FIELD_HALF * 2, TS);
    // щебень
    if (scale > 0.72) {
      for (var i = 0; i < COLS * 6; i++) {
        var h = hash01(row.r * 61 + i * 41);
        var hx = -FIELD_HALF + h * FIELD_HALF * 2;
        var hy = y - TS / 2 + hash01(i * 17 + row.r) * TS;
        ctx.fillStyle = h < 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
        ctx.fillRect(hx, hy, 2.4, 2.4);
      }
    }
    // шпалы
    ctx.fillStyle = '#6d4a2f';
    for (var s = -COLS; s <= COLS; s++) {
      ctx.fillRect(colX(s) - TS * 0.42, y - TS * 0.36, TS * 0.84, TS * 0.72);
    }
    // рельсы
    ctx.fillStyle = '#cdd3dc';
    ctx.fillRect(-FIELD_HALF, y - TS * 0.20, FIELD_HALF * 2, 3.5);
    ctx.fillRect(-FIELD_HALF, y + TS * 0.16, FIELD_HALF * 2, 3.5);
    // светофоры по краям
    var warn = (!row.train && row.timer < row.warn);
    var blink = Math.floor(G.t * 5) % 2 === 0;
    [-FIELD_HALF - TS * 0.5, FIELD_HALF + TS * 0.5].forEach(function (px) {
      shadow(px, y + TS * 0.30, 9, 4, 0.25);
      ctx.fillStyle = '#5a6472';
      ctx.fillRect(px - 2.5, y - TS * 0.5, 5, TS * 0.85);
      rr(px - 9, y - TS * 0.5, 18, 12, 3);
      ctx.fillStyle = '#2b3038'; ctx.fill();
      ctx.fillStyle = (warn && blink) ? '#ff3b30' : '#5c1f1c';
      ctx.beginPath(); ctx.arc(px - 4.5, y - TS * 0.5 + 6, 3.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = (warn && !blink) ? '#ff3b30' : '#5c1f1c';
      ctx.beginPath(); ctx.arc(px + 4.5, y - TS * 0.5 + 6, 3.4, 0, 6.2832); ctx.fill();
    });
  }

  /* --- деревья, камни, монеты ---------------------------------------------- */
  function drawTree(x, y, variant) {
    shadow(x + 3, y + 9, 17, 8, 0.26);
    if (variant === 1) {                                  // ёлка (вид сверху)
      var layers = [[19, '#2f7d43'], [14, '#39934f'], [9, '#46a95c']];
      for (var i = 0; i < layers.length; i++) {
        var spikes = 10, R = layers[i][0];
        ctx.fillStyle = layers[i][1];
        ctx.beginPath();
        for (var s = 0; s < spikes * 2; s++) {
          var rr2 = (s % 2 === 0) ? R : R * 0.72;
          var a = (s / (spikes * 2)) * 6.2832 + i * 0.3;
          var px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2 * 0.92;
          if (s === 0) { ctx.moveTo(px, py); } else { ctx.lineTo(px, py); }
        }
        ctx.closePath(); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.beginPath(); ctx.arc(x - 3, y - 3, 3.6, 0, 6.2832); ctx.fill();
      return;
    }
    if (variant === 2) {                                  // куст
      var c = [['#3f8f4a', -7, 0, 10], ['#49a457', 7, 1, 9], ['#57b465', 0, -6, 9.5]];
      for (var k = 0; k < c.length; k++) {
        ctx.fillStyle = c[k][0];
        ctx.beginPath(); ctx.arc(x + c[k][1], y + c[k][2], c[k][3], 0, 6.2832); ctx.fill();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath(); ctx.arc(x - 4, y - 5, 3, 0, 6.2832); ctx.fill();
      return;
    }
    // лиственное дерево
    ctx.fillStyle = '#7a5230';
    ctx.beginPath(); ctx.arc(x, y + 1, 5, 0, 6.2832); ctx.fill();
    var blob = [[-8, -2, 11, '#2f8043'], [8, -1, 10.5, '#358c4a'], [0, -8, 12, '#3f9c55'], [0, 3, 10, '#2b763d']];
    for (var b = 0; b < blob.length; b++) {
      ctx.fillStyle = blob[b][3];
      ctx.beginPath(); ctx.arc(x + blob[b][0], y + blob[b][1], blob[b][2], 0, 6.2832); ctx.fill();
    }
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.beginPath(); ctx.arc(x - 5, y - 6, 4.2, 0, 6.2832); ctx.fill();
  }

  function drawRock(x, y) {
    shadow(x + 2, y + 8, 14, 6, 0.24);
    ctx.fillStyle = '#8b8f98';
    ctx.beginPath();
    ctx.moveTo(x - 13, y + 6); ctx.lineTo(x - 9, y - 8); ctx.lineTo(x + 2, y - 12);
    ctx.lineTo(x + 12, y - 5); ctx.lineTo(x + 11, y + 8); ctx.lineTo(x - 4, y + 11);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#a8adb8';
    ctx.beginPath();
    ctx.moveTo(x - 8, y - 6); ctx.lineTo(x + 1, y - 9); ctx.lineTo(x + 6, y - 3); ctx.lineTo(x - 4, y + 1);
    ctx.closePath(); ctx.fill();
  }

  function drawCoin(x, y, phase) {
    var k = Math.abs(Math.cos(G.t * 3 + phase));
    shadow(x, y + 7, 8, 3.5, 0.20);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(0.22 + k * 0.78, 1);
    ctx.fillStyle = '#f0b429';
    ctx.beginPath(); ctx.arc(0, 0, 8.5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#ffd75e';
    ctx.beginPath(); ctx.arc(0, -0.6, 6.6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#e0a01c';
    ctx.fillRect(-1.1, -4, 2.2, 8);
    ctx.restore();
  }

  /* --- брёвна и лилии ------------------------------------------------------- */
  function drawLog(x, y, len, kind) {
    var w = len * TS;
    if (kind === 'lily') {
      shadow(x, y + 5, w * 0.5, 7, 0.20);
      ctx.fillStyle = '#3f9c55';
      ctx.beginPath(); ctx.arc(x, y, w * 0.5, 0.35, 6.2832 - 0.35); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#54b96c';
      ctx.beginPath(); ctx.arc(x, y, w * 0.38, 0.35, 6.2832 - 0.35); ctx.lineTo(x, y); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#ffd0e8';
      ctx.beginPath(); ctx.arc(x + w * 0.16, y - 2, 3.2, 0, 6.2832); ctx.fill();
      return;
    }
    shadow(x, y + 6, w * 0.5, 8, 0.22);
    var g = ctx.createLinearGradient(0, y - 10, 0, y + 10);
    g.addColorStop(0, '#a9743f'); g.addColorStop(0.5, '#8b5a2b'); g.addColorStop(1, '#6f4520');
    ctx.fillStyle = g;
    rr(x - w / 2, y - 10, w, 20, 9); ctx.fill();
    // кольца на спиле
    ctx.fillStyle = '#c08a4e';
    ctx.beginPath(); ctx.ellipse(x - w / 2 + 3, y, 3.2, 8, 0, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(x + w / 2 - 3, y, 3.2, 8, 0, 0, 6.2832); ctx.fill();
    // кора
    ctx.strokeStyle = 'rgba(60,36,14,0.45)'; ctx.lineWidth = 1.4;
    for (var i = -2; i <= 2; i++) {
      ctx.beginPath();
      ctx.moveTo(x - w / 2 + 8, y + i * 3.4);
      ctx.lineTo(x + w / 2 - 8, y + i * 3.4 + (i % 2 ? 1 : -1));
      ctx.stroke();
    }
  }

  /* --- 2D-модели машин ------------------------------------------------------ */
  function drawVehicle(x, y, kind, dir, color, ph) {
    var len = KIND[kind].len * TS;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    // тень
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    rr(-len / 2 + 2, -TS * 0.30 + 4, len, TS * 0.60, 9); ctx.fill();

    var body = color || '#e05a47';
    var dark = 'rgba(0,0,0,0.22)';

    if (kind === 'truck') {
      // прицеп
      ctx.fillStyle = '#c9ced8';
      rr(-len / 2, -TS * 0.28, len - TS * 1.05, TS * 0.56, 5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 2;
      for (var t = 1; t < 4; t++) {
        var tx = -len / 2 + (len - TS * 1.05) * (t / 4);
        ctx.beginPath(); ctx.moveTo(tx, -TS * 0.26); ctx.lineTo(tx, TS * 0.26); ctx.stroke();
      }
      // кабина
      ctx.fillStyle = body;
      rr(len / 2 - TS * 1.15, -TS * 0.30, TS * 1.05, TS * 0.60, 8); ctx.fill();
      ctx.fillStyle = 'rgba(20,26,40,0.85)';
      rr(len / 2 - TS * 0.55, -TS * 0.22, TS * 0.32, TS * 0.44, 3); ctx.fill();
    } else if (kind === 'bus') {
      ctx.fillStyle = body;
      rr(-len / 2, -TS * 0.30, len, TS * 0.60, 10); ctx.fill();
      ctx.fillStyle = 'rgba(20,26,40,0.75)';                 // окна по борту
      for (var b = 0; b < 4; b++) {
        ctx.fillRect(-len / 2 + 9 + b * (len - 18) / 4.2, -TS * 0.24, (len - 18) / 5.4, TS * 0.15);
        ctx.fillRect(-len / 2 + 9 + b * (len - 18) / 4.2, TS * 0.09, (len - 18) / 5.4, TS * 0.15);
      }
      ctx.fillStyle = '#dfe6f0';
      rr(len / 2 - TS * 0.32, -TS * 0.24, TS * 0.28, TS * 0.48, 3); ctx.fill();
    } else {
      // кузов
      var g = ctx.createLinearGradient(0, -TS * 0.3, 0, TS * 0.3);
      g.addColorStop(0, 'rgba(255,255,255,0.30)'); g.addColorStop(0.45, body); g.addColorStop(1, dark);
      ctx.fillStyle = body;
      rr(-len / 2, -TS * 0.30, len, TS * 0.60, 10); ctx.fill();
      ctx.fillStyle = g;
      rr(-len / 2, -TS * 0.30, len, TS * 0.60, 10); ctx.fill();
      // крыша и стёкла
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      rr(-len * 0.20, -TS * 0.21, len * 0.42, TS * 0.42, 6); ctx.fill();
      ctx.fillStyle = 'rgba(18,24,38,0.80)';
      rr(len * 0.10, -TS * 0.23, len * 0.16, TS * 0.46, 4); ctx.fill();   // лобовое
      rr(-len * 0.34, -TS * 0.23, len * 0.13, TS * 0.46, 4); ctx.fill();  // заднее
      // зеркала
      ctx.fillStyle = body;
      ctx.fillRect(len * 0.04, -TS * 0.40, 5, 4);
      ctx.fillRect(len * 0.04, TS * 0.30, 5, 4);
    }

    // колёса
    ctx.fillStyle = '#20242e';
    ctx.fillRect(-len / 2 + 7, -TS * 0.36, 10, 6);
    ctx.fillRect(len / 2 - 17, -TS * 0.36, 10, 6);
    ctx.fillRect(-len / 2 + 7, TS * 0.30, 10, 6);
    ctx.fillRect(len / 2 - 17, TS * 0.30, 10, 6);

    // фары и стопы
    ctx.fillStyle = '#fff3c4';
    ctx.fillRect(len / 2 - 5, -TS * 0.26, 4, 7);
    ctx.fillRect(len / 2 - 5, TS * 0.18, 4, 7);
    ctx.fillStyle = '#ff5b4a';
    ctx.fillRect(-len / 2 + 1, -TS * 0.26, 3.5, 7);
    ctx.fillRect(-len / 2 + 1, TS * 0.18, 3.5, 7);

    if (kind === 'police') {
      // мигалка
      var on = Math.floor(G.t * 7) % 2 === 0;
      ctx.fillStyle = on ? '#3b82f6' : '#ef4444';
      rr(-3, -TS * 0.20, 6, TS * 0.40, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-len / 2 + 2, -TS * 0.20, len - 4, 4);
    }
    if (kind === 'taxi') {
      ctx.fillStyle = '#ffe066';
      rr(-6, -TS * 0.10, 12, 8, 3); ctx.fill();
    }
    ctx.restore();
  }

  /* --- поезд ---------------------------------------------------------------- */
  function drawTrain(x, y, dir) {
    var total = 8.4 * TS;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(-total / 2 + 2, -TS * 0.34 + 4, total, TS * 0.68, 8); ctx.fill();

    // вагоны
    for (var i = 0; i < 3; i++) {
      var wx = total / 2 - TS * 1.4 - i * TS * 2.3;
      ctx.fillStyle = i === 0 ? '#d94b3f' : '#8f98a6';
      rr(wx - TS * 1.05, -TS * 0.32, TS * 2.1, TS * 0.64, 8); ctx.fill();
      ctx.fillStyle = 'rgba(20,26,40,0.45)';
      for (var w = 0; w < 3; w++) { ctx.fillRect(wx - TS * 0.85 + w * TS * 0.62, -TS * 0.22, TS * 0.36, TS * 0.12); }
    }
    // локомотив
    ctx.fillStyle = '#c8342b';
    rr(total / 2 - TS * 4.6, -TS * 0.34, TS * 1.6, TS * 0.68, 9); ctx.fill();
    ctx.fillStyle = '#f2c94c';
    rr(total / 2 - TS * 4.6, -TS * 0.34, TS * 0.30, TS * 0.68, 6); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(total / 2 - TS * 3.6, -TS * 0.22, TS * 0.55, TS * 0.44, 5); ctx.fill();
    ctx.restore();

    // фара-конус вперёд
    ctx.save();
    ctx.globalAlpha = 0.16;
    var g = ctx.createLinearGradient(x + dir * total * 0.1, 0, x + dir * total * 0.9, 0);
    g.addColorStop(0, '#fff8c0'); g.addColorStop(1, 'rgba(255,248,192,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(x + dir * total * 0.1, y - TS * 0.45);
    ctx.lineTo(x + dir * total * 0.95, y - TS * 1.3);
    ctx.lineTo(x + dir * total * 0.95, y + TS * 1.3);
    ctx.lineTo(x + dir * total * 0.1, y + TS * 0.45);
    ctx.closePath(); ctx.fill();
    ctx.restore();
  }

  /* --- курица (главная 2D-модель) ------------------------------------------ */
  function drawChicken(x, y, hopT, facing, dead, t) {
    var airborne = hopT !== null;
    var arc = airborne ? Math.sin(Math.PI * hopT) : 0;
    var lift = arc * 20;
    var sq = 1 + arc * 0.13;                       // squash & stretch
    var breathe = airborne ? 0 : Math.sin(t * 3.4) * 0.02;

    shadow(x, y + 12 - lift * 0.15, 15 * (1 + arc * 0.25), 6.5 * (1 + arc * 0.2), 0.26 - arc * 0.10);
    if (dead) { return; }

    ctx.save();
    ctx.translate(x, y - lift);
    ctx.scale(1 - breathe, 1 + breathe);
    ctx.scale(1 / sq, sq);
    var ang = facing === 'up' ? 0 : facing === 'right' ? Math.PI / 2 : facing === 'down' ? Math.PI : -Math.PI / 2;
    ctx.rotate(ang);

    var flap = airborne ? Math.sin(hopT * Math.PI * 2) * 0.35 : Math.sin(t * 6) * 0.06;

    // лапки (прячутся в прыжке)
    if (!airborne) {
      ctx.strokeStyle = '#f2a33c'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(-6, 20); ctx.lineTo(-10, 21); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, 13); ctx.lineTo(6, 20); ctx.lineTo(10, 21); ctx.stroke();
    }
    // хвост
    ctx.fillStyle = '#eef1f7';
    ctx.beginPath(); ctx.ellipse(0, 16, 11, 7, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#d7dce7';
    ctx.beginPath(); ctx.ellipse(-5, 19, 5, 6, -0.5, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 19, 5, 6, 0.5, 0, 6.2832); ctx.fill();

    // крылья
    ctx.save();
    ctx.translate(-12, 2); ctx.rotate(-flap);
    ctx.fillStyle = '#e3e8f2';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 12, 0.15, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(12, 2); ctx.rotate(flap);
    ctx.fillStyle = '#e3e8f2';
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 12, -0.15, 0, 6.2832); ctx.fill();
    ctx.restore();

    // тело
    var bg = ctx.createLinearGradient(-10, -12, 10, 14);
    bg.addColorStop(0, '#ffffff'); bg.addColorStop(0.6, '#f4f6fb'); bg.addColorStop(1, '#d9dfea');
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 1, 14, 16, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(120,132,155,0.35)'; ctx.lineWidth = 1.2; ctx.stroke();

    // голова
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(0, -14, 9.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(120,132,155,0.30)'; ctx.stroke();

    // гребешок
    ctx.fillStyle = '#e8453c';
    ctx.beginPath(); ctx.arc(-3.4, -21.5, 3.2, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(1.6, -22.5, 3.4, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -20, 2.8, 0, 6.2832); ctx.fill();

    // клюв
    ctx.fillStyle = '#f5a623';
    ctx.beginPath();
    ctx.moveTo(-3.6, -22.5); ctx.lineTo(3.6, -22.5); ctx.lineTo(0, -29.5);
    ctx.closePath(); ctx.fill();

    // глаза
    ctx.fillStyle = '#20242e';
    ctx.beginPath(); ctx.arc(-4.6, -15.5, 1.7, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(4.6, -15.5, 1.7, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-5.1, -16.1, 0.6, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(4.1, -16.1, 0.6, 0, 6.2832); ctx.fill();

    ctx.restore();

    // щит неуязвимости
    if (G.invuln > 0) {
      ctx.strokeStyle = 'rgba(255,230,128,' + (0.35 + 0.35 * Math.sin(t * 14)) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y - 2, 24, 0, 6.2832); ctx.stroke();
    }
  }

  /* --- орёл ----------------------------------------------------------------- */
  function drawEagle(e, t) {
    var k = Math.min(1, e.t / EAGLE_DELAY);
    var gy = pl.py + 6;
    // растущая тень на земле
    ctx.fillStyle = 'rgba(0,0,0,' + (0.10 + k * 0.28) + ')';
    ctx.beginPath(); ctx.ellipse(pl.px, gy, 12 + k * 26, 6 + k * 12, 0, 0, 6.2832); ctx.fill();

    var ex = e.x, ey = e.y;
    ctx.save();
    ctx.translate(ex, ey);
    ctx.scale(0.9 + k * 0.35, 0.9 + k * 0.35);
    var wing = Math.sin(t * 9) * 0.22;
    // крылья
    ctx.fillStyle = '#8a5a34';
    ctx.save(); ctx.rotate(-0.25 + wing);
    ctx.beginPath(); ctx.ellipse(-24, 2, 24, 9, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(0.25 - wing);
    ctx.beginPath(); ctx.ellipse(24, 2, 24, 9, 0, 0, 6.2832); ctx.fill(); ctx.restore();
    // тело
    ctx.fillStyle = '#a06a3d';
    ctx.beginPath(); ctx.ellipse(0, 0, 12, 19, 0, 0, 6.2832); ctx.fill();
    // голова и клюв
    ctx.fillStyle = '#e8dcc8';
    ctx.beginPath(); ctx.arc(0, -17, 8, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#f2c94c';
    ctx.beginPath(); ctx.moveTo(-3.5, -21); ctx.lineTo(3.5, -21); ctx.lineTo(0, -28); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#20242e';
    ctx.beginPath(); ctx.arc(-3.6, -18, 1.6, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(3.6, -18, 1.6, 0, 6.2832); ctx.fill();
    ctx.restore();
  }

  /* --- общий рендер --------------------------------------------------------- */
  function drawVoid() {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var g = ctx.createLinearGradient(0, 0, 0, VH);
    g.addColorStop(0, '#131c2b'); g.addColorStop(1, '#0b1119');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    var step = 44, off = (-camY * scale) % step;
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    for (var y = off - step; y < VH + step; y += step) {
      for (var x = 0; x < VW + step; x += step) { ctx.fillRect(x, y, 2, 2); }
    }
  }

  function render() {
    drawVoid();

    var sx = 0, sy = 0;
    if (G.shake > 0) { sx = (Math.random() * 2 - 1) * G.shake * 0.4; sy = (Math.random() * 2 - 1) * G.shake * 0.4; }
    ctx.setTransform(DPR * scale, 0, 0, DPR * scale,
      DPR * (VW / 2 - camX * scale + sx), DPR * (VH / 2 - camY * scale + sy));

    var top = camY - (VH / 2) / scale, bot = camY + (VH / 2) / scale;
    var rFrom = Math.floor(-(bot + TS) / TS), rTo = Math.ceil(-(top - TS) / TS);

    for (var r = rTo; r >= rFrom; r--) {
      var row = G.rows[r];
      if (!row) { continue; }
      var y = rowY(r);
      if (row.type === 'grass') { drawGrass(row, y); }
      else if (row.type === 'road') { drawRoad(row, y); }
      else if (row.type === 'water') { drawWater(row, y); }
      else if (row.type === 'rail') { drawRail(row, y); }

      // объекты ряда
      if (row.type === 'grass') {
        for (var c in row.obstacles) {
          var cc = +c;
          var kind = row.obstacles[c];
          if (kind === 'tree') { drawTree(colX(cc), y - 4, hash01(row.r * 17 + cc * 29) < 0.4 ? 1 : (hash01(row.r * 3 + cc) < 0.3 ? 2 : 0)); }
          else { drawRock(colX(cc), y); }
        }
        for (var k2 = 0; k2 < row.coins.length; k2++) {
          drawCoin(colX(row.coins[k2]), y - 3 + Math.sin(G.t * 3 + row.coins[k2]) * 1.5, row.coins[k2]);
        }
      } else if (row.type === 'road') {
        for (var i2 = 0; i2 < row.items.length; i2++) {
          var it2 = row.items[i2];
          if (it2.x > -FIELD_HALF - TS * 4 && it2.x < FIELD_HALF + TS * 4) {
            drawVehicle(it2.x, y, it2.kind, it2.vx > 0 ? 1 : -1, it2.color, it2.ph);
          }
        }
      } else if (row.type === 'water') {
        for (var i3 = 0; i3 < row.items.length; i3++) {
          var it3 = row.items[i3];
          if (it3.x > -FIELD_HALF - TS * 4 && it3.x < FIELD_HALF + TS * 4) {
            drawLog(it3.x, y, it3.len, it3.kind);
          }
        }
      } else if (row.type === 'rail' && row.train) {
        drawTrain(row.train.x, y, row.dir);
      }
    }

    // затемнение за границами поля
    var edge = ctx.createLinearGradient(-FIELD_HALF - TS * 2, 0, -FIELD_HALF, 0);
    edge.addColorStop(0, 'rgba(6,10,16,0.85)'); edge.addColorStop(1, 'rgba(6,10,16,0)');
    ctx.fillStyle = edge;
    ctx.fillRect(-FIELD_HALF - TS * 3, camY - VH / scale, TS * 3, VH / scale * 2);
    var edge2 = ctx.createLinearGradient(FIELD_HALF + TS * 2, 0, FIELD_HALF, 0);
    edge2.addColorStop(0, 'rgba(6,10,16,0.85)'); edge2.addColorStop(1, 'rgba(6,10,16,0)');
    ctx.fillStyle = edge2;
    ctx.fillRect(FIELD_HALF, camY - VH / scale, TS * 3, VH / scale * 2);

    // орёл
    if (G.eagle && pl.alive) { drawEagle(G.eagle, G.t); }

    // частицы
    for (var p = 0; p < G.particles.length; p++) {
      var pt = G.particles[p];
      var a = Math.max(0, pt.life / pt.max);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      if (pt.kind === 'feather') {
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, pt.size * 1.6, pt.size * 0.65, 0, 0, 6.2832); ctx.fill();
        ctx.restore();
      } else if (pt.kind === 'sparkle') {
        ctx.save(); ctx.translate(pt.x, pt.y); ctx.rotate(pt.rot);
        ctx.fillRect(-pt.size / 2, -0.8, pt.size, 1.6);
        ctx.fillRect(-0.8, -pt.size / 2, 1.6, pt.size);
        ctx.restore();
      } else if (pt.kind === 'dust') {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, 6.2832); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size * a, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;

    // курица
    if (G.state !== 'loading') {
      drawChicken(pl.px, pl.py, pl.hop ? pl.hop.t : null, pl.facing, !pl.alive, G.t);
    }

    // всплывашки
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (var q = 0; q < G.popups.length; q++) {
      var po = G.popups[q];
      ctx.globalAlpha = Math.max(0, po.life / 0.9);
      ctx.fillStyle = po.color;
      ctx.fillText(po.text, po.x, po.y);
    }
    ctx.globalAlpha = 1;

    // вспышка урона / воды
    if (G.flash > 0) {
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.fillStyle = 'rgba(' + G.flashColor + ',' + (G.flash * 0.28) + ')';
      ctx.fillRect(0, 0, VW, VH);
    }
    // виньетка
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    var vg = ctx.createRadialGradient(VW / 2, VH / 2, Math.min(VW, VH) * 0.35, VW / 2, VH / 2, Math.max(VW, VH) * 0.75);
    vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);
  }

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
    tryMove(d[0], d[1]);
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
    if (e.code === 'KeyM') { toggleMute(); return; }
    if (e.code === 'KeyP' || e.code === 'Escape') { togglePause(); return; }
    if (e.code === 'Space' || e.code === 'Enter') {
      if (G.state === 'menu') { startGame(); }
      else if (G.state === 'over') { startGame(); }
      else if (G.state === 'paused') { togglePause(); }
      else if (G.state === 'playing') { tryMove(0, 1); }
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
    if (dist < 26) { tryMove(0, 1); }
    else if (Math.abs(dx) > Math.abs(dy)) { tryMove(dx > 0 ? 1 : -1, 0); }
    else { tryMove(0, dy < 0 ? 1 : -1); }
    touch = null;
    if (e.preventDefault) { e.preventDefault(); }
  }, { passive: false });

  canvas.addEventListener('mousedown', function () {
    Sound.init();
    if (G.state === 'playing') { tryMove(0, 1); }
  }, false);

  window.addEventListener('resize', function () { resize(); }, false);
  if (window.addEventListener) {
    window.addEventListener('orientationchange', function () { setTimeout(resize, 120); }, false);
  }

  /* ==========================================================================
     11. ИНТЕРФЕЙС (DOM)
     ========================================================================== */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    score: $('vScore'), best: $('vBest'), coins: $('vCoins'),
    ovMenu: $('ovMenu'), ovOver: $('ovOver'), ovPause: $('ovPause'), ovLoading: $('ovLoading'),
    oScore: $('oScore'), oBest: $('oBest'), oRecord: $('oRecord'), oReason: $('tReason'),
    mBest: $('mBest'), mCoins: $('mCoins'),
    btnPlay: $('btnPlay'), btnRestart: $('btnRestart'), btnRevive: $('btnRevive'),
    btnResume: $('btnResume'), btnRestart2: $('btnRestart2'),
    btnMute: $('btnMute'), btnPause: $('btnPause'),
    hint: $('hintEagle')
  };
  var lastHUD = { score: -1, best: -1, coins: -1 };

  function syncHUD(force) {
    if (force || G.score !== lastHUD.score) { if (el.score) { el.score.textContent = G.score; } lastHUD.score = G.score; }
    if (force || G.best !== lastHUD.best) { if (el.best) { el.best.textContent = G.best; } lastHUD.best = G.best; }
    var shown = G.state === 'playing' ? G.coins : G.totalCoins;
    if (force || shown !== lastHUD.coins) { if (el.coins) { el.coins.textContent = shown; } lastHUD.coins = shown; }
  }

  function showOnly(which) {
    var list = [el.ovMenu, el.ovOver, el.ovPause, el.ovLoading];
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) { continue; }
      var on = (list[i].id === which);
      list[i].classList.toggle('on', on);
    }
  }
  function showHint(text) {
    if (!el.hint) { return; }
    el.hint.textContent = text;
    el.hint.classList.add('on');
    G.hintShown = true;
  }
  function hideHint() { if (el.hint) { el.hint.classList.remove('on'); } }

  function toggleMute() {
    G.muted = !G.muted;
    Sound.setMuted(G.muted);
    if (el.btnMute) { el.btnMute.textContent = G.muted ? '🔇' : '🔊'; }
    try { window.localStorage.setItem('cc_muted', G.muted ? '1' : '0'); } catch (e) {}
  }
  function togglePause() {
    if (G.state === 'playing') {
      G.state = 'paused';
      Pl.gameplayStop();
      Sound.suspend();
      UI.pause();
      showOnly('ovPause');
    } else if (G.state === 'paused') {
      G.state = 'playing';
      Pl.gameplayStart();
      Sound.resume();
      showOnly(null);
    }
  }

  var UI = {
    applyLang: function () {
      var set = function (id, txt) { var n = $(id); if (n) { n.textContent = txt; } };
      set('lblBest', Pl.t('best')); set('lblCoins', Pl.t('coins'));
      set('mLblBest', Pl.t('best')); set('mLblCoins', Pl.t('coins'));
      set('oLblBest', Pl.t('best'));
      set('tOver', Pl.t('gameOver')); set('tPaused', Pl.t('paused'));
      set('btnPlay', Pl.t('play')); set('btnRestart', Pl.t('playAgain'));
      set('btnRestart2', Pl.t('restart')); set('btnResume', Pl.t('resume'));
      set('btnRevive', Pl.t('revive'));
      set('tControls', Pl.t('controlsDesktop'));
      set('tControls2', Pl.t('controlsMobile'));
      set('tSub', Pl.t('tap'));
      set('oRecord', Pl.t('record'));
      set('ovLoadText', Pl.t('loading'));
      document.title = 'Crossy Chicken';
    },
    menu: function () {
      if (el.mBest) { el.mBest.textContent = G.best; }
      if (el.mCoins) { el.mCoins.textContent = G.totalCoins; }
      showOnly('ovMenu');
    },
    over: function (isRecord) {
      if (el.oScore) { el.oScore.textContent = G.score; }
      if (el.oBest) { el.oBest.textContent = G.best; }
      if (el.oRecord) { el.oRecord.classList.toggle('on', !!isRecord); }
      if (el.oReason) { el.oReason.textContent = Pl.t('r_' + G.deathReason); }
      var canRevive = Pl.rewardedAvailable && !G.reviveUsed;
      if (el.btnRevive) {
        el.btnRevive.hidden = !canRevive;
        el.btnRevive.disabled = false;
        el.btnRevive.textContent = Pl.t('revive');
      }
    },
    pause: function () {}
  };

  if (el.btnPlay) { el.btnPlay.addEventListener('click', function () { Sound.init(); startGame(); }); }
  if (el.btnRestart) { el.btnRestart.addEventListener('click', function () { startGame(); }); }
  if (el.btnRestart2) { el.btnRestart2.addEventListener('click', function () { startGame(); }); }
  if (el.btnResume) { el.btnResume.addEventListener('click', function () { if (G.state === 'paused') { togglePause(); } }); }
  if (el.btnPause) { el.btnPause.addEventListener('click', function () { togglePause(); }); }
  if (el.btnMute) { el.btnMute.addEventListener('click', function () { toggleMute(); }); }
  if (el.btnRevive) {
    el.btnRevive.addEventListener('click', function () {
      var b = el.btnRevive;
      b.disabled = true;
      b.textContent = Pl.t('reviveWait');
      Pl.showRewarded(function () { revive(); }, function () {
        b.disabled = false;
        b.textContent = Pl.t('revive');
      });
    });
  }

  // пауза при потере фокуса вкладки (требование площадки + здравый смысл)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.state === 'playing') { togglePause(); }
  }, false);

  /* ==========================================================================
     12. ЦИКЛ
     ========================================================================== */
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) { last = now; }
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    G.t += dt;
    if (G.state === 'playing') { update(dt); }
    else if (G.state === 'menu') { moveWorld(dt); updateParticles(dt); }
    render();
  }

  /* ==========================================================================
     13. СТАРТ
     ========================================================================== */
  function boot() {
    try { G.muted = window.localStorage.getItem('cc_muted') === '1'; } catch (e) {}
    Sound.setMuted(G.muted);
    if (el.btnMute) { el.btnMute.textContent = G.muted ? '🔇' : '🔊'; }

    // во время рекламы платформа обязана видеть остановку геймплея
    Pl.onPause = function () {
      Sound.suspend();
      Pl.gameplayStop();
      if (G.state === 'playing') { G.state = 'paused'; showOnly('ovPause'); }
    };
    Pl.onResume = function () {
      Sound.resume();
      if (G.state === 'paused') { G.state = 'playing'; Pl.gameplayStart(); showOnly(null); }
    };

    resize();
    ensureRows(ROWS_AHEAD);

    Pl.init().then(function () {
      UI.applyLang();
      return Pl.load();
    }).then(function (data) {
      G.best = data.best || 0;
      G.totalCoins = data.coins || 0;
      syncHUD(true);
      G.state = 'menu';
      UI.menu();
      showOnly('ovMenu');
    }).catch(function () {
      G.state = 'menu';
      showOnly('ovMenu');
    });

    requestAnimationFrame(frame);
  }

  // отладочный доступ (используется автотестом, в проде не мешает)
  window.__CHICKEN__ = {
    G: G, pl: pl,
    start: startGame, die: die, revive: revive, tryMove: tryMove,
    teleport: function (c, r) { pl.px = colX(c); pl.py = rowY(r); pl.hop = null; pl.log = null; camY = camTargetY = camTargetFor(pl.py); },
    rows: function () { return G.rows; },
    ensure: ensureRows,
    resize: resize
  };

  boot();
})();
