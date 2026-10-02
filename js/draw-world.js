/* ============================================================================
   draw-world.js — отрисовка мира: земля, дороги, вода, рельсы, поезд, орёл
   ----------------------------------------------------------------------------
   Земля и её украшения, покрытия, брёвна и лилии, поезд, орёл и фон за полем.
   Палитры берутся из активного биома (CC.themes), поэтому одна и та же
   функция рисует и летнюю лужайку, и зимний снег, и лаву вулкана.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var TS = C.TS, COLS = C.COLS, FIELD_HALF = C.FIELD_HALF, EAGLE_DELAY = C.EAGLE_DELAY;
  var clamp = U.clamp, rnd = U.rnd, pick = U.pick, hash01 = U.hash01;
  var colX = U.colX, rowY = U.rowY;
  var DEC = CC.decor, TH = CC.themes;
  function rr(x, y, w, h, r) {                       // скруглённый прямоугольник
    r = Math.min(r, Math.abs(w) / 2, Math.abs(h) / 2);
    R.ctx.beginPath();
    R.ctx.moveTo(x + r, y);
    R.ctx.arcTo(x + w, y, x + w, y + h, r);
    R.ctx.arcTo(x + w, y + h, x, y + h, r);
    R.ctx.arcTo(x, y + h, x, y, r);
    R.ctx.arcTo(x, y, x + w, y, r);
    R.ctx.closePath();
  }
  function shadow(x, y, rx, ry, a) {
    R.ctx.fillStyle = 'rgba(0,0,0,' + (a || 0.22) + ')';
    R.ctx.beginPath(); R.ctx.ellipse(x, y, rx, ry, 0, 0, 6.2832); R.ctx.fill();
  }

  var dots = null;   // тайл-паттерн точек фона

  // Активный биом: палитры и набор украшений берём отсюда.
  function theme() { return TH.get(G.themeId); }

  // Украшение клетки: сначала спрашиваем CC.decor (свои модели биомов),
  // а если такого вида нет — рисуем обычное дерево или камень.
  function drawDecor(kind, x, y, seed) {
    if (!DEC.draw(kind, x, y, seed, G.t)) {
      if (kind === 'rock') { drawRock(x, y); } else { drawTree(x, y, hash01(seed * 977) < 0.4 ? 1 : 0); }
    }
  }

  /* --- трава ---------------------------------------------------------------- */
  function drawGrass(row, y) {
    var i, x;
    for (i = 0; i < COLS; i++) {
      var tone = hash01(row.r * 71 + i * 13);
      x = colX(i);
      var tones = theme().grass;
      R.ctx.fillStyle = tone < 0.5 ? tones[0] : (tone < 0.8 ? tones[1] : tones[2]);
      R.ctx.fillRect(x - TS / 2, y - TS / 2, TS, TS);
    }
    // травинки и цветочки (мелочь не рисуем на мелком масштабе — экономия для телефонов)
    if (R.scale > 0.68) {
      for (i = 0; i < COLS; i++) {
        var h1 = hash01(row.r * 977 + i * 31);
        var h2 = hash01(row.r * 313 + i * 7);
        x = colX(i) - TS / 2 + 6 + h1 * (TS - 12);
        var yy = y - TS / 2 + 6 + h2 * (TS - 12);
        if (h1 > 0.72) {
          R.ctx.strokeStyle = 'rgba(60,140,60,0.55)'; R.ctx.lineWidth = 1.6; R.ctx.lineCap = 'round';
          R.ctx.beginPath(); R.ctx.moveTo(x, yy); R.ctx.lineTo(x + (h2 - 0.5) * 4, yy - 5); R.ctx.stroke();
        } else if (h1 < 0.07) {
          R.ctx.fillStyle = h2 < 0.5 ? '#fff2a8' : '#ffd0e8';
          R.ctx.beginPath(); R.ctx.arc(x, yy, 2.4, 0, 6.2832); R.ctx.fill();
        }
      }
    }
    // тёмная кромка сверху — «толщина» блока
    R.ctx.fillStyle = theme().grassTop;
    R.ctx.fillRect(-FIELD_HALF, y - TS / 2, TS * COLS, 3);
  }

  /* --- дорога --------------------------------------------------------------- */
  function drawRoad(row, y) {
    var road = theme().road;
    R.ctx.fillStyle = road[0];
    R.ctx.fillRect(-FIELD_HALF, y - TS / 2, FIELD_HALF * 2, TS);
    R.ctx.fillStyle = road[1];
    R.ctx.fillRect(-FIELD_HALF, y - TS / 2 + 1, FIELD_HALF * 2, 2);
    R.ctx.fillRect(-FIELD_HALF, y + TS / 2 - 3, FIELD_HALF * 2, 2);
    // прерывистая разметка по центру ряда
    R.ctx.fillStyle = road[2];
    for (var i = -COLS; i <= COLS; i++) {
      var x = colX(i) + ((G.t * 8) % (TS * 2)) * 0;
      R.ctx.fillRect(x - TS * 0.28, y - 1.5, TS * 0.56, 3);
    }
  }

  /* --- вода ----------------------------------------------------------------- */
  function drawWater(row, y) {
    var wc = theme().water;
    var g = U.grad('water|' + G.themeId, function () {
      // координаты градиента заданы относительно ряда: рядов на экране много,
      // а градиент у них один и тот же, поэтому он кэшируется
      var gg = R.ctx.createLinearGradient(0, -TS / 2, 0, TS / 2);
      gg.addColorStop(0, wc[0]); gg.addColorStop(0.5, wc[1]); gg.addColorStop(1, wc[2]);
      return gg;
    });
    R.ctx.save();
    R.ctx.translate(0, y);            // дальше рисуем ряд в своих координатах
    R.ctx.fillStyle = g;
    R.ctx.fillRect(-FIELD_HALF, -TS / 2, FIELD_HALF * 2, TS);
    R.ctx.strokeStyle = 'rgba(255,255,255,0.20)'; R.ctx.lineWidth = 2;
    for (var w = 0; w < 3; w++) {
      R.ctx.beginPath();
      var yy = -TS * 0.28 + w * TS * 0.28;
      for (var x = -FIELD_HALF; x <= FIELD_HALF; x += 12) {
        var dy = Math.sin((x * 0.06) + G.t * 2.2 + row.phase + w) * 2.2;
        if (x === -FIELD_HALF) { R.ctx.moveTo(x, yy + dy); } else { R.ctx.lineTo(x, yy + dy); }
      }
      R.ctx.stroke();
    }
    // пена у берега
    R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
    R.ctx.fillRect(-FIELD_HALF, -TS / 2, FIELD_HALF * 2, 2.5);
    R.ctx.fillRect(-FIELD_HALF, TS / 2 - 2.5, FIELD_HALF * 2, 2.5);
    R.ctx.restore();
  }

  /* --- рельсы --------------------------------------------------------------- */
  function drawRail(row, y) {
    var rail = theme().rail;
    R.ctx.fillStyle = rail[0];
    R.ctx.fillRect(-FIELD_HALF, y - TS / 2, FIELD_HALF * 2, TS);
    // щебень
    if (R.scale > 0.72) {
      for (var i = 0; i < COLS * 6; i++) {
        var h = hash01(row.r * 61 + i * 41);
        var hx = -FIELD_HALF + h * FIELD_HALF * 2;
        var hy = y - TS / 2 + hash01(i * 17 + row.r) * TS;
        R.ctx.fillStyle = h < 0.5 ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.12)';
        R.ctx.fillRect(hx, hy, 2.4, 2.4);
      }
    }
    // шпалы
    R.ctx.fillStyle = rail[1];
    for (var s = -COLS; s <= COLS; s++) {
      R.ctx.fillRect(colX(s) - TS * 0.42, y - TS * 0.36, TS * 0.84, TS * 0.72);
    }
    // рельсы
    R.ctx.fillStyle = rail[2];
    R.ctx.fillRect(-FIELD_HALF, y - TS * 0.20, FIELD_HALF * 2, 3.5);
    R.ctx.fillRect(-FIELD_HALF, y + TS * 0.16, FIELD_HALF * 2, 3.5);
    // светофоры по краям
    var warn = (!row.train && row.timer < row.warn);
    var blink = Math.floor(G.t * 5) % 2 === 0;
    [-FIELD_HALF - TS * 0.5, FIELD_HALF + TS * 0.5].forEach(function (px) {
      shadow(px, y + TS * 0.30, 9, 4, 0.25);
      R.ctx.fillStyle = '#5a6472';
      R.ctx.fillRect(px - 2.5, y - TS * 0.5, 5, TS * 0.85);
      rr(px - 9, y - TS * 0.5, 18, 12, 3);
      R.ctx.fillStyle = '#2b3038'; R.ctx.fill();
      R.ctx.fillStyle = (warn && blink) ? '#ff3b30' : '#5c1f1c';
      R.ctx.beginPath(); R.ctx.arc(px - 4.5, y - TS * 0.5 + 6, 3.4, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = (warn && !blink) ? '#ff3b30' : '#5c1f1c';
      R.ctx.beginPath(); R.ctx.arc(px + 4.5, y - TS * 0.5 + 6, 3.4, 0, 6.2832); R.ctx.fill();
    });
  }

  /* --- деревья, камни, монеты ---------------------------------------------- */
  function drawTree(x, y, variant) {
    shadow(x + 3, y + 9, 17, 8, 0.26);
    if (variant === 1) {                                  // ёлка (вид сверху)
      var layers = [[19, '#2f7d43'], [14, '#39934f'], [9, '#46a95c']];
      for (var i = 0; i < layers.length; i++) {
        var spikes = 10, rad = layers[i][0];
        R.ctx.fillStyle = layers[i][1];
        R.ctx.beginPath();
        for (var s = 0; s < spikes * 2; s++) {
          var rr2 = (s % 2 === 0) ? rad : rad * 0.72;
          var a = (s / (spikes * 2)) * 6.2832 + i * 0.3;
          var px = x + Math.cos(a) * rr2, py = y + Math.sin(a) * rr2 * 0.92;
          if (s === 0) { R.ctx.moveTo(px, py); } else { R.ctx.lineTo(px, py); }
        }
        R.ctx.closePath(); R.ctx.fill();
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.18)';
      R.ctx.beginPath(); R.ctx.arc(x - 3, y - 3, 3.6, 0, 6.2832); R.ctx.fill();
      return;
    }
    if (variant === 2) {                                  // куст
      var c = [['#3f8f4a', -7, 0, 10], ['#49a457', 7, 1, 9], ['#57b465', 0, -6, 9.5]];
      for (var k = 0; k < c.length; k++) {
        R.ctx.fillStyle = c[k][0];
        R.ctx.beginPath(); R.ctx.arc(x + c[k][1], y + c[k][2], c[k][3], 0, 6.2832); R.ctx.fill();
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.20)';
      R.ctx.beginPath(); R.ctx.arc(x - 4, y - 5, 3, 0, 6.2832); R.ctx.fill();
      return;
    }
    // лиственное дерево
    R.ctx.fillStyle = '#7a5230';
    R.ctx.beginPath(); R.ctx.arc(x, y + 1, 5, 0, 6.2832); R.ctx.fill();
    var blob = [[-8, -2, 11, '#2f8043'], [8, -1, 10.5, '#358c4a'], [0, -8, 12, '#3f9c55'], [0, 3, 10, '#2b763d']];
    for (var b = 0; b < blob.length; b++) {
      R.ctx.fillStyle = blob[b][3];
      R.ctx.beginPath(); R.ctx.arc(x + blob[b][0], y + blob[b][1], blob[b][2], 0, 6.2832); R.ctx.fill();
    }
    R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
    R.ctx.beginPath(); R.ctx.arc(x - 5, y - 6, 4.2, 0, 6.2832); R.ctx.fill();
  }

  function drawRock(x, y) {
    shadow(x + 2, y + 8, 14, 6, 0.24);
    R.ctx.fillStyle = '#8b8f98';
    R.ctx.beginPath();
    R.ctx.moveTo(x - 13, y + 6); R.ctx.lineTo(x - 9, y - 8); R.ctx.lineTo(x + 2, y - 12);
    R.ctx.lineTo(x + 12, y - 5); R.ctx.lineTo(x + 11, y + 8); R.ctx.lineTo(x - 4, y + 11);
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#a8adb8';
    R.ctx.beginPath();
    R.ctx.moveTo(x - 8, y - 6); R.ctx.lineTo(x + 1, y - 9); R.ctx.lineTo(x + 6, y - 3); R.ctx.lineTo(x - 4, y + 1);
    R.ctx.closePath(); R.ctx.fill();
  }

  function drawCoin(x, y, phase) {
    var k = Math.abs(Math.cos(G.t * 3 + phase));
    shadow(x, y + 7, 8, 3.5, 0.20);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.scale(0.22 + k * 0.78, 1);
    R.ctx.fillStyle = '#f0b429';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 8.5, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#ffd75e';
    R.ctx.beginPath(); R.ctx.arc(0, -0.6, 6.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e0a01c';
    R.ctx.fillRect(-1.1, -4, 2.2, 8);
    R.ctx.restore();
  }

  /* --- брёвна и лилии ------------------------------------------------------- */
  function drawLog(x, y, len, kind) {
    var w = len * TS;
    if (kind === 'lily') {
      shadow(x, y + 5, w * 0.5, 7, 0.20);
      R.ctx.fillStyle = '#3f9c55';
      R.ctx.beginPath(); R.ctx.arc(x, y, w * 0.5, 0.35, 6.2832 - 0.35); R.ctx.lineTo(x, y); R.ctx.closePath(); R.ctx.fill();
      R.ctx.fillStyle = '#54b96c';
      R.ctx.beginPath(); R.ctx.arc(x, y, w * 0.38, 0.35, 6.2832 - 0.35); R.ctx.lineTo(x, y); R.ctx.closePath(); R.ctx.fill();
      R.ctx.fillStyle = '#ffd0e8';
      R.ctx.beginPath(); R.ctx.arc(x + w * 0.16, y - 2, 3.2, 0, 6.2832); R.ctx.fill();
      return;
    }
    shadow(x, y + 6, w * 0.5, 8, 0.22);
    var g = R.ctx.createLinearGradient(0, y - 10, 0, y + 10);
    g.addColorStop(0, '#a9743f'); g.addColorStop(0.5, '#8b5a2b'); g.addColorStop(1, '#6f4520');
    R.ctx.fillStyle = g;
    rr(x - w / 2, y - 10, w, 20, 9); R.ctx.fill();
    // кольца на спиле
    R.ctx.fillStyle = '#c08a4e';
    R.ctx.beginPath(); R.ctx.ellipse(x - w / 2 + 3, y, 3.2, 8, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(x + w / 2 - 3, y, 3.2, 8, 0, 0, 6.2832); R.ctx.fill();
    // кора
    R.ctx.strokeStyle = 'rgba(60,36,14,0.45)'; R.ctx.lineWidth = 1.4;
    for (var i = -2; i <= 2; i++) {
      R.ctx.beginPath();
      R.ctx.moveTo(x - w / 2 + 8, y + i * 3.4);
      R.ctx.lineTo(x + w / 2 - 8, y + i * 3.4 + (i % 2 ? 1 : -1));
      R.ctx.stroke();
    }
  }


  /* --- поезд ---------------------------------------------------------------- */
  function drawTrain(x, y, dir) {
    var total = 8.4 * TS;
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.scale(dir, 1);
    R.ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(-total / 2 + 2, -TS * 0.34 + 4, total, TS * 0.68, 8); R.ctx.fill();

    // вагоны
    for (var i = 0; i < 3; i++) {
      var wx = total / 2 - TS * 1.4 - i * TS * 2.3;
      R.ctx.fillStyle = i === 0 ? '#d94b3f' : '#8f98a6';
      rr(wx - TS * 1.05, -TS * 0.32, TS * 2.1, TS * 0.64, 8); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(20,26,40,0.45)';
      for (var w = 0; w < 3; w++) { R.ctx.fillRect(wx - TS * 0.85 + w * TS * 0.62, -TS * 0.22, TS * 0.36, TS * 0.12); }
    }
    // локомотив
    R.ctx.fillStyle = '#c8342b';
    rr(total / 2 - TS * 4.6, -TS * 0.34, TS * 1.6, TS * 0.68, 9); R.ctx.fill();
    R.ctx.fillStyle = '#f2c94c';
    rr(total / 2 - TS * 4.6, -TS * 0.34, TS * 0.30, TS * 0.68, 6); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.25)';
    rr(total / 2 - TS * 3.6, -TS * 0.22, TS * 0.55, TS * 0.44, 5); R.ctx.fill();
    R.ctx.restore();

    // фара-конус вперёд
    R.ctx.save();
    R.ctx.globalAlpha = 0.16;
    var g = R.ctx.createLinearGradient(x + dir * total * 0.1, 0, x + dir * total * 0.9, 0);
    g.addColorStop(0, '#fff8c0'); g.addColorStop(1, 'rgba(255,248,192,0)');
    R.ctx.fillStyle = g;
    R.ctx.beginPath();
    R.ctx.moveTo(x + dir * total * 0.1, y - TS * 0.45);
    R.ctx.lineTo(x + dir * total * 0.95, y - TS * 1.3);
    R.ctx.lineTo(x + dir * total * 0.95, y + TS * 1.3);
    R.ctx.lineTo(x + dir * total * 0.1, y + TS * 0.45);
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.restore();
  }


  /* --- орёл ----------------------------------------------------------------- */
  function drawEagle(e, t) {
    var k = Math.min(1, e.t / EAGLE_DELAY);
    var gy = pl.py + 6;
    // растущая тень на земле
    R.ctx.fillStyle = 'rgba(0,0,0,' + (0.10 + k * 0.28) + ')';
    R.ctx.beginPath(); R.ctx.ellipse(pl.px, gy, 12 + k * 26, 6 + k * 12, 0, 0, 6.2832); R.ctx.fill();

    var ex = e.x, ey = e.y;
    R.ctx.save();
    R.ctx.translate(ex, ey);
    R.ctx.scale(0.9 + k * 0.35, 0.9 + k * 0.35);
    var wing = Math.sin(t * 9) * 0.22;
    // крылья
    R.ctx.fillStyle = '#8a5a34';
    R.ctx.save(); R.ctx.rotate(-0.25 + wing);
    R.ctx.beginPath(); R.ctx.ellipse(-24, 2, 24, 9, 0, 0, 6.2832); R.ctx.fill(); R.ctx.restore();
    R.ctx.save(); R.ctx.rotate(0.25 - wing);
    R.ctx.beginPath(); R.ctx.ellipse(24, 2, 24, 9, 0, 0, 6.2832); R.ctx.fill(); R.ctx.restore();
    // тело
    R.ctx.fillStyle = '#a06a3d';
    R.ctx.beginPath(); R.ctx.ellipse(0, 0, 12, 19, 0, 0, 6.2832); R.ctx.fill();
    // голова и клюв
    R.ctx.fillStyle = '#e8dcc8';
    R.ctx.beginPath(); R.ctx.arc(0, -17, 8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f2c94c';
    R.ctx.beginPath(); R.ctx.moveTo(-3.5, -21); R.ctx.lineTo(3.5, -21); R.ctx.lineTo(0, -28); R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.arc(-3.6, -18, 1.6, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(3.6, -18, 1.6, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  /* --- общий рендер --------------------------------------------------------- */
  function drawVoid() {
    R.ctx.setTransform(R.DPR, 0, 0, R.DPR, 0, 0);
    var sky = theme().sky;
    var g = U.grad('sky|' + G.themeId, function () {
      var gg = R.ctx.createLinearGradient(0, 0, 0, R.VH);
      gg.addColorStop(0, sky[0]); gg.addColorStop(1, sky[1]);
      return gg;
    });
    R.ctx.fillStyle = g; R.ctx.fillRect(0, 0, R.VW, R.VH);
    // Точки фона: вместо сотен fillRect каждый кадр — один тайл-паттерн,
    // сдвинутый камерой. Паттерн создаётся один раз на контекст.
    if (R.quality > 0) {
      var step = 44, off = (-R.camY * R.scale) % step;
      if (!dots) {
        var tile = document.createElement('canvas');
        tile.width = tile.height = step;
        var tg = tile.getContext('2d');
        tg.fillStyle = 'rgba(255,255,255,0.05)';
        tg.fillRect(0, 0, 2, 2);
        dots = R.ctx.createPattern(tile, 'repeat');
      }
      if (dots) {
        R.ctx.save();
        R.ctx.translate(0, off);
        R.ctx.fillStyle = dots;
        R.ctx.fillRect(0, -off, R.VW, R.VH);
        R.ctx.restore();
      }
    }
  }

  U.expose(CC.draw, {
    rr: rr, shadow: shadow, drawGrass: drawGrass, drawRoad: drawRoad,
    drawWater: drawWater, drawRail: drawRail, drawTree: drawTree, drawRock: drawRock,
    drawCoin: drawCoin, drawLog: drawLog, drawTrain: drawTrain, drawEagle: drawEagle,
    drawVoid: drawVoid, drawDecor: drawDecor
  });
})(window.CC);
