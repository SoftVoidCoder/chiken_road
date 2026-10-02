/* ============================================================================
   platform.js — слой интеграции с Yandex Games SDK v2 (+ локальный фолбэк)
   ----------------------------------------------------------------------------
   Что делает:
     • YaGames.init() с таймаутом и безопасным фолбэком (работает и вне Яндекса)
     • LoadingAPI.ready()    — сообщаем платформе, что игра загружена
     • GameplayAPI.start/stop — обязательные вызовы при старте/паузе геймплея
     • Межстраничная реклама  — не чаще 1 раза в минуту (требование платформы)
     • Rewarded video         — «продолжить после смерти»
     • Сохранения: player.setData/getData + локальное зеркало в localStorage
     • Таблица лидеров (включается одной константой)
     • Локализация: ru / en (добавляется одним объектом в STRINGS)
   ========================================================================== */
(function (global) {
  'use strict';

  /* --- настройки ---------------------------------------------------------- */
  var LEADERBOARD_NAME = '';        // ← id таблицы лидеров из консоли разработчика; '' = выключено
  var AD_COOLDOWN_MS   = 62000;     // Яндекс: межстраничная реклама не чаще 1 раза в минуту
  var AD_MIN_RUN_MS    = 12000;     // не показываем рекламу, если забег был короче 12 секунд
  var USE_STICKY_BANNER = false;    // липкий баннер (включать осознанно, он занимает место)
  var INIT_TIMEOUT_MS  = 4000;

  /* --- локализация -------------------------------------------------------- */
  var STRINGS = {
    ru: {
      play: 'Играть', loading: 'Загрузка…', tap: 'Тап — шаг вперёд, свайп — в сторону',
      best: 'Рекорд', coins: 'Монеты', score: 'Очки',
      gameOver: 'Игра окончена', record: 'Новый рекорд!',
      playAgain: 'Играть снова', revive: 'Продолжить за рекламу', reviveWait: 'Загрузка рекламы…',
      paused: 'Пауза', resume: 'Продолжить', restart: 'Заново', sound: 'Звук',
      controlsDesktop: 'WASD / стрелки — шаг, P — пауза, M — звук',
      controlsMobile: 'Тап — вперёд, свайп — в сторону',
      r_car: 'Курицу сбила машина', r_train: 'Курицу переехал поезд', r_water: 'Курица утонула',
      r_edge: 'Курицу унесло течением', r_eagle: 'Курицу унёс орёл',
      hintEagle: 'Не стой на месте — прилетит орёл!'
    },
    en: {
      play: 'Play', loading: 'Loading…', tap: 'Tap to hop, swipe to steer',
      best: 'Best', coins: 'Coins', score: 'Score',
      gameOver: 'Game over', record: 'New record!',
      playAgain: 'Play again', revive: 'Continue for an ad', reviveWait: 'Loading ad…',
      paused: 'Paused', resume: 'Resume', restart: 'Restart', sound: 'Sound',
      controlsDesktop: 'WASD / arrows to hop, P to pause, M for sound',
      controlsMobile: 'Tap to hop, swipe to steer',
      r_car: 'The chicken got hit by a car', r_train: 'The chicken got hit by a train',
      r_water: 'The chicken drowned', r_edge: 'The chicken drifted away',
      r_eagle: 'The chicken was taken by an eagle',
      hintEagle: 'Keep moving or the eagle will get you!'
    }
  };

  function navLang() {
    var l = (global.navigator && (global.navigator.language || global.navigator.userLanguage)) || 'ru';
    l = String(l).toLowerCase().slice(0, 2);
    return STRINGS[l] ? l : 'en';
  }

  /* --- служебное ---------------------------------------------------------- */
  function ls(key, val) {
    try {
      if (val === undefined) { return global.localStorage.getItem(key); }
      global.localStorage.setItem(key, val);
    } catch (e) { /* приватный режим — игнорируем */ }
    return null;
  }
  function parseNum(v, def) { var n = parseInt(v, 10); return isFinite(n) ? n : def; }

  var P = {
    ok: false,            // SDK реально доступен
    ysdk: null,
    player: null,
    lang: 'ru',
    rewardedAvailable: false,
    leaderboardId: LEADERBOARD_NAME,

    /* колбэки, которые назначает игра */
    onPause: null,
    onResume: null,

    _lastAd: 0,
    _ready: false,
    _booting: false,

    /* --- перевод ---------------------------------------------------------- */
    t: function (key) {
      var d = STRINGS[P.lang] || STRINGS.en;
      return (d && d[key]) || STRINGS.en[key] || key;
    },

    /* --- инициализация ---------------------------------------------------- */
    init: function () {
      if (P._booting) { return P._readyPromise; }
      P._booting = true;
      P.lang = navLang();
      // ?ysdk=off — принудительно локальный режим (удобно отлаживать)
      var forceOff = /(\?|&)ysdk=off/.test(global.location ? global.location.search : '');

      P._readyPromise = new Promise(function (resolve) {
        var settled = false;
        function done() { if (!settled) { settled = true; resolve(P); } }

        if (forceOff || typeof global.YaGames === 'undefined') {
          P.debugAd = /(\?|&)debug=1/.test(global.location ? global.location.search : '');
          if (P.debugAd) { P.rewardedAvailable = true; }   // локальная проверка кнопки «продолжить»
          setTimeout(done, 0);
          return;
        }

        var timer = setTimeout(function () {
          // SDK не ответил (медленная сеть, открыт вне площадки) — играем без него
          done();
        }, INIT_TIMEOUT_MS);

        global.YaGames.init().then(function (ysdk) {
          P.ysdk = ysdk;
          P.ok = true;
          P.rewardedAvailable = true;
          try {
            var lang = ysdk.environment.i18n.lang;
            if (STRINGS[lang]) { P.lang = lang; }
          } catch (e) { /* остаётся язык браузера */ }

          // игрок (для сохранений и лидерборда)
          try {
            ysdk.getPlayer({ scopes: false }).then(function (pl) { P.player = pl; }, function () {});
          } catch (e) {}

          // липкий баннер
          if (USE_STICKY_BANNER) {
            try { ysdk.adv.showBannerAdv(); } catch (e) {}
          }

          // сообщаем платформе, что игра готова к показу
          try { ysdk.features.LoadingAPI.ready(); } catch (e) {}
          P._ready = true;

          clearTimeout(timer);
          done();
        }).catch(function () {
          clearTimeout(timer);
          done();
        });
      });
      return P._readyPromise;
    },

    /* --- геймплей (обязательно для игр с рекламой) ------------------------ */
    gameplayStart: function () {
      try { if (P.ysdk && P.ysdk.features.GameplayAPI) { P.ysdk.features.GameplayAPI.start(); } } catch (e) {}
    },
    gameplayStop: function () {
      try { if (P.ysdk && P.ysdk.features.GameplayAPI) { P.ysdk.features.GameplayAPI.stop(); } } catch (e) {}
    },

    /* --- реклама ---------------------------------------------------------- */
    canShowFullscreen: function (runMs) {
      if (!P.ok) { return false; }
      if (runMs !== undefined && runMs < AD_MIN_RUN_MS) { return false; }
      return (Date.now() - P._lastAd) > AD_COOLDOWN_MS;
    },
    showFullscreen: function (cb) {
      cb = cb || function () {};
      if (!P.ok || !P.ysdk) { cb(); return; }
      P._lastAd = Date.now();
      var closed = false;
      function finish() { if (!closed) { closed = true; cb(); } }
      try {
        P.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: function () { if (P.onPause) { P.onPause(); } },
            onClose: function () { if (P.onResume) { P.onResume(); } finish(); },
            onError: function () { if (P.onResume) { P.onResume(); } finish(); }
          }
        });
      } catch (e) { finish(); }
    },
    showRewarded: function (onReward, onFail) {
      // локальная отладка (?debug=1): имитируем успешный просмотр рекламы
      if (P.debugAd && !P.ok) { setTimeout(function () { if (onReward) { onReward(); } }, 250); return; }
      if (!P.ok || !P.ysdk) { if (onFail) { onFail(); } return; }
      var rewarded = false, closed = false;
      function finish() {
        if (closed) { return; }
        closed = true;
        if (rewarded) { if (onReward) { onReward(); } } else if (onFail) { onFail(); }
      }
      try {
        P.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: function () { if (P.onPause) { P.onPause(); } },
            onRewarded: function () { rewarded = true; },
            onClose: function () { if (P.onResume) { P.onResume(); } finish(); },
            onError: function () { if (P.onResume) { P.onResume(); } finish(); }
          }
        });
      } catch (e) { finish(); }
    },

    /* --- сохранения ------------------------------------------------------- */
    load: function () {
      var local = {
        best: parseNum(ls('cc_best'), 0),
        coins: parseNum(ls('cc_coins'), 0)
      };
      if (!P.player) { return Promise.resolve(local); }
      return P.player.getData(['best', 'coins']).then(function (d) {
        var best = Math.max(local.best, parseNum(d && d.best, 0));
        var coins = Math.max(local.coins, parseNum(d && d.coins, 0));
        return { best: best, coins: coins };
      }, function () { return local; });
    },
    save: function (data) {
      if (data.best !== undefined) { ls('cc_best', String(data.best)); }
      if (data.coins !== undefined) { ls('cc_coins', String(data.coins)); }
      if (P.player) {
        try { P.player.setData({ best: data.best, coins: data.coins }, true); } catch (e) {}
      }
    },

    /* --- таблица лидеров (опционально) ------------------------------------ */
    submitScore: function (score) {
      if (!P.ok || !P.leaderboardId || !score) { return; }
      try {
        P.ysdk.getLeaderboards().then(function (lb) {
          lb.setLeaderboardScore(P.leaderboardId, score);
        }, function () {});
      } catch (e) {}
    }
  };

  global.Platform = P;
})(typeof window !== 'undefined' ? window : this);
