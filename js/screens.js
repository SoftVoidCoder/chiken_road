/* ============================================================================
   screens.js — экраны прогрессии, магазина и настроек
   ----------------------------------------------------------------------------
   Здесь живёт вся обвязка вокруг игры: режимы и бусты, задания, достижения,
   сезонный пропуск, рейтинг, статистика, настройки, обучение и витрина
   покупок. Экраны строятся из данных CC.meta и CC.skins, поэтому новая
   награда или товар появляется в интерфейсе сам.

   Правила, которых модуль придерживается:
     • ничего не считает сам — прогресс считает CC.meta, покупки проводит
       CC.platform, а модуль только показывает и вызывает;
     • реклама за вознаграждение всегда подписана тем, что игрок получит
       (требование площадки 4.5.1);
     • при отрисовке строк используется один и тот же вид, поэтому экраны
       выглядят одинаково и легко читаются на телевизоре.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl;
  var Pl = CC.platform, META = CC.meta, SK = CC.skins, TH = CC.themes, UI = CC.ui;
  var A = CC.actors, SND = CC.audio;

  var T = function (k, v) { return Pl.t(k, v); };
  function $(id) { return document.getElementById(id); }

  /* ==========================================================================
     Общие кирпичики интерфейса
     ========================================================================== */
  function node(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) { n.className = cls; }
    if (text !== undefined && text !== null) { n.textContent = String(text); }
    return n;
  }

  // Узел с разметкой: нужен там, где в подпись встраивается значок монеты
  function markup(tag, cls, html) {
    var n = node(tag, cls);
    n.innerHTML = html;
    return n;
  }
  // «120 🪙» — сумма со значком монеты из спрайта
  function coinText(n) { return String(n) + ' ' + U.iconHtml('i-coin'); }

  // Строка списка: значок, заголовок, подпись и (необязательно) кнопка.
  // Значок — либо имя символа из спрайта ('i-coin'), либо готовая строка
  // (номер места в рейтинге), либо узел. Кнопка без обработчика не рисуется
  // вовсе: раньше на экранах висели «мёртвые» кнопки, которые ничего не делали.
  function row(icon, title, sub, btnText, btnCls, onClick) {
    var r = node('div', 'row');
    if (icon) {
      var ric = node('div', 'ric');
      if (typeof icon === 'string' && icon.indexOf('i-') === 0) { ric.appendChild(U.icon(icon)); }
      else if (typeof icon === 'string') { ric.textContent = icon; }
      else { ric.appendChild(icon); }
      r.appendChild(ric);
    }
    var txt = node('div', 'rtxt');
    txt.appendChild(node('div', 'rt', title));
    if (sub) { txt.appendChild(node('div', 'rs', sub)); }
    r.appendChild(txt);
    if (btnText && onClick) {
      var b = node('button', 'rbtn ' + (btnCls || ''));
      b.type = 'button';
      if (String(btnText).indexOf('<') >= 0) { b.innerHTML = btnText; } else { b.textContent = String(btnText); }
      b.addEventListener('click', onClick);
      r.appendChild(b);
    } else if (btnText) {
      // состояние, а не действие: показываем плашкой, а не кнопкой
      var tagEl = node('span', 'rstate ' + (btnCls || ''));
      if (String(btnText).indexOf('<') >= 0) { tagEl.innerHTML = btnText; } else { tagEl.textContent = String(btnText); }
      r.appendChild(tagEl);
    }
    return r;
  }

  function bar(fraction) {
    var wrap = node('div', 'bar');
    var fill = node('i');
    fill.style.width = Math.max(0, Math.min(100, Math.round(fraction * 100))) + '%';
    wrap.appendChild(fill);
    return wrap;
  }

  function clearBox(id) {
    var box = $(id);
    if (!box) { return null; }
    box.innerHTML = '';
    return box;
  }

  function pct(a, b) { return b > 0 ? a / b : 0; }

  /* ==========================================================================
     Экраны: открытие и закрытие
     ========================================================================== */
  var SCREENS = {
    modes: 'ovModes', quests: 'ovQuests', ach: 'ovAch',
    leaders: 'ovLeaders', store: 'ovStore', stats: 'ovStats', settings: 'ovSettings',
    skins: 'ovSkins', maps: 'ovThemes'
  };

  function open(name) {
    var id = SCREENS[name];
    if (!id) { return; }
    build(name);
    UI.showOnly(id);
    SND.hop();
  }
  function closeToMenu() {
    UI.menu();
    UI.showOnly('ovMenu');
    refreshBadges();
  }
  function closeToPause() {
    UI.pauseScreen();
    UI.showOnly('ovPause');
  }
  function build(name) {
    if (name === 'modes') { buildModes(); }
    else if (name === 'quests') { buildQuests(); }
    else if (name === 'ach') { buildAch(); }
    else if (name === 'leaders') { buildLeaders(); }
    else if (name === 'store') { buildStore(); }
    else if (name === 'stats') { buildStats(); }
    else if (name === 'settings') { buildSettings(); }
  }

  /* ==========================================================================
     Режимы и бусты
     ========================================================================== */
  var MODES = [
    { id: 'classic',  icon: 'i-chicken', name: 'mode_classic',  desc: 'mode_classic_d' },
    { id: 'water',    icon: 'i-water',   name: 'mode_water',    desc: 'mode_water_d' },
    { id: 'rails',    icon: 'i-rails',   name: 'mode_rails',    desc: 'mode_rails_d' },
    { id: 'nostop',   icon: 'i-zap',     name: 'mode_nostop',   desc: 'mode_nostop_d' },
    { id: 'night',    icon: 'i-moon',    name: 'mode_night',    desc: 'mode_night_d' },
    { id: 'extreme',  icon: 'i-flame',   name: 'mode_extreme',  desc: 'mode_extreme_d' }
  ];
  // значки бустов: имена символов спрайта
  var BOOST_ICON = { magnet: 'i-magnet', slow: 'i-slow', shield: 'i-shield', double: 'i-double', mini: 'i-egg' };

  function modeById(id) {
    for (var i = 0; i < MODES.length; i++) { if (MODES[i].id === id) { return MODES[i]; } }
    return MODES[0];
  }

  function buildModes() {
    var box = clearBox('modeGrid');
    if (!box) { return; }
    // Под заголовком всегда написано, какой режим выбран: раньше после нажатия
    // ничего не менялось на вид, и казалось, что раздел не работает.
    var cur = modeById(G.modeId);
    var hint = $('tModesHint');
    if (hint) {
      hint.textContent = T('mode_now', { s: T(cur.name) }) + ' — ' + T(cur.desc) +
        (cur.id === 'classic' ? '' : ' ' + T('mode_applies'));
    }
    for (var i = 0; i < MODES.length; i++) {
      (function (m) {
        var on = G.modeId === m.id;
        var card = node('button', 'themecard' + (on ? ' sel' : ''));
        card.type = 'button';
        card.setAttribute('data-mode', m.id);
        if (on) { card.setAttribute('aria-pressed', 'true'); }
        var mIcon = node('span', 'thc-icon');
        mIcon.appendChild(U.icon(m.icon));
        card.appendChild(mIcon);
        card.appendChild(node('span', 'thc-name', T(m.name)));
        card.appendChild(node('span', 'thc-tag', T(m.desc)));
        if (on) {
          var mark = node('span', 'thc-mark');
          mark.appendChild(U.icon('i-check'));
          card.appendChild(mark);
        }
        card.addEventListener('click', function () {
          var same = G.modeId === m.id;
          G.modeId = m.id;
          U.saveProfile();
          buildModes();
          SND.select();
          toast(same ? T('mode_already', { s: T(m.name) }) : T('mode_on', { s: T(m.name) }));
        });
        box.appendChild(card);
      })(MODES[i]);
    }
    buildBoosts('boostRow', true);
  }

  // Бусты: в меню их можно купить, в паузе — применить в текущем забеге
  // A/B-эксперимент: половина игроков видит бусты на 20 % дешевле, половина —
  // рекламу чуть реже. Вариант закрепляется за игроком навсегда и уходит в метрики.
  function boostPrice(b) {
    var bucket = Pl.ab('boost_price', ['base', 'cheap']);
    return bucket === 'cheap' ? Math.round(b.price * 0.8) : b.price;
  }

  // Реклама за вознаграждение доступна только на площадке (или в отладочном режиме)
  function adsReady() { return !!(Pl.rewardedAvailable || Pl.debugAd); }

  function buildBoosts(targetId, shop) {
    var box = clearBox(targetId);
    if (!box) { return; }
    var list = SK.boosts;
    for (var i = 0; i < list.length; i++) {
      (function (b) {
        var active = G.boost === b.id || (b.id === 'shield' && G.shield > 0);
        var stock = (G.boostStock && G.boostStock[b.id]) || 0;
        var price = boostPrice(b);
        var card = node('button', 'bcard' + (active ? ' sel' : '') + (stock > 0 ? ' has' : ''));
        card.type = 'button';
        card.setAttribute('data-boost', b.id);
        var bic = node('span', 'bic');
        bic.appendChild(U.icon(BOOST_ICON[b.id] || 'i-star'));
        card.appendChild(bic);
        card.appendChild(node('span', 'bn', T(b.name)));
        // Подпись честно говорит, что произойдёт по нажатию
        var label;
        if (shop) {
          label = T('price_coins', { n: price });
        } else if (stock > 0) {
          label = T('use') + ' ×' + stock;
          card.className += ' ready';
        } else if (G.totalCoins >= price) {
          label = T('price_coins', { n: price });
        } else if (adsReady()) {
          label = T('watch_ad');
        } else {
          label = T('poor');
        }
        card.appendChild(node('span', 'bp', label));
        // Запас виден всегда: в меню он объясняет, что уже куплено
        if (stock > 0) { card.appendChild(markup('span', 'bp stock', T('stock') + ': ' + stock)); }
        card.addEventListener('click', function () { boostAction(b, shop); });
        box.appendChild(card);
      })(list[i]);
    }
  }

  // Нажатие на буст. В меню — покупка в запас, в забеге — применение из запаса,
  // а если запаса нет, то покупка за монеты прямо здесь (раньше в забеге можно
  // было только смотреть рекламу, и без площадки буст не включался вообще).
  function boostAction(b, shop) {
    var price = boostPrice(b);
    var stock = (G.boostStock && G.boostStock[b.id]) || 0;
    if (!shop && stock > 0) {
      G.boostStock[b.id] = stock - 1;
      if (CC.game.activateBoost(b.id)) {
        SND.boost();
        toast(T('boost_on', { s: T(b.name) }));
        buildBoosts('pauseBoostRow', false);
      }
      return;
    }
    if (G.totalCoins >= price) {
      if (!UI.spendCoins(price)) { return; }
      if (shop) {
        G.boostStock = G.boostStock || {};
        G.boostStock[b.id] = (G.boostStock[b.id] || 0) + 1;
        U.saveProfile();
        SND.buy();
        toast(T('bought'));
        buildBoosts('boostRow', true);
      } else {
        // в забеге покупаем и сразу применяем: запас не нужен
        if (CC.game.activateBoost(b.id)) {
          SND.boost();
          toast(T('boost_on', { s: T(b.name) }));
        }
        buildBoosts('pauseBoostRow', false);
      }
      return;
    }
    if (!shop && adsReady()) {
      Pl.showRewarded(function () {
        if (CC.game.activateBoost(b.id)) {
          SND.boost();
          buildBoosts('pauseBoostRow', false);
        }
        if (META && META.onAd) { META.onAd(); }
      }, function () { toast(T('purchaseFail')); });
      return;
    }
    SND.error();
    toast(T('notEnough'));
  }

  /* ==========================================================================
     Испытание дня
     ========================================================================== */
  function startDaily() {
    var today = new Date().toISOString().slice(0, 10);
    G.daily = true;
    G.modeId = 'classic';
    UI.setDiff('normal', true);
    UI.showOnly(null);
    CC.game.startGame();
    G.dailyDate = today;
    G.dailyPlayed = true;
    U.saveProfile();
    refreshBadges();
    if (META && META.onDailyDone) { META.onDailyDone(); }
  }

  /* ==========================================================================
     Задания
     ========================================================================== */
  function buildQuests() {
    var box = clearBox('questList');
    var coins = $('qCoins');
    if (coins) { coins.textContent = String(G.totalCoins); }
    if (!box) { return; }
    var q = META.quests();
    box.appendChild(node('div', 'subh', T('quest_daily')));
    for (var i = 0; i < q.daily.length; i++) { box.appendChild(questRow(q.daily[i])); }
    box.appendChild(node('div', 'subh', T('quest_weekly')));
    for (var j = 0; j < q.weekly.length; j++) { box.appendChild(questRow(q.weekly[j])); }
  }

  function questText(q) {
    var vars = { n: q.target };
    if (q.type === 'biome' && q.biome) { vars.b = T('th_' + q.biome); }
    if (q.type === 'diff' && q.diff) { vars.d = T('diff' + q.diff.charAt(0).toUpperCase() + q.diff.slice(1)); }
    return T('q_' + q.type, vars);
  }

  function questRow(q) {
    var sub = questText(q) + ' — ' + q.progress + '/' + q.target;
    // Незакрытое задание не получает кнопку: прогресс показывает полоса.
    // Раньше там висела кнопка «Прогресс», которая ничего не делала.
    var btn = null, cls = '';
    if (q.claimed) { btn = T('q_claimed'); cls = 'off'; }
    else if (q.done) { btn = T('q_claim') + ' +' + q.reward + ' ' + U.iconHtml('i-coin'); cls = 'gold'; }
    var r = row(q.claimed ? 'i-check' : (q.done ? 'i-gift' : 'i-quests'), questText(q), sub, btn, cls,
      (q.done && !q.claimed) ? function () {
        var got = META.claimQuest(q.id);
        if (got) {
          UI.addCoins(got.coins);
          SND.coin();
          toast(T('reward_coins', { n: got.coins }));
          buildQuests();
          refreshBadges();
        }
      } : null);
    if (!q.done) { r.appendChild(bar(pct(q.progress, q.target))); }
    else { r.className += ' done'; }
    return r;
  }

  /* ==========================================================================
     Достижения
     ========================================================================== */
  function buildAch() {
    var box = clearBox('achList');
    if (!box) { return; }
    var list = META.achievements();
    var open = 0;
    for (var i = 0; i < list.length; i++) { if (list[i].unlocked) { open++; } }
    box.appendChild(node('div', 'subh', open + ' / ' + list.length));
    for (var j = 0; j < list.length; j++) {
      var a = list[j];
      // Достижение нельзя «нажать»: открытое отмечаем галочкой в строке,
      // закрытое — замком. Мёртвых кнопок «Готово» здесь больше нет.
      var ar = row(a.unlocked ? 'i-trophy' : 'i-lock', T('ach_' + a.id), T('ach_' + a.id + '_d'), null, null, null);
      if (a.unlocked) { ar.className += ' done'; }
      var mark = node('div', 'rmark');
      mark.appendChild(U.icon(a.unlocked ? 'i-check' : 'i-lock'));
      ar.appendChild(mark);
      box.appendChild(ar);
    }
  }


  // Выдача косметики из награды: предмет сразу становится надетым
  function grantCosmetic(kind, id) {
    if (kind === 'trail') {
      if (G.ownedTrails.indexOf(id) < 0) { G.ownedTrails.push(id); }
      G.trail = id;
    } else if (kind === 'hat') {
      if (G.ownedHats.indexOf(id) < 0) { G.ownedHats.push(id); }
      G.hat = id;
    } else if (kind === 'pet') {
      if (G.ownedPets.indexOf(id) < 0) { G.ownedPets.push(id); }
      G.pet = id;
    } else if (kind === 'voice') {
      if (G.ownedVoices.indexOf(id) < 0) { G.ownedVoices.push(id); }
      G.voice = id;
    } else if (kind === 'skin') {
      if (G.skins.indexOf(id) < 0) { G.skins.push(id); }
      G.skin = id;
      UI.refreshSkins();
    }
    U.saveProfile();
  }

  /* ==========================================================================
     Рейтинг
     ========================================================================== */
  function buildLeaders() {
    var box = clearBox('lbList');
    if (!box) { return; }
    var boards = [['best', T('best')], ['normal', T('diffNormal')], ['hard', T('diffHard')], ['daily', T('daily')]];
    if (!Pl.leaderboardsAvailable) {
      box.appendChild(row('i-chart', T('leaders'), T('store_unavailable'), null, null, null));
      return;
    }
    for (var i = 0; i < boards.length; i++) {
      (function (board) {
        box.appendChild(node('div', 'subh', board[1]));
        var holder = node('div');
        box.appendChild(holder);
        holder.appendChild(row('i-hourglass', T('loading'), '', null, null, null));
        Pl.top(board[0], function (list) {
          holder.innerHTML = '';
          if (!list.length) {
            holder.appendChild(row('i-chart', board[1], T('locked'), null, null, null));
            return;
          }
          for (var k = 0; k < list.length; k++) {
            holder.appendChild(row(list[k].me ? 'i-star' : '#' + list[k].rank,
              (list[k].rank + '. ' + list[k].name), String(list[k].score), null, null, null));
          }
        });
      })(boards[i]);
    }
  }

  /* ==========================================================================
     Витрина покупок (инап через площадку)
     ========================================================================== */
  var PRODUCTS = [
    { id: 'coins_500', icon: 'i-coin', name: 'bundle_1', desc: 'bundle_1_n', coins: 500 },
    { id: 'coins_1500', icon: 'i-banknote', name: 'bundle_2', desc: 'bundle_2_n', coins: 1500 },
    { id: 'coins_5000', icon: 'i-box', name: 'bundle_3', desc: 'bundle_3_n', coins: 5000 },
    { id: 'no_ads', icon: 'i-ban', name: 'noAds', desc: 'adsOff', noAds: true }
  ];

  function buildStore() {
    var box = clearBox('storeList');
    if (!box) { return; }
    // Вне площадки покупки недоступны: не показываем кнопки и цены-заглушки,
    // а честно пишем, что витрина работает только в Яндекс Играх.
    var canBuy = !!Pl.purchasesAvailable;
    if (!canBuy) {
      box.appendChild(row('i-info', T('store_unavailable'), T('store_local_note'), null, null, null));
    }
    for (var i = 0; i < PRODUCTS.length; i++) {
      (function (p) {
        var price = Pl.priceOf(p.id);
        var priceText = price ? (price.price + ' ' + (price.currency || Pl.currency.name)) : '';
        var owned = (p.noAds && G.adsDisabled) || (p.premium && META.passInfo().premium);
        var sub = T(p.desc) + (priceText ? '  •  ' + priceText : '');
        var canClick = canBuy && !owned;
        box.appendChild(row(p.icon, T(p.name), sub,
          owned ? T('owned') : (canBuy ? T('buy') : T('soon')),
          owned || !canBuy ? 'off' : 'gold',
          canClick ? function () { buyProduct(p); } : null));
      })(PRODUCTS[i]);
    }
    // покупка за рекламу: монеты и сундук. Без площадки ролик не показать,
    // поэтому строки честно помечаются недоступными.
    var adOk = adsReady();
    box.appendChild(row('i-tv', T('coinsForAd'), T('getForAd'),
      adOk ? T('getForAd') : T('soon'), adOk ? 'gold' : 'off', adOk ? function () {
        Pl.showRewarded(function () {
          UI.addCoins(100);
          if (META && META.onAd) { META.onAd(); }
          SND.coin();
          toast(T('reward_coins', { n: 100 }));
          buildStore();
        }, function () {});
      } : null));
    box.appendChild(row('i-gift', T('freeChest'), T('chest_note'),
      adOk ? T('getForAd') : T('soon'), adOk ? 'gold' : 'off', adOk ? function () {
        Pl.showRewarded(function () {
          UI.addCoins(75);
          if (META && META.onAd) { META.onAd(); }
          SND.coin();
          toast(T('reward_coins', { n: 75 }));
        }, function () {});
      } : null));
  }

  function buyProduct(p) {
    Pl.buy(p.id, function () {
      if (p.noAds) {
        G.adsDisabled = true;
        Pl.adsDisabled = true;
        Pl.hideBanner();
      } else if (p.premium) {
        META.setPremium(true);
      } else if (p.coins) {
        UI.addCoins(p.coins);
      }
      U.saveProfile();
      SND.record();
      toast(T('purchased'));
      buildStore();
      refreshBadges();
    }, function () { toast(T('purchaseFail')); });
  }

  /* ==========================================================================
     Статистика
     ========================================================================== */
  function buildStats() {
    var box = clearBox('statList');
    if (!box) { return; }
    var st = META.stats();
    var lvl = META.levelInfo();
    var fav = '', favN = 0;
    for (var b in st.biomes) {
      if (st.biomes.hasOwnProperty(b) && st.biomes[b] > favN) { favN = st.biomes[b]; fav = b; }
    }
    var metrics = Pl.metrics();
    var mins = Math.round((st.timeMs || 0) / 60000);
    var rows = [
      ['i-star', T('st_level'), lvl.level + ' (' + T('st_rank') + ': ' + lvl.rank + ')'],
      ['i-flag', T('st_runs'), st.runs],
      ['i-ruler', T('st_rows'), st.rows],
      ['i-medal', T('st_best'), st.best],
      ['i-coin', T('st_coins'), st.coins],
      ['i-clock', T('st_time'), mins + ' ' + T('st_min')],
      ['i-skull', T('st_deaths'), st.deaths],
      ['i-map', T('st_biomes'), Object.keys(st.biomes).length + ' / ' + TH.list.length],
      ['i-chicken', T('st_skins'), G.skins.length + ' / ' + SK.list.length],
      ['i-zap', T('st_boosts'), st.boosts || 0],
      ['i-flame', T('st_combo'), st.comboBest || 0],
      ['i-globe', T('st_fav'), fav ? T('th_' + fav) : '—'],
      ['i-tv', T('st_ads'), metrics.ad_rewarded || 0],
      ['i-clapper', T('st_inter'), metrics.ad_interstitial || 0]
    ];
    for (var i = 0; i < rows.length; i++) {
      box.appendChild(row(rows[i][0], rows[i][1], '', String(rows[i][2]), 'off', null));
    }
    if (Pl.isAuthorized()) {
      box.appendChild(row('i-user', T('cloudOn'), Pl.authName() || '', null, null, null));
    }
  }

  function resetProgress() {
    if (!window.confirm(T('st_reset_q'))) { return; }
    G.best = 0;
    G.bests = { easy: 0, normal: 0, hard: 0 };
    G.totalCoins = 0;
    G.skins = ['classic'];
    G.skin = 'classic';
    G.ownedPets = ['none']; G.ownedTrails = ['none']; G.ownedHats = ['none']; G.ownedVoices = ['classic'];
    G.pet = 'none'; G.trail = 'none'; G.hat = 'none'; G.voice = 'classic';
    META.reset();
    Pl.resetMetrics();
    U.saveProfile();
    UI.syncHUD(true);
    UI.refreshSkins();
    buildStats();
    toast(T('st_reset_done'));
  }

  /* ==========================================================================
     Настройки и доступность
     ========================================================================== */
  function buildSettings() {
    var box = clearBox('setList');
    if (!box) { return; }
    var S = CC.settings;
    var items = [
      { key: 'sound', label: 'set_sound', kind: 'onoff' },
      { key: 'music', label: 'set_music', kind: 'onoff' },
      { key: 'vibro', label: 'set_vibro', kind: 'onoff' },
      { key: 'leftHand', label: 'set_left', kind: 'onoff' },
      { key: 'ui', label: 'set_ui', kind: 'choice', values: ['normal', 'big'], names: ['set_normal', 'set_big'] },
      { key: 'quality', label: 'set_quality', kind: 'choice', values: ['auto', 'low', 'mid', 'high'], names: ['auto', 'set_low', 'set_mid', 'set_high'] },
      { key: 'colorblind', label: 'set_colorblind', kind: 'choice', values: ['off', 'protan', 'deutan', 'tritan'], names: ['cb_off', 'cb_protan', 'cb_deutan', 'cb_tritan'] }
    ];
    for (var i = 0; i < items.length; i++) {
      (function (it) {
        var wrap = node('div', 'setrow');
        wrap.appendChild(node('div', 'sl', T(it.label)));
        var seg = node('div', 'seg2');
        if (it.kind === 'onoff') {
          [['on', true], ['off', false]].forEach(function (pair) {
            var on = (!!S.get(it.key)) === pair[1];
            var b = node('button', on ? 'on' : '', T(pair[1] ? 'set_on' : 'set_off'));
            b.type = 'button';
            b.addEventListener('click', function () {
              S.set(it.key, pair[1]);
              // звук и музыка — независимые каналы настроек
              if (it.key === 'sound') { SND.setSfx(pair[1]); }
              if (it.key === 'music') { SND.setMusic(pair[1]); }
              SND.select();
              buildSettings();
            });
            seg.appendChild(b);
          });
        } else {
          for (var v = 0; v < it.values.length; v++) {
            (function (val, nameKey) {
              var b = node('button', S.get(it.key) === val ? 'on' : '', T(nameKey));
              b.type = 'button';
              b.addEventListener('click', function () {
                S.set(it.key, val);
                if (it.key === 'quality') { U.applyQuality(); U.resize(); }
                buildSettings();
              });
              seg.appendChild(b);
            })(it.values[v], it.names[v]);
          }
        }
        wrap.appendChild(seg);
        box.appendChild(wrap);
      })(items[i]);
    }
    // язык: переключатель доступен без знания текущего языка (иконка + самоназвание)
    var langWrap = node('div', 'setrow');
    var sl = node('div', 'sl');
    sl.appendChild(U.icon('i-lang'));
    sl.appendChild(node('span', null, T('set_lang')));
    langWrap.appendChild(sl);
    var langSeg = node('div', 'seg2');
    [['ru', 'Русский'], ['en', 'English']].forEach(function (pair) {
      var b = node('button', Pl.lang === pair[0] ? 'on' : '', pair[1]);
      b.type = 'button';
      b.addEventListener('click', function () {
        Pl.lang = pair[0];
        try { window.localStorage.setItem('cc_lang', pair[0]); } catch (e) {}
        UI.applyLang();
        buildSettings();
      });
      langSeg.appendChild(b);
    });
    langWrap.appendChild(langSeg);
    box.appendChild(langWrap);
    // обратная связь: требование площадки 6.1
    box.appendChild(row('i-mail', T('feedback'), Pl.feedbackEmail, null, null, null));
    if (Pl.isTv) { box.appendChild(row('i-tv', T('tv_hint'), '', null, null, null)); }
    // Авторы звука и музыки: часть наборов под CC-BY, указание обязательно.
    box.appendChild(node('div', 'keys credits', T('credits')));
  }

  /* ==========================================================================
     Обучение
     ========================================================================== */
  var TUTORIAL = [
    { icon: 'i-tap', text: 'tip_move' },
    { icon: 'i-car', text: 'tip_wait' },
    { icon: 'i-log', text: 'tip_water' },
    { icon: 'i-eagle', text: 'tip_eagle' }
  ];
  var tutStep = 0;

  function openTutorial() {
    tutStep = 0;
    showTutStep();
    UI.showOnly('ovTutorial');
  }
  function showTutStep() {
    var t = $('tutText');
    var title = $('tTutorial');
    var step = TUTORIAL[tutStep];
    if (t) { t.textContent = step.icon + '  ' + T(step.text); }
    if (title) { title.textContent = T('tutorial') + ' ' + (tutStep + 1) + '/' + TUTORIAL.length; }
    var btn = $('btnTutNext');
    if (btn) { btn.textContent = tutStep >= TUTORIAL.length - 1 ? T('tip_done') : '→'; }
  }
  function nextTutStep() {
    tutStep++;
    if (tutStep >= TUTORIAL.length) {
      G.tutorialDone = true;
      U.saveProfile();
      UI.showOnly('ovMenu');
      UI.menu();
      return;
    }
    showTutStep();
  }

  /* ==========================================================================
     Магазин внешнего вида: слоты скинов, питомцев, следов, шапок и голосов
     ========================================================================== */
  var SLOTS = [
    { id: 'skin', label: 'slot_skin', list: function () { return SK.list; }, owned: function () { return G.skins; }, worn: function () { return G.skin; } },
    { id: 'pet', label: 'slot_pet', list: function () { return SK.pets; }, owned: function () { return G.ownedPets; }, worn: function () { return G.pet; } },
    { id: 'trail', label: 'slot_trail', list: function () { return SK.trails; }, owned: function () { return G.ownedTrails; }, worn: function () { return G.trail; } },
    { id: 'hat', label: 'slot_hat', list: function () { return SK.hats; }, owned: function () { return G.ownedHats; }, worn: function () { return G.hat; } },
    { id: 'voice', label: 'slot_voice', list: function () { return SK.voices; }, owned: function () { return G.ownedVoices; }, worn: function () { return G.voice; } }
  ];
  var curSlot = 'skin';

  function buildSlotTabs() {
    var box = $('slotTabs');
    if (!box) { return; }
    box.innerHTML = '';
    for (var i = 0; i < SLOTS.length; i++) {
      (function (s) {
        var b = node('button', 'segbtn' + (curSlot === s.id ? ' on' : ''), T(s.label));
        b.type = 'button';
        b.addEventListener('click', function () {
          curSlot = s.id;
          buildSlotTabs();
          buildSlotItems();
          SND.hop();
        });
        box.appendChild(b);
      })(SLOTS[i]);
    }
  }

  function slotDef(id) {
    for (var i = 0; i < SLOTS.length; i++) { if (SLOTS[i].id === id) { return SLOTS[i]; } }
    return SLOTS[0];
  }

  function itemName(slot, id) {
    if (slot === 'skin') { return T('sk_' + id); }
    return T(slot + '_' + id);
  }

  function buildSlotItems() {
    var box = $('skinsGrid');
    var head = $('tSkins');
    if (head) { head.textContent = T('shop'); }
    var coins = $('skCoins');
    if (coins) { coins.textContent = String(G.totalCoins); }
    if (!box) { return; }
    box.innerHTML = '';
    previewCards = [];
    var slot = slotDef(curSlot);
    var list = slot.list();
    var ownedList = slot.owned();
    var worn = slot.worn();
    for (var i = 0; i < list.length; i++) {
      (function (item) {
        var owned = ownedList.indexOf(item.id) >= 0;
        var isWorn = worn === item.id;
        var card = node('button', 'skincard' + (isWorn ? ' sel' : '') + (owned ? '' : ' locked'));
        card.type = 'button';
        var cv = document.createElement('canvas');
        var px = Math.round(64 * Math.min(window.devicePixelRatio || 1, 2));
        cv.width = px; cv.height = px;
        if (cv.style) { cv.style.width = '64px'; cv.style.height = '64px'; }
        card.appendChild(cv);
        card.appendChild(node('span', 'skc-name', itemName(slot.id, item.id)));
        var tag;
        if (isWorn) { tag = node('span', 'skc-tag', T('equipped')); }
        else if (owned) { tag = node('span', 'skc-tag', T('equip')); }
        else { tag = markup('span', 'skc-tag', coinText(item.price)); }
        if (isWorn || owned) { tag.className += ' have'; }
        else if (G.totalCoins < item.price) { tag.className += ' poor'; }
        card.appendChild(tag);
        var badge = node('span', 'skc-badge');
        if (isWorn) { badge.appendChild(U.icon('i-check')); }
        else if (!owned) { badge.appendChild(U.icon('i-lock')); }
        card.appendChild(badge);
        card.addEventListener('click', function () { pickSlotItem(slot, item); });
        box.appendChild(card);
        previewInto(cv, slot.id, item.id);
        previewCards.push({ canvas: cv, slot: slot.id, id: item.id });
      })(list[i]);
    }
  }

  // Превью предмета: скины и питомцы рисуются своими моделями
  function previewInto(cv, slotId, id) {
    if (!cv || !cv.getContext) { return; }
    var g = cv.getContext('2d');
    var dpr = (cv.width || 64) / 64;
    if (g.setTransform) { g.setTransform(dpr, 0, 0, dpr, 0, 0); }
    if (g.clearRect) { g.clearRect(0, 0, 64, 64); }
    if (slotId === 'skin') { A.drawSkinPreview(g, id, 64); return; }
    U.withCtx(g, function () {
      g.save();
      g.translate(32, 34);
      g.scale(1.1, 1.1);
      if (slotId === 'pet') { A.drawPet(id, 0, 0, G.t); }
      else if (slotId === 'hat') { A.drawHatPreview(id); }
      else if (slotId === 'trail') { A.drawTrailPreview(id); }
      else if (slotId === 'voice') { A.drawVoicePreview(id); }
      g.restore();
    });
  }

  function pickSlotItem(slot, item) {
    var ownedList = slot.owned();
    if (ownedList.indexOf(item.id) < 0) {
      if (G.totalCoins < item.price) { toast(T('notEnough')); return; }
      if (!UI.spendCoins(item.price)) { return; }
      ownedList.push(item.id);
      applyWorn(slot.id, item.id);
      SND.coin();
      toast(T('bought'));
    } else {
      applyWorn(slot.id, item.id);
      SND.hop();
    }
    U.saveProfile();
    buildSlotItems();
    refreshBadges();
  }

  function applyWorn(slotId, id) {
    if (slotId === 'skin') { G.skin = id; UI.refreshSkins(); }
    else if (slotId === 'pet') { G.pet = id; }
    else if (slotId === 'trail') { G.trail = id; }
    else if (slotId === 'hat') { G.hat = id; }
    else if (slotId === 'voice') { G.voice = id; }
  }

  /* ==========================================================================
     Подсказки и индикаторы
     ========================================================================== */
  // Превью предметов перерисовываются примерно 12 раз в секунду: этого хватает
  // для анимированных скинов, но не грузит процессор.
  var previewCards = [];
  function tick() {
    for (var i = 0; i < previewCards.length; i++) {
      var c = previewCards[i];
      if (c.canvas && c.canvas.parentNode) { previewInto(c.canvas, c.slot, c.id); }
    }
  }

  var toastTimer = null;
  function toast(text) {
    var t = $('toast');
    if (!t) { return; }
    t.textContent = text;
    t.classList.add('on');
    if (toastTimer) { clearTimeout(toastTimer); }
    toastTimer = setTimeout(function () {
      try { t.classList.remove('on'); } catch (e) {}
    }, 1600);
  }

  // Красные точки в меню: есть что забрать или сыграть
  function refreshBadges() {
    var q = META.quests();
    var ready = 0;
    for (var i = 0; i < q.daily.length; i++) { if (q.daily[i].done && !q.daily[i].claimed) { ready++; } }
    for (var j = 0; j < q.weekly.length; j++) { if (q.weekly[j].done && !q.weekly[j].claimed) { ready++; } }
    var dot = $('questDot');
    if (dot) { dot.hidden = ready === 0; }
    var chest = META.chestInfo();
    var dayDot = $('dailyDot');
    if (dayDot) { dayDot.hidden = !(chest.canClaim || !G.dailyPlayed); }
  }

  /* ==========================================================================
     Подключение к интерфейсу
     ========================================================================== */
  function bind(id, fn) {
    var n = $(id);
    if (n) { n.addEventListener('click', fn); }
  }

  function init() {
    bind('btnMenuModes', function () { open('modes'); });
    bind('btnMenuQuests', function () { open('quests'); });
    bind('btnMenuAch', function () { open('ach'); });
    bind('btnMenuLeaders', function () { open('leaders'); });
    bind('btnMenuStore', function () { open('store'); });
    bind('btnMenuStats', function () { open('stats'); });
    bind('btnMenuSettings', function () { open('settings'); });
    bind('btnMenuDaily', function () { startDaily(); });
    bind('btnMenuTutorial', function () { openTutorial(); });
    bind('btnModesClose', closeToMenu);
    bind('btnQuestsClose', closeToMenu);
    bind('btnAchClose', closeToMenu);
    bind('btnLeadersClose', closeToMenu);
    bind('btnStoreClose', closeToMenu);
    bind('btnStatsClose', closeToMenu);
    bind('btnSettingsClose', closeToMenu);
    bind('btnTutNext', nextTutStep);
    bind('btnStatsReset', resetProgress);
    bind('btnRate', function () {
      Pl.requestReview(function (sent) { toast(sent ? T('rated') : T('purchaseFail')); });
    });
    bind('btnAuth', function () {
      Pl.requestAuth(function (ok) {
        toast(ok ? T('loggedIn', { n: Pl.authName() || '—' }) : T('purchaseFail'));
        buildStats();
      });
    });
    // экран скинов превращается в магазин со слотами
    var grid = $('skinsGrid');
    if (grid && grid.parentNode) {
      var tabs = node('div', 'seg');
      tabs.id = 'slotTabs';
      grid.parentNode.insertBefore(tabs, grid);
    }
    buildSlotTabs();
    buildSlotItems();
  }

  CC.screens = {
    open: open,
    closeToMenu: closeToMenu,
    closeToPause: closeToPause,
    build: build,
    init: init,
    toast: toast,
    refreshBadges: refreshBadges,
    buildSlotTabs: buildSlotTabs,
    buildSlotItems: buildSlotItems,
    tick: tick,
    cardCount: function () { return previewCards.length; },
    startDaily: startDaily,
    openTutorial: openTutorial,
    MODES: MODES,
    modeById: modeById,
    PRODUCTS: PRODUCTS,
    buildBoosts: buildBoosts,
    pickSlotItem: pickSlotItem,
    grantCosmetic: grantCosmetic,
    SLOTS: SLOTS
  };
})(window.CC);
