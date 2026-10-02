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
       (общий рекорд, рекорды по трём сложностям, монеты, купленные скины)
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
      hintEagle: 'Не стой на месте — прилетит орёл!',

      /* сложность */
      diffEasy: 'Легко', diffEasySub: 'без спешки',
      diffNormal: 'Обычно', diffNormalSub: 'как в оригинале',
      diffHard: 'Сложно', diffHardSub: 'трафик и орёл',
      diffEasyHint: 'Машины едут медленнее, зазоры шире, орёл ждёт дольше.',
      diffNormalHint: 'Классический баланс: средний трафик и орёл через 7 секунд.',
      diffHardHint: 'Плотный поток, быстрые реки и орёл уже через 5 секунд — зато монет больше.',
      pauseHint: 'P / Esc — продолжить, M — звук', toMenu: 'В меню',

      /* скины */
      skins: 'Скины', wallet: 'Монеты', back: 'Назад',
      skinsHint: 'Купи скин за монеты и надень его — курица сразу изменится.',
      buy: 'Купить', equip: 'Надеть', equipped: 'Надето', owned: 'Куплено',
      poor: 'Мало монет', bought: 'Куплено!', notEnough: 'Не хватает монет',
      sk_classic: 'Классика', sk_chick: 'Цыплёнок', sk_bandit: 'Разбойник', sk_ninja: 'Ниндзя',
      sk_zombie: 'Зомби', sk_robot: 'Робот', sk_gold: 'Золотая', sk_rainbow: 'Радуга'
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
      hintEagle: 'Keep moving or the eagle will get you!',

      /* difficulty */
      diffEasy: 'Easy', diffEasySub: 'no rush',
      diffNormal: 'Normal', diffNormalSub: 'the original',
      diffHard: 'Hard', diffHardSub: 'traffic & eagle',
      diffEasyHint: 'Slower cars, wider gaps, the eagle waits longer.',
      diffNormalHint: 'Classic balance: average traffic, the eagle strikes after 7 seconds.',
      diffHardHint: 'Dense traffic, fast rivers, the eagle dives at 5 seconds — but coins are plentiful.',
      pauseHint: 'P / Esc to resume, M for sound', toMenu: 'Menu',

      /* skins */
      skins: 'Skins', wallet: 'Coins', back: 'Back',
      skinsHint: 'Buy a skin with coins and put it on — the chicken changes right away.',
      buy: 'Buy', equip: 'Wear', equipped: 'Worn', owned: 'Owned',
      poor: 'Too few coins', bought: 'Bought!', notEnough: 'Not enough coins',
      sk_classic: 'Classic', sk_chick: 'Chick', sk_bandit: 'Bandit', sk_ninja: 'Ninja',
      sk_zombie: 'Zombie', sk_robot: 'Robot', sk_gold: 'Golden', sk_rainbow: 'Rainbow'
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
  function parseList(v) {
    if (!v) { return []; }
    var out = [];
    String(v).split(',').forEach(function (s) { s = s.trim(); if (s && out.indexOf(s) < 0) { out.push(s); } });
    return out;
  }

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
    // Профиль игрока: общий рекорд, рекорды по сложностям, монеты, скины.
    load: function () {
      var local = {
        best: parseNum(ls('cc_best'), 0),
        coins: parseNum(ls('cc_coins'), 0),
        bests: {
          easy: parseNum(ls('cc_best_easy'), 0),
          normal: parseNum(ls('cc_best_normal'), 0),
          hard: parseNum(ls('cc_best_hard'), 0)
        },
        skins: parseList(ls('cc_skins')),
        skin: ls('cc_skin') || '',
        diff: ls('cc_diff') || ''
      };
      if (!P.player) { return Promise.resolve(local); }
      return P.player.getData(['best', 'coins', 'bests', 'skins', 'skin', 'diff']).then(function (d) {
        d = d || {};
        var rBests = (d.bests && typeof d.bests === 'object') ? d.bests : {};
        var bests = {
          easy: Math.max(local.bests.easy, parseNum(rBests.easy, 0)),
          normal: Math.max(local.bests.normal, parseNum(rBests.normal, 0)),
          hard: Math.max(local.bests.hard, parseNum(rBests.hard, 0))
        };
        var skins = local.skins.slice();
        if (Array.isArray(d.skins)) {
          for (var i = 0; i < d.skins.length; i++) {
            var id = String(d.skins[i]);
            if (id && skins.indexOf(id) < 0) { skins.push(id); }
          }
        }
        return {
          best: Math.max(local.best, parseNum(d.best, 0), bests.easy, bests.normal, bests.hard),
          coins: Math.max(local.coins, parseNum(d.coins, 0)),
          bests: bests,
          skins: skins,
          skin: local.skin || (typeof d.skin === 'string' ? d.skin : ''),
          diff: local.diff || (typeof d.diff === 'string' ? d.diff : '')
        };
      }, function () { return local; });
    },
    save: function (data) {
      var payload = {};
      if (data.best !== undefined) {
        ls('cc_best', String(data.best));
        payload.best = data.best;
      }
      if (data.coins !== undefined) {
        var c = Math.max(0, Math.round(data.coins));
        ls('cc_coins', String(c));
        payload.coins = c;
      }
      if (data.bests && typeof data.bests === 'object') {
        payload.bests = {};
        for (var k in data.bests) {
          if (!data.bests.hasOwnProperty(k)) { continue; }
          payload.bests[k] = Math.max(0, Math.round(data.bests[k] || 0));
          ls('cc_best_' + k, String(payload.bests[k]));
        }
      }
      if (data.skins) {
        payload.skins = data.skins.slice();
        ls('cc_skins', payload.skins.join(','));
      }
      if (data.skin) {
        payload.skin = data.skin;
        ls('cc_skin', data.skin);
      }
      if (data.diff) {
        payload.diff = data.diff;
        ls('cc_diff', data.diff);
      }
      if (P.player) {
        try { P.player.setData(payload, true); } catch (e) {}
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
