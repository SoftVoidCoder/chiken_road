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
  var TS = C.TS, COLS = C.COLS, FIELD_HALF = C.FIELD_HALF;
  var colX = U.colX, rowY = U.rowY, hash01 = U.hash01, clamp = U.clamp;
  var D = CC.draw, A = CC.actors, TH = CC.themes;

  /* --- кэши кадра ----------------------------------------------------------
     Покрытие ряда (земля, дорога) не меняется, пока ряд жив: рисуем его один
     раз в полоску шириной поля и потом только копируем. Вода и рельсы
     анимированы, поэтому идут живьём. */
  function rowCover(type, row, y, fn) {
    if (!R.rowCache || type === 'water' || type === 'rail') { fn(row, y); return; }
    var k = R.DPR * R.scale;
    var key = 'r|' + type + '|' + G.themeId + '|' + row.r + '|' + (R.fine ? 1 : 0);
    var s = U.rowSprite(key, k, function () { fn(row, 0); });
    R.ctx.drawImage(s.cv, -FIELD_HALF, y - TS / 2, s.w, s.h);
  }

  // Виньетка — статичная картинка на размер окна: радиальный градиент
  // заметно дорогой, а выглядит одинаково каждый кадр.
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
      } else if (row.type === 'road') {
        for (var i2 = 0; i2 < row.items.length; i2++) {
          var it2 = row.items[i2];
          if (it2.x > -FIELD_HALF - TS * 4 && it2.x < FIELD_HALF + TS * 4) {
            A.drawVehicleCached(it2.x, y, it2.kind, it2.vx > 0 ? 1 : -1, it2.color, it2.ph);
          }
        }
      } else if (row.type === 'water') {
        for (var i3 = 0; i3 < row.items.length; i3++) {
          var it3 = row.items[i3];
          if (it3.x > -FIELD_HALF - TS * 4 && it3.x < FIELD_HALF + TS * 4) {
            D.drawLog(it3.x, y, it3.len, it3.kind);
          }
        }
      } else if (row.type === 'rail' && row.train) {
        D.drawTrain(row.train.x, y, row.dir);
      }
    }

    // затемнение за границами поля
    var edge = R.ctx.createLinearGradient(-FIELD_HALF - TS * 2, 0, -FIELD_HALF, 0);
    edge.addColorStop(0, 'rgba(6,10,16,0.85)'); edge.addColorStop(1, 'rgba(6,10,16,0)');
    R.ctx.fillStyle = edge;
    R.ctx.fillRect(-FIELD_HALF - TS * 3, R.camY - R.VH / R.scale, TS * 3, R.VH / R.scale * 2);
    var edge2 = R.ctx.createLinearGradient(FIELD_HALF + TS * 2, 0, FIELD_HALF, 0);
    edge2.addColorStop(0, 'rgba(6,10,16,0.85)'); edge2.addColorStop(1, 'rgba(6,10,16,0)');
    R.ctx.fillStyle = edge2;
    R.ctx.fillRect(FIELD_HALF, R.camY - R.VH / R.scale, TS * 3, R.VH / R.scale * 2);

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
  }

  U.expose(CC.render, { frame: render });
})(window.CC);
