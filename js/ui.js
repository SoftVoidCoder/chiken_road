/* ============================================================================
   ui.js — интерфейс: HUD, меню, пауза, магазин, настройки
   ----------------------------------------------------------------------------
   Экраны живут в DOM поверх холста: так их дешевле верстать и проще
   адаптировать под ТВ и крупные шрифты, а игровое поле не блокируется.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var diff = U.diff, bestFor = U.bestFor, profile = U.profile, saveProfile = U.saveProfile;
  var Pl = CC.platform, Sound = CC.audio, GM = CC.game, W = CC.world;
  var SK = CC.skins, TH = CC.themes, META = CC.meta, DIFFS = C.DIFFS, A = CC.actors;
  /* ==========================================================================
     11. ИНТЕРФЕЙС (DOM)
     ========================================================================== */
  var $ = function (id) { return document.getElementById(id); };
  var el = {
    score: $('vScore'), best: $('vBest'), coins: $('vCoins'),
    ovMenu: $('ovMenu'), ovOver: $('ovOver'), ovPause: $('ovPause'), ovLoading: $('ovLoading'),
    ovSkins: $('ovSkins'), ovThemes: $('ovThemes'),
    ovModes: $('ovModes'), ovQuests: $('ovQuests'), ovAch: $('ovAch'), ovPass: $('ovPass'),
    ovLeaders: $('ovLeaders'), ovStore: $('ovStore'), ovStats: $('ovStats'),
    ovSettings: $('ovSettings'), ovTutorial: $('ovTutorial'),
    oScore: $('oScore'), oBest: $('oBest'), oRecord: $('oRecord'), oReason: $('tReason'),
    mBest: $('mBest'), mCoins: $('mCoins'),
    btnPlay: $('btnPlay'), btnRestart: $('btnRestart'), btnRevive: $('btnRevive'),
    btnResume: $('btnResume'), btnRestart2: $('btnRestart2'),
    btnMute: $('btnMute'), btnPause: $('btnPause'),
    btnPauseSound: $('btnPauseSound'), icPauseSound: $('icPauseSound'),
    btnPauseSkins: $('btnPauseSkins'), btnToMenu: $('btnToMenu'), btnMenuSkins: $('btnMenuSkins'),
    btnSkinsClose: $('btnSkinsClose'), skinsGrid: $('skinsGrid'), skCoins: $('skCoins'),
    btnMenuMaps: $('btnMenuMaps'), btnThemesClose: $('btnThemesClose'), themeGrid: $('themeGrid'),
    skinsHint: $('tSkinsHint'), diffHint: $('tDiffHint'),
    pScore: $('pScore'), pCoins: $('pCoins'), pDiff: $('pDiff'),
    pillCombo: $('pillCombo'), vCombo: $('vCombo'), pillBoost: $('pillBoost'), vBoost: $('vBoost'),
    hint: $('hintEagle')
  };
  var lastHUD = { score: -1, best: -1, coins: -1 };

  function syncHUD(force) {
    if (force || G.score !== lastHUD.score) { if (el.score) { el.score.textContent = String(G.score); } lastHUD.score = G.score; }
    var best = bestFor();
    if (force || best !== lastHUD.best) { if (el.best) { el.best.textContent = String(best); } lastHUD.best = best; }
    var shown = G.state === 'playing' ? G.coins : G.totalCoins;
    if (force || shown !== lastHUD.coins) { if (el.coins) { el.coins.textContent = String(shown); } lastHUD.coins = shown; }
    // Ход забега: комбо и активный буст видны прямо в игре
    var comboOn = G.state === 'playing' && G.combo >= 3;
    if (el.pillCombo) {
      el.pillCombo.hidden = !comboOn;
      if (comboOn && el.vCombo) { el.vCombo.textContent = '×' + (1 + Math.min(4, Math.floor(G.combo / 10))) + '  ' + G.combo; }
    }
    if (el.pillBoost) {
      el.pillBoost.hidden = !G.boostLabel;
      if (el.vBoost) { el.vBoost.textContent = G.boostLabel || ''; }
    }
  }

  function showOnly(which) {
    var list = [el.ovMenu, el.ovOver, el.ovPause, el.ovLoading, el.ovSkins, el.ovThemes,
      el.ovModes, el.ovQuests, el.ovAch, el.ovPass, el.ovLeaders, el.ovStore,
      el.ovStats, el.ovSettings, el.ovTutorial];
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
    // Магазин со слотами строит CC.screens: там же питомцы, следы, шапки и голоса
    if (CC.screens && CC.screens.buildSlotTabs) {
      CC.screens.buildSlotTabs();
      CC.screens.buildSlotItems();
    }
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
      A.drawSkinPreview(g, c.id, 64);
    }
    lastPreviewAt = G.t;
  }
  function refreshSkins() {
    if (el.skCoins) { el.skCoins.textContent = String(G.totalCoins); }
    if (CC.screens && CC.screens.buildSlotItems && el.ovSkins && el.ovSkins.classList.contains('on')) {
      CC.screens.buildSlotItems();
    }
    for (var i = 0; i < skinCards.length; i++) {
      var c = skinCards[i], sk = SK.byId[c.id];
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
    var sk = SK.byId[id];
    if (!sk || ownsSkin(id) || G.totalCoins < sk.price) { return false; }
    G.totalCoins -= sk.price;
    G.skins.push(id);
    saveProfile();
    syncHUD(true);
    refreshSkins();
    return true;
  }
  function equipSkin(id) {
    if (!SK.byId[id] || !ownsSkin(id)) { return false; }
    G.skin = id;
    saveProfile();
    refreshSkins();
    return true;
  }
  function pickSkin(id) {
    if (!SK.byId[id]) { return false; }
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

  // Экран карт: список биомов строится заново при каждом открытии, потому что
  // между открытиями мог измениться суммарный пробег и часть карт открылась.
  function openThemes() {
    buildThemeList();
    showOnly('ovThemes');
  }
  function closeThemes() {
    UI.menu();
    showOnly('ovMenu');
  }

  // выход в меню из паузы: забег не засчитываем, но прогресс сохраняем
  function toMenu() {
    saveProfile();
    Sound.resume();
    G.state = 'menu';
    G.eagle = null;
    GM.reset();
    Pl.gameplayStop();
    syncHUD(true);
    UI.menu();
    showOnly('ovMenu');
  }


  // --- точечные хуки для главного цикла и отладочного API -------------------
  // Превью скинов перерисовываются не каждый кадр, а примерно 12 раз в секунду:
  // этого хватает для анимации «радуги», но не грузит процессор.
  function tickPreviews() {
    if (el.ovSkins && el.ovSkins.classList.contains('on') && G.t - lastPreviewAt > 0.08) {
      lastPreviewAt = G.t;
      if (CC.screens && CC.screens.tick) { CC.screens.tick(); }
    }
  }
  function skinCardsCount() {
    return (CC.screens && CC.screens.cardCount) ? CC.screens.cardCount() : skinCards.length;
  }

  // Смена биома: сохраняем выбор и обновляем кэши (палитры меняются целиком)
  function setTheme(id) {
    if (!TH.byId[id]) { return G.themeId; }
    if (!TH.isUnlocked(id, META.stats().rows)) { return G.themeId; }
    G.themeId = id;
    U.clearCaches();
    U.saveProfile();
    buildThemeList();
    return G.themeId;
  }

  // Список карт в меню: открытые можно выбрать, закрытые показывают, сколько
  // ещё рядов нужно пройти.
  function buildThemeList() {
    var box = el.themeGrid;
    if (!box) { return; }
    var rows = META.stats().rows;
    var list = TH.list;
    var html = '';
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      var open = rows >= t.unlockRows;
      var sel = G.themeId === t.id;
      html += '<button class="themecard' + (sel ? ' sel' : '') + (open ? '' : ' locked') +
        '" data-theme="' + t.id + '" type="button">' +
        '<span class="thc-icon">' + (open ? t.icon : '🔒') + '</span>' +
        '<span class="thc-name">' + Pl.t('th_' + t.id) + '</span>' +
        '<span class="thc-tag">' + (open ? Pl.t('th_' + t.id + '_d') : Pl.t('unlockIn', { n: t.unlockRows - rows })) + '</span>' +
        '</button>';
    }
    box.innerHTML = html;
    var btns = box.querySelectorAll('.themecard');
    for (var b = 0; b < btns.length; b++) {
      (function (btn) {
        btn.addEventListener('click', function () {
          var id = btn.getAttribute('data-theme');
          if (!TH.isUnlocked(id, META.stats().rows)) { skinMessage(Pl.t('locked')); return; }
          Sound.hop();
          setTheme(id);
          showOnly('ovMenu');
        });
      })(btns[b]);
    }
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
      setT('tMenuMaps', 'maps'); setT('tMaps', 'maps'); setT('tMapsHint', 'mapsHint');
      setT('tSkinsHint', 'skinsHint'); setT('btnSkinsClose', 'back');
      for (var i = 0; i < skinCards.length; i++) {
        skinCards[i].name.textContent = Pl.t('sk_' + skinCards[i].id);
      }
      document.title = 'Crossy Chicken';
    },
    menu: function () {
      buildThemeList();
      if (CC.screens && CC.screens.refreshBadges) { CC.screens.refreshBadges(); }
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

  if (el.btnPlay) { el.btnPlay.addEventListener('click', function () { Sound.init(); GM.startGame(); }); }
  if (el.btnRestart) { el.btnRestart.addEventListener('click', function () { GM.startGame(); }); }
  if (el.btnRestart2) { el.btnRestart2.addEventListener('click', function () { Sound.resume(); GM.startGame(); }); }
  if (el.btnResume) { el.btnResume.addEventListener('click', function () { if (G.state === 'paused') { togglePause(); } }); }
  if (el.btnPause) { el.btnPause.addEventListener('click', function () { togglePause(); }); }
  if (el.btnMute) { el.btnMute.addEventListener('click', function () { toggleMute(); }); }
  if (el.btnPauseSound) { el.btnPauseSound.addEventListener('click', function () { toggleMute(); }); }
  if (el.btnPauseSkins) { el.btnPauseSkins.addEventListener('click', function () { openSkins('pause'); }); }
  if (el.btnMenuSkins) { el.btnMenuSkins.addEventListener('click', function () { openSkins('menu'); }); }
  if (el.btnSkinsClose) { el.btnSkinsClose.addEventListener('click', function () { closeSkins(); }); }
  if (el.btnMenuMaps) { el.btnMenuMaps.addEventListener('click', function () { openThemes(); }); }
  if (el.btnThemesClose) { el.btnThemesClose.addEventListener('click', function () { closeThemes(); }); }
  if (el.btnToMenu) { el.btnToMenu.addEventListener('click', function () { toMenu(); }); }
  if (el.btnRevive) {
    el.btnRevive.addEventListener('click', function () {
      var b = el.btnRevive;
      b.disabled = true;
      b.textContent = Pl.t('reviveWait');
      Pl.showRewarded(function () { GM.revive(); }, function () {
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

  // Единые точки изменения кошелька: через них проходят и покупки, и награды
  function addCoins(n) {
    G.totalCoins += Math.max(0, Math.round(n) || 0);
    U.saveProfile();
    syncHUD(true);
    refreshSkins();
    return G.totalCoins;
  }
  function spendCoins(n) {
    n = Math.max(0, Math.round(n) || 0);
    if (G.totalCoins < n) { return false; }
    G.totalCoins -= n;
    U.saveProfile();
    syncHUD(true);
    refreshSkins();
    return true;
  }

  U.expose(CC.ui, {
    $: $, el: el, syncHUD: syncHUD, showOnly: showOnly, showHint: showHint,
    hideHint: hideHint, toggleMute: toggleMute, togglePause: togglePause,
    setDiff: setDiff, openSkins: openSkins, closeSkins: closeSkins, toMenu: toMenu,
    buildSkinCards: buildSkinCards, refreshSkins: refreshSkins,
    drawSkinPreviews: drawSkinPreviews, buySkin: buySkin, equipSkin: equipSkin,
    pickSkin: pickSkin, screens: UI, tickPreviews: tickPreviews,
    skinCardsCount: skinCardsCount, setTheme: setTheme, buildThemeList: buildThemeList,
    addCoins: addCoins, spendCoins: spendCoins,
    openThemes: openThemes, closeThemes: closeThemes,
    applyLang: UI.applyLang, menu: UI.menu, over: UI.over, pauseScreen: UI.pause,
    refreshRecord: UI.refreshRecord
  });
})(window.CC);