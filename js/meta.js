/* ============================================================================
   meta.js — мета-прогрессия: задания, достижения, уровень, сундук, сезон
   ----------------------------------------------------------------------------
   Модуль не знает ничего про рендер и DOM: он считает прогресс и отдаёт
   награды. Игра сообщает о событиях (начало и конец забега, покупка, буст),
   а модуль решает, что открылось, и возвращает список наград.

   Что внутри:
     • статистика игрока (ряды, монеты, смерти по причинам, биомы, режимы);
     • ежедневные и недельные задания — выбираются детерминированно по дате;
     • 20 достижений;
     • уровень аккаунта и ранг;
     • сундук за ежедневный вход с растущей наградой;
     • сезонный пропуск на 30 уровней (бесплатный и премиум треки);
     • призрак рекорда — запись лучшего забега для показа в игре.
   ========================================================================== */
(function (global) {
  'use strict';

  var CC = global.CC;
  var DAY = 86400000;

  /* --- пул заданий --------------------------------------------------------- */
  var QUEST_POOL = [
    { type: 'rows_single', targets: [20, 30, 45], reward: 50 },
    { type: 'rows_total',  targets: [120, 250],   reward: 60 },
    { type: 'coins',       targets: [8, 15, 25],  reward: 45 },
    { type: 'coins_total', targets: [50, 120],    reward: 70 },
    { type: 'runs',        targets: [3, 5, 8],    reward: 40 },
    { type: 'combo',       targets: [12, 25],     reward: 60 },
    { type: 'boost',       targets: [1, 2],       reward: 50 },
    { type: 'nostop',      targets: [12, 20],     reward: 70 },
    { type: 'diff',        targets: [1],          reward: 45 },
    { type: 'biome',       targets: [1],          reward: 55 },
    { type: 'daily',       targets: [1],          reward: 90 }
  ];
  var WEEKLY_MULT = 3;      // недельные задания втрое длиннее и дороже

  /* --- достижения ---------------------------------------------------------- */
  var ACH = [
    { id: 'first',      check: function (s) { return s.rows >= 1; } },
    { id: 'rows50',     check: function (s) { return s.best >= 50; } },
    { id: 'rows100',    check: function (s) { return s.best >= 100; } },
    { id: 'rows250',    check: function (s) { return s.best >= 250; } },
    { id: 'coins1000',  check: function (s) { return s.coins >= 1000; } },
    { id: 'coins5000',  check: function (s) { return s.coins >= 5000; } },
    { id: 'eagle',      check: function (s) { return (s.reasons.eagle || 0) >= 1; } },
    { id: 'deaths',     check: function (s) { return countKeys(s.reasons) >= 5; } },
    { id: 'biomes5',    check: function (s) { return countKeys(s.biomes) >= 5; } },
    { id: 'biomes_all', check: function (s, g) { return countKeys(s.biomes) >= ((g && g.biomeCount) || 5); } },
    { id: 'skins5',     check: function (s, g) { return g.skins.length >= 5; } },
    { id: 'hard50',     check: function (s) { return (s.bestHard || 0) >= 50; } },
    { id: 'daily7',     check: function (s) { return (s.streak || 0) >= 7; } },
    { id: 'combo50',    check: function (s) { return s.comboBest >= 50; } },
    { id: 'boost',      check: function (s) { return s.boosts >= 1; } },
    { id: 'pet',        check: function (s, g) { return !!(g.pet && g.pet !== 'none'); } },
    { id: 'allmodes',   check: function (s) { return countKeys(s.modes) >= 6; } },
    { id: 'ghost',      check: function (s) { return !!s.ghostBeaten; } },
    { id: 'runs50',     check: function (s) { return s.runs >= 50; } }
  ];

  function countKeys(o) { var n = 0; for (var k in o) { if (o.hasOwnProperty(k)) { n++; } } return n; }

  /* --- сезонный пропуск ---------------------------------------------------- */
  var PASS_LEVELS = 30;
  var PASS_XP_PER_LEVEL = 60;
  // награды треков: бесплатный — монеты, премиум — косметика и монеты
  var PASS_PREMIUM = {
    3: { kind: 'trail', id: 'spark' },
    6: { kind: 'coins', n: 300 },
    9: { kind: 'hat', id: 'cap' },
    12: { kind: 'pet', id: 'chick' },
    15: { kind: 'coins', n: 600 },
    18: { kind: 'hat', id: 'ushanka' },
    21: { kind: 'trail', id: 'snow' },
    24: { kind: 'coins', n: 900 },
    27: { kind: 'hat', id: 'crown' },
    30: { kind: 'pet', id: 'dragon' }
  };

  function dayKey(ts) {
    var d = new Date(ts || Date.now());
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function weekKey(ts) {
    var d = new Date(ts || Date.now());
    var start = new Date(d.getFullYear(), 0, 1);
    var week = Math.floor(((d - start) / DAY + start.getDay()) / 7);
    return d.getFullYear() + '-w' + week;
  }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }

  // Простой детерминированный генератор: у всех игроков в один день задания
  // одинаковые, и они не меняются при перезагрузке страницы.
  function seeded(seedStr) {
    var h = 2166136261;
    for (var i = 0; i < seedStr.length; i++) {
      h ^= seedStr.charCodeAt(i);
      h = (h * 16777619) >>> 0;
    }
    return function () {
      h ^= h << 13; h >>>= 0;
      h ^= h >> 17;
      h ^= h << 5; h >>>= 0;
      return h / 4294967296;
    };
  }

  function makeQuests(key, count, mult) {
    var rand = seeded(key);
    var pool = QUEST_POOL.slice();
    var out = [];
    for (var i = 0; i < count && pool.length; i++) {
      var idx = Math.floor(rand() * pool.length);
      var q = pool.splice(idx, 1)[0];
      var target = q.targets[Math.floor(rand() * q.targets.length)] * mult;
      out.push({
        id: key + ':' + q.type + ':' + target,
        type: q.type, target: target, progress: 0, done: false, claimed: false,
        reward: Math.round(q.reward * (mult > 1 ? 2.2 : 1)),
        biome: q.type === 'biome' ? pickBiome(rand) : null,
        diff: q.type === 'diff' ? ['normal', 'hard'][Math.floor(rand() * 2)] : null
      });
    }
    return out;
  }
  function pickBiome(rand) {
    if (CC.themes && CC.themes.list.length) {
      return CC.themes.list[Math.floor(rand() * CC.themes.list.length)].id;
    }
    return 'meadow';
  }

  /* --- состояние ----------------------------------------------------------- */
  var M = {
    state: null,
    onReward: null,      // колбэк игры: onReward(coins, textKey)
    onUnlock: null,      // колбэк игры: onUnlock(kind, id)

    blank: function () {
      return {
        stats: {
          runs: 0, rows: 0, best: 0, bestHard: 0, coins: 0, deaths: 0, timeMs: 0,
          boosts: 0, ads: 0, comboBest: 0, streak: 0,
          biomes: {}, modes: {}, reasons: {}, ghostBeaten: 0, biomeBest: {}
        },
        ach: {},
        daily: { date: '', streak: 0, claimed: 0, quests: [] },
        weekly: { key: '', quests: [] },
        chest: { date: '', streak: 0 },
        pass: { season: 1, xp: 0, level: 1, premium: false, claimedFree: [], claimedPremium: [] },
        level: 1, xp: 0,
        ghost: null,
        lastDaily: ''
      };
    },

    load: function (data) {
      M.state = M.blank();
      if (data && typeof data === 'object') {
        for (var k in M.state) {
          if (M.state.hasOwnProperty(k) && data[k] !== undefined && data[k] !== null) {
            M.state[k] = data[k];
          }
        }
        // статистику тоже добираем по полям, чтобы новые метрики не терялись
        if (data.stats) {
          for (var s in M.state.stats) {
            if (M.state.stats.hasOwnProperty(s) && data.stats[s] !== undefined) {
              M.state.stats[s] = data.stats[s];
            }
          }
        }
      }
      M.refreshQuests();
      return M.state;
    },

    toSave: function () {
      M.refreshQuests();
      return M.state;
    },

    reset: function () {
      M.state = M.blank();
      M.refreshQuests();
    },

    /* --- задания ---------------------------------------------------------- */
    refreshQuests: function () {
      var st = M.state;
      var today = dayKey();
      if (st.daily.date !== today || !st.daily.quests.length) {
        // серия входов считается по разнице дат
        var prev = st.daily.date;
        if (prev) {
          var diffDays = Math.round((new Date(today) - new Date(prev)) / DAY);
          st.daily.streak = (diffDays === 1) ? (st.daily.streak || 0) + 1 : 1;
        } else {
          st.daily.streak = 1;
        }
        st.daily.date = today;
        st.daily.quests = makeQuests('d' + today, 3, 1);
        st.daily.claimed = 0;
        st.stats.streak = st.daily.streak;
      }
      var wk = weekKey();
      if (st.weekly.key !== wk || !st.weekly.quests.length) {
        st.weekly.key = wk;
        st.weekly.quests = makeQuests('w' + wk, 2, WEEKLY_MULT);
      }
    },

    // прогресс задания: сколько добавить к счётчику
    bump: function (type, value, ctx) {
      var lists = [M.state.daily.quests, M.state.weekly.quests];
      for (var l = 0; l < lists.length; l++) {
        var qs = lists[l];
        for (var i = 0; i < qs.length; i++) {
          var q = qs[i];
          if (q.type !== type || q.done) { continue; }
          if (type === 'biome' && ctx && ctx.biome && q.biome && q.biome !== ctx.biome) { continue; }
          if (type === 'diff' && ctx && ctx.diff && q.diff && q.diff !== ctx.diff) { continue; }
          // задания «за один забег» и «всего» обновляются по-разному
          if (type === 'rows_single' || type === 'coins' || type === 'combo' || type === 'nostop') {
            q.progress = Math.max(q.progress, value);
          } else {
            q.progress += value;
          }
          if (q.progress >= q.target) { q.progress = q.target; q.done = true; }
        }
      }
    },

    quests: function () {
      M.refreshQuests();
      var out = { daily: [], weekly: [], resetMs: 0 };
      var d = new Date();
      var next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
      out.resetMs = next - d;
      var i;
      for (i = 0; i < M.state.daily.quests.length; i++) { out.daily.push(M.state.daily.quests[i]); }
      for (i = 0; i < M.state.weekly.quests.length; i++) { out.weekly.push(M.state.weekly.quests[i]); }
      return out;
    },

    claimQuest: function (id) {
      var lists = [M.state.daily.quests, M.state.weekly.quests];
      for (var l = 0; l < lists.length; l++) {
        for (var i = 0; i < lists[l].length; i++) {
          var q = lists[l][i];
          if (q.id === id && q.done && !q.claimed) {
            q.claimed = true;
            M.addXp(20);
            return { coins: q.reward, passXp: 20 };
          }
        }
      }
      return null;
    },

    /* --- достижения ------------------------------------------------------- */
    achievements: function () {
      var out = [];
      var g = CC.game || {};
      for (var i = 0; i < ACH.length; i++) {
        out.push({
          id: ACH[i].id,
          unlocked: !!M.state.ach[ACH[i].id]
        });
      }
      return out;
    },
    checkAchievements: function () {
      var fresh = [];
      for (var i = 0; i < ACH.length; i++) {
        var id = ACH[i].id;
        if (M.state.ach[id]) { continue; }
        var ok = false;
        try {
          ok = ACH[i].check(M.state.stats, {
            skins: CC.G.skins, pet: CC.G.pet, passLevel: M.state.pass.level,
            biomeCount: (CC.themes && CC.themes.list.length) || 5
          });
        } catch (e) { ok = false; }
        if (ok) { M.state.ach[id] = 1; fresh.push(id); }
      }
      return fresh;
    },

    /* --- уровень и ранг --------------------------------------------------- */
    addXp: function (n) {
      M.state.xp += n;
      var need = M.xpNeed(M.state.level);
      while (M.state.xp >= need) {
        M.state.xp -= need;
        M.state.level++;
        need = M.xpNeed(M.state.level);
      }
      return M.state.level;
    },
    xpNeed: function (level) { return 100 + (level - 1) * 60; },
    levelInfo: function () {
      var lvl = M.state.level;
      var rank = lvl >= 20 ? 'diamond' : lvl >= 10 ? 'gold' : lvl >= 5 ? 'silver' : 'bronze';
      return { level: lvl, xp: M.state.xp, need: M.xpNeed(lvl), rank: rank };
    },

    /* --- сундук за ежедневный вход ---------------------------------------- */
    chestInfo: function () {
      var today = dayKey();
      var st = M.state;
      var canClaim = st.chest.date !== today;
      if (st.chest.date && st.chest.date !== today) {
        var gap = Math.round((new Date(today) - new Date(st.chest.date)) / DAY);
        if (gap > 1) { st.chest.streak = 0; }   // пропустил день — серия сгорела
      }
      return {
        canClaim: canClaim,
        streak: st.chest.streak,
        next: st.chest.streak + 1,
        reward: 30 + 15 * Math.min(7, st.chest.streak + 1)
      };
    },
    claimChest: function () {
      var info = M.chestInfo();
      if (!info.canClaim) { return null; }
      var st = M.state;
      st.chest.date = dayKey();
      st.chest.streak = Math.min(30, st.chest.streak + 1);
      st.stats.streak = Math.max(st.stats.streak || 0, st.daily.streak || 0, st.chest.streak);
      M.addXp(30);
      return { coins: info.reward, passXp: 30, streak: st.chest.streak };
    },

    /* --- сезонный пропуск ------------------------------------------------- */
    passInfo: function () {
      var st = M.state.pass;
      var out = { level: st.level, xp: st.xp, need: PASS_XP_PER_LEVEL, premium: st.premium, season: st.season, rows: [] };
      for (var i = 1; i <= PASS_LEVELS; i++) {
        out.rows.push({
          level: i,
          free: { coins: 40 + i * 12, claimed: st.claimedFree.indexOf(i) >= 0 },
          premium: PASS_PREMIUM[i] ? { item: PASS_PREMIUM[i], claimed: st.claimedPremium.indexOf(i) >= 0 } : null
        });
      }
      return out;
    },
    addPassXp: function (n) {
      var st = M.state.pass;
      st.xp += n;
      while (st.xp >= PASS_XP_PER_LEVEL && st.level < PASS_LEVELS) {
        st.xp -= PASS_XP_PER_LEVEL;
        st.level++;
      }
      if (st.level >= PASS_LEVELS) { st.xp = Math.min(st.xp, PASS_XP_PER_LEVEL); }
      return st.level;
    },
    claimPass: function (level, track) {
      var st = M.state.pass;
      if (level > st.level) { return null; }
      var arr = track === 'premium' ? st.claimedPremium : st.claimedFree;
      if (arr.indexOf(level) >= 0) { return null; }
      if (track === 'premium') {
        if (!st.premium) { return null; }
        var item = PASS_PREMIUM[level];
        if (!item) { return null; }
        arr.push(level);
        return { kind: item.kind, id: item.id, n: item.n };
      }
      arr.push(level);
      return { kind: 'coins', n: 40 + level * 12 };
    },
    setPremium: function (on) {
      M.state.pass.premium = !!on;
      return M.state.pass.premium;
    },

    /* --- события забега --------------------------------------------------- */
    onRunStart: function (ctx) {
      M._ctx = ctx || {};
    },

    // run = { rows, coins, reason, timeMs, combo, boostUsed, noStop, biome, mode, diff }
    onRunEnd: function (run) {
      var st = M.state.stats;
      var ctx = { biome: run.biome, diff: run.diff, mode: run.mode };
      st.runs++;
      st.rows += run.rows || 0;
      st.coins += run.coins || 0;
      st.deaths++;
      st.timeMs += run.timeMs || 0;
      if ((run.rows || 0) > st.best) { st.best = run.rows || 0; }
      if (run.diff === 'hard' && (run.rows || 0) > (st.bestHard || 0)) { st.bestHard = run.rows || 0; }
      if ((run.combo || 0) > (st.comboBest || 0)) { st.comboBest = run.combo || 0; }
      st.reasons[run.reason || 'unknown'] = (st.reasons[run.reason || 'unknown'] || 0) + 1;
      st.biomes[run.biome || 'meadow'] = (st.biomes[run.biome || 'meadow'] || 0) + 1;
      // отдельный рекорд по каждой карте: у биомов разная сложность
      if (!st.biomeBest) { st.biomeBest = {}; }
      var bId = run.biome || 'meadow';
      if ((run.rows || 0) > (st.biomeBest[bId] || 0)) { st.biomeBest[bId] = run.rows || 0; }
      st.modes[run.mode || 'classic'] = (st.modes[run.mode || 'classic'] || 0) + 1;
      if (run.ghostBeaten) { st.ghostBeaten = (st.ghostBeaten || 0) + 1; }

      // прогресс заданий
      M.refreshQuests();
      M.bump('runs', 1, ctx);
      M.bump('rows_total', run.rows || 0, ctx);
      M.bump('rows_single', run.rows || 0, ctx);
      M.bump('coins_total', run.coins || 0, ctx);
      M.bump('coins', run.coins || 0, ctx);
      M.bump('combo', run.combo || 0, ctx);
      M.bump('nostop', run.noStop || 0, ctx);
      M.bump('boost', run.boostUsed || 0, ctx);
      M.bump('biome', 1, ctx);
      M.bump('diff', 1, ctx);

      // опыт: ряды дают опыт аккаунта и сезона
      var gained = (run.rows || 0);
      var levelsBefore = M.state.level;
      M.addXp(gained * 2);
      M.addPassXp(gained);

      var fresh = M.checkAchievements();
      return {
        levelUp: M.state.level > levelsBefore ? M.state.level : 0,
        achievements: fresh,
        passLevel: M.state.pass.level
      };
    },

    onBoost: function () { M.state.stats.boosts++; },
    onAd: function () { M.state.stats.ads++; },
    onDailyDone: function () { M.refreshQuests(); M.bump('daily', 1, M._ctx); },

    stats: function () { return M.state.stats; },
    biomeBest: function (id) { return (M.state.stats.biomeBest && M.state.stats.biomeBest[id]) || 0; }
  };

  CC.meta = M;
})(typeof window !== 'undefined' ? window : this);
