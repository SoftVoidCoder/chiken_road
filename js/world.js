/* ============================================================================
   world.js — генерация мира: ряды, ленты, дороги, реки, рельсы
   ----------------------------------------------------------------------------
   Мир строится рядами на ходу: у каждого ряда свой тип и объекты. Плотность
   потока задаётся временем между машинами (gapTime) из таблицы сложностей,
   поэтому и быстрые, и медленные полосы одинаково проходимы.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var TS = C.TS, COLS = C.COLS, FIELD_HALF = C.FIELD_HALF, ROWS_AHEAD = C.ROWS_AHEAD;
  var KIND = C.KIND, CAR_COLORS = C.CAR_COLORS;
  var clamp = U.clamp, rnd = U.rnd, pick = U.pick, hash01 = U.hash01;
  var diff = U.diff, colX = U.colX, rowY = U.rowY;
  var TH = CC.themes, A = CC.actors, MECH = CC.mech;

  // Пул машин биома: неизвестные движку id превращаются в обычную машину.
  function themeCars() {
    var th = TH.get(G.themeId);
    var pool = th && th.cars && th.cars.length ? th.cars : null;
    if (!pool) { return null; }
    var out = [];
    for (var i = 0; i < pool.length; i++) {
      out.push(KIND[pool[i]] ? pool[i] : 'car');
    }
    return out.length ? out : null;
  }
  /* ==========================================================================
     6. ГЕНЕРАЦИЯ МИРА
     ========================================================================== */
  // разгон внутри забега: чем дальше, тем злее; крутизна зависит от сложности
  function ramp(row) { return clamp((row - diff().row0) / 240, 0, 1) * diff().ramp; }

  function shuffle(a) {
    for (var i = a.length - 1; i > 0; i--) { var j = (wrnd() * (i + 1)) | 0; var t = a[i]; a[i] = a[j]; a[j] = t; }
    return a;
  }
  function cols() { var a = []; for (var i = 0; i < COLS; i++) { a.push(i); } return a; }

  // лента объектов (машины или брёвна): равномерно по кольцу, кольцо шире поля
  function makeLane(row, d, opts) {
    var dir = wrnd() < 0.5 ? 1 : -1;
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
      var x = -L / 2 + i * spacing * TS + wrnd() * slack * TS;
      items.push({ x: x, vx: vT * TS * dir, len: len, kind: kind, color: kind ? pick(CAR_COLORS[kind]) : null, ph: wrnd(0, 6.28) });
    }
    return { dir: dir, items: items, loop: L, speed: vT };
  }

  function genGrass(r, d, safe) {
    var row = { type: 'grass', r: r, obstacles: {}, coins: [] };
    if (!safe) {
      var maxObs = Math.min(COLS - 2, Math.round((1 + d * 5 + wrnd() * 2) * diff().obs));
      var order = shuffle(cols());
      for (var i = 0; i < maxObs; i++) {
        var c = order[i];
        row.obstacles[c] = hash01(r * 131 + c * 17) < 0.62 ? 'tree' : 'rock';
      }
      // редкий «золотой» ряд: много монет, но и препятствий больше
      if (wrnd() < 0.04) {
        row.gold = true;
        row.coins = [];
        var g0 = (wrnd() * (COLS - 5)) | 0;
        for (var gi = 0; gi < 5; gi++) {
          if (!((g0 + gi) in row.obstacles)) { row.coins.push(g0 + gi); }
        }
      } else if (wrnd() < 0.22 * diff().coin) {
        var c0 = (wrnd() * COLS) | 0;
        var n = 1 + ((wrnd() * 3) | 0);
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
      speedT: (1.7 + wrnd() * 2.1 + d * 2.4) * diff().speed,
      kind: function () {
        var pool = themeCars();
        if (pool) { return pick(pool); }
        var q = wrnd();
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
      minGap: diff().minGap,
      // в экстриме поток плотнее, а мягкая подстройка чуть ослабляет его новичку
      gapTime: diff().gapTime * (G.modeId === 'extreme' ? 0.8 : 1) * (G.ddaMul || 1),
      gapTighten: 0.16 * diff().ramp
    });
    row.dir = lane.dir; row.items = lane.items; row.loop = lane.loop; row.speed = lane.speed;
    return row;
  }

  function genWater(r, d) {
    var row = { type: 'water', r: r, phase: wrnd(0, 6.28) };
    var lane = makeLane(r, d, {
      speedT: (0.65 + wrnd() * 1.5) * diff().water,
      len: function () { return 1.8 + wrnd() * 1.4; },
      minGap: 1.35 * diff().gap, gapTime: 0.95 * diff().gap, gapTighten: 0.05 * diff().ramp
    });
    for (var i = 0; i < lane.items.length; i++) {
      lane.items[i].kind = wrnd() < 0.78 ? 'log' : 'lily';
      if (lane.items[i].kind === 'lily') { lane.items[i].len = Math.max(1.5, lane.items[i].len - 0.4); }
    }
    row.dir = lane.dir; row.items = lane.items; row.loop = lane.loop; row.speed = lane.speed;
    return row;
  }

  function genRail(r, d) {
    return {
      type: 'rail', r: r, dir: wrnd() < 0.5 ? 1 : -1,
      timer: wrnd(1.6, 4.4) / diff().speed, warn: 1.15, train: null,
      trainSpeed: (9 + d * 3.5) * TS * diff().speed, trainLen: 8.4, d: d
    };
  }

  // Режим забега задаёт, из чего вообще состоит мир
  function modePattern(q) {
    var m = G.modeId;
    if (m === 'water') {
      if (q < 0.55) { return { kind: 'water', left: 1 }; }
      return { kind: 'grass', left: 1 };
    }
    if (m === 'rails') {
      if (q < 0.6) { return { kind: 'rail', left: 1 }; }
      return { kind: 'grass', left: 1 };
    }
    return null;
  }

  // Испытание дня: у всех игроков должен получиться один и тот же мир, поэтому
  // вся случайность генерации идёт через один генератор с сидом даты.
  var seedState = 0;
  var daySeed = 0;
  function seedInit() {
    var d = new Date();
    daySeed = ((d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()) >>> 0) || 1;
    seedState = daySeed;
  }
  // Перед каждым рядом подмешиваем номер ряда в состояние генератора: тогда
  // ряд зависит только от даты и своего номера, а не от истории генерации.
  // Без этого повторный забег дня давал бы другой мир.
  function seedForRow(r) {
    if (!G.daily) { return; }
    if (!daySeed) { seedInit(); }
    seedState = ((daySeed ^ Math.imul(r, 2654435761)) >>> 0) || 1;
  }
  function dayRnd() {
    if (!G.daily) { return Math.random(); }
    if (!seedState) { seedInit(); }
    seedState ^= seedState << 13; seedState >>>= 0;
    seedState ^= seedState >> 17;
    seedState ^= seedState << 5; seedState >>>= 0;
    return seedState / 4294967296;
  }
  // Сброс сида в начале забега: иначе повторный забег дня продолжил бы
  // последовательность и мир оказался бы другим.
  function resetSeed() { seedState = 0; daySeed = 0; if (G.daily) { seedInit(); } }
  // Случайное число генерации: в обычном режиме это Math.random, в испытании дня — сид
  function wrnd(a, b) {
    var r = dayRnd();
    if (a === undefined) { return r; }
    return a + r * (b - a);
  }

  function nextPattern(r, d) {
    var prev = G.rows[r - 1] ? G.rows[r - 1].type : 'grass';
    // после воды и рельсов — обязательно передышка (иначе игрок окажется в ловушке)
    if (prev === 'water' || prev === 'rail') { return { kind: 'grass', left: 1 + ((wrnd() * 2) | 0) }; }
    var q = dayRnd();
    var forced = modePattern(q);
    // режим действует сразу после безопасной стартовой зоны
    if (forced && r > 3) { return forced; }
    var pRoad = 0.44 * diff().pattern, pWater = 0.18 * diff().pattern;
    // длина серии дорог ограничена: 4 полосы подряд уже требуют ювелирной
    // реакции, поэтому на позднем разгоне серия растёт до трёх-четырёх
    if (q < pRoad) { return { kind: 'road', left: 1 + ((wrnd() * (1 + d * 1.7)) | 0) }; }
    if (q < pRoad + pWater) { return { kind: 'water', left: 1 + ((wrnd() * (1 + d * 1.2)) | 0) }; }
    if (q < pRoad + pWater + 0.11) { return { kind: 'rail', left: 1 }; }
    return { kind: 'grass', left: 1 + ((wrnd() * 2) | 0) };
  }

  function genNextRow() {
    var r = G.genUntil + 1;
    if (G.daily) { seedForRow(r); }   // детерминированный мир испытания дня
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
    // механики биома помечают ряд: лёд, тоннель, лазер, лава и так далее
    if (MECH) { MECH.decorateRow(row, d); }
    G.rows[r] = row;
    G.genUntil = r;
  }
  function ensureRows(until) { while (G.genUntil < until) { genNextRow(); } }
  function pruneRows(minKeep) {
    for (var k in G.rows) { if (+k < minKeep) { delete G.rows[k]; } }
  }

  U.expose(CC.world, {
    ramp: ramp, shuffle: shuffle, cols: cols, makeLane: makeLane,
    genGrass: genGrass, genRoad: genRoad, genWater: genWater, genRail: genRail,
    nextPattern: nextPattern, genNextRow: genNextRow, ensureRows: ensureRows,
    resetSeed: resetSeed,
    pruneRows: pruneRows
  });
})(window.CC);
