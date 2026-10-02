/* ============================================================================
   audio.js — звук и музыка: файлы из assets/audio
   ----------------------------------------------------------------------------
   Эффекты — короткие ogg из свободных наборов (Kenney, OpenGameArt), музыка —
   чиптюн-треки Juhani Junkala. Все они лежат рядом с игрой в assets/audio и
   собираются скриптом dev/build-audio.sh; лицензии — в assets/audio/CREDITS.md.
   Эффекты играются через WebAudio (буферы), музыка — через <audio loop>, чтобы
   не держать в памяти распакованные дорожки. Если файлы недоступны (кто-то
   скопировал только js/), включается прежний синтез — игра не остаётся немой.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;

  /* ==========================================================================
     5. ЗВУК
     ========================================================================== */
  var Sound = (function () {
    var BASE = 'assets/audio/';

    // Короткие эффекты: имя в игре → файл.
    var SAMPLES = {
      hop:      'hop.ogg',
      land:     'land.ogg',
      coin:     'coin.ogg',
      crash:    'crash.ogg',
      splash:   'splash.ogg',
      horn:     'horn.ogg',
      brake:    'brake.ogg',
      sink:     'sink.ogg',
      click:    'click.ogg',
      open:     'open.ogg',
      close:    'close.ogg',
      select:   'select.ogg',
      error:    'error.ogg',
      boost:    'boost.ogg',
      buy:      'buy.ogg',
      shield:   'shield.ogg',
      record:   'record.ogg',
      levelup:  'levelup.ogg',
      gameover: 'gameover.ogg'
    };

    // Музыка: состояние игры → файл.
    var TRACKS = {
      menu:  'music/menu.ogg',
      game1: 'music/game1.ogg',
      game2: 'music/game2.ogg',
      game3: 'music/game3.ogg',
      over:  'music/over.ogg'
    };

    var ac = null, master = null, sfxBus = null, musicBusGain = 1;
    var buf = {}, html = {}, dead = {};
    var muted = false, sfxOn = true, musicOn = true;
    var loaded = false, unlocked = false;

    // музыка
    var mEl = null, mName = '', mTimer = null, duck = 1;
    var MUSIC_VOL = 0.34;

    /* --- инициализация ---------------------------------------------------- */
    function init() {
      if (!ac) {
        try {
          var AC = window.AudioContext || window.webkitAudioContext;
          if (AC) {
            ac = new AC();
            master = ac.createGain();
            master.gain.value = 1;
            master.connect(ac.destination);
            sfxBus = ac.createGain();
            sfxBus.gain.value = muted || !sfxOn ? 0 : 0.9;
            sfxBus.connect(master);
          }
        } catch (e) { ac = null; }
      }
      if (ac && ac.state === 'suspended' && unlocked) { try { ac.resume(); } catch (e) {} }
      return ac;
    }

    // Первый жест игрока снимает блокировку автозапуска звука в браузере.
    function unlock() {
      unlocked = true;
      init();
      try { if (ac && ac.state === 'suspended') { ac.resume(); } } catch (e) {}
      if (musicOn && mName) { music(mName, true); }
    }

    /* --- загрузка банка --------------------------------------------------- */
    function load() {
      if (loaded) { return Promise.resolve(true); }
      loaded = true;
      init();
      var names = [], k;
      for (k in SAMPLES) { if (SAMPLES.hasOwnProperty(k)) { names.push(k); } }
      if (!ac || typeof window.fetch !== 'function') {
        // без WebAudio остаётся <audio>: он умеет читать и локальные файлы
        for (var i = 0; i < names.length; i++) { markHtml(names[i]); }
        return Promise.resolve(false);
      }
      var jobs = [];
      for (var j = 0; j < names.length; j++) { jobs.push(fetchOne(names[j])); }
      return Promise.all(jobs).then(function () { return true; }, function () { return false; });
    }

    function fetchOne(name) {
      return window.fetch(BASE + SAMPLES[name]).then(function (r) {
        if (!r.ok) { throw new Error('http ' + r.status); }
        return r.arrayBuffer();
      }).then(function (data) {
        return new Promise(function (res, rej) {
          // старые сборки Safari требуют колбэки вместо промиса
          var p = ac.decodeAudioData(data, function (b) { res(b); }, function (e) { rej(e); });
          if (p && p.then) { p.then(res, rej); }
        });
      }).then(function (b) {
        buf[name] = b;
      }, function () { markHtml(name); });
    }

    /* --- резервные способы воспроизведения -------------------------------- */
    // Если файл не декодировался — держим наготове <audio> с тем же файлом.
    function markHtml(name) {
      if (buf[name] || dead[name]) { return; }
      try {
        var a = document.createElement('audio');
        a.src = BASE + SAMPLES[name];
        a.preload = 'auto';
        a.volume = 0.8;
        a.addEventListener('error', function () { dead[name] = true; html[name] = null; });
        html[name] = a;
      } catch (e) { dead[name] = true; }
    }

    function htmlPlay(name, rate, vol) {
      var a = html[name];
      if (!a || dead[name]) { return false; }
      try {
        var node = a.cloneNode(true);          // новый узел — звук можно накладывать
        node.volume = Math.max(0, Math.min(1, (vol || 1) * 0.8));
        if (rate && rate !== 1) { node.playbackRate = rate; }
        node.play();
        return true;
      } catch (e) { return false; }
    }

    // Последний рубеж: короткий синтез, чтобы игра не была совсем немой.
    function beep(f1, f2, dur, type, vol) {
      if (!ac || muted || !sfxOn) { return; }
      try {
        var t = ac.currentTime;
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = type || 'square';
        o.frequency.setValueAtTime(f1, t);
        if (f2 && f2 !== f1) { o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur); }
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(vol || 0.25, t + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(sfxBus);
        o.start(t); o.stop(t + dur + 0.03);
      } catch (e) {}
    }
    var SYNTH = {
      hop:      function () { beep(520, 760, 0.07, 'square', 0.13); },
      land:     function () { beep(300, 200, 0.06, 'triangle', 0.12); },
      coin:     function () { beep(1180, 1180, 0.06, 'square', 0.16); },
      splash:   function () { beep(420, 90, 0.3, 'sine', 0.18); },
      crash:    function () { beep(180, 60, 0.35, 'sawtooth', 0.3); },
      horn:     function () { beep(220, 220, 0.5, 'sawtooth', 0.22); },
      brake:    function () { beep(1800, 700, 0.35, 'sawtooth', 0.16); },
      sink:     function () { beep(240, 90, 0.5, 'sine', 0.18); },
      click:    function () { beep(900, 900, 0.04, 'square', 0.1); },
      open:     function () { beep(600, 900, 0.09, 'square', 0.12); },
      close:    function () { beep(700, 420, 0.09, 'square', 0.12); },
      select:   function () { beep(820, 820, 0.05, 'square', 0.1); },
      error:    function () { beep(240, 180, 0.18, 'square', 0.16); },
      boost:    function () { beep(700, 1400, 0.25, 'square', 0.16); },
      buy:      function () { beep(880, 1320, 0.16, 'square', 0.16); },
      shield:   function () { beep(300, 900, 0.2, 'triangle', 0.16); },
      record:   function () { [660, 880, 1180].forEach(function (f, i) { setTimeout(function () { beep(f, f, 0.14, 'square', 0.18); }, i * 110); }); },
      levelup:  function () { beep(520, 1040, 0.4, 'square', 0.16); },
      gameover: function () { beep(520, 130, 0.7, 'triangle', 0.26); }
    };

    /* --- воспроизведение эффекта ------------------------------------------ */
    function play(name, opt) {
      opt = opt || {};
      if (muted || !sfxOn || !name) { return; }
      var vol = opt.vol === undefined ? 1 : opt.vol;
      var rate = opt.rate || 1;
      var b = buf[name];
      if (ac && b) {
        try {
          var t = ac.currentTime + (opt.delay || 0);
          var src = ac.createBufferSource();
          src.buffer = b;
          src.playbackRate.value = rate;
          var g = ac.createGain();
          g.gain.value = vol;
          src.connect(g); g.connect(sfxBus);
          src.start(t);
          return;
        } catch (e) {}
      }
      if (htmlPlay(name, rate, vol)) { return; }
      var s = SYNTH[name];
      if (s) { s(); }
    }

    /* --- музыка ----------------------------------------------------------- */
    function ensureEl() {
      if (mEl) { return mEl; }
      try {
        mEl = document.createElement('audio');
        mEl.loop = true;
        mEl.preload = 'auto';
        mEl.volume = 0;
        document.body.appendChild(mEl);
      } catch (e) { mEl = null; }
      return mEl;
    }

    function targetVol() { return musicOn && !muted && unlocked ? MUSIC_VOL * duck : 0; }

    function fadeTo(el, to, ms, done) {
      if (mTimer) { clearInterval(mTimer); mTimer = null; }
      if (!el) { if (done) { done(); } return; }
      var from = el.volume, steps = Math.max(1, Math.round(ms / 40)), i = 0;
      mTimer = setInterval(function () {
        i++;
        var v = from + (to - from) * (i / steps);
        try { el.volume = Math.max(0, Math.min(1, v)); } catch (e) {}
        if (i >= steps) {
          clearInterval(mTimer); mTimer = null;
          if (done) { done(); }
        }
      }, 40);
    }

    // music('menu') — переключение дорожки; повторный вызов той же ничего не делает
    function music(name, force) {
      if (!TRACKS[name]) { return; }
      if (name === mName && !force) { return; }
      var el = ensureEl();
      if (!el) { mName = name; return; }
      var switching = mName && mName !== name;
      mName = name;
      var start = function () {
        try { el.pause(); } catch (e) {}
        // тот же файл — просто продолжаем с текущего места
        if (el.getAttribute('data-track') !== name) {
          el.setAttribute('data-track', name);
          el.src = BASE + TRACKS[name];
        }
        try { el.currentTime = el.currentTime || 0; } catch (e) {}
        try { el.play().catch(function () {}); } catch (e) {}
        fadeTo(el, targetVol(), switching ? 700 : 400);
      };
      if (switching && el.volume > 0.01) { fadeTo(el, 0, 260, start); }
      else { start(); }
    }

    function stopMusic() {
      mName = '';
      if (!mEl) { return; }
      var el = mEl;
      fadeTo(el, 0, 260, function () { try { el.pause(); } catch (e) {} });
    }

    // Приглушение на паузе и во время рекламы: дорожка не сбрасывается
    function setDuck(v) {
      duck = v;
      if (mEl && mEl.volume > 0.01) { fadeTo(mEl, targetVol(), 250); }
    }

    function applySfxGain() {
      if (sfxBus) { sfxBus.gain.value = muted || !sfxOn ? 0 : 0.9; }
    }

    /* --- настройки -------------------------------------------------------- */
    function setMuted(m) {
      muted = !!m;
      applySfxGain();
      if (mEl) { fadeTo(mEl, targetVol(), 220); }
    }
    function setSfx(on) { sfxOn = !!on; applySfxGain(); }
    function setMusic(on) {
      musicOn = !!on;
      if (!musicOn) { if (mEl) { fadeTo(mEl, 0, 220, function () { try { mEl.pause(); } catch (e) {} }); } }
      else if (mName) { music(mName, true); }
    }

    /* --- пауза платформы -------------------------------------------------- */
    function suspend() {
      try { if (ac && ac.state === 'running') { ac.suspend(); } } catch (e) {}
      setDuck(0.35);
    }
    function resume() {
      try { if (ac && ac.state === 'suspended' && unlocked) { ac.resume(); } } catch (e) {}
      setDuck(1);
    }

    /* --- дорожка под текущий забег ---------------------------------------- */
    // Сложность и режим выбирают трек: спокойнее для лёгкой, злее для жёсткой.
    function runTrack() {
      var diff = G && G.diffId;
      var mode = G && G.modeId;
      if (mode === 'extreme' || mode === 'nostop' || diff === 'hard') { return 'game3'; }
      if (diff === 'normal') { return 'game2'; }
      return 'game1';
    }

    return {
      init: init,
      unlock: unlock,
      load: load,
      play: play,

      hop:      function () { play('hop', { rate: 1 + (Math.random() * 0.08 - 0.04) }); },
      land:     function () { play('land', { rate: 1 + (Math.random() * 0.1 - 0.05) }); },
      coin:     function () { play('coin', { rate: 1 + (Math.random() * 0.06 - 0.03) }); },
      splash:   function () { play('splash'); },
      crash:    function () { play('crash'); play('land', { vol: 0.5, rate: 0.7 }); },
      horn:     function () { play('horn', { rate: 1 + (Math.random() * 0.1 - 0.05) }); },
      screech:  function () {
        play('brake', { rate: 0.95 });
        setTimeout(function () { play('brake', { rate: 1.12, vol: 0.8 }); }, 70);
      },
      sink:     function () { play('sink'); },
      click:    function () { play('click'); },
      open:     function () { play('open'); },
      close:    function () { play('close'); },
      select:   function () { play('select'); },
      error:    function () { play('error'); },
      boost:    function () { play('boost'); },
      buy:      function () { play('buy'); },
      shield:   function () { play('shield'); },
      record:   function () { play('record'); },
      levelup:  function () { play('levelup'); },
      over:     function () { play('gameover'); },

      music: music,
      stopMusic: stopMusic,
      // Состояние банка: сколько эффектов декодировано, играет ли музыка.
      // Нужно тестам и отладочному API, на геймплей не влияет.
      state: function () {
        var n = 0, k;
        for (k in SAMPLES) { if (buf[k]) { n++; } }
        return { buffers: n, total: Object.keys(SAMPLES).length, music: mName, muted: muted, sfx: sfxOn, musicOn: musicOn };
      },
      runTrack: runTrack,
      duck: setDuck,
      setMuted: setMuted,
      setSfx: setSfx,
      setMusic: setMusic,
      suspend: suspend,
      resume: resume
    };
  })();

  U.expose(CC.audio, Sound);
})(window.CC);
