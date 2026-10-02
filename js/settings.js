/* ============================================================================
   settings.js — настройки игрока и доступность
   ----------------------------------------------------------------------------
   Звук, музыка, вибрация, размер интерфейса, режим для левой руки, качество
   графики, режим для дальтоников и язык. Настройки применяются к документу
   через data-атрибуты, поэтому CSS сам подстраивает размеры и палитру.
   ========================================================================== */
(function (global) {
  'use strict';

  var CC = global.CC;
  var doc = global.document;

  var DEFAULTS = {
    sound: true,
    music: true,
    vibro: true,
    ui: 'normal',          // normal | big
    leftHand: false,
    quality: 'auto',       // auto | low | mid | high
    colorblind: 'off',     // off | protan | deutan | tritan
    lang: ''               // '' = как на площадке
  };

  var S = {
    data: {},
    load: function (saved) {
      var d = {};
      for (var k in DEFAULTS) { if (DEFAULTS.hasOwnProperty(k)) { d[k] = DEFAULTS[k]; } }
      if (saved) {
        for (var k2 in d) {
          if (d.hasOwnProperty(k2) && saved[k2] !== undefined) { d[k2] = saved[k2]; }
        }
      }
      S.data = d;
      S.apply();
      return d;
    },
    toSave: function () { return S.data; },
    get: function (key) { return S.data[key]; },
    set: function (key, value) {
      S.data[key] = value;
      S.apply();
      if (CC.util && CC.util.saveProfile) { CC.util.saveProfile(); }
      return value;
    },
    toggle: function (key) { return S.set(key, !S.data[key]); },
    // Качество из настроек подменяет автоматический менеджер качества
    qualityLevel: function () {
      var q = S.data.quality;
      if (q === 'low') { return 0; }
      if (q === 'mid') { return 1; }
      if (q === 'high') { return 2; }
      return -1;   // авто
    },
    apply: function () {
      try {
        var root = doc.documentElement;
        root.setAttribute('data-ui', S.data.ui);
        root.setAttribute('data-cb', S.data.colorblind);
        root.setAttribute('data-hand', S.data.leftHand ? 'left' : 'right');
        var q = S.qualityLevel();
        if (CC.R) {
          CC.R.forcedQuality = q;
          if (q >= 0 && q !== CC.R.quality) {
            CC.R.quality = q;
            if (CC.util && CC.util.applyQuality) { CC.util.applyQuality(); }
            if (CC.util && CC.util.resize) { CC.util.resize(); }
          }
        }
      } catch (e) {}
    },
    // Короткая вибрация для телефонов (если поддерживается и включена)
    buzz: function (ms) {
      if (!S.data.vibro) { return; }
      try { if (global.navigator && global.navigator.vibrate) { global.navigator.vibrate(ms || 12); } } catch (e) {}
    }
  };

  CC.settings = S;
})(typeof window !== 'undefined' ? window : this);
