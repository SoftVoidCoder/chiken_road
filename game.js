/* ============================================================================
   Crossy Chicken — 2D-игра в стиле Crossy Road для Яндекс Игр
   ----------------------------------------------------------------------------
   Вся графика рисуется процедурно на Canvas 2D: ни одной картинки, ни одного
   внешнего файла. У каждого объекта своя 2D-модель (спрайт) с анимацией:
   курица (шаг, прыжок, squash&stretch), 11 типов машин, брёвна и лилии,
   поезд с вагонами, деревья, камни, монеты, орёл.
   Вид строго сверху. Мир — бесконечная сетка рядов, генерируемых на ходу.
   Три уровня сложности меняют плотность и скорость потока, поведение орла
   и щедрость монет. Скины курицы покупаются за монеты и тоже нарисованы кодом.
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
  var EAGLE_DELAY = 1.25;      // сколько орёл пикирует
  var MIN_ROW = -6;            // докуда можно отойти назад от старта
  var ROWS_AHEAD = 42;         // на сколько рядов генерируем мир вперёд
  var PLAYER_SCREEN_Y = 0.63;  // положение курицы по вертикали экрана
  var fine = true;             // рисовать ли мелкие детали машин (см. resize)

  // Три уровня сложности.
  //   speed    — множитель скорости потока
  //   gapTime  — сколько секунд машина едет от бампера до бампера (главный
  //              регулятор плотности: больше — реже поток)
  //   minGap   — минимальный просвет между машинами в клетках
  //   ramp     — крутизна разгона внутри забега
  //   pattern  — как часто выпадают дороги/реки
  //   obs      — плотность препятствий на траве
  //   water    — скорость течения
  //   eagle    — сколько секунд можно стоять до орла
  //   coin     — шанс монет на траве, coin10 — награда за каждые 10 рядов
  var DIFFS = {
    easy:   { id: 'easy',   speed: 0.82, gap: 1.45, gapTime: 2.10, minGap: 5.0, ramp: 0.70, pattern: 0.72, obs: 0.72, water: 0.86, eagle: 14.0, coin: 0.85, coin10: 2, row0: 6 },
    normal: { id: 'normal', speed: 1.00, gap: 1.00, gapTime: 1.55, minGap: 3.6, ramp: 1.00, pattern: 1.00, obs: 1.00, water: 1.00, eagle: 10.0, coin: 1.00, coin10: 2, row0: 8 },
    hard:   { id: 'hard',   speed: 1.20, gap: 0.80, gapTime: 1.15, minGap: 2.6, ramp: 1.30, pattern: 1.28, obs: 1.16, water: 1.16, eagle: 7.0,  coin: 1.40, coin10: 3, row0: 9 }
  };
  var DIFF_ORDER = ['easy', 'normal', 'hard'];

  // 2D-модели машин: длина (в клетках) и множитель скорости
  var KIND = {
    car:       { len: 1.05, sp: 1.00 },
    taxi:      { len: 1.05, sp: 1.00 },
    van:       { len: 1.42, sp: 0.90 },
    bus:       { len: 2.30, sp: 0.76 },
    truck:     { len: 2.75, sp: 0.68 },
    police:    { len: 1.05, sp: 1.18 },
    sport:     { len: 1.16, sp: 1.34 },   // спорткар: низкий, с антикрылом
    pickup:    { len: 1.52, sp: 0.94 },   // пикап: кабина + открытый кузов
    ambulance: { len: 1.46, sp: 1.08 },   // скорая: белая, с крестом и мигалкой
    tractor:   { len: 1.30, sp: 0.52 },   // трактор: еле ползёт, большие колёса
    moto:      { len: 0.72, sp: 1.48 }    // мотоцикл: узкий и очень быстрый
  };
  var CAR_COLORS = {
    car:       ['#e05a47', '#3d7ce0', '#59b36b', '#8b5cf6', '#e8792b', '#d94f7d'],
    taxi:      ['#f5c542'],
    van:       ['#e8ecf2', '#6b7c93', '#4aa3a3'],
    bus:       ['#e0574a', '#3f7fd0'],
    truck:     ['#8d99ae', '#b0552e'],
    police:    ['#f2f5fa'],
    sport:     ['#f04e3e', '#ffc93c', '#22c1c3', '#242c3a'],
    pickup:    ['#c2703a', '#4f7d5a', '#6b7c93'],
    ambulance: ['#f4f7fb'],
    tractor:   ['#3f8f3a', '#c2703a', '#2f6fb0'],
    moto:      ['#e11d48', '#2563eb', '#1f2937']
  };

  /* --- скины курицы: палитра + украшения, всё тоже рисуется кодом ----------- */
  // price — цена в монетах; size — масштаб модели; extra — функция украшений
  var SKINS = [
    { id: 'classic', price: 0, size: 1,
      body: ['#ffffff', '#f4f6fb', '#d9dfea'], wing: '#e3e8f2', tail: ['#eef1f7', '#d7dce7'],
      comb: '#e8453c', beak: '#f5a623', legs: '#f2a33c', eye: '#20242e', line: 'rgba(120,132,155,0.35)', extra: null },
    { id: 'chick', price: 30, size: 0.80,
      body: ['#fff0a8', '#ffd84d', '#eaa900'], wing: '#ffe066', tail: ['#fff3b0', '#ffe066'],
      comb: '#ffb703', beak: '#ff9f1c', legs: '#ff9f1c', eye: '#20242e', line: 'rgba(170,120,20,0.35)', extra: 'fluff' },
    { id: 'bandit', price: 70, size: 1,
      body: ['#f7dcb6', '#e6bd8a', '#c99a63'], wing: '#d9ac78', tail: ['#f0d3ab', '#d9ac78'],
      comb: '#c0392b', beak: '#f5a623', legs: '#e08b2e', eye: '#20242e', line: 'rgba(120,80,40,0.35)', extra: 'bandit' },
    { id: 'ninja', price: 120, size: 1,
      body: ['#4c5468', '#343b4d', '#222738'], wing: '#3d4557', tail: ['#3d4557', '#2a3040'],
      comb: '#e8453c', beak: '#c9ced8', legs: '#c9ced8', eye: '#ffffff', line: 'rgba(10,14,22,0.5)', extra: 'ninja' },
    { id: 'zombie', price: 170, size: 1,
      body: ['#b9d47d', '#93b855', '#6f9339'], wing: '#a3c463', tail: ['#a3c463', '#7d9c46'],
      comb: '#7d9c46', beak: '#c9b458', legs: '#7d9c46', eye: '#ff3b30', line: 'rgba(50,70,25,0.5)', extra: 'zombie' },
    { id: 'robot', price: 230, size: 1,
      body: ['#dbe4ef', '#b3c0d0', '#8b99ab'], wing: '#c3cedd', tail: ['#c3cedd', '#9aa6b6'],
      comb: '#8892a3', beak: '#f2c94c', legs: '#9aa6b6', eye: '#22d3ee', line: 'rgba(50,62,80,0.5)', extra: 'robot' },
    { id: 'gold', price: 300, size: 1,
      body: ['#fff2bb', '#f2c94c', '#b8860b'], wing: '#ffdd77', tail: ['#ffe89a', '#c99a12'],
      comb: '#c1121f', beak: '#ffe066', legs: '#e0a91c', eye: '#5a3d00', line: 'rgba(150,105,0,0.5)', extra: 'gold' },
    { id: 'rainbow', price: 400, size: 1,
      body: null, wing: null, tail: null,
      comb: '#ffffff', beak: '#ffd75e', legs: '#ffd75e', eye: '#1d2b3f', line: 'rgba(40,40,80,0.35)', extra: 'rainbow' }
  ];
  var SKIN_BY_ID = {};
  for (var sk0 = 0; sk0 < SKINS.length; sk0++) { SKIN_BY_ID[SKINS[sk0].id] = SKINS[sk0]; }


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
    fine = scale > 0.62;       // на мелком экране блики и ручки не видны — экономим кадры
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
    diffId: 'normal', bests: { easy: 0, normal: 0, hard: 0 },
    skin: 'classic', skins: ['classic'],
    rows: {}, genUntil: MIN_ROW - 1, pattern: null,
    particles: [], popups: [],
    shake: 0, flash: 0, flashColor: '255,80,80',
    eagle: null, invuln: 0, deathT: 0, deathReason: '',
    reviveUsed: false, runStart: 0, muted: false,
    hintShown: false
  };

  function diff() { return DIFFS[G.diffId] || DIFFS.normal; }
  function eagleLimit() { return diff().eagle; }
  // рекорд конкретного режима: у каждой сложности своя таблица рекордов
  function bestFor(id) { return Math.max(0, G.bests[id || G.diffId] || 0); }
  function profile() {
    return {
      best: G.best,
      bests: { easy: G.bests.easy, normal: G.bests.normal, hard: G.bests.hard },
      coins: G.totalCoins,
      skins: G.skins.slice(),
      skin: G.skin,
      diff: G.diffId
    };
  }
  function saveProfile() { Pl.save(profile()); }

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
  // разгон внутри забега: чем дальше, тем злее; крутизна зависит от сложности
  function ramp(row) { return clamp((row - diff().row0) / 240, 0, 1) * diff().ramp; }

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
    // длина: либо своя функция (брёвна), либо из таблицы KIND по типу машины
    var len = opts.len ? opts.len(d, kind) : (kind && KIND[kind] ? KIND[kind].len : 1);
    var spMul = (kind && KIND[kind]) ? KIND[kind].sp : 1;
    var vT = speedT * spMul;
    var gap = Math.max(opts.minGap, vT * opts.gapTime - d * opts.gapTighten);
    var span = COLS + 9;
    // страховка: ни одна из величин не должна оказаться NaN, иначе лента
    // молча останется пустой (именно так дороги когда-то были без машин)
    if (!isFinite(len) || len <= 0) { len = 1; }
    if (!isFinite(gap) || gap < 0) { gap = opts.minGap || 1; }
    var count = Math.max(1, Math.floor(span / (len + gap)));
    if (!isFinite(count) || count < 1) { count = 1; }
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
      var maxObs = Math.min(COLS - 2, Math.round((1 + d * 5 + Math.random() * 2) * diff().obs));
      var order = shuffle(cols());
      for (var i = 0; i < maxObs; i++) {
        var c = order[i];
        row.obstacles[c] = hash01(r * 131 + c * 17) < 0.62 ? 'tree' : 'rock';
      }
      if (Math.random() < 0.22 * diff().coin) {
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
      speedT: (1.7 + Math.random() * 2.1 + d * 2.4) * diff().speed,
      kind: function () {
        var q = Math.random();
        if (q < 0.30) { return 'car'; }
        if (q < 0.41) { return 'taxi'; }
        if (q < 0.51) { return 'van'; }
        if (q < 0.60) { return 'bus'; }
        if (q < 0.68) { return 'truck'; }
        if (q < 0.74) { return 'police'; }
        if (q < 0.82) { return 'sport'; }       // быстрый и юркий
        if (q < 0.88) { return 'pickup'; }
        if (q < 0.93) { return 'ambulance'; }
        if (q < 0.97) { return 'tractor'; }     // медленный, но длинный
        return 'moto';                          // самый быстрый в игре
      },
      minGap: diff().minGap, gapTime: diff().gapTime, gapTighten: 0.16 * diff().ramp
    });
    row.dir = lane.dir; row.items = lane.items; row.loop = lane.loop; row.speed = lane.speed;
    return row;
  }

  function genWater(r, d) {
    var row = { type: 'water', r: r, phase: rnd(0, 6.28) };
    var lane = makeLane(r, d, {
      speedT: (0.65 + Math.random() * 1.5) * diff().water,
      len: function () { return 1.8 + Math.random() * 1.4; },
      minGap: 1.35 * diff().gap, gapTime: 0.95 * diff().gap, gapTighten: 0.05 * diff().ramp
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
      timer: rnd(1.6, 4.4) / diff().speed, warn: 1.15, train: null,
      trainSpeed: (9 + d * 3.5) * TS * diff().speed, trainLen: 8.4, d: d
    };
  }

  function nextPattern(r, d) {
    var prev = G.rows[r - 1] ? G.rows[r - 1].type : 'grass';
    // после воды и рельсов — обязательно передышка (иначе игрок окажется в ловушке)
    if (prev === 'water' || prev === 'rail') { return { kind: 'grass', left: 1 + ((Math.random() * 2) | 0) }; }
    var q = Math.random();
    var pRoad = 0.44 * diff().pattern, pWater = 0.18 * diff().pattern;
    // длина серии дорог ограничена: 4 полосы подряд уже требуют ювелирной
    // реакции, поэтому на позднем разгоне серия растёт до трёх-четырёх
    if (q < pRoad) { return { kind: 'road', left: 1 + ((Math.random() * (1 + d * 1.7)) | 0) }; }
    if (q < pRoad + pWater) { return { kind: 'water', left: 1 + ((Math.random() * (1 + d * 1.2)) | 0) }; }
    if (q < pRoad + pWater + 0.11) { return { kind: 'rail', left: 1 }; }
    return { kind: 'grass', left: 1 + ((Math.random() * 2) | 0) };
  }

  function genNextRow() {
    var r = G.genUntil + 1;
    var d = ramp(r);
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
      // награда за дистанцию: каждые 10 рядов капает немного монет, иначе
      // первые скины пришлось бы копить сотнями забегов
      if (row > 0 && row % 10 === 0) {
        var bonus = diff().coin10 || 2;
        G.coins += bonus; G.totalCoins += bonus;
        popup(pl.px, pl.py - TS * 0.75, '+' + bonus, '#ffd75e');
        burst(pl.px, pl.py, 12, '#ffd75e', 'sparkle', 120);
        Sound.coin();
      }
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
      if (pl.idle > eagleLimit()) {
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
      if (pl.alive && !G.hintShown && pl.idle > eagleLimit() - 3) { showHint(Pl.t('hintEagle')); }
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
    var isRecord = G.score > bestFor();
    if (isRecord) { G.bests[G.diffId] = G.score; }
    G.best = Math.max(G.best, G.score, bestFor());
    saveProfile();
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
  // Модели собираются послойно, как настоящие спрайты:
  //   тень → колёса → кузов с градиентом и швами → стёкла с бликами →
  //   крыша и боковые окна → зеркала → фары и стопы → детали конкретного типа
  //   (шашечки, мигалки, крест, кузов пикапа, плуг трактора и т.д.).
  // Мелкие штрихи (блики на стекле, ручки дверей, диски колёс) рисуются
  // только при крупном масштабе — на мелком экране телефона они не видны.

  var CAR_W = TS * 0.60;                     // ширина кузова машины

  function hexRgb(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) { return [224, 90, 71]; }
    return [r, g, b];
  }
  // k > 0 — светлее, k < 0 — темнее: из одного цвета получаем всю палитру машины
  function shade(hex, k) {
    var c = hexRgb(hex);
    for (var i = 0; i < 3; i++) {
      c[i] = k >= 0 ? c[i] + (255 - c[i]) * k : c[i] * (1 + k);
      c[i] = c[i] < 0 ? 0 : (c[i] > 255 ? 255 : c[i]);
    }
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }

  function vShadowBox(len, w) {
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(-len / 2 + 3, -w / 2 + 5, len, w, Math.min(11, w / 2.6)); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    rr(-len / 2 + 7, -w / 2 + 8, len - 6, w - 3, Math.min(10, w / 2.8)); ctx.fill();
  }

  // кузов: градиент по ширине даёт ощущение объёма, сверху блик, снизу тень
  function vBody(len, hw, base, r) {
    var g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.36));
    g.addColorStop(0.28, shade(base, 0.08));
    g.addColorStop(0.60, base);
    g.addColorStop(1, shade(base, -0.44));
    rr(-len / 2, -hw, len, hw * 2, r);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(18,22,32,0.5)'; ctx.lineWidth = 1.1; ctx.stroke();
    if (!fine) { return; }
    ctx.save();
    rr(-len / 2 + 0.8, -hw + 0.8, len - 1.6, hw * 2 - 1.6, r);
    ctx.clip();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    rr(-len / 2 + 2, -hw + 1.2, len - 4, hw * 0.26, 3); ctx.fill();
    ctx.restore();
  }

  function vSeam(x, hw, from, to) {          // шов панели поперёк кузова
    ctx.strokeStyle = 'rgba(0,0,0,0.26)'; ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, from === undefined ? -hw + 2 : from);
    ctx.lineTo(x, to === undefined ? hw - 2 : to);
    ctx.stroke();
  }

  function vHandles(x, hw, w) {              // дверные ручки
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath();
    ctx.rect(x, -hw + 2.2, w, 2); ctx.rect(x, hw - 4.2, w, 2);
    ctx.fill();
  }

  // стекло задаётся четырьмя точками (передняя кромка шире/уже задней)
  function vGlassQuad(p) {
    var yMin = Math.min(p[1], p[3], p[5], p[7]), yMax = Math.max(p[1], p[3], p[5], p[7]);
    var xMin = Math.min(p[0], p[2], p[4], p[6]), xMax = Math.max(p[0], p[2], p[4], p[6]);
    ctx.beginPath();
    ctx.moveTo(p[0], p[1]); ctx.lineTo(p[2], p[3]); ctx.lineTo(p[4], p[5]); ctx.lineTo(p[6], p[7]);
    ctx.closePath();
    // плоская заливка вместо градиента: полоса стекла всего 6–10 px,
    // градиент на ней не читается, а стоит заметно дороже
    ctx.fillStyle = '#2c3f56'; ctx.fill();
    ctx.strokeStyle = 'rgba(12,16,24,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    if (!fine) { return; }
    ctx.save(); ctx.clip();
    ctx.fillStyle = 'rgba(169,201,232,0.85)';       // отражение неба у кромки
    ctx.fillRect(xMin - 1, yMin - 1, xMax - xMin + 2, Math.max(1.6, (yMax - yMin) * 0.16));
    ctx.strokeStyle = 'rgba(232,245,255,0.30)'; ctx.lineWidth = 2.2;
    ctx.beginPath();
    ctx.moveTo(xMin, yMax + 2); ctx.lineTo(xMax, yMin - 2);
    ctx.stroke();
    ctx.restore();
  }

  function vWheel(cx, cy, h, big) {
    rr(cx - 5.5, cy - h / 2, 11, h, 3);
    ctx.fillStyle = '#14171d'; ctx.fill();
    if (big) {                                  // протектор у больших колёс
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (var i = 0; i < 3; i++) { ctx.fillRect(cx - 5.5, cy - h / 2 + 2 + i * (h / 3.2), 11, 1.2); }
    }
    if (!fine) { return; }
    ctx.fillStyle = 'rgba(196,206,220,0.38)';
    rr(cx - 3, cy - h * 0.24, 6, h * 0.48, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(cx - 4.5, cy - h / 2 + 1, 9, 1.3);
  }

  function vHead(x, hw, glow) {
    if (glow) {
      var g = ctx.createRadialGradient(x, 0, 1, x, 0, 24);
      g.addColorStop(0, 'rgba(255,244,190,0.38)');
      g.addColorStop(1, 'rgba(255,244,190,0)');
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.arc(x, 0, 24, 0, 6.2832); ctx.fill();
    }
    var ys = [-hw + 2.5, hw - 8.5];
    rr(x - 3.5, ys[0], 5, 6, 2); rr(x - 3.5, ys[1], 5, 6, 2);
    ctx.fillStyle = '#dde5f0'; ctx.fill();
    rr(x - 2.6, ys[0] + 1, 3.2, 4, 1.4); rr(x - 2.6, ys[1] + 1, 3.2, 4, 1.4);
    ctx.fillStyle = 'rgba(255,250,215,0.95)'; ctx.fill();
  }

  function vTail(x, hw) {
    var ys = [-hw + 2.5, hw - 8.5];
    rr(x, ys[0], 4, 6, 1.8); rr(x, ys[1], 4, 6, 1.8);
    ctx.fillStyle = '#cf2a1e'; ctx.fill();
    rr(x + 0.7, ys[0] + 1.2, 2.3, 3.6, 1); rr(x + 0.7, ys[1] + 1.2, 2.3, 3.6, 1);
    ctx.fillStyle = 'rgba(255,150,130,0.85)'; ctx.fill();
    ctx.fillStyle = '#e6ecf5';
    ctx.fillRect(x + 0.6, -1.8, 2.2, 3.6);
  }

  function vMirrors(x, hw, base) {            // зеркала на ножках
    ctx.fillStyle = 'rgba(26,32,42,0.85)';
    ctx.fillRect(x - 1.2, -hw - 3.4, 2.4, 4);
    ctx.fillRect(x - 1.2, hw - 0.6, 2.4, 4);
    ctx.fillStyle = shade(base, -0.15);
    rr(x - 4.2, -hw - 5.4, 7.5, 3.2, 1.5); ctx.fill();
    rr(x - 4.2, hw + 2.2, 7.5, 3.2, 1.5); ctx.fill();
  }

  function vPlate(x, y) {
    ctx.fillStyle = '#e9eef6'; rr(x, y - 3, 2.6, 6, 0.8); ctx.fill();
    if (!fine) { return; }
    ctx.fillStyle = 'rgba(30,40,60,0.5)';
    ctx.fillRect(x + 0.6, y - 1.5, 1.5, 3);
  }

  /* --- легковой автомобиль (car / taxi / police) ---------------------------- */
  function drawSedan(len, base, variant) {
    var hw = CAR_W / 2, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 8.5, -hw + 0.5, 7);
    vWheel(x0 + 8.5, hw - 0.5, 7);
    vWheel(x1 - 9.5, -hw + 0.5, 7);
    vWheel(x1 - 9.5, hw - 0.5, 7);

    vBody(len, hw, base, Math.min(12, len * 0.14));

    var xHood = x0 + len * 0.70, xTrunk = x0 + len * 0.20;
    var xR0 = x0 + len * 0.32, xR1 = x0 + len * 0.56;

    // капот со рёбрами
    ctx.fillStyle = 'rgba(255,255,255,0.09)';
    rr(xHood + 1, -hw + 1.8, x1 - xHood - 3, hw * 2 - 3.6, 3); ctx.fill();
    if (fine) {
      ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(xHood + 2, -hw * 0.42); ctx.lineTo(x1 - 4, -hw * 0.30); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(xHood + 2, hw * 0.42); ctx.lineTo(x1 - 4, hw * 0.30); ctx.stroke();
      // решётка радиатора
      ctx.fillStyle = 'rgba(20,24,32,0.55)';
      rr(x1 - 4.5, -hw * 0.55, 2.5, hw * 1.1, 1); ctx.fill();
    }

    vSeam(xTrunk, hw);
    vSeam(xR1, hw);
    if (fine) { vHandles(x0 + len * 0.40, hw, 6); vHandles(x0 + len * 0.50, hw, 5); }

    // лобовое и заднее стекло
    vGlassQuad([x0 + len * 0.70, -hw * 0.80, x0 + len * 0.70, hw * 0.80,
                x0 + len * 0.58, hw * 0.93, x0 + len * 0.58, -hw * 0.93]);
    vGlassQuad([x0 + len * 0.30, -hw * 0.87, x0 + len * 0.30, hw * 0.87,
                x0 + len * 0.19, hw * 0.96, x0 + len * 0.19, -hw * 0.96]);

    // крыша и боковые окна
    ctx.fillStyle = shade(base, 0.18);
    rr(xR0, -hw * 0.80, xR1 - xR0, hw * 1.60, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    ctx.fillRect(xR0 + 1.5, -hw * 0.96, xR1 - xR0 - 3, 2.3);
    ctx.fillRect(xR0 + 1.5, hw * 0.96 - 2.3, xR1 - xR0 - 3, 2.3);
    if (fine) {
      ctx.fillStyle = 'rgba(255,255,255,0.30)';       // хромированная окантовка
      ctx.fillRect(xR0 + 1.5, -hw * 0.96 + 2.3, xR1 - xR0 - 3, 0.5);
      ctx.fillRect(xR0 + 1.5, hw * 0.96 - 2.8, xR1 - xR0 - 3, 0.5);
      ctx.fillStyle = 'rgba(0,0,0,0.14)';             // люк
      rr(xR0 + (xR1 - xR0) * 0.22, -hw * 0.44, (xR1 - xR0) * 0.5, hw * 0.88, 2.5); ctx.fill();
    }

    vMirrors(xHood - 1, hw, base);

    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
    if (fine) { vPlate(x1 - 1.6, 0); }

    if (variant === 'taxi') {                        // шашечки и «шапка»
      ctx.fillStyle = '#20242e';
      for (i = 0; i < 6; i++) {
        var bx = x0 + len * 0.22 + i * len * 0.10;
        ctx.fillRect(bx, -hw + 0.8, len * 0.05, 2.2);
        ctx.fillRect(bx, hw - 3.0, len * 0.05, 2.2);
      }
      ctx.fillStyle = '#f5c542';
      rr(xR0 + (xR1 - xR0) * 0.22, -hw * 0.52, (xR1 - xR0) * 0.56, hw * 1.04, 2.5); ctx.fill();
      ctx.fillStyle = '#20242e';
      for (i = 0; i < 3; i++) {
        ctx.fillRect(xR0 + (xR1 - xR0) * (0.28 + i * 0.16), -hw * 0.40, (xR1 - xR0) * 0.08, hw * 0.80);
      }
    } else if (variant === 'police') {               // полосы и мигалка
      ctx.fillStyle = '#1e3a8a';
      ctx.fillRect(x0 + len * 0.06, -hw + 1.2, len * 0.60, 3);
      ctx.fillRect(x0 + len * 0.06, hw - 4.2, len * 0.60, 3);
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.fillRect(x0 + len * 0.06, -hw + 4.2, len * 0.60, 1.4);
      ctx.fillRect(x0 + len * 0.06, hw - 5.6, len * 0.60, 1.4);
      var on = Math.floor(G.t * 8) % 2 === 0;
      ctx.fillStyle = '#20242e';
      rr(xR0 + (xR1 - xR0) * 0.30, -hw * 0.66, (xR1 - xR0) * 0.40, hw * 1.32, 2); ctx.fill();
      ctx.fillStyle = on ? '#3b82f6' : '#5b6472';
      rr(xR0 + (xR1 - xR0) * 0.32, -hw * 0.60, (xR1 - xR0) * 0.17, hw * 1.20, 1.5); ctx.fill();
      ctx.fillStyle = on ? '#5b6472' : '#ef4444';
      rr(xR0 + (xR1 - xR0) * 0.52, -hw * 0.60, (xR1 - xR0) * 0.17, hw * 1.20, 1.5); ctx.fill();
      if (fine) {                                   // свечение над мигалкой
        var lg = ctx.createRadialGradient(xR0 + (xR1 - xR0) * 0.45, 0, 1, xR0 + (xR1 - xR0) * 0.45, 0, 18);
        lg.addColorStop(0, on ? 'rgba(90,160,255,0.35)' : 'rgba(255,80,80,0.35)');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = lg;
        ctx.beginPath(); ctx.arc(xR0 + (xR1 - xR0) * 0.45, 0, 18, 0, 6.2832); ctx.fill();
      }
    }
  }

  /* --- фургон --------------------------------------------------------------- */
  function drawVan(len, base) {
    var hw = CAR_W / 2 + 1, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 9, -hw + 0.5, 7.5);
    vWheel(x0 + 9, hw - 0.5, 7.5);
    vWheel(x1 - 11, -hw + 0.5, 7.5);
    vWheel(x1 - 11, hw - 0.5, 7.5);

    vBody(len, hw, base, 8);

    var xWind0 = x0 + len * 0.64, xWind1 = x0 + len * 0.80;
    // короткий капот
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(xWind1, -hw + 2, x1 - xWind1 - 2, hw * 2 - 4, 3); ctx.fill();
    if (fine) {
      ctx.fillStyle = 'rgba(20,24,32,0.5)';
      rr(x1 - 4, -hw * 0.5, 2.2, hw, 1); ctx.fill();
    }
    vGlassQuad([xWind1, -hw * 0.88, xWind1, hw * 0.88, xWind0, hw * 0.98, xWind0, -hw * 0.98]);

    // крыша фургона с рёбрами жёсткости и вентиляцией
    var xR0 = x0 + len * 0.12, xR1 = xWind0;
    ctx.fillStyle = shade(base, 0.20);
    rr(xR0, -hw * 0.86, xR1 - xR0, hw * 1.72, 5); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.16)'; ctx.lineWidth = 1; ctx.stroke();
    if (fine) {
      ctx.fillStyle = 'rgba(0,0,0,0.13)';
      for (i = 1; i <= 3; i++) {
        ctx.fillRect(xR0 + (xR1 - xR0) * (i / 4), -hw * 0.84, 1.6, hw * 1.68);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.45)';       // люк на крыше
      rr(xR0 + (xR1 - xR0) * 0.62, -hw * 0.26, (xR1 - xR0) * 0.18, hw * 0.52, 2); ctx.fill();
    }
    // боковые окна кабины и сдвижная дверь
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    ctx.fillRect(xWind0 + 1.5, -hw * 0.99, 3.5, 2.6);
    ctx.fillRect(xWind0 + 1.5, hw * 0.99 - 2.6, 3.5, 2.6);
    vSeam(x0 + len * 0.44, hw);
    vGlassQuad([x0 + len * 0.62, -hw * 0.95, x0 + len * 0.62, -hw * 0.55,
                x0 + len * 0.44, -hw * 0.55, x0 + len * 0.44, -hw * 0.95]);
    if (fine) { vHandles(x0 + len * 0.40, hw, 7); vHandles(x0 + len * 0.70, hw, 5); }

    vMirrors(xWind1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
    if (fine) {                                   // задние двери
      vSeam(x0 + len * 0.05, hw);
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x0 + len * 0.05 - 1.4, -hw + 2, 2.8, 3);
    }
  }

  /* --- спорткар ------------------------------------------------------------- */
  function drawSport(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 8, -hw + 0.5, 8);
    vWheel(x0 + 8, hw - 0.5, 8);
    vWheel(x1 - 11, -hw + 0.5, 8);
    vWheel(x1 - 11, hw - 0.5, 8);

    // низкий клин: нос сходится к острию
    var g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.40));
    g.addColorStop(0.30, shade(base, 0.10));
    g.addColorStop(0.62, base);
    g.addColorStop(1, shade(base, -0.48));
    ctx.beginPath();
    ctx.moveTo(x0, -hw);
    ctx.lineTo(x1 - 5, -hw * 0.92);
    ctx.quadraticCurveTo(x1 + 3, 0, x1 - 5, hw * 0.92);
    ctx.lineTo(x0, hw);
    ctx.closePath();
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(18,22,32,0.5)'; ctx.lineWidth = 1.1; ctx.stroke();

    // сплиттер и воздухозаборник
    ctx.fillStyle = 'rgba(16,18,24,0.85)';
    rr(x1 - 6, -hw * 0.86, 4, hw * 1.72, 1.5); ctx.fill();
    if (fine) {
      ctx.fillStyle = 'rgba(16,18,24,0.6)';
      rr(x1 - 14, -hw * 0.34, 5, hw * 0.68, 1.5); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.22)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x1 - 20, -hw * 0.5); ctx.lineTo(x1 - 12, -hw * 0.24); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 20, hw * 0.5); ctx.lineTo(x1 - 12, hw * 0.24); ctx.stroke();
    }
    // гоночная полоса
    ctx.fillStyle = 'rgba(255,255,255,0.72)';
    ctx.fillRect(x0 + 4, -3.2, len - 12, 2.2);
    ctx.fillRect(x0 + 4, 1.0, len - 12, 2.2);

    // фонарь кабины
    vGlassQuad([x0 + len * 0.62, -hw * 0.72, x0 + len * 0.62, hw * 0.72,
                x0 + len * 0.36, hw * 0.86, x0 + len * 0.36, -hw * 0.86]);
    ctx.fillStyle = shade(base, 0.22);
    rr(x0 + len * 0.24, -hw * 0.74, len * 0.12, hw * 1.48, 3); ctx.fill();

    // антикрыло с боковыми стойками
    ctx.fillStyle = '#232833';
    rr(x0 - 3, -hw * 1.06, 6, hw * 2.12, 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(x0 - 3, -hw * 1.02, 6, 1.6);
    ctx.fillStyle = shade(base, -0.25);
    ctx.fillRect(x0 + 1.5, -hw * 0.86, 3, 4);
    ctx.fillRect(x0 + 1.5, hw * 0.86 - 4, 3, 4);

    vMirrors(x0 + len * 0.60, hw, base);
    vHead(x1 - 4.5, hw, true);
    vTail(x0 + 0.6, hw);
    if (fine) {                                   // сдвоенный выхлоп
      ctx.fillStyle = '#2b3038';
      rr(x0 + 0.4, -hw * 0.42, 3.4, 3, 1.2); ctx.fill();
      rr(x0 + 0.4, hw * 0.42 - 3, 3.4, 3, 1.2); ctx.fill();
    }
  }

  /* --- пикап ---------------------------------------------------------------- */
  function drawPickup(len, base) {
    var hw = CAR_W / 2 + 1, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 11, -hw + 0.5, 8.5, true);
    vWheel(x0 + 11, hw - 0.5, 8.5, true);
    vWheel(x1 - 12, -hw + 0.5, 8.5, true);
    vWheel(x1 - 12, hw - 0.5, 8.5, true);

    vBody(len, hw, base, 7);

    var xCab0 = x0 + len * 0.46, xCab1 = x0 + len * 0.80;
    // открытый кузов: тёмный пол и рёбра
    ctx.fillStyle = '#4a3627';
    rr(x0 + 2.5, -hw + 3, xCab0 - x0 - 3.5, hw * 2 - 6, 2.5); ctx.fill();
    if (fine) {
      ctx.strokeStyle = 'rgba(255,255,255,0.16)'; ctx.lineWidth = 1.2;
      for (i = 1; i <= 3; i++) {
        var rx2 = x0 + 2.5 + (xCab0 - x0 - 3.5) * (i / 4);
        ctx.beginPath(); ctx.moveTo(rx2, -hw + 3.5); ctx.lineTo(rx2, hw - 3.5); ctx.stroke();
      }
      ctx.fillStyle = 'rgba(255,255,255,0.22)';       // борта кузова
      ctx.fillRect(x0 + 2.5, -hw + 3.2, xCab0 - x0 - 3.5, 1.4);
      ctx.fillRect(x0 + 2.5, hw - 4.6, xCab0 - x0 - 3.5, 1.4);
    }
    // кабина
    ctx.fillStyle = shade(base, 0.20);
    rr(xCab0, -hw + 1.5, xCab1 - xCab0, hw * 2 - 3, 4); ctx.fill();
    vGlassQuad([xCab1, -hw * 0.86, xCab1, hw * 0.86, xCab0 + (xCab1 - xCab0) * 0.45, hw * 0.94, xCab0 + (xCab1 - xCab0) * 0.45, -hw * 0.94]);
    ctx.fillStyle = 'rgba(30,40,55,0.85)';
    ctx.fillRect(xCab0 + 2, -hw * 0.97, xCab1 - xCab0 - 6, 2.4);
    ctx.fillRect(xCab0 + 2, hw * 0.97 - 2.4, xCab1 - xCab0 - 6, 2.4);
    // капот и решётка
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(xCab1, -hw + 2, x1 - xCab1 - 2, hw * 2 - 4, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,24,32,0.6)';
    rr(x1 - 4.5, -hw * 0.62, 3, hw * 1.24, 1); ctx.fill();
    if (fine) {                                     // дуга за кабиной
      ctx.strokeStyle = '#c9ced8'; ctx.lineWidth = 2.4;
      ctx.beginPath(); ctx.arc(xCab1 - 2, 0, hw * 0.92, -Math.PI * 0.5, Math.PI * 0.5); ctx.stroke();
      vHandles(xCab0 + 6, hw, 5);
    }
    vSeam(xCab0, hw);
    vMirrors(xCab1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- скорая помощь -------------------------------------------------------- */
  function drawAmbulance(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 10, -hw + 0.5, 8);
    vWheel(x0 + 10, hw - 0.5, 8);
    vWheel(x1 - 12, -hw + 0.5, 8);
    vWheel(x1 - 12, hw - 0.5, 8);

    vBody(len, hw, base, 8);

    var xBox1 = x0 + len * 0.70, xWind0 = x0 + len * 0.74, xWind1 = x0 + len * 0.90;
    // кузов с рёбрами
    ctx.fillStyle = shade(base, 0.18);
    rr(x0 + 1.5, -hw * 0.88, xBox1 - x0 - 3, hw * 1.76, 4); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
    if (fine) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (i = 1; i <= 3; i++) { ctx.fillRect(x0 + 4 + (xBox1 - x0 - 8) * (i / 4), -hw * 0.86, 1.5, hw * 1.72); }
    }
    // кабина и лобовое
    vGlassQuad([xWind1, -hw * 0.86, xWind1, hw * 0.86, xWind0, hw * 0.96, xWind0, -hw * 0.96]);
    ctx.fillStyle = 'rgba(30,40,55,0.8)';
    ctx.fillRect(xWind0 + 1.2, -hw * 0.99, 3.6, 2.6);
    ctx.fillRect(xWind0 + 1.2, hw * 0.99 - 2.6, 3.6, 2.6);

    // красная полоса и крест на обоих бортах
    ctx.fillStyle = '#e03b30';
    ctx.fillRect(x0 + 1, -hw + 1.4, len * 0.70, 3.4);
    ctx.fillRect(x0 + 1, hw - 4.8, len * 0.70, 3.4);
    if (fine) {
      for (i = 0; i < 2; i++) {
        var cy = i === 0 ? -hw * 0.42 : hw * 0.42;
        ctx.fillStyle = '#e03b30';
        ctx.fillRect(x0 + len * 0.30 - 1.8, cy - 3.4, 3.6, 6.8);
        ctx.fillRect(x0 + len * 0.30 - 5.2, cy - 1.2, 10.4, 2.4);
      }
    }
    // проблесковая мигалка на крыше кабины
    var bl = Math.floor(G.t * 9) % 3;
    ctx.fillStyle = '#20242e';
    rr(xWind0 - 2, -hw * 0.62, 8, hw * 1.24, 2); ctx.fill();
    ctx.fillStyle = bl === 0 ? '#ef4444' : '#6b7280';
    rr(xWind0 - 1.5, -hw * 0.58, 3.4, hw * 1.16, 1.4); ctx.fill();
    ctx.fillStyle = bl === 1 ? '#3b82f6' : '#6b7280';
    rr(xWind0 + 2.5, -hw * 0.58, 3.4, hw * 1.16, 1.4); ctx.fill();
    if (fine) {
      var ag = ctx.createRadialGradient(xWind0 + 2, 0, 1, xWind0 + 2, 0, 20);
      ag.addColorStop(0, bl === 0 ? 'rgba(255,70,70,0.34)' : (bl === 1 ? 'rgba(80,150,255,0.34)' : 'rgba(0,0,0,0)'));
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag;
      ctx.beginPath(); ctx.arc(xWind0 + 2, 0, 20, 0, 6.2832); ctx.fill();
      vSeam(x0 + len * 0.06, hw);                    // задние створки
      vHandles(xWind0 - 12, hw, 6);
    }
    vMirrors(xWind1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- грузовик ------------------------------------------------------------- */
  function drawTruck(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i;
    var xCab0 = x1 - TS * 1.12;
    // колёса тягача и прицепа
    vWheel(xCab0 + 6, -hw + 0.5, 8, true);
    vWheel(xCab0 + 6, hw - 0.5, 8, true);
    vWheel(xCab0 - 4, -hw + 0.5, 8, true);
    vWheel(xCab0 - 4, hw - 0.5, 8, true);
    vWheel(x0 + 14, -hw + 0.5, 8, true);
    vWheel(x0 + 14, hw - 0.5, 8, true);
    vWheel(x0 + 7, -hw + 0.5, 8, true);
    vWheel(x0 + 7, hw - 0.5, 8, true);

    var xBox1 = xCab0 - TS * 0.22;
    // прицеп: рёбра, юбка, задние двери
    var bg = ctx.createLinearGradient(0, -hw, 0, hw);
    bg.addColorStop(0, '#e9edf4');
    bg.addColorStop(0.35, '#cfd6e1');
    bg.addColorStop(1, '#9aa3b1');
    rr(x0, -hw, xBox1 - x0, hw * 2, 4);
    ctx.fillStyle = bg; ctx.fill();
    ctx.strokeStyle = 'rgba(18,22,32,0.45)'; ctx.lineWidth = 1.1; ctx.stroke();
    if (fine) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (i = 1; i <= 5; i++) { ctx.fillRect(x0 + (xBox1 - x0) * (i / 6), -hw + 1.5, 1.6, hw * 2 - 3); }
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x0 + 2, -hw + 2.4, xBox1 - x0 - 4, 1.6);
      ctx.fillStyle = '#8d99ae';                     // юбка
      rr(x0 + 3, -hw + 1, xBox1 - x0 - 6, hw * 2 - 2, 3); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      rr(x0 + 6, -hw * 0.72, xBox1 - x0 - 12, hw * 1.44, 3); ctx.fill();
      ctx.fillStyle = 'rgba(255,220,120,0.75)';      // боковые габариты
      for (i = 0; i < 3; i++) {
        var lx = x0 + (xBox1 - x0) * (0.2 + i * 0.3);
        ctx.fillRect(lx, -hw - 0.4, 3, 1.6);
        ctx.fillRect(lx, hw - 1.2, 3, 1.6);
      }
      vSeam(x0 + (xBox1 - x0) * 0.5, hw, -hw + 2, hw - 2);
    }
    // кабина
    ctx.save();
    ctx.translate(xCab0 + (x1 - xCab0) / 2, 0);
    var chw = CAR_W / 2, clen = x1 - xCab0;
    vBody(clen, chw, base, 6);
    vGlassQuad([clen * 0.32, -chw * 0.86, clen * 0.32, chw * 0.86, -clen * 0.5, chw * 0.96, -clen * 0.5, -chw * 0.96]);
    ctx.fillStyle = 'rgba(30,40,55,0.8)';
    ctx.fillRect(-clen * 0.44, -chw * 0.98, clen * 0.24, 2.4);
    ctx.fillRect(-clen * 0.44, chw * 0.98 - 2.4, clen * 0.24, 2.4);
    ctx.fillStyle = shade(base, 0.2);
    rr(-clen * 0.18, -chw * 0.80, clen * 0.5, chw * 1.6, 3); ctx.fill();
    ctx.fillStyle = 'rgba(20,24,32,0.6)';
    rr(clen * 0.40, -chw * 0.66, 2.6, chw * 1.32, 1); ctx.fill();
    // труба за кабиной
    if (fine) {
      ctx.fillStyle = '#6b7280';
      rr(-clen * 0.5 - 1.5, -chw * 1.16, 4, 3, 1); ctx.fill();
    }
    ctx.restore();
    vMirrors(xCab0 + (x1 - xCab0) * 0.30, CAR_W / 2, base);
    vHead(x1 - 2.5, CAR_W / 2, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- автобус -------------------------------------------------------------- */
  function drawBus(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 13, -hw + 0.5, 9, true);
    vWheel(x0 + 13, hw - 0.5, 9, true);
    vWheel(x1 - 16, -hw + 0.5, 9, true);
    vWheel(x1 - 16, hw - 0.5, 9, true);

    vBody(len, hw, base, 10);

    // огромное лобовое и маршрутный указатель
    vGlassQuad([x1 - 3, -hw * 0.90, x1 - 3, hw * 0.90, x0 + len * 0.80, hw * 0.98, x0 + len * 0.80, -hw * 0.98]);
    ctx.fillStyle = 'rgba(16,20,28,0.85)';
    rr(x1 - 9, -hw * 0.52, 4, hw * 1.04, 1.5); ctx.fill();
    ctx.fillStyle = 'rgba(255,214,102,0.85)';
    ctx.fillRect(x1 - 8.2, -hw * 0.14, 2.4, hw * 0.28);

    // крыша с люками и рёбрами
    var xR0 = x0 + len * 0.06, xR1 = x0 + len * 0.78;
    ctx.fillStyle = shade(base, 0.22);
    rr(xR0, -hw * 0.88, xR1 - xR0, hw * 1.76, 6); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.15)'; ctx.lineWidth = 1; ctx.stroke();
    if (fine) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (i = 1; i <= 5; i++) { ctx.fillRect(xR0 + (xR1 - xR0) * (i / 6), -hw * 0.86, 1.5, hw * 1.72); }
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      rr(xR0 + (xR1 - xR0) * 0.18, -hw * 0.24, (xR1 - xR0) * 0.16, hw * 0.48, 2); ctx.fill();
      rr(xR0 + (xR1 - xR0) * 0.66, -hw * 0.24, (xR1 - xR0) * 0.16, hw * 0.48, 2); ctx.fill();
    }
    // ряд боковых окон
    ctx.fillStyle = 'rgba(30,40,55,0.88)';
    for (i = 0; i < 5; i++) {
      var wx = x0 + len * 0.12 + i * len * 0.13, ww = len * 0.10;
      ctx.fillRect(wx, -hw * 0.995, ww, 2.8);
      ctx.fillRect(wx, hw * 0.995 - 2.8, ww, 2.8);
    }
    if (fine) {
      ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (i = 0; i < 5; i++) {
        var wx2 = x0 + len * 0.12 + i * len * 0.13, ww2 = len * 0.10;
        ctx.fillRect(wx2, -hw * 0.995 + 2.9, ww2, 0.5);
        ctx.fillRect(wx2, hw * 0.995 - 3.4, ww2, 0.5);
      }
      // передняя дверь
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(x0 + len * 0.72, -hw * 0.995, 1.6, 3);
      ctx.fillRect(x0 + len * 0.72, hw * 0.995 - 3, 1.6, 3);
      vSeam(x0 + len * 0.70, hw);
    }
    // заднее стекло
    vGlassQuad([x0 + len * 0.10, -hw * 0.82, x0 + len * 0.10, hw * 0.82,
                x0 + len * 0.04, hw * 0.90, x0 + len * 0.04, -hw * 0.90]);

    vMirrors(x1 - 12, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- трактор -------------------------------------------------------------- */
  function drawTractor(len, base) {
    var hw = CAR_W / 2, x0 = -len / 2, x1 = len / 2;
    // огромные задние колёса и маленькие передние
    vWheel(x0 + 5, -hw - 1.5, 13, true);
    vWheel(x0 + 5, hw + 1.5, 13, true);
    vWheel(x1 - 9, -hw + 1, 7, true);
    vWheel(x1 - 9, hw - 1, 7, true);
    // крылья над задними колёсами
    ctx.fillStyle = '#f2c94c';
    rr(x0 - 3, -hw - 5.5, 15, 5, 2); ctx.fill();
    rr(x0 - 3, hw + 0.5, 15, 5, 2); ctx.fill();

    // капот с решёткой
    var g = ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.34));
    g.addColorStop(0.4, base);
    g.addColorStop(1, shade(base, -0.40));
    rr(x0 - 1, -hw + 1, len * 0.62, hw * 2 - 2, 6);
    ctx.fillStyle = g; ctx.fill();
    ctx.strokeStyle = 'rgba(18,22,32,0.5)'; ctx.lineWidth = 1.1; ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(x0 + 1, -hw + 3, len * 0.58, hw * 0.5, 3); ctx.fill();
    if (fine) {
      ctx.fillStyle = 'rgba(20,24,32,0.55)';        // решётка радиатора
      rr(x1 - 8, -hw * 0.66, 3.4, hw * 1.32, 1);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      ctx.fillRect(x1 - 7.2, -hw * 0.6, 1.8, hw * 1.2);
    }
    // кабина с дугой безопасности
    ctx.fillStyle = '#39404f';
    rr(x0 + len * 0.44, -hw * 0.92, len * 0.26, hw * 1.84, 4); ctx.fill();
    vGlassQuad([x0 + len * 0.68, -hw * 0.80, x0 + len * 0.68, hw * 0.80,
                x0 + len * 0.46, hw * 0.88, x0 + len * 0.46, -hw * 0.88]);
    ctx.strokeStyle = '#f2c94c'; ctx.lineWidth = 2.4;
    ctx.beginPath(); ctx.arc(x0 + len * 0.44, 0, hw * 0.96, -Math.PI * 0.52, Math.PI * 0.52); ctx.stroke();
    // выхлопная труба с теплозащитой
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.beginPath(); ctx.arc(x1 - 12, -hw * 1.05, 4.6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#5a6472';
    ctx.beginPath(); ctx.arc(x1 - 12, -hw * 1.05, 2.8, 0, 6.2832); ctx.fill();
    if (fine) {
      ctx.fillStyle = '#20242e';
      ctx.beginPath(); ctx.arc(x1 - 12, -hw * 1.05, 1.4, 0, 6.2832); ctx.fill();
      // фара и сцепка
      ctx.fillStyle = '#fff3c4';
      ctx.beginPath(); ctx.arc(x1 - 3, -hw * 0.5, 2.6, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#4a5266';
      rr(x0 - 5, -3, 4, 6, 1.5); ctx.fill();
    }
  }

  /* --- мотоцикл ------------------------------------------------------------- */
  function drawMoto(len, base) {
    var hw = TS * 0.20, x0 = -len / 2, x1 = len / 2;
    // лёгкий наклон в повороте — мотоцикл не едет строго прямо
    ctx.rotate(Math.sin(G.t * 3 + base.length) * 0.05);

    vWheel(x0 + 4, 0, 6.5);
    vWheel(x1 - 4, 0, 6.5);
    if (fine) {                                    // спицы
      ctx.strokeStyle = 'rgba(210,220,235,0.5)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 + 4, -3.4); ctx.lineTo(x0 + 4, 3.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 4, -3.4); ctx.lineTo(x1 - 4, 3.4); ctx.stroke();
    }
    // рама, бак, седло, задний обтекатель
    ctx.fillStyle = '#20242e';
    rr(x0 + 2, -hw * 0.42, len - 4, hw * 0.84, 3); ctx.fill();
    var tg = ctx.createLinearGradient(0, -hw, 0, hw);
    tg.addColorStop(0, shade(base, 0.42));
    tg.addColorStop(0.45, base);
    tg.addColorStop(1, shade(base, -0.42));
    rr(x1 - len * 0.52, -hw, len * 0.34, hw * 2, 4);
    ctx.fillStyle = tg; ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.22)';
    ctx.fillRect(x1 - len * 0.50, -hw * 0.72, len * 0.28, 1.6);
    ctx.fillStyle = '#161a22';                     // седло
    rr(x0 + len * 0.10, -hw * 0.86, len * 0.34, hw * 1.72, 3); ctx.fill();
    ctx.fillStyle = shade(base, -0.1);             // задний обтекатель
    rr(x0 + 1, -hw * 0.66, len * 0.18, hw * 1.32, 3); ctx.fill();
    // выхлоп вдоль борта
    ctx.fillStyle = '#b9c1cd';
    rr(x0 + 4, hw * 0.7, len * 0.55, 2.2, 1); ctx.fill();
    // руль и вилка
    ctx.fillStyle = '#c9ced8';
    rr(x1 - len * 0.20, -hw * 1.8, 3, hw * 3.6, 1.4); ctx.fill();
    ctx.fillStyle = '#8f98a6';
    ctx.fillRect(x1 - len * 0.20, -hw * 1.5, len * 0.16, 2);
    ctx.fillRect(x1 - len * 0.20, hw * 1.5 - 2, len * 0.16, 2);
    // гонщик: корпус, руки, шлем с визором
    ctx.fillStyle = shade(base, -0.25);
    ctx.beginPath(); ctx.ellipse(-len * 0.02, 0, hw * 1.5, hw * 1.35, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#2b3240';
    ctx.fillRect(-len * 0.02, -hw * 2.1, hw * 1.2, hw * 4.2);
    ctx.fillStyle = '#f2f5fa';
    ctx.beginPath(); ctx.arc(len * 0.04, 0, hw * 1.55, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(18,24,38,0.9)';
    ctx.beginPath();
    ctx.arc(len * 0.04 + hw * 0.35, 0, hw * 1.3, -1.25, 1.25);
    ctx.lineTo(len * 0.04 + hw * 0.35, 0);
    ctx.closePath(); ctx.fill();
    if (fine) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      ctx.fillRect(len * 0.04 - hw * 1.2, -hw * 0.5, hw * 0.9, 1.2);
    }
    // фара и стоп
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(x1 - 2, 0, 2.6, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#e8352a';
    ctx.beginPath(); ctx.arc(x0 + 2, 0, 2, 0, 6.2832); ctx.fill();
  }

  /* --- диспетчер моделей ---------------------------------------------------- */
  function drawVehicle(x, y, kind, dir, color, ph) {
    var spec = KIND[kind] || KIND.car;
    var len = spec.len * TS;
    var base = color || '#e05a47';
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(dir, 1);

    if (kind === 'moto') {
      vShadowBox(len + 6, TS * 0.30);
      drawMoto(len, base);
    } else if (kind === 'tractor') {
      vShadowBox(len + 4, CAR_W + 8);
      drawTractor(len, base);
    } else if (kind === 'bus') {
      vShadowBox(len, CAR_W + 4);
      drawBus(len, base);
    } else if (kind === 'truck') {
      vShadowBox(len, CAR_W + 4);
      drawTruck(len, base);
    } else if (kind === 'ambulance') {
      vShadowBox(len, CAR_W + 2);
      drawAmbulance(len, base);
    } else if (kind === 'pickup') {
      vShadowBox(len, CAR_W + 2);
      drawPickup(len, base);
    } else if (kind === 'sport') {
      vShadowBox(len, CAR_W + 3);
      drawSport(len, base);
    } else if (kind === 'van') {
      vShadowBox(len, CAR_W + 2);
      drawVan(len, base);
    } else {
      vShadowBox(len, CAR_W);
      drawSedan(len, base, kind);
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
  // Модель одна, а скинов много: палитра и украшения приходят из таблицы SKINS.
  // Чтобы те же спрайты можно было рисовать в маленькие превью на экране
  // магазина, контекст рисования на время подменяется.
  function withCtx(g, fn) {
    var prev = ctx;
    ctx = g;
    try { fn(); } finally { ctx = prev; }
  }
  function skinOf(id) { return SKIN_BY_ID[id] || SKINS[0]; }
  // «Радуга» пересчитывает палитру каждый кадр, остальные скины статичны
  function skinColors(sk, t) {
    if (sk.body) { return sk; }
    var h = (t * 70) % 360;
    return {
      size: sk.size, extra: sk.extra, comb: sk.comb, beak: sk.beak, legs: sk.legs,
      eye: sk.eye, line: sk.line,
      body: ['hsl(' + h + ',88%,74%)', 'hsl(' + ((h + 60) % 360) + ',88%,60%)', 'hsl(' + ((h + 120) % 360) + ',82%,48%)'],
      wing: 'hsl(' + ((h + 180) % 360) + ',85%,66%)',
      tail: ['hsl(' + ((h + 240) % 360) + ',88%,76%)', 'hsl(' + ((h + 300) % 360) + ',82%,60%)']
    };
  }

  function drawChicken(x, y, hopT, facing, dead, t) {
    var sk = skinColors(skinOf(G.skin), t);
    var body = sk.body[0], bodyMid = sk.body[1], bodyDark = sk.body[2];
    var airborne = hopT !== null;
    var arc = airborne ? Math.sin(Math.PI * hopT) : 0;
    var lift = arc * 20;
    var sq = 1 + arc * 0.13;                       // squash & stretch
    var breathe = airborne ? 0 : Math.sin(t * 3.4) * 0.02;

    shadow(x, y + 12 - lift * 0.15, 15 * (1 + arc * 0.25), 6.5 * (1 + arc * 0.2), 0.26 - arc * 0.10);
    if (dead) { return; }

    ctx.save();
    ctx.translate(x, y - lift);
    ctx.scale(sk.size || 1, sk.size || 1);         // цыплёнок меньше остальных
    ctx.scale(1 - breathe, 1 + breathe);
    ctx.scale(1 / sq, sq);
    var ang = facing === 'up' ? 0 : facing === 'right' ? Math.PI / 2 : facing === 'down' ? Math.PI : -Math.PI / 2;
    ctx.rotate(ang);

    var flap = airborne ? Math.sin(hopT * Math.PI * 2) * 0.35 : Math.sin(t * 6) * 0.06;

    // лапки (прячутся в прыжке)
    if (!airborne) {
      ctx.strokeStyle = sk.legs; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-5, 13); ctx.lineTo(-6, 20); ctx.lineTo(-10, 21); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(5, 13); ctx.lineTo(6, 20); ctx.lineTo(10, 21); ctx.stroke();
    }
    // хвост
    ctx.fillStyle = sk.tail[0];
    ctx.beginPath(); ctx.ellipse(0, 16, 11, 7, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = sk.tail[1];
    ctx.beginPath(); ctx.ellipse(-5, 19, 5, 6, -0.5, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.ellipse(5, 19, 5, 6, 0.5, 0, 6.2832); ctx.fill();

    // крылья
    ctx.save();
    ctx.translate(-12, 2); ctx.rotate(-flap);
    ctx.fillStyle = sk.wing;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 12, 0.15, 0, 6.2832); ctx.fill();
    ctx.restore();
    ctx.save();
    ctx.translate(12, 2); ctx.rotate(flap);
    ctx.fillStyle = sk.wing;
    ctx.beginPath(); ctx.ellipse(0, 0, 7, 12, -0.15, 0, 6.2832); ctx.fill();
    ctx.restore();

    // тело
    var bg = ctx.createLinearGradient(-10, -12, 10, 14);
    bg.addColorStop(0, body); bg.addColorStop(0.6, bodyMid); bg.addColorStop(1, bodyDark);
    ctx.fillStyle = bg;
    ctx.beginPath(); ctx.ellipse(0, 1, 14, 16, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = sk.line; ctx.lineWidth = 1.2; ctx.stroke();

    // голова
    ctx.fillStyle = body;
    ctx.beginPath(); ctx.arc(0, -14, 9.5, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = sk.line; ctx.stroke();

    // гребешок
    ctx.fillStyle = sk.comb;
    ctx.beginPath(); ctx.arc(-3.4, -21.5, 3.2, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(1.6, -22.5, 3.4, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(6, -20, 2.8, 0, 6.2832); ctx.fill();

    // клюв
    ctx.fillStyle = sk.beak;
    ctx.beginPath();
    ctx.moveTo(-3.6, -22.5); ctx.lineTo(3.6, -22.5); ctx.lineTo(0, -29.5);
    ctx.closePath(); ctx.fill();

    // глаза
    ctx.fillStyle = sk.eye;
    ctx.beginPath(); ctx.arc(-4.6, -15.5, 1.7, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(4.6, -15.5, 1.7, 0, 6.2832); ctx.fill();
    ctx.fillStyle = sk.eye === '#ffffff' ? 'rgba(32,36,46,0.8)' : 'rgba(255,255,255,0.85)';
    ctx.beginPath(); ctx.arc(-5.1, -16.1, 0.6, 0, 6.2832); ctx.fill();
    ctx.beginPath(); ctx.arc(4.1, -16.1, 0.6, 0, 6.2832); ctx.fill();

    // украшения скина (рисуются поверх и вращаются вместе с курицей)
    if (sk.extra) { drawSkinExtra(sk, t, airborne); }

    ctx.restore();

    // щит неуязвимости
    if (G.invuln > 0) {
      ctx.strokeStyle = 'rgba(255,230,128,' + (0.35 + 0.35 * Math.sin(t * 14)) + ')';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(x, y - 2, 24 * (sk.size || 1), 0, 6.2832); ctx.stroke();
    }
  }

  // Украшения скинов: шляпы, швы, визоры, блики — всё тоже кодом
  function drawSkinExtra(sk, t, airborne) {
    var i, a;
    if (sk.extra === 'fluff') {                     // цыплёнок: пух и хохолок
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (i = 0; i < 7; i++) {
        a = (i / 7) * 6.2832 + t * 0.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 15, 2 + Math.sin(a) * 17, 3.6 + Math.sin(t * 5 + i) * 0.5, 0, 6.2832);
        ctx.fill();
      }
      ctx.fillStyle = sk.comb;
      ctx.beginPath(); ctx.arc(0, -25.5, 3.2, 0, 6.2832); ctx.fill();
      return;
    }
    if (sk.extra === 'bandit') {                    // разбойник: бандана и повязка
      ctx.fillStyle = '#2b3140';
      rr(-11, -19.5, 22, 7, 2.5); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-10, -18); ctx.lineTo(-19, -22 + Math.sin(t * 4) * 1.6); ctx.lineTo(-17, -13);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.9)';
      ctx.beginPath(); ctx.arc(-4.6, -15.5, 3.4, 0, 6.2832); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,0.9)'; ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(-8, -16.6); ctx.lineTo(9, -18.4); ctx.stroke();
      return;
    }
    if (sk.extra === 'ninja') {                     // ниндзя: лента с развевающимися концами
      ctx.fillStyle = '#e8453c';
      rr(-11, -19.5, 22, 6.5, 2.5); ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9, -18);
      ctx.lineTo(-20 - Math.sin(t * 5) * 2, -23 + Math.sin(t * 6) * 3);
      ctx.lineTo(-19, -16 + Math.cos(t * 5) * 2.5);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.25)';
      rr(-11, -19.5, 22, 2, 1); ctx.fill();
      return;
    }
    if (sk.extra === 'zombie') {                    // зомби: швы и заплатка
      ctx.strokeStyle = 'rgba(40,60,20,0.75)'; ctx.lineWidth = 1.4;
      for (i = -1; i <= 1; i++) {
        ctx.beginPath();
        ctx.moveTo(-9, 4 + i * 7);
        ctx.lineTo(9, 3 + i * 7);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(90,110,60,0.85)';
      rr(4, -4, 9, 8, 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.beginPath(); ctx.arc(-6, -2, 4, 0, 6.2832); ctx.fill();
      return;
    }
    if (sk.extra === 'robot') {                     // робот: визор, антенна, заклёпки
      ctx.fillStyle = '#1f2937';
      rr(-8, -18, 16, 5.5, 2.5); ctx.fill();
      ctx.fillStyle = 'rgba(80,230,255,' + (0.55 + 0.45 * Math.sin(t * 9)) + ')';
      rr(-6.5, -17, 6, 3, 1.4); ctx.fill();
      rr(0.5, -17, 6, 3, 1.4); ctx.fill();
      ctx.strokeStyle = '#9aa6b6'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(2, -23); ctx.lineTo(5, -30); ctx.stroke();
      ctx.fillStyle = (Math.floor(t * 4) % 2) ? '#ff3b30' : '#5c1f1c';
      ctx.beginPath(); ctx.arc(5.4, -30.6, 2.2, 0, 6.2832); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (i = 0; i < 4; i++) {
        ctx.beginPath(); ctx.arc(-9 + i * 6, 12, 1.3, 0, 6.2832); ctx.fill();
      }
      return;
    }
    if (sk.extra === 'gold') {                      // золотая: бегущий блик и искры
      ctx.save();
      ctx.globalAlpha = 0.5;
      ctx.beginPath(); ctx.ellipse(0, 1, 14, 16, 0, 0, 6.2832); ctx.clip();
      var sx = -20 + ((t * 26) % 40);
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.save(); ctx.rotate(0.5);
      ctx.fillRect(sx, -22, 5, 46);
      ctx.restore();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,245,190,0.95)';
      for (i = 0; i < 3; i++) {
        var ph = t * 2.4 + i * 2.1;
        var px = Math.cos(ph) * 18, py = Math.sin(ph * 1.3) * 16 - 2;
        var sz = 2.6 + Math.abs(Math.sin(ph * 2)) * 2.4;
        ctx.save(); ctx.translate(px, py); ctx.rotate(ph);
        ctx.fillRect(-sz / 2, -0.8, sz, 1.6);
        ctx.fillRect(-0.8, -sz / 2, 1.6, sz);
        ctx.restore();
      }
      return;
    }
    if (sk.extra === 'rainbow') {                   // радуга: светящийся контур и искры
      ctx.strokeStyle = 'hsla(' + ((t * 140) % 360) + ',90%,75%,0.85)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.ellipse(0, 1, 14.5, 16.5, 0, 0, 6.2832); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (i = 0; i < 4; i++) {
        a = t * 3 + i * 1.6;
        ctx.beginPath();
        ctx.arc(Math.cos(a) * 17, Math.sin(a) * 18 - 1, 1.8 + Math.abs(Math.sin(a * 2)) * 1.4, 0, 6.2832);
        ctx.fill();
      }
      return;
    }
  }

  // Превью скина для магазина: тот же спрайт в отдельном маленьком контексте
  function drawSkinPreview(g, skinId, size) {
    var keepSkin = G.skin, keepInv = G.invuln;
    G.skin = skinId; G.invuln = 0;
    withCtx(g, function () {
      g.save();
      g.translate(size / 2, size * 0.56);
      g.scale(size / 78, size / 78);
      drawChicken(0, 0, null, 'up', false, G.t + skinId.length * 0.7);
      g.restore();
    });
    G.skin = keepSkin; G.invuln = keepInv;
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
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (el.ovSkins && el.ovSkins.classList.contains('on')) { closeSkins(); return; }
      togglePause();
      return;
    }
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
    ovMenu: $('ovMenu'), ovOver: $('ovOver'), ovPause: $('ovPause'), ovLoading: $('ovLoading'), ovSkins: $('ovSkins'),
    oScore: $('oScore'), oBest: $('oBest'), oRecord: $('oRecord'), oReason: $('tReason'),
    mBest: $('mBest'), mCoins: $('mCoins'),
    btnPlay: $('btnPlay'), btnRestart: $('btnRestart'), btnRevive: $('btnRevive'),
    btnResume: $('btnResume'), btnRestart2: $('btnRestart2'),
    btnMute: $('btnMute'), btnPause: $('btnPause'),
    btnPauseSound: $('btnPauseSound'), icPauseSound: $('icPauseSound'),
    btnPauseSkins: $('btnPauseSkins'), btnToMenu: $('btnToMenu'), btnMenuSkins: $('btnMenuSkins'),
    btnSkinsClose: $('btnSkinsClose'), skinsGrid: $('skinsGrid'), skCoins: $('skCoins'),
    skinsHint: $('tSkinsHint'), diffHint: $('tDiffHint'),
    pScore: $('pScore'), pCoins: $('pCoins'), pDiff: $('pDiff'),
    hint: $('hintEagle')
  };
  var lastHUD = { score: -1, best: -1, coins: -1 };

  function syncHUD(force) {
    if (force || G.score !== lastHUD.score) { if (el.score) { el.score.textContent = String(G.score); } lastHUD.score = G.score; }
    var best = bestFor();
    if (force || best !== lastHUD.best) { if (el.best) { el.best.textContent = String(best); } lastHUD.best = best; }
    var shown = G.state === 'playing' ? G.coins : G.totalCoins;
    if (force || shown !== lastHUD.coins) { if (el.coins) { el.coins.textContent = String(shown); } lastHUD.coins = shown; }
  }

  function showOnly(which) {
    var list = [el.ovMenu, el.ovOver, el.ovPause, el.ovLoading, el.ovSkins];
    for (var i = 0; i < list.length; i++) {
      if (!list[i]) { continue; }
      list[i].classList.toggle('on', list[i].id === which);
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
    if (el.icPauseSound) { el.icPauseSound.textContent = G.muted ? '🔇' : '🔊'; }
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

  /* --- сложность ------------------------------------------------------------ */
  function diffKey(id, suffix) {
    return 'diff' + id.charAt(0).toUpperCase() + id.slice(1) + (suffix || '');
  }
  function setDiff(id, silent) {
    if (!DIFFS[id]) { id = 'normal'; }
    var changed = G.diffId !== id;
    G.diffId = id;
    G.best = Math.max(G.best, bestFor());
    lastHUD.best = -1;
    var btns = document.querySelectorAll ? document.querySelectorAll('#segDiff .segbtn') : [];
    for (var i = 0; i < btns.length; i++) {
      var id2 = btns[i].getAttribute ? btns[i].getAttribute('data-diff') : null;
      btns[i].classList.toggle('on', id2 === id);
    }
    if (el.diffHint) { el.diffHint.textContent = Pl.t(diffKey(id, 'Hint')); }
    if (el.pDiff) { el.pDiff.textContent = Pl.t(diffKey(id)); }
    UI.refreshRecord();
    if (!silent) { saveProfile(); }
    return changed;
  }

  /* --- скины: карточки магазина -------------------------------------------- */
  var skinCards = [];
  var skinsFrom = 'menu';       // куда возвращает «Назад»
  var lastPreviewAt = -1;
  var hintBackTimer = null;

  function ownsSkin(id) { return G.skins.indexOf(id) >= 0; }

  function makeSkinCard(sk) {
    var node = document.createElement('button');
    node.className = 'skincard';
    node.type = 'button';
    var cv = document.createElement('canvas');
    var px = Math.round(64 * Math.min(window.devicePixelRatio || 1, 2));
    cv.width = px; cv.height = px;
    if (cv.style) { cv.style.width = '64px'; cv.style.height = '64px'; }
    var name = document.createElement('span');
    name.className = 'skc-name';
    name.textContent = Pl.t('sk_' + sk.id);
    var tag = document.createElement('span');
    tag.className = 'skc-tag';
    var badge = document.createElement('span');
    badge.className = 'skc-badge';
    node.appendChild(cv); node.appendChild(name); node.appendChild(tag); node.appendChild(badge);
    node.addEventListener('click', function () { pickSkin(sk.id); });
    if (el.skinsGrid) { el.skinsGrid.appendChild(node); }
    skinCards.push({ id: sk.id, node: node, canvas: cv, tag: tag, badge: badge, name: name });
  }
  function buildSkinCards() {
    if (skinCards.length || !el.skinsGrid) { return; }
    for (var i = 0; i < SKINS.length; i++) { makeSkinCard(SKINS[i]); }
  }
  // превью перерисовываются на лету — «радуга» и «золотая» анимированы
  function drawSkinPreviews() {
    for (var i = 0; i < skinCards.length; i++) {
      var c = skinCards[i];
      if (!c.canvas || !c.canvas.getContext) { continue; }
      var g = c.canvas.getContext('2d');
      var dpr = (c.canvas.width || 64) / 64;
      if (g.setTransform) { g.setTransform(dpr, 0, 0, dpr, 0, 0); }
      if (g.clearRect) { g.clearRect(0, 0, 64, 64); }
      drawSkinPreview(g, c.id, 64);
    }
    lastPreviewAt = G.t;
  }
  function refreshSkins() {
    if (el.skCoins) { el.skCoins.textContent = String(G.totalCoins); }
    for (var i = 0; i < skinCards.length; i++) {
      var c = skinCards[i], sk = SKIN_BY_ID[c.id];
      var owned = ownsSkin(c.id), worn = G.skin === c.id;
      c.node.classList.toggle('sel', worn);
      c.node.classList.toggle('locked', !owned);
      c.tag.textContent = worn ? Pl.t('equipped') : (owned ? Pl.t('equip') : sk.price + ' 🪙');
      c.tag.className = 'skc-tag' + (worn || owned ? ' have' : (G.totalCoins >= sk.price ? '' : ' poor'));
      c.badge.textContent = worn ? '✅' : (owned ? '' : '🔒');
    }
    drawSkinPreviews();
  }
  function skinMessage(text) {
    if (!el.skinsHint) { return; }
    el.skinsHint.textContent = text;
    if (hintBackTimer) { clearTimeout(hintBackTimer); }
    hintBackTimer = setTimeout(function () {
      try { if (el.skinsHint) { el.skinsHint.textContent = Pl.t('skinsHint'); } } catch (e) {}
    }, 1500);
  }
  function buySkin(id) {
    var sk = SKIN_BY_ID[id];
    if (!sk || ownsSkin(id) || G.totalCoins < sk.price) { return false; }
    G.totalCoins -= sk.price;
    G.skins.push(id);
    saveProfile();
    syncHUD(true);
    refreshSkins();
    return true;
  }
  function equipSkin(id) {
    if (!SKIN_BY_ID[id] || !ownsSkin(id)) { return false; }
    G.skin = id;
    saveProfile();
    refreshSkins();
    return true;
  }
  function pickSkin(id) {
    if (!SKIN_BY_ID[id]) { return false; }
    if (!ownsSkin(id)) {
      if (!buySkin(id)) { skinMessage(Pl.t('notEnough')); return false; }
      Sound.coin();
      skinMessage(Pl.t('bought'));
    } else {
      Sound.hop();
    }
    equipSkin(id);
    return true;
  }
  function openSkins(from) {
    skinsFrom = from || 'menu';
    buildSkinCards();
    refreshSkins();
    showOnly('ovSkins');
  }
  function closeSkins() {
    if (skinsFrom === 'pause' && G.state === 'paused') {
      UI.pause();
      showOnly('ovPause');
    } else {
      UI.menu();
      showOnly('ovMenu');
    }
  }

  // выход в меню из паузы: забег не засчитываем, но прогресс сохраняем
  function toMenu() {
    saveProfile();
    Sound.resume();
    G.state = 'menu';
    G.eagle = null;
    reset();
    Pl.gameplayStop();
    syncHUD(true);
    UI.menu();
    showOnly('ovMenu');
  }

  var UI = {
    applyLang: function () {
      var set = function (id, txt) { var n = $(id); if (n) { n.textContent = txt; } };
      var setT = function (id, key) { set(id, Pl.t(key)); };
      setT('lblBest', 'best'); setT('lblCoins', 'coins');
      setT('mLblBest', 'best'); setT('mLblCoins', 'coins');
      setT('oLblBest', 'best');
      setT('tOver', 'gameOver'); setT('tPaused', 'paused');
      setT('btnPlay', 'play'); setT('btnRestart', 'playAgain');
      setT('tRestart', 'restart'); setT('tResume', 'resume'); setT('tSound', 'sound');
      setT('btnRevive', 'revive');
      setT('tControls', 'controlsDesktop');
      setT('tControls2', 'controlsMobile');
      setT('tSub', 'tap');
      setT('oRecord', 'record');
      setT('ovLoadText', 'loading');
      // пауза
      setT('tPauseHint', 'pauseHint'); setT('tToMenu', 'toMenu'); setT('tPauseSkins', 'skins');
      setT('pLblScore', 'score'); setT('pLblCoins', 'coins');
      // сложность
      setT('tDiffEasy', 'diffEasy'); setT('tDiffEasySub', 'diffEasySub');
      setT('tDiffNormal', 'diffNormal'); setT('tDiffNormalSub', 'diffNormalSub');
      setT('tDiffHard', 'diffHard'); setT('tDiffHardSub', 'diffHardSub');
      if (el.diffHint) { el.diffHint.textContent = Pl.t(diffKey(G.diffId, 'Hint')); }
      if (el.pDiff) { el.pDiff.textContent = Pl.t(diffKey(G.diffId)); }
      // скины
      setT('tMenuSkins', 'skins'); setT('tSkins', 'skins'); setT('tWallet', 'wallet');
      setT('tSkinsHint', 'skinsHint'); setT('btnSkinsClose', 'back');
      for (var i = 0; i < skinCards.length; i++) {
        skinCards[i].name.textContent = Pl.t('sk_' + skinCards[i].id);
      }
      document.title = 'Crossy Chicken';
    },
    menu: function () {
      if (el.mBest) { el.mBest.textContent = String(bestFor()); }
      if (el.mCoins) { el.mCoins.textContent = String(G.totalCoins); }
      showOnly('ovMenu');
    },
    refreshRecord: function () {
      if (el.mBest) { el.mBest.textContent = String(bestFor()); }
      if (el.mCoins) { el.mCoins.textContent = String(G.totalCoins); }
    },
    over: function (isRecord) {
      if (el.oScore) { el.oScore.textContent = String(G.score); }
      if (el.oBest) { el.oBest.textContent = String(bestFor()); }
      if (el.oRecord) { el.oRecord.classList.toggle('on', !!isRecord); }
      if (el.oReason) { el.oReason.textContent = Pl.t('r_' + G.deathReason); }
      var canRevive = Pl.rewardedAvailable && !G.reviveUsed;
      if (el.btnRevive) {
        el.btnRevive.hidden = !canRevive;
        el.btnRevive.disabled = false;
        el.btnRevive.textContent = Pl.t('revive');
      }
    },
    // панель паузы показывает, с чем игрок остановился
    pause: function () {
      if (el.pScore) { el.pScore.textContent = String(G.score); }
      if (el.pCoins) { el.pCoins.textContent = String(G.coins); }
      if (el.pDiff) { el.pDiff.textContent = Pl.t(diffKey(G.diffId)); }
    },
    skins: openSkins
  };

  if (el.btnPlay) { el.btnPlay.addEventListener('click', function () { Sound.init(); startGame(); }); }
  if (el.btnRestart) { el.btnRestart.addEventListener('click', function () { startGame(); }); }
  if (el.btnRestart2) { el.btnRestart2.addEventListener('click', function () { Sound.resume(); startGame(); }); }
  if (el.btnResume) { el.btnResume.addEventListener('click', function () { if (G.state === 'paused') { togglePause(); } }); }
  if (el.btnPause) { el.btnPause.addEventListener('click', function () { togglePause(); }); }
  if (el.btnMute) { el.btnMute.addEventListener('click', function () { toggleMute(); }); }
  if (el.btnPauseSound) { el.btnPauseSound.addEventListener('click', function () { toggleMute(); }); }
  if (el.btnPauseSkins) { el.btnPauseSkins.addEventListener('click', function () { openSkins('pause'); }); }
  if (el.btnMenuSkins) { el.btnMenuSkins.addEventListener('click', function () { openSkins('menu'); }); }
  if (el.btnSkinsClose) { el.btnSkinsClose.addEventListener('click', function () { closeSkins(); }); }
  if (el.btnToMenu) { el.btnToMenu.addEventListener('click', function () { toMenu(); }); }
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

  // три кнопки сложности в главном меню
  (function () {
    var btns = document.querySelectorAll ? document.querySelectorAll('#segDiff .segbtn') : [];
    for (var i = 0; i < btns.length; i++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute ? btn.getAttribute('data-diff') : null;
          if (id) { Sound.hop(); setDiff(id); }
        });
      })(btns[i]);
    }
  })();

  // пауза при потере фокуса вкладки (требование площадки + здравый смысл)
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && G.state === 'playing') { togglePause(); }
  }, false);

  /* ==========================================================================
     12. ЦИКЛ
     ========================================================================== */
  var previewCv = null;      // переиспользуемый canvas для отладочных превью
  var last = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) { last = now; }
    var dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    G.t += dt;
    if (G.state === 'playing') { update(dt); }
    else if (G.state === 'menu') { moveWorld(dt); updateParticles(dt); }
    // в магазине скинов превью живут своей жизнью: «радуга» и «золотая» анимированы
    if (skinCards.length && el.ovSkins && el.ovSkins.classList.contains('on') && G.t - lastPreviewAt > 0.08) {
      drawSkinPreviews();
    }
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
    buildSkinCards();

    Pl.init().then(function () {
      UI.applyLang();
      return Pl.load();
    }).then(function (data) {
      applyProfile(data || {});
      G.state = 'menu';
      UI.menu();
      showOnly('ovMenu');
    }).catch(function () {
      applyProfile({});
      G.state = 'menu';
      UI.menu();
      showOnly('ovMenu');
    });

    requestAnimationFrame(frame);
  }

  // профиль из сохранений: рекорды по режимам, монеты, сложность, скины
  function applyProfile(data) {
    G.best = Math.max(0, data.best || 0);
    G.bests = {
      easy: Math.max(0, (data.bests && data.bests.easy) || 0),
      normal: Math.max(0, (data.bests && data.bests.normal) || 0),
      hard: Math.max(0, (data.bests && data.bests.hard) || 0)
    };
    G.best = Math.max(G.best, G.bests.easy, G.bests.normal, G.bests.hard);
    G.totalCoins = Math.max(0, data.coins || 0);
    G.skins = ['classic'];
    if (data.skins && data.skins.length) {
      for (var i = 0; i < data.skins.length; i++) {
        var id = String(data.skins[i]);
        if (SKIN_BY_ID[id] && G.skins.indexOf(id) < 0) { G.skins.push(id); }
      }
    }
    G.skin = (data.skin && SKIN_BY_ID[data.skin] && G.skins.indexOf(data.skin) >= 0) ? data.skin : 'classic';
    setDiff(DIFFS[data.diff] ? data.diff : 'normal', true);
    lastHUD.best = -1;
    syncHUD(true);
    refreshSkins();
  }

  // отладочный доступ (используется автотестом, в проде не мешает)
  window.__CHICKEN__ = {
    G: G, pl: pl,
    start: startGame, die: die, revive: revive, tryMove: tryMove,
    teleport: function (c, r) { pl.px = colX(c); pl.py = rowY(r); pl.hop = null; pl.log = null; camY = camTargetY = camTargetFor(pl.py); },
    rows: function () { return G.rows; },
    ensure: ensureRows,
    resize: resize,

    /* отрисовка одной модели машины в отдельный canvas (автотест и отладка) */
    carPreview: function (kind, w, h, color) {
      var cw = w || 240, ch = h || 90;
      if (!previewCv) { previewCv = document.createElement('canvas'); }
      var cv = previewCv;
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      if (!cv.getContext) { return null; }
      var g = cv.getContext('2d');
      if (g.clearRect) { g.clearRect(0, 0, cw, ch); }
      withCtx(g, function () {
        drawVehicle(cw / 2, ch / 2, kind, 1, color || pick(CAR_COLORS[kind] || ['#e05a47']), 0);
      });
      return cv;
    },
    kinds: function () { return Object.keys(KIND); },

    /* сложность */
    diffs: function () { return DIFF_ORDER.slice(); },
    diff: function () { return G.diffId; },
    setDiff: setDiff,
    ramp: ramp,
    eagleLimit: eagleLimit,

    /* скины */
    skinList: function () {
      var out = [];
      for (var i = 0; i < SKINS.length; i++) {
        out.push({
          id: SKINS[i].id, price: SKINS[i].price,
          name: Pl.t('sk_' + SKINS[i].id),
          owned: ownsSkin(SKINS[i].id), worn: G.skin === SKINS[i].id
        });
      }
      return out;
    },
    skin: function () { return G.skin; },
    coins: function () { return G.totalCoins; },
    setCoins: function (n) {
      G.totalCoins = Math.max(0, Math.round(n) || 0);
      saveProfile(); syncHUD(true); refreshSkins();
      return G.totalCoins;
    },
    buySkin: buySkin,
    equipSkin: equipSkin,
    pickSkin: pickSkin,
    skinCards: function () { return skinCards.length; },

    /* экраны */
    state: function () { return G.state; },
    pause: togglePause,
    toMenu: toMenu,
    openSkins: openSkins,
    closeSkins: closeSkins,
    profile: profile,
    save: saveProfile
  };

  boot();
})();
