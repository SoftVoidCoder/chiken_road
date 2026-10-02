/* ============================================================================
   render.js — кадр: камера, слои мира, эффекты, виньетка
   ----------------------------------------------------------------------------
   Единственное место, которое знает порядок слоёв. Ряды за пределами экрана
   не рисуются вовсе, фон и покрытия берутся из кэшей (см. js/core.js), чтобы
   держать стабильные кадры на слабых устройствах.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var TS = C.TS;
  var colX = U.colX, rowY = U.rowY, hash01 = U.hash01, clamp = U.clamp;
  var D = CC.draw, A = CC.actors, TH = CC.themes, MECH = CC.mech, META = CC.meta;

  /* --- кэши кадра ----------------------------------------------------------
     Покрытие ряда (земля, дорога) не меняется, пока ряд жив: рисуем его один
     раз в полоску шириной поля и потом только копируем. Вода и рельсы
     анимированы, поэтому идут живьём. */
  function rowCover(type, row, y, fn) {
    if (!R.rowCache || type === 'water' || type === 'rail') { fn(row, y); return; }
    var k = R.DPR * R.scale;
    var key = 'r|' + type + '|' + G.themeId + '|' + row.r + '|' + (R.fine ? 1 : 0);
    var s = U.rowSprite(key, k, function () { fn(row, 0); });
    R.ctx.drawImage(s.cv, -R.fieldHalf, y - TS / 2, s.w, s.h);
  }

  // Виньетка выключена: радиальное затемнение съедало до 42 % яркости в углах,
  // и углы экрана выглядели серыми квадратами поверх карты. Функция оставлена
  // на случай, если захочется вернуть мягкое затемнение (R.vignette = true).
  function drawVignette() {
    if (!R.vignette) { return; }
    var cv = U.fullscreenSprite(vignetteCache, 'vg|' + R.VW + 'x' + R.VH + '|' + R.DPR,
      Math.round(R.VW * R.DPR), Math.round(R.VH * R.DPR), function (g) {
        g.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
        var vg = g.createRadialGradient(R.VW / 2, R.VH / 2, Math.min(R.VW, R.VH) * 0.35,
          R.VW / 2, R.VH / 2, Math.max(R.VW, R.VH) * 0.75);
        vg.addColorStop(0, 'rgba(0,0,0,0)');
        vg.addColorStop(1, 'rgba(0,0,0,0.42)');
        g.fillStyle = vg;
        g.fillRect(0, 0, R.VW, R.VH);
      });
    R.ctx.setTransform(1, 0, 0, 1, 0, 0);
    R.ctx.drawImage(cv, 0, 0, cv.width, cv.height);   // кэш хранится в физических пикселях
  }
  var vignetteCache = { cv: null, key: '' };

  function render() {
    D.drawVoid();

    var sx = 0, sy = 0;
    if (G.shake > 0) { sx = (Math.random() * 2 - 1) * G.shake * 0.4; sy = (Math.random() * 2 - 1) * G.shake * 0.4; }
    R.ctx.setTransform(R.DPR * R.scale, 0, 0, R.DPR * R.scale,
      R.DPR * (R.VW / 2 - R.camX * R.scale + sx), R.DPR * (R.VH / 2 - R.camY * R.scale + sy));

    var top = R.camY - (R.VH / 2) / R.scale, bot = R.camY + (R.VH / 2) / R.scale;
    var rFrom = Math.floor(-(bot + TS) / TS), rTo = Math.ceil(-(top - TS) / TS);


    for (var r = rTo; r >= rFrom; r--) {
      var row = G.rows[r];
      if (!row) { continue; }
      var y = rowY(r);
      // прилив: ряды позади игрока постепенно уходят под воду
      var flooded = MECH && row.type === 'grass' && MECH.state().tide > 0 && row.r < G.maxRow - MECH.state().tide;
      if (row.type === 'grass') { rowCover('grass', row, y, D.drawGrass); }
      else if (row.type === 'road') { rowCover('road', row, y, D.drawRoad); }
      else if (row.type === 'water') { D.drawWater(row, y); }
      else if (row.type === 'rail') { D.drawRail(row, y); }

      // объекты ряда
      if (row.type === 'grass') {
        for (var c in row.obstacles) {
          var cc = +c;
          var kind = row.obstacles[c];
          // Вид украшения задаёт биом: зимой снеговик, в пустыне кактус и так далее.
          var th = TH.get(G.themeId);
          var decorKind = th.decor[kind === 'rock' ? 1 : 0] || kind;
          var dseed = hash01(row.r * 17 + cc * 29);
          D.drawDecor(decorKind, colX(cc), y + (decorKind === 'tree' ? -4 : 0), dseed);
        }
        for (var k2 = 0; k2 < row.coins.length; k2++) {
          D.drawCoin(colX(row.coins[k2]), y - 3 + Math.sin(G.t * 3 + row.coins[k2]) * 1.5, row.coins[k2]);
        }
        // скользкие клетки подсвечиваем, чтобы игрок понимал, где пронесёт
        if (row.ice) {
          for (var ic in row.ice) {
            R.ctx.fillStyle = 'rgba(210,240,255,0.30)';
            R.ctx.beginPath();
            R.ctx.ellipse(colX(+ic), y, TS * 0.40, TS * 0.34, 0, 0, 6.2832);
            R.ctx.fill();
            R.ctx.strokeStyle = 'rgba(255,255,255,0.45)';
            R.ctx.lineWidth = 1.4;
            R.ctx.stroke();
          }
        }
        if (flooded) { D.drawFlood(y, 1); }
        if (row.holes) { for (var hp in row.holes) { D.drawPit(colX(+hp), y); } }
      } else if (row.type === 'road') {
        for (var i2 = 0; i2 < row.items.length; i2++) {
          var it2 = row.items[i2];
          if (it2.x > -R.fieldHalf - TS * 4 && it2.x < R.fieldHalf + TS * 4) {
            // высокая трава соседнего ряда прячет машины
            var hiddenBelow = G.rows[r - 1] && G.rows[r - 1].tall;
            if (hiddenBelow) { R.ctx.globalAlpha = 0.45; }
            A.drawVehicleCached(it2.x, y, it2.kind, it2.vx > 0 ? 1 : -1, it2.color, it2.ph);
            if (hiddenBelow) { R.ctx.globalAlpha = 1; }
          }
        }
      } else if (row.type === 'water') {
        for (var i3 = 0; i3 < row.items.length; i3++) {
          var it3 = row.items[i3];
          if (it3.x > -R.fieldHalf - TS * 4 && it3.x < R.fieldHalf + TS * 4) {
            D.drawLog(it3.x, y, it3.len, it3.kind);
          }
        }
      } else if (row.type === 'road') {
        if (G.rows[r - 1] && G.rows[r - 1].tall) { D.drawTallFringe(y + TS / 2 - 2); }
      } else if (row.type === 'rail' && row.train) {
        D.drawTrain(row.train.x, y, row.dir);
      }
    }

    // явления механик биома: лазеры, краны, карусели, тени метеоров
    if (MECH) { MECH.drawWorld(); }


    // затемнение по краям поля убрано: поле занимает всю ширину экрана

    // орёл
    if (G.eagle && pl.alive) { D.drawEagle(G.eagle, G.t); }

    // частицы
    for (var p = 0; p < G.particles.length; p++) {
      var pt = G.particles[p];
      var a = Math.max(0, pt.life / pt.max);
      R.ctx.globalAlpha = a;
      R.ctx.fillStyle = pt.color;
      if (pt.kind === 'feather') {
        R.ctx.save(); R.ctx.translate(pt.x, pt.y); R.ctx.rotate(pt.rot);
        R.ctx.beginPath(); R.ctx.ellipse(0, 0, pt.size * 1.6, pt.size * 0.65, 0, 0, 6.2832); R.ctx.fill();
        R.ctx.restore();
      } else if (pt.kind === 'sparkle') {
        R.ctx.save(); R.ctx.translate(pt.x, pt.y); R.ctx.rotate(pt.rot);
        R.ctx.fillRect(-pt.size / 2, -0.8, pt.size, 1.6);
        R.ctx.fillRect(-0.8, -pt.size / 2, 1.6, pt.size);
        R.ctx.restore();
      } else if (pt.kind === 'dust') {
        R.ctx.beginPath(); R.ctx.arc(pt.x, pt.y, pt.size * (1.6 - a * 0.6), 0, 6.2832); R.ctx.fill();
      } else {
        R.ctx.beginPath(); R.ctx.arc(pt.x, pt.y, pt.size * a, 0, 6.2832); R.ctx.fill();
      }
    }
    R.ctx.globalAlpha = 1;

    // призрак рекорда: полупрозрачная курица повторяет лучший забег
    if (META && META.ghostTrack && G.state === 'playing' && pl.alive) {
      var track = META.ghostTrack();
      if (track && track.length > 3) {
        var gPrev = null;
        for (var gi = 0; gi < track.length; gi++) {
          if (track[gi].t <= G.runTime) { gPrev = track[gi]; } else { break; }
        }
        if (gPrev) {
          R.ctx.globalAlpha = 0.32;
          A.drawChicken(colX(gPrev.c), rowY(gPrev.r), null, 'up', false, G.t);
          R.ctx.globalAlpha = 1;
          // обгон призрака отмечаем один раз за забег
          if (G.maxRow > (META.ghostScore() || 0) && !G.ghostBeaten && META.ghostScore() > 0) {
            G.ghostBeaten = true;
          }
        }
      }
    }

    // питомец идёт рядом с курицей
    if (G.state !== 'loading' && G.pet && G.pet !== 'none') {
      A.drawPet(G.pet, pl.px - 20, pl.py + 22, G.t);
    }

    // курица
    if (G.state !== 'loading') {
      A.drawChicken(pl.px, pl.py, pl.hop ? pl.hop.t : null, pl.facing, !pl.alive, G.t);
    }

    // всплывашки
    R.ctx.font = 'bold 15px system-ui, sans-serif';
    R.ctx.textAlign = 'center';
    for (var q = 0; q < G.popups.length; q++) {
      var po = G.popups[q];
      R.ctx.globalAlpha = Math.max(0, po.life / 0.9);
      R.ctx.fillStyle = po.color;
      R.ctx.fillText(po.text, po.x, po.y);
    }
    R.ctx.globalAlpha = 1;

    // вспышка урона / воды
    if (G.flash > 0) {
      R.ctx.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
      R.ctx.fillStyle = 'rgba(' + G.flashColor + ',' + (G.flash * 0.28) + ')';
      R.ctx.fillRect(0, 0, R.VW, R.VH);
    }
    // виньетка
    drawVignette();

    // погода и ограничение обзора — уже в экранных координатах
    if (MECH) { MECH.drawScreen(); }
  }

  U.expose(CC.render, { frame: render });
})(window.CC);
