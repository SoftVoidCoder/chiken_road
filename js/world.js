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
  var TH = CC.themes, A = CC.actors;
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

  U.expose(CC.world, {
    ramp: ramp, shuffle: shuffle, cols: cols, makeLane: makeLane,
    genGrass: genGrass, genRoad: genRoad, genWater: genWater, genRail: genRail,
    nextPattern: nextPattern, genNextRow: genNextRow, ensureRows: ensureRows,
    pruneRows: pruneRows
  });
})(window.CC);
