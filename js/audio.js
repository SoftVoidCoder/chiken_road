/* ============================================================================
   audio.js — звук: синтез на WebAudio, без файлов
   ----------------------------------------------------------------------------
   Все звуки считаются осцилляторами и шумом на месте: ни одного mp3/ogg.
   Модуль отдаёт CC.audio и умеет засыпать при потере фокуса и во время рекламы.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;

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

  U.expose(CC.audio, Sound);
})(window.CC);
