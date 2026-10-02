/* ============================================================================
   gameplay.js — ход забега: прыжки, смерть, возрождение, эффекты
   ----------------------------------------------------------------------------
   Правила игры целиком: попытка шага, приземление, столкновения, орёл,
   конец забега, возрождение за рекламу и частицы. Рендер сюда не заглядывает.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var TS = C.TS, COLS = C.COLS, FIELD_HALF = C.FIELD_HALF, HOP_TIME = C.HOP_TIME;
  var HOP_HOLD = C.HOP_HOLD, EAGLE_DELAY = C.EAGLE_DELAY, MIN_ROW = C.MIN_ROW;
  var ROWS_AHEAD = C.ROWS_AHEAD, PLAYER_SCREEN_Y = C.PLAYER_SCREEN_Y;
  var clamp = U.clamp, rnd = U.rnd, pick = U.pick, colX = U.colX, rowY = U.rowY;
  var diff = U.diff, eagleLimit = U.eagleLimit, bestFor = U.bestFor;
  var profile = U.profile, saveProfile = U.saveProfile;
  var playerCol = U.playerCol, playerRow = U.playerRow, camTargetFor = U.camTargetFor;
  var Pl = CC.platform, Sound = CC.audio;
  var W = CC.world, UI = CC.ui, META = CC.meta, held = IN.held;
  /* ==========================================================================
     4. ЧАСТИЦЫ
     ========================================================================== */
  function part(x, y, vx, vy, life, size, color, kind) {
    if (G.particles.length > 260) { return; }
    G.particles.push({ x: x, y: y, vx: vx, vy: vy, life: life, max: life, size: size, color: color, kind: kind || 'dot', rot: rnd(0, 6.28) });
  }
  function burst(x, y, n, color, kind, power) {
    power = power || 90;
    for (var i = 0; i < n; i++) {
      var a = rnd(0, Math.PI * 2), s = rnd(power * 0.25, power);
      part(x, y, Math.cos(a) * s, Math.sin(a) * s, rnd(0.35, 0.9), rnd(2, 5.5), color, kind);
    }
  }
  function updateParticles(dt) {
    var a = G.particles;
    for (var i = a.length - 1; i >= 0; i--) {
      var p = a[i];
      p.life -= dt;
      if (p.life <= 0) { a.splice(i, 1); continue; }
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= (1 - 3.2 * dt); p.vy *= (1 - 3.2 * dt);
      if (p.kind === 'feather') { p.vy += 60 * dt; p.rot += dt * 6; }
    }
    var b = G.popups;
    for (var j = b.length - 1; j >= 0; j--) {
      b[j].life -= dt; b[j].y -= dt * 26;
      if (b[j].life <= 0) { b.splice(j, 1); }
    }
  }
  function popup(x, y, text, color) {
    if (G.popups.length > 40) { return; }
    G.popups.push({ x: x, y: y, text: text, color: color || '#ffe680', life: 0.9 });
  }


  /* ==========================================================================
     7. ХОД ИГРЫ
     ========================================================================== */
  function reset() {
    G.rows = {}; G.genUntil = MIN_ROW - 1; G.pattern = null;
    G.particles = []; G.popups = [];
    G.t = 0; G.runTime = 0; G.score = 0; G.maxRow = 0;
    G.coins = 0; G.shake = 0; G.flash = 0; G.invuln = 0; G.deathT = 0;
    G.eagle = null; G.reviveUsed = false; G.hintShown = false;
    G.boostsUsed = 0; G.noStopBest = 0; G.ghostBeaten = false;
    G.ghostTrack = []; G.ghostNext = 0;
    pl.px = colX((COLS - 1) / 2); pl.py = rowY(0);
    pl.hop = null; pl.log = null; pl.facing = 'up';
    pl.idle = 0; pl.alive = true; pl.holdTimer = 0;
    W.ensureRows(ROWS_AHEAD);
    R.camY = R.camTargetY = camTargetFor(pl.py);
    UI.hideHint();
  }

  function startGame() {
    Sound.init();
    reset();
    G.state = 'playing';
    // сообщаем мете контекст забега: от него зависят задания «поиграй в биоме»
    if (META && META.onRunStart) {
      META.onRunStart({ biome: G.themeId, mode: G.modeId, diff: G.diffId });
    }
    G.runStart = (window.performance && performance.now) ? performance.now() : Date.now();
    UI.showOnly(null);
    Pl.gameplayStart();
    UI.syncHUD(true);
  }

  function tryMove(dc, dr) {
    if (G.state !== 'playing' || !pl.alive || pl.hop) { return false; }
    var col = playerCol(), row = playerRow();
    var tc = col + dc, tr = row + dr;
    if (tc < 0 || tc >= COLS) { return false; }
    var backLimit = Math.max(MIN_ROW, G.maxRow - 12);
    if (tr < backLimit) { return false; }
    if (tr > G.genUntil - 2) { return false; }
    var dest = G.rows[tr];
    if (dest && dest.type === 'grass' && (tc in dest.obstacles)) {
      // тупик: небольшой отскок + облачко пыли
      pl.holdTimer = 0.12;
      burst(colX(tc), rowY(tr) + TS * 0.3, 4, 'rgba(255,255,255,0.75)', 'dust', 60);
      return false;
    }
    pl.hop = { fx: pl.px, fy: pl.py, tx: colX(tc), ty: rowY(tr), t: 0, dc: dc, dr: dr };
    pl.facing = dr > 0 ? 'up' : (dr < 0 ? 'down' : (dc > 0 ? 'right' : 'left'));
    pl.log = null;
    pl.holdTimer = HOP_HOLD;
    Sound.hop();
    return true;
  }

  function logUnder(row, x) {
    var items = row.items;
    if (!items) { return null; }
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (Math.abs(x - it.x) <= it.len * TS * 0.5 + TS * 0.18) { return it; }
    }
    return null;
  }

  function onLand() {
    var row = playerRow(), obj = G.rows[row];

    if (obj && obj.type === 'water') {
      var lg = logUnder(obj, pl.px);
      if (lg) {
        pl.log = lg;
        burst(pl.px, pl.py + TS * 0.2, 5, 'rgba(150,220,255,0.9)', 'dot', 70);
      } else {
        die('water');
        return;
      }
    } else {
      burst(pl.px, pl.py + TS * 0.28, 3, 'rgba(230,240,255,0.55)', 'dust', 45);
      Sound.land();
    }

    if (obj && obj.coins && obj.coins.indexOf(playerCol()) >= 0) {
      var idx = obj.coins.indexOf(playerCol());
      obj.coins.splice(idx, 1);
      G.coins++; G.totalCoins++;
      popup(pl.px, pl.py - TS * 0.4, '+1', '#ffd75e');
      burst(pl.px, pl.py, 10, '#ffd75e', 'sparkle', 110);
      Sound.coin();
      UI.syncHUD();
    }

    if (row > G.maxRow) {
      G.maxRow = row;
      G.score = Math.max(0, row);
      pl.idle = 0;
      UI.hideHint();
      // награда за дистанцию: каждые 10 рядов капает немного монет, иначе
      // первые скины пришлось бы копить сотнями забегов
      if (row > 0 && row % 10 === 0) {
        var bonus = diff().coin10 || 2;
        G.coins += bonus; G.totalCoins += bonus;
        popup(pl.px, pl.py - TS * 0.75, '+' + bonus, '#ffd75e');
        burst(pl.px, pl.py, 12, '#ffd75e', 'sparkle', 120);
        Sound.coin();
      }
      UI.syncHUD();
    }
  }

  function edgeOut() { return Math.abs(pl.px) > FIELD_HALF + TS * 0.35; }

  function checkHits() {
    var r = playerRow(), obj = G.rows[r];
    if (!obj) { return; }
    var phw = TS * 0.29, phh = TS * 0.26;

    if (obj.type === 'road' && obj.items) {
      for (var i = 0; i < obj.items.length; i++) {
        var it = obj.items[i];
        if (Math.abs(pl.px - it.x) < it.len * TS * 0.5 + phw * 0.55) { die('car'); return; }
      }
    } else if (obj.type === 'rail' && obj.train) {
      var tr = obj.train;
      if (Math.abs(pl.px - tr.x) < tr.len * TS * 0.5 + phw * 0.6) { die('train'); return; }
    }
  }

  function die(reason) {
    if (!pl.alive || G.state !== 'playing') { return; }
    pl.alive = false;
    G.deathReason = reason;
    G.deathT = 0;
    G.shake = (reason === 'car' || reason === 'train') ? 16 : 10;
    G.flash = 1;
    G.flashColor = (reason === 'water' || reason === 'edge') ? '80,150,255' : '255,70,70';
    if (reason === 'water' || reason === 'edge') {
      Sound.splash();
      burst(pl.px, pl.py, 26, 'rgba(150,220,255,0.95)', 'dot', 150);
    } else if (reason === 'eagle') {
      Sound.screech();
      burst(pl.px, pl.py, 22, '#ffffff', 'feather', 120);
    } else {
      Sound.crash();
      burst(pl.px, pl.py, 24, '#ffffff', 'feather', 170);
      burst(pl.px, pl.py, 14, 'rgba(255,190,80,0.9)', 'dot', 150);
    }
  }

  function updateEagle(dt) {
    if (!pl.alive) { return; }
    if (!G.eagle) {
      if (pl.idle > eagleLimit()) {
        G.eagle = { t: 0, x: pl.px, y: pl.py - 260 };
        Sound.screech();
        UI.showHint(Pl.t('hintEagle'));
      }
      return;
    }
    G.eagle.t += dt;
    G.eagle.x += (pl.px - G.eagle.x) * Math.min(1, dt * 2.4);
    G.eagle.y += ((pl.py - 6) - G.eagle.y) * Math.min(1, dt * 3.2);
    if (G.eagle.t > EAGLE_DELAY) { die('eagle'); }
  }

  function moveWorld(dt) {
    var r, k, row, items, i, it, half;
    for (k in G.rows) {
      row = G.rows[+k];
      if (row.type === 'road' || row.type === 'water') {
        items = row.items; half = row.loop / 2;
        for (i = 0; i < items.length; i++) {
          it = items[i];
          it.x += it.vx * dt;
          if (it.vx > 0 && it.x > half) { it.x -= row.loop; }
          else if (it.vx < 0 && it.x < -half) { it.x += row.loop; }
        }
      } else if (row.type === 'rail') {
        if (row.train) {
          row.train.x += row.trainSpeed * dt * row.dir;
          var lim = (COLS / 2 + 8) * TS;
          if (row.dir > 0 ? row.train.x > lim : row.train.x < -lim) {
            row.train = null;
            row.timer = Math.max(1.5, rnd(2.6, 5.6) - (row.d || 0) * 1.4);
          }
        } else {
          row.timer -= dt;
          if (row.timer <= 0) {
            row.train = { x: -row.dir * (COLS / 2 + 8) * TS, len: row.trainLen };
            row.timer = Infinity;
            Sound.horn();
          }
        }
      }
    }
    // подчистка далёких рядов, чтобы память не росла
    var backLimit = Math.max(MIN_ROW, G.maxRow - 12);
    W.pruneRows(backLimit - 2);
    W.ensureRows(playerRow() + ROWS_AHEAD);
  }

  function update(dt) {
    if (G.state !== 'playing') { return; }
    G.runTime += dt;
    moveWorld(dt);

    if (pl.alive) {
      if (G.invuln > 0) { G.invuln -= dt; }
      if (pl.holdTimer > 0) { pl.holdTimer -= dt; }
      if (!pl.hop && held.dir && pl.holdTimer <= 0) { tryMove(held.dc, held.dr); }

      if (pl.hop) {
        pl.hop.t += dt / HOP_TIME;
        var e = Math.min(1, pl.hop.t);
        pl.px = pl.hop.fx + (pl.hop.tx - pl.hop.fx) * e;
        pl.py = pl.hop.fy + (pl.hop.ty - pl.hop.fy) * e;
        if (pl.hop.t >= 1) {
          pl.px = pl.hop.tx; pl.py = pl.hop.ty; pl.hop = null;
          onLand();
        }
      } else if (pl.log) {
        pl.px += pl.log.vx * dt;
        if (edgeOut()) { die('edge'); }
      } else {
        var obj = G.rows[playerRow()];
        if (obj && obj.type === 'water') { die('water'); }
      }

      if (pl.alive && !pl.hop && pl.log === null) { pl.idle += dt; }
      if (pl.alive && G.invuln <= 0) { checkHits(); }
      updateEagle(dt);

      // подсказка про орла заранее
      if (pl.alive && !G.hintShown && pl.idle > eagleLimit() - 3) { UI.showHint(Pl.t('hintEagle')); }
    } else {
      G.deathT += dt;
      if (G.deathT > 0.95) { gameOver(); return; }
    }

    updateParticles(dt);

    // призрак рекорда: раз в треть секунды запоминаем, где была курица
    if (pl.alive && G.runTime >= G.ghostNext && G.ghostTrack.length < 400) {
      G.ghostNext = G.runTime + 0.3;
      G.ghostTrack.push({ r: playerRow(), c: playerCol(), t: G.runTime });
    }

    R.camTargetY = camTargetFor(pl.py);
    if (Math.abs(R.camTargetY - R.camY) > TS * 6) { R.camY = R.camTargetY; }
    else { R.camY += (R.camTargetY - R.camY) * Math.min(1, dt * 9); }
    if (G.shake > 0) { G.shake = Math.max(0, G.shake - dt * 46); }
    if (G.flash > 0) { G.flash = Math.max(0, G.flash - dt * 2.1); }
    UI.syncHUD();
  }

  /* ==========================================================================
     8. КОНЕЦ ИГРЫ / ПРОДОЛЖЕНИЕ
     ========================================================================== */
  function gameOver() {
    if (G.state === 'over') { return; }
    G.state = 'over';
    Pl.gameplayStop();
    // Мета-прогрессия: статистика, задания, достижения, сезонный опыт
    if (META && META.onRunEnd) {
      G.metaResult = META.onRunEnd({
        rows: G.maxRow, coins: G.coins, reason: G.deathReason,
        timeMs: Math.round(G.runTime * 1000), combo: G.comboBest,
        biome: G.themeId, mode: G.modeId, diff: G.diffId,
        boostUsed: G.boostsUsed, noStop: G.noStopBest, ghostBeaten: G.ghostBeaten
      });
      META.ghostRecord(G.ghostTrack, G.score);
      if (Pl.metric) { Pl.metric('run_end', { rows: G.maxRow }); }
    }

    var isRecord = G.score > bestFor();
    if (isRecord) { G.bests[G.diffId] = G.score; }
    G.best = Math.max(G.best, G.score, bestFor());
    saveProfile();
    Pl.submitScore(G.score);
    if (isRecord && G.score > 0) { Sound.record(); }
    UI.over(isRecord);
    UI.showOnly('ovOver');

    var runMs = ((window.performance && performance.now) ? performance.now() : Date.now()) - G.runStart;
    if (Pl.canShowFullscreen(runMs)) {
      setTimeout(function () {
        if (G.state !== 'over') { return; }
        Pl.showFullscreen(function () { if (G.state === 'over') { UI.showOnly('ovOver'); } });
      }, 600);
    }
  }

  function findSafeRow(from) {
    var r;
    for (r = from; r <= from + 10; r++) { if (G.rows[r] && G.rows[r].type === 'grass') { return r; } }
    for (r = from - 1; r >= from - 10; r--) { if (G.rows[r] && G.rows[r].type === 'grass') { return r; } }
    return 0;
  }
  function freeCol(row, want) {
    var obj = G.rows[row];
    if (!obj || !obj.obstacles) { return want; }
    for (var d = 0; d < COLS; d++) {
      var a = want + d, b = want - d;
      if (a < COLS && !(a in obj.obstacles)) { return a; }
      if (b >= 0 && !(b in obj.obstacles)) { return b; }
    }
    return want;
  }

  function revive() {
    var row = findSafeRow(playerRow());
    var col = freeCol(row, playerCol());
    G.reviveUsed = true;
    pl.px = colX(col); pl.py = rowY(row);
    pl.hop = null; pl.log = null; pl.alive = true; pl.idle = 0; pl.facing = 'up';
    G.eagle = null; G.invuln = 2.0; G.deathT = 0; G.shake = 0; G.flash = 0;
    G.state = 'playing';
    UI.hideHint();
    UI.showOnly(null);
    Pl.gameplayStart();
    R.camY = R.camTargetY = camTargetFor(pl.py);
    burst(pl.px, pl.py, 20, '#ffe680', 'sparkle', 130);
    UI.syncHUD(true);
  }

  U.expose(CC.fx, { part: part, burst: burst, popup: popup, updateParticles: updateParticles });
  U.expose(CC.game, {
    reset: reset, startGame: startGame, tryMove: tryMove, logUnder: logUnder,
    onLand: onLand, edgeOut: edgeOut, checkHits: checkHits, die: die,
    updateEagle: updateEagle, moveWorld: moveWorld, update: update,
    gameOver: gameOver, findSafeRow: findSafeRow, freeCol: freeCol, revive: revive
  });
})(window.CC);
