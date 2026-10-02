/* ============================================================================
   main.js — сборка: игровой цикл, загрузка профиля, отладочный доступ
   ----------------------------------------------------------------------------
   Последний модуль: запускает цикл кадров, подтягивает сохранения,
   связывает игру с платформой и выставляет window.__CHICKEN__ для тестов.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var TS = C.TS, ROWS_AHEAD = C.ROWS_AHEAD, MIN_ROW = C.MIN_ROW, DIFFS = C.DIFFS;
  var colX = U.colX, rowY = U.rowY, camTargetFor = U.camTargetFor, clamp = U.clamp;
  var bestFor = U.bestFor;
  var Pl = CC.platform, Sound = CC.audio, GM = CC.game, FX = CC.fx, W = CC.world;
  var RD = CC.render, UI = CC.ui, META = CC.meta, TH = CC.themes, SK = CC.skins;
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
    if (G.state === 'playing') { GM.update(dt); }
    else if (G.state === 'menu') { GM.moveWorld(dt); FX.updateParticles(dt); }
    // в магазине скинов превью живут своей жизнью: «радуга» и «золотая» анимированы
    UI.tickPreviews();
    RD.frame();
  }

  /* ==========================================================================
     13. СТАРТ
     ========================================================================== */
  function boot() {
    try { G.muted = window.localStorage.getItem('cc_muted') === '1'; } catch (e) {}
    Sound.setMuted(G.muted);
    if (UI.el.btnMute) { UI.el.btnMute.textContent = G.muted ? '🔇' : '🔊'; }

    // во время рекламы платформа обязана видеть остановку геймплея
    Pl.onPause = function () {
      Sound.suspend();
      Pl.gameplayStop();
      if (G.state === 'playing') { G.state = 'paused'; UI.showOnly('ovPause'); }
    };
    Pl.onResume = function () {
      Sound.resume();
      if (G.state === 'paused') { G.state = 'playing'; Pl.gameplayStart(); UI.showOnly(null); }
    };

    U.resize();
    W.ensureRows(ROWS_AHEAD);
    UI.buildSkinCards();

    // язык, выбранный вручную в настройках, важнее языка площадки
    try {
      var savedLang = window.localStorage.getItem('cc_lang');
      if (savedLang && (savedLang === 'ru' || savedLang === 'en')) { Pl.lang = savedLang; }
    } catch (e) {}

    Pl.init().then(function () {
      UI.applyLang();
      return Pl.load();
    }).then(function (data) {
      applyProfile(data || {});
      if (CC.screens && CC.screens.init) { CC.screens.init(); }
      G.state = 'menu';
      UI.menu();
      UI.showOnly('ovMenu');
      // при первом запуске показываем короткое обучение (п. 6.8)
      if (!G.tutorialDone && CC.screens && CC.screens.openTutorial) {
        CC.screens.openTutorial();
      }
    }).catch(function () {
      applyProfile({});
      if (CC.screens && CC.screens.init) { CC.screens.init(); }
      G.state = 'menu';
      UI.menu();
      UI.showOnly('ovMenu');
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
    // мета-прогресс, настройки и активный биом
    if (META && META.load) { META.load(data.meta); }
    if (CC.settings && CC.settings.load) { CC.settings.load(data.settings); }
    if (data.theme && TH.byId[data.theme] && TH.isUnlocked(data.theme, META.stats().rows)) { G.themeId = data.theme; }
    G.skins = ['classic'];
    if (data.skins && data.skins.length) {
      for (var i = 0; i < data.skins.length; i++) {
        var id = String(data.skins[i]);
        if (SK.byId[id] && G.skins.indexOf(id) < 0) { G.skins.push(id); }
      }
    }
    G.skin = (data.skin && SK.byId[data.skin] && G.skins.indexOf(data.skin) >= 0) ? data.skin : 'classic';
    // остальные слоты внешнего вида: покупаются за монеты, хранятся списком
    var owned = data.owned && data.owned.length ? data.owned : [];
    // Возвращает МАССИВ купленного для слота: раньше функция отдавала строку,
    // из-за чего список покупок в магазине ломался.
    function ownSlot(list, listName) {
      var arr = [list[0].id];
      for (var i = 0; i < owned.length; i++) {
        for (var j = 0; j < list.length; j++) {
          if (list[j].id === owned[i] && arr.indexOf(owned[i]) < 0) { arr.push(owned[i]); }
        }
      }
      G[listName] = arr;
      return arr;
    }
    ownSlot(SK.pets, 'ownedPets');
    ownSlot(SK.trails, 'ownedTrails');
    ownSlot(SK.hats, 'ownedHats');
    ownSlot(SK.voices, 'ownedVoices');
    G.pet = G.ownedPets.indexOf(data.pet) >= 0 ? data.pet : 'none';
    G.trail = G.ownedTrails.indexOf(data.trail) >= 0 ? data.trail : 'none';
    G.hat = G.ownedHats.indexOf(data.hat) >= 0 ? data.hat : 'none';
    G.voice = G.ownedVoices.indexOf(data.voice) >= 0 ? data.voice : 'classic';
    G.adsDisabled = !!data.adsDisabled;
    G.tutorialDone = !!data.tutorialDone;
    if (CC.platform) { CC.platform.adsDisabled = G.adsDisabled; }
    UI.setDiff(DIFFS[data.diff] ? data.diff : 'normal', true);
    UI.syncHUD(true);
    UI.refreshSkins();
  }

  // отладочный доступ (используется автотестом, в проде не мешает)
  window.__CHICKEN__ = {
    G: G, pl: pl, C: C, R: R,
    start: GM.startGame, die: GM.die, revive: GM.revive, tryMove: GM.tryMove,
    teleport: function (c, r) {
      pl.px = colX(c); pl.py = rowY(r); pl.hop = null; pl.log = null;
      R.camY = R.camTargetY = camTargetFor(pl.py);
    },
    rows: function () { return G.rows; },
    ensure: W.ensureRows,
    resize: U.resize,
    quality: function () { return { level: R.quality, fps: R.fps, fine: R.fine }; },
    setQuality: function (q) { R.quality = clamp(q | 0, 0, 2); U.applyQuality(); U.resize(); return R.quality; },
    caches: function () { return { sprites: Object.keys(CC.actors.sprites || {}).length }; },

    /* отрисовка одной модели машины в отдельный canvas (автотест и отладка) */
    carPreview: function (kind, w, h, color) {
      var cw = w || 240, ch = h || 90;
      if (!previewCv) { previewCv = document.createElement('canvas'); }
      var cv = previewCv;
      if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
      if (!cv.getContext) { return null; }
      var g = cv.getContext('2d');
      if (g.clearRect) { g.clearRect(0, 0, cw, ch); }
      U.withCtx(g, function () {
        CC.actors.drawVehicle(cw / 2, ch / 2, kind, 1, color || U.pick(C.CAR_COLORS[kind] || ['#e05a47']), 0);
      });
      return cv;
    },
    kinds: function () { return Object.keys(C.KIND); },

    /* бусты и режимы */
    boost: function (id) { return GM.activateBoost(id); },
    magnet: function () { GM.magnetTick(); },
    boostState: function () { return { id: G.boost, left: G.boostLeft, shield: G.shield, label: G.boostLabel }; },
    combo: function () { return { combo: G.combo, best: G.comboBest }; },
    mode: function () { return G.modeId; },
    setMode: function (id) { G.modeId = id; return G.modeId; },
    daily: function (on) { G.daily = !!on; return G.daily; },
    night: function () { return G.night; },

    /* сложность */
    diffs: function () { return C.DIFF_ORDER.slice(); },
    diff: function () { return G.diffId; },
    setDiff: UI.setDiff,
    ramp: W.ramp,
    eagleLimit: U.eagleLimit,

    /* биомы */
    themes: function () { return TH.ids(); },
    theme: function () { return G.themeId; },
    setTheme: function (id) { return UI.setTheme(id); },
    themeUnlocked: function (id) { return TH.isUnlocked(id, META.stats().rows); },

    /* мета-прогресс */
    meta: function () { return META.state; },
    quests: function () { return META.quests(); },
    claimQuest: function (id) { return META.claimQuest(id); },
    achievements: function () { return META.achievements(); },
    levelInfo: function () { return META.levelInfo(); },
    chest: function () { return META.chestInfo(); },
    claimChest: function () { return META.claimChest(); },
    pass: function () { return META.passInfo(); },
    claimPass: function (lvl, track) { return META.claimPass(lvl, track); },
    ghost: function () { return META.ghostTrack(); },

    /* скины и кастомизация */
    skinList: function () {
      var out = [];
      for (var i = 0; i < SK.list.length; i++) {
        out.push({
          id: SK.list[i].id, price: SK.list[i].price,
          name: Pl.t('sk_' + SK.list[i].id),
          owned: G.skins.indexOf(SK.list[i].id) >= 0, worn: G.skin === SK.list[i].id
        });
      }
      return out;
    },
    skin: function () { return G.skin; },
    coins: function () { return G.totalCoins; },
    setCoins: function (n) {
      G.totalCoins = Math.max(0, Math.round(n) || 0);
      U.saveProfile(); UI.syncHUD(true); UI.refreshSkins();
      return G.totalCoins;
    },
    awardCoins: function (n) { G.totalCoins += Math.max(0, Math.round(n) || 0); U.saveProfile(); UI.syncHUD(true); return G.totalCoins; },
    buySkin: UI.buySkin,
    equipSkin: UI.equipSkin,
    pickSkin: UI.pickSkin,
    skinCards: function () { return UI.skinCardsCount(); },
    slots: function () { return SK; },

    /* экраны */
    state: function () { return G.state; },
    pause: UI.togglePause,
    toMenu: UI.toMenu,
    openSkins: UI.openSkins,
    closeSkins: UI.closeSkins,
    profile: U.profile,
    save: U.saveProfile,
    metrics: function () { return Pl.metrics(); },

    /* экраны и кастомизация */
    screens: function () {
      return {
        открыто: CC.input.overlayOpen(),
        режимов: CC.screens.MODES.length,
        товаров: CC.screens.PRODUCTS.length,
        предметовВМагазине: CC.screens.cardCount()
      };
    },
    openScreen: function (name) { CC.screens.open(name); return name; },
    closeScreens: function () { CC.screens.closeToMenu(); },
    pickSlotItem: function (slot, id) {
      var slots = CC.screens.SLOTS, def = null;
      for (var i = 0; i < slots.length; i++) { if (slots[i].id === slot) { def = slots[i]; } }
      if (!def) { return false; }
      var list = def.list();
      for (var j = 0; j < list.length; j++) {
        if (list[j].id === id) { CC.screens.pickSlotItem(def, list[j]); return true; }
      }
      return false;
    },
    cosmetics: function () {
      return { pet: G.pet, trail: G.trail, hat: G.hat, voice: G.voice,
        pets: G.ownedPets.length, trails: G.ownedTrails.length,
        hats: G.ownedHats.length, voices: G.ownedVoices.length };
    },
    setMode: function (id) { G.modeId = id; return G.modeId; },
    boostStock: function () { return G.boostStock || {}; },
    tutorialDone: function () { return G.tutorialDone; }
  };

  boot();
})(window.CC);
