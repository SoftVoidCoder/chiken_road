/* ============================================================================
   core.js — ядро: константы, состояние, утилиты, кэши, качество
   ----------------------------------------------------------------------------
   Здесь живут четыре общих объекта, на которые опираются все остальные модули:

     CC.C   — неизменяемые константы (размер клетки, таблицы машин и сложностей);
     CC.R   — состояние рендера: холст, контекст, масштаб, камера, качество;
     CC.G   — состояние игры (очки, монеты, ряды, эффекты);
     CC.pl  — курица;  CC.in — состояние ввода;  CC.util — чистые функции.

   Здесь же лежат кэши, которые держат стабильный FPS:
     • спрайты машин   — модель рисуется один раз и дальше копируется;
     • покрытие рядов  — земля/дорога/рельсы рисуются один раз на ряд;
     • фон и виньетка  — один раз на размер окна;
     • градиенты       — переиспользуются вместо создания каждый кадр.

   Любой кэш сбрасывается при смене размера окна, масштаба или биома, то есть
   ровно тогда, когда картинка действительно меняется.
   ========================================================================== */
(function (global) {
  'use strict';

  var CC = global.CC || (global.CC = {});

  /* --- шина модулей: все остальные модули только наполняют свои отсеки ------ */
  CC.C = {};
  CC.R = {
    canvas: null, ctx: null,
    VW: 800, VH: 600, DPR: 1, scale: 1, fine: true,
    camX: 0, camY: 0, camTargetY: 0,
    shadows: true, vignette: true, rowCache: true, spritesOn: true, particlesMax: 260,
    quality: 2, fps: 60
  };
  CC.util = {};
  CC.in = { held: { dir: null, dc: 0, dr: 0 }, stack: [], touch: null };
  // отсеки, которые наполняются позже (нужны для ссылок «вперёд»)
  CC.world = {}; CC.fx = {}; CC.game = {}; CC.draw = {}; CC.decor = {};
  CC.actors = {}; CC.render = {}; CC.input = {}; CC.ui = {}; CC.audio = {}; CC.mech = {};

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
    moto:      { len: 0.72, sp: 1.48 },   // мотоцикл: узкий и очень быстрый
    snowplow:  { len: 1.45, sp: 0.88 },   // снегоуборщик (зимние биомы)
    firetruck: { len: 2.10, sp: 1.06 },   // пожарная
    icecream:  { len: 1.45, sp: 0.86 },   // фургон с мороженым
    limo:      { len: 2.05, sp: 0.95 },   // лимузин
    hearse:    { len: 1.90, sp: 0.90 },   // катафалк
    garbage:   { len: 1.95, sp: 0.72 },   // мусоровоз
    tow:       { len: 1.70, sp: 0.88 },   // эвакуатор
    f1:        { len: 1.35, sp: 1.55 },   // болид
    drone:     { len: 0.95, sp: 1.40 },   // дрон
    plane:     { len: 2.60, sp: 1.30 },   // самолёт на взлётной полосе
    sleigh:    { len: 1.30, sp: 1.10 }    // сани (если модель не нарисована — станет car)
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
    moto:      ['#e11d48', '#2563eb', '#1f2937'],
    snowplow:  ['#f2a33c', '#e8a020'],
    firetruck: ['#d9342b'],
    icecream:  ['#f7f2e8'],
    limo:      ['#1f2430', '#f2f5fa'],
    hearse:    ['#2b2f3a', '#3d4350'],
    garbage:   ['#4f7d5a', '#6b7c93'],
    tow:       ['#e0a91c', '#3d7ce0'],
    f1:        ['#e11d48', '#2563eb', '#111827'],
    drone:     ['#2b3240', '#e11d48'],
    plane:     ['#f2f5fa', '#dfe6f0'],
    sleigh:    ['#c8342b']
  };

  /* ==========================================================================
     2. ХОЛСТ И КАМЕРА
     ========================================================================== */
  var R = CC.R;
  var canvas = document.getElementById('game');
  R.canvas = canvas;
  R.ctx = canvas.getContext('2d');

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rnd(a, b) { return a + Math.random() * (b - a); }
  function pick(a) { return a[(Math.random() * a.length) | 0]; }
  // детерминированный «шум» для декора клеток
  function hash01(n) {
    n = (n << 13) ^ n;
    n = (n * (n * n * 15731 + 789221) + 1376312589) & 0x7fffffff;
    return n / 0x7fffffff;
  }

  function resize() {
    var wasDpr = R.DPR;
    R.DPR = Math.min(window.devicePixelRatio || 1, 2);
    if (R.quality === 0) { R.DPR = Math.min(R.DPR, 1); }   // на слабом устройстве экономим пиксели
    R.VW = canvas.clientWidth || window.innerWidth || 800;
    R.VH = canvas.clientHeight || window.innerHeight || 600;
    canvas.width = Math.round(R.VW * R.DPR);
    canvas.height = Math.round(R.VH * R.DPR);
    // вперёд должно быть видно не меньше 13 рядов, иначе на быстрые машины не хватит реакции
    R.scale = clamp(Math.min(R.VW / ((COLS + 1.4) * TS), R.VH / (13 * TS)), 0.42, 1.75);
    R.fine = R.quality > 1 && R.scale > 0.62;  // мелкие штрихи — только на крупном масштабе
    R.camY = R.camTargetY = camTargetFor(pl.py);
    if (wasDpr !== R.DPR || true) { clearCaches(); }   // размер окна изменился — кэши недействительны
  }
  function camTargetFor(py) { return py - (PLAYER_SCREEN_Y - 0.5) * R.VH / R.scale; }
  function colX(c) { return (c - (COLS - 1) / 2) * TS; }   // центр клетки по X
  function rowY(r) { return -r * TS; }                     // центр ряда по Y

  /* ==========================================================================
     3. СОСТОЯНИЕ ИГРЫ
     ========================================================================== */
  var G = {
    state: 'loading',     // loading | menu | playing | paused | over
    t: 0, runTime: 0,
    score: 0, best: 0, maxRow: 0,
    coins: 0, totalCoins: 0,
    diffId: 'normal', bests: { easy: 0, normal: 0, hard: 0 },
    skin: 'classic', skins: ['classic'],
    themeId: 'meadow',            // активный биом
    modeId: 'classic',            // активный режим
    rows: {}, genUntil: MIN_ROW - 1, pattern: null,
    particles: [], popups: [],
    shake: 0, flash: 0, flashColor: '255,80,80',
    eagle: null, invuln: 0, deathT: 0, deathReason: '',
    reviveUsed: false, runStart: 0, muted: false,
    hintShown: false,
    combo: 0, comboTimer: 0, comboBest: 0,
    boostsUsed: 0, noStopBest: 0, ghostBeaten: false, ghostTrack: [], ghostNext: 0,
    boost: null, boostLeft: 0, shield: 0,
    weather: null, weatherT: 0
  };
  CC.G = G;

  var pl = {
    px: 0, py: 0, hop: null, log: null,
    facing: 'up', idle: 0, alive: true,
    holdTimer: 0, dust: 0
  };
  CC.pl = pl;

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
      diff: G.diffId,
      meta: CC.meta && CC.meta.toSave ? CC.meta.toSave() : null,
      settings: CC.settings && CC.settings.toSave ? CC.settings.toSave() : null
    };
  }
  function saveProfile() { if (CC.platform) { CC.platform.save(profile()); } }

  function playerCol() { return clamp(Math.round(pl.px / TS + (COLS - 1) / 2), 0, COLS - 1); }
  function playerRow() { return Math.round(-pl.py / TS); }

  // Подмена контекста рисования: нужна, чтобы те же 2D-модели рисовать
  // в маленькие превью магазина и в спрайты-кэши.
  function withCtx(g, fn) {
    var prev = R.ctx;
    R.ctx = g;
    try { fn(); } finally { R.ctx = prev; }
  }

  /* ==========================================================================
     4. КЭШИ (стабильный FPS)
     ========================================================================== */
  var SPRITE_LIMIT = 120;        // сколько спрайтов машин держим в памяти
  var ROW_LIMIT = 24;            // сколько рядов покрытия кэшируем
  var sprites = {};
  var spriteCount = 0;
  var rowSprites = {};
  var rowCount = 0;
  var gradCache = {};
  var gradedBack = { cv: null, key: '' };
  var gradedVignette = { cv: null, key: '' };

  function clearCaches() {
    sprites = {}; spriteCount = 0;
    rowSprites = {}; rowCount = 0;
    gradCache = {};
    gradedBack = { cv: null, key: '' };
    gradedVignette = { cv: null, key: '' };
    if (CC.actors && CC.actors.clearVehicleSprites) { CC.actors.clearVehicleSprites(); }
  }

  // Градиент с кэшем: создание градиента — одна из самых дорогих операций
  // в Canvas 2D, а параметры у нас повторяются из кадра в кадр.
  function grad(key, build) {
    var g = gradCache[key];
    if (!g) { g = gradCache[key] = build(); }
    return g;
  }

  // Спрайт произвольного размера. Рисуется в физических пикселях (k = DPR*scale),
  // чтобы картинка оставалась резкой, а в мир возвращается через drawImage.
  function sprite(key, w, h, k, draw) {
    var s = sprites[key];
    if (s) { return s; }
    if (spriteCount >= SPRITE_LIMIT) { clearCaches(); }
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * k));
    cv.height = Math.max(1, Math.ceil(h * k));
    var g = cv.getContext('2d');
    if (g.setTransform) { g.setTransform(k, 0, 0, k, 0, 0); }
    withCtx(g, function () { draw(g, w / 2, h / 2); });
    s = { cv: cv, w: w, h: h, k: k };
    sprites[key] = s; spriteCount++;
    return s;
  }

  // Кэш покрытия ряда: земля, дорога и рельсы статичны для конкретного ряда,
  // поэтому рисуем их один раз в полоску шириной поля и высотой в клетку.
  function rowSprite(key, k, draw) {
    var s = rowSprites[key];
    if (s) { return s; }
    var w = FIELD_HALF * 2, h = TS;
    if (rowCount >= ROW_LIMIT) { rowSprites = {}; rowCount = 0; }
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.ceil(w * k));
    cv.height = Math.max(1, Math.ceil(h * k));
    var g = cv.getContext('2d');
    if (g.setTransform) { g.setTransform(k, 0, 0, k, 0, 0); }
    withCtx(g, function () { draw(g); });
    s = { cv: cv, w: w, h: h, k: k };
    rowSprites[key] = s; rowCount++;
    return s;
  }

  // Крупные статичные слои (фон и виньетка) — один canvas на размер окна.
  function fullscreenSprite(cache, key, w, h, draw) {
    if (cache.cv && cache.key === key) { return cache.cv; }
    var cv = document.createElement('canvas');
    cv.width = Math.max(1, Math.round(w));
    cv.height = Math.max(1, Math.round(h));
    var g = cv.getContext('2d');
    withCtx(g, function () { draw(g); });
    cache.cv = cv; cache.key = key;
    return cv;
  }

  /* ==========================================================================
     5. МЕНЕДЖЕР КАЧЕСТВА
     ========================================================================== */
  var qFrames = 0, qTime = 0, qCooldown = 0, qUpStreak = 0;

  function applyQuality() {
    var q = R.quality;
    R.shadows = q > 0;
    R.vignette = q > 1;
    R.rowCache = q > 0;
    R.particlesMax = q > 1 ? 260 : (q > 0 ? 140 : 70);
    R.fine = q > 1 && R.scale > 0.62;
    clearCaches();
  }

  // Вызывается каждый кадр из игрового цикла: держим средний кадр в норме,
  // понижая качество при просадке и возвращая обратно, если стало легко.
  function qualityTick(dtMs) {
    qFrames++; qTime += dtMs;
    if (qCooldown > 0) { qCooldown--; }
    if (qFrames < 40) { return; }
    var avg = qTime / qFrames;
    R.fps = Math.round(1000 / Math.max(1, avg));
    qFrames = 0; qTime = 0;
    if (qCooldown > 0) { return; }
    if (avg > 26 && R.quality > 0) {          // тяжело — снижаем качество
      R.quality--; applyQuality(); qCooldown = 120; qUpStreak = 0; resize();
    } else if (avg < 14 && R.quality < 2) {   // легко — возвращаем качество
      qUpStreak++;
      if (qUpStreak > 4) { R.quality++; applyQuality(); qCooldown = 240; qUpStreak = 0; resize(); }
    } else if (avg < 20) { qUpStreak = 0; }
  }

  /* ==========================================================================
     6. ЭКСПОРТ
     ========================================================================== */
  var C = CC.C;
  C.TS = TS; C.COLS = COLS; C.FIELD_HALF = FIELD_HALF;
  C.HOP_TIME = HOP_TIME; C.HOP_HOLD = HOP_HOLD; C.EAGLE_DELAY = EAGLE_DELAY;
  C.MIN_ROW = MIN_ROW; C.ROWS_AHEAD = ROWS_AHEAD; C.PLAYER_SCREEN_Y = PLAYER_SCREEN_Y;
  C.DIFFS = DIFFS; C.DIFF_ORDER = DIFF_ORDER; C.KIND = KIND; C.CAR_COLORS = CAR_COLORS;
  C.canvas = canvas;
  C.CAR_W = TS * 0.60;

  var U = CC.util;
  // Модуль отдаёт свой API в готовый отсек шины. Важно именно наполнять объект,
  // а не заменять его: модули, загруженные раньше, уже держат на него ссылку.
  U.expose = function (bucket, api) {
    for (var k in api) { if (api.hasOwnProperty(k)) { bucket[k] = api[k]; } }
    return bucket;
  };
  U.clamp = clamp; U.rnd = rnd; U.pick = pick; U.hash01 = hash01;
  U.resize = resize; U.camTargetFor = camTargetFor; U.colX = colX; U.rowY = rowY;
  U.diff = diff; U.eagleLimit = eagleLimit; U.bestFor = bestFor;
  U.profile = profile; U.saveProfile = saveProfile;
  U.playerCol = playerCol; U.playerRow = playerRow; U.withCtx = withCtx;
  U.grad = grad; U.sprite = sprite; U.rowSprite = rowSprite;
  U.fullscreenSprite = fullscreenSprite; U.clearCaches = clearCaches;
  U.qualityTick = qualityTick; U.applyQuality = applyQuality;
})(typeof window !== 'undefined' ? window : this);
