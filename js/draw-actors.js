/* ============================================================================
   draw-actors.js — отрисовка героев: 2D-модели машин и курица со скинами
   ----------------------------------------------------------------------------
   Кузова собираются послойно (тень, колёса, кузов с градиентом и швами,
   стёкла с бликами, крыша, зеркала, фары и стопы), курица — из палитры скина.
   Мелкие штрихи отключаются при R.fine = false, то есть на телефонах.
   Готовые машины кэшируются в спрайты: см. drawVehicleCached.
   Модуль сборки Crossy Chicken. Общая шина — window.CC (см. js/core.js);
   порядок подключения задан в index.html.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl, IN = CC.in;
  var TS = C.TS, KIND = C.KIND, CAR_COLORS = C.CAR_COLORS;
  var rr = CC.draw.rr, shadow = CC.draw.shadow;
  var withCtx = U.withCtx, SK = CC.skins;
  /* --- 2D-модели машин ------------------------------------------------------ */
  // Модели собираются послойно, как настоящие спрайты:
  //   тень → колёса → кузов с градиентом и швами → стёкла с бликами →
  //   крыша и боковые окна → зеркала → фары и стопы → детали конкретного типа
  //   (шашечки, мигалки, крест, кузов пикапа, плуг трактора и т.д.).
  // Мелкие штрихи (блики на стекле, ручки дверей, диски колёс) рисуются
  // только при крупном масштабе — на мелком экране телефона они не видны.

  var CAR_W = TS * 0.60;                     // ширина кузова машины

  function hexRgb(hex) {
    var n = parseInt(String(hex).slice(1), 16);
    var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
    if (!isFinite(r) || !isFinite(g) || !isFinite(b)) { return [224, 90, 71]; }
    return [r, g, b];
  }
  // k > 0 — светлее, k < 0 — темнее: из одного цвета получаем всю палитру машины
  function shade(hex, k) {
    var c = hexRgb(hex);
    for (var i = 0; i < 3; i++) {
      c[i] = k >= 0 ? c[i] + (255 - c[i]) * k : c[i] * (1 + k);
      c[i] = c[i] < 0 ? 0 : (c[i] > 255 ? 255 : c[i]);
    }
    return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')';
  }

  function vShadowBox(len, w) {
    R.ctx.fillStyle = 'rgba(0,0,0,0.30)';
    rr(-len / 2 + 3, -w / 2 + 5, len, w, Math.min(11, w / 2.6)); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(0,0,0,0.18)';
    rr(-len / 2 + 7, -w / 2 + 8, len - 6, w - 3, Math.min(10, w / 2.8)); R.ctx.fill();
  }

  // кузов: градиент по ширине даёт ощущение объёма, сверху блик, снизу тень
  function vBody(len, hw, base, r) {
    var g = R.ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.36));
    g.addColorStop(0.28, shade(base, 0.08));
    g.addColorStop(0.60, base);
    g.addColorStop(1, shade(base, -0.44));
    rr(-len / 2, -hw, len, hw * 2, r);
    R.ctx.fillStyle = g; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    if (!R.fine) { return; }
    R.ctx.save();
    rr(-len / 2 + 0.8, -hw + 0.8, len - 1.6, hw * 2 - 1.6, r);
    R.ctx.clip();
    R.ctx.fillStyle = 'rgba(255,255,255,0.16)';
    rr(-len / 2 + 2, -hw + 1.2, len - 4, hw * 0.26, 3); R.ctx.fill();
    R.ctx.restore();
  }

  function vSeam(x, hw, from, to) {          // шов панели поперёк кузова
    R.ctx.strokeStyle = 'rgba(0,0,0,0.26)'; R.ctx.lineWidth = 1;
    R.ctx.beginPath();
    R.ctx.moveTo(x, from === undefined ? -hw + 2 : from);
    R.ctx.lineTo(x, to === undefined ? hw - 2 : to);
    R.ctx.stroke();
  }

  function vHandles(x, hw, w) {              // дверные ручки
    R.ctx.fillStyle = 'rgba(255,255,255,0.55)';
    R.ctx.beginPath();
    R.ctx.rect(x, -hw + 2.2, w, 2); R.ctx.rect(x, hw - 4.2, w, 2);
    R.ctx.fill();
  }

  // стекло задаётся четырьмя точками (передняя кромка шире/уже задней)
  function vGlassQuad(p) {
    var yMin = Math.min(p[1], p[3], p[5], p[7]), yMax = Math.max(p[1], p[3], p[5], p[7]);
    var xMin = Math.min(p[0], p[2], p[4], p[6]), xMax = Math.max(p[0], p[2], p[4], p[6]);
    R.ctx.beginPath();
    R.ctx.moveTo(p[0], p[1]); R.ctx.lineTo(p[2], p[3]); R.ctx.lineTo(p[4], p[5]); R.ctx.lineTo(p[6], p[7]);
    R.ctx.closePath();
    // плоская заливка вместо градиента: полоса стекла всего 6–10 px,
    // градиент на ней не читается, а стоит заметно дороже
    R.ctx.fillStyle = '#2c3f56'; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(12,16,24,0.5)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (!R.fine) { return; }
    R.ctx.save(); R.ctx.clip();
    R.ctx.fillStyle = 'rgba(169,201,232,0.85)';       // отражение неба у кромки
    R.ctx.fillRect(xMin - 1, yMin - 1, xMax - xMin + 2, Math.max(1.6, (yMax - yMin) * 0.16));
    R.ctx.strokeStyle = 'rgba(232,245,255,0.30)'; R.ctx.lineWidth = 2.2;
    R.ctx.beginPath();
    R.ctx.moveTo(xMin, yMax + 2); R.ctx.lineTo(xMax, yMin - 2);
    R.ctx.stroke();
    R.ctx.restore();
  }

  function vWheel(cx, cy, h, big) {
    rr(cx - 5.5, cy - h / 2, 11, h, 3);
    R.ctx.fillStyle = '#14171d'; R.ctx.fill();
    if (big) {                                  // протектор у больших колёс
      R.ctx.fillStyle = 'rgba(255,255,255,0.10)';
      for (var i = 0; i < 3; i++) { R.ctx.fillRect(cx - 5.5, cy - h / 2 + 2 + i * (h / 3.2), 11, 1.2); }
    }
    if (!R.fine) { return; }
    R.ctx.fillStyle = 'rgba(196,206,220,0.38)';
    rr(cx - 3, cy - h * 0.24, 6, h * 0.48, 1.5); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
    R.ctx.fillRect(cx - 4.5, cy - h / 2 + 1, 9, 1.3);
  }

  function vHead(x, hw, glow) {
    if (glow) {
      var g = R.ctx.createRadialGradient(x, 0, 1, x, 0, 24);
      g.addColorStop(0, 'rgba(255,244,190,0.38)');
      g.addColorStop(1, 'rgba(255,244,190,0)');
      R.ctx.fillStyle = g;
      R.ctx.beginPath(); R.ctx.arc(x, 0, 24, 0, 6.2832); R.ctx.fill();
    }
    var ys = [-hw + 2.5, hw - 8.5];
    rr(x - 3.5, ys[0], 5, 6, 2); rr(x - 3.5, ys[1], 5, 6, 2);
    R.ctx.fillStyle = '#dde5f0'; R.ctx.fill();
    rr(x - 2.6, ys[0] + 1, 3.2, 4, 1.4); rr(x - 2.6, ys[1] + 1, 3.2, 4, 1.4);
    R.ctx.fillStyle = 'rgba(255,250,215,0.95)'; R.ctx.fill();
  }

  function vTail(x, hw) {
    var ys = [-hw + 2.5, hw - 8.5];
    rr(x, ys[0], 4, 6, 1.8); rr(x, ys[1], 4, 6, 1.8);
    R.ctx.fillStyle = '#cf2a1e'; R.ctx.fill();
    rr(x + 0.7, ys[0] + 1.2, 2.3, 3.6, 1); rr(x + 0.7, ys[1] + 1.2, 2.3, 3.6, 1);
    R.ctx.fillStyle = 'rgba(255,150,130,0.85)'; R.ctx.fill();
    R.ctx.fillStyle = '#e6ecf5';
    R.ctx.fillRect(x + 0.6, -1.8, 2.2, 3.6);
  }

  function vMirrors(x, hw, base) {            // зеркала на ножках
    R.ctx.fillStyle = 'rgba(26,32,42,0.85)';
    R.ctx.fillRect(x - 1.2, -hw - 3.4, 2.4, 4);
    R.ctx.fillRect(x - 1.2, hw - 0.6, 2.4, 4);
    R.ctx.fillStyle = shade(base, -0.15);
    rr(x - 4.2, -hw - 5.4, 7.5, 3.2, 1.5); R.ctx.fill();
    rr(x - 4.2, hw + 2.2, 7.5, 3.2, 1.5); R.ctx.fill();
  }

  function vPlate(x, y) {
    R.ctx.fillStyle = '#e9eef6'; rr(x, y - 3, 2.6, 6, 0.8); R.ctx.fill();
    if (!R.fine) { return; }
    R.ctx.fillStyle = 'rgba(30,40,60,0.5)';
    R.ctx.fillRect(x + 0.6, y - 1.5, 1.5, 3);
  }

  /* --- легковой автомобиль (car / taxi / police) ---------------------------- */
  function drawSedan(len, base, variant) {
    var hw = CAR_W / 2, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 8.5, -hw + 0.5, 7);
    vWheel(x0 + 8.5, hw - 0.5, 7);
    vWheel(x1 - 9.5, -hw + 0.5, 7);
    vWheel(x1 - 9.5, hw - 0.5, 7);

    vBody(len, hw, base, Math.min(12, len * 0.14));

    var xHood = x0 + len * 0.70, xTrunk = x0 + len * 0.20;
    var xR0 = x0 + len * 0.32, xR1 = x0 + len * 0.56;

    // капот со рёбрами
    R.ctx.fillStyle = 'rgba(255,255,255,0.09)';
    rr(xHood + 1, -hw + 1.8, x1 - xHood - 3, hw * 2 - 3.6, 3); R.ctx.fill();
    if (R.fine) {
      R.ctx.strokeStyle = 'rgba(0,0,0,0.18)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.moveTo(xHood + 2, -hw * 0.42); R.ctx.lineTo(x1 - 4, -hw * 0.30); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(xHood + 2, hw * 0.42); R.ctx.lineTo(x1 - 4, hw * 0.30); R.ctx.stroke();
      // решётка радиатора
      R.ctx.fillStyle = 'rgba(20,24,32,0.55)';
      rr(x1 - 4.5, -hw * 0.55, 2.5, hw * 1.1, 1); R.ctx.fill();
    }

    vSeam(xTrunk, hw);
    vSeam(xR1, hw);
    if (R.fine) { vHandles(x0 + len * 0.40, hw, 6); vHandles(x0 + len * 0.50, hw, 5); }

    // лобовое и заднее стекло
    vGlassQuad([x0 + len * 0.70, -hw * 0.80, x0 + len * 0.70, hw * 0.80,
                x0 + len * 0.58, hw * 0.93, x0 + len * 0.58, -hw * 0.93]);
    vGlassQuad([x0 + len * 0.30, -hw * 0.87, x0 + len * 0.30, hw * 0.87,
                x0 + len * 0.19, hw * 0.96, x0 + len * 0.19, -hw * 0.96]);

    // крыша и боковые окна
    R.ctx.fillStyle = shade(base, 0.18);
    rr(xR0, -hw * 0.80, xR1 - xR0, hw * 1.60, 4); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.16)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xR0 + 1.5, -hw * 0.96, xR1 - xR0 - 3, 2.3);
    R.ctx.fillRect(xR0 + 1.5, hw * 0.96 - 2.3, xR1 - xR0 - 3, 2.3);
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.30)';       // хромированная окантовка
      R.ctx.fillRect(xR0 + 1.5, -hw * 0.96 + 2.3, xR1 - xR0 - 3, 0.5);
      R.ctx.fillRect(xR0 + 1.5, hw * 0.96 - 2.8, xR1 - xR0 - 3, 0.5);
      R.ctx.fillStyle = 'rgba(0,0,0,0.14)';             // люк
      rr(xR0 + (xR1 - xR0) * 0.22, -hw * 0.44, (xR1 - xR0) * 0.5, hw * 0.88, 2.5); R.ctx.fill();
    }

    vMirrors(xHood - 1, hw, base);

    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
    if (R.fine) { vPlate(x1 - 1.6, 0); }

    if (variant === 'taxi') {                        // шашечки и «шапка»
      R.ctx.fillStyle = '#20242e';
      for (i = 0; i < 6; i++) {
        var bx = x0 + len * 0.22 + i * len * 0.10;
        R.ctx.fillRect(bx, -hw + 0.8, len * 0.05, 2.2);
        R.ctx.fillRect(bx, hw - 3.0, len * 0.05, 2.2);
      }
      R.ctx.fillStyle = '#f5c542';
      rr(xR0 + (xR1 - xR0) * 0.22, -hw * 0.52, (xR1 - xR0) * 0.56, hw * 1.04, 2.5); R.ctx.fill();
      R.ctx.fillStyle = '#20242e';
      for (i = 0; i < 3; i++) {
        R.ctx.fillRect(xR0 + (xR1 - xR0) * (0.28 + i * 0.16), -hw * 0.40, (xR1 - xR0) * 0.08, hw * 0.80);
      }
    } else if (variant === 'police') {               // полосы и мигалка
      R.ctx.fillStyle = '#1e3a8a';
      R.ctx.fillRect(x0 + len * 0.06, -hw + 1.2, len * 0.60, 3);
      R.ctx.fillRect(x0 + len * 0.06, hw - 4.2, len * 0.60, 3);
      R.ctx.fillStyle = 'rgba(255,255,255,0.9)';
      R.ctx.fillRect(x0 + len * 0.06, -hw + 4.2, len * 0.60, 1.4);
      R.ctx.fillRect(x0 + len * 0.06, hw - 5.6, len * 0.60, 1.4);
      var on = Math.floor(G.t * 8) % 2 === 0;
      R.ctx.fillStyle = '#20242e';
      rr(xR0 + (xR1 - xR0) * 0.30, -hw * 0.66, (xR1 - xR0) * 0.40, hw * 1.32, 2); R.ctx.fill();
      R.ctx.fillStyle = on ? '#3b82f6' : '#5b6472';
      rr(xR0 + (xR1 - xR0) * 0.32, -hw * 0.60, (xR1 - xR0) * 0.17, hw * 1.20, 1.5); R.ctx.fill();
      R.ctx.fillStyle = on ? '#5b6472' : '#ef4444';
      rr(xR0 + (xR1 - xR0) * 0.52, -hw * 0.60, (xR1 - xR0) * 0.17, hw * 1.20, 1.5); R.ctx.fill();
      if (R.fine) {                                   // свечение над мигалкой
        var lg = R.ctx.createRadialGradient(xR0 + (xR1 - xR0) * 0.45, 0, 1, xR0 + (xR1 - xR0) * 0.45, 0, 18);
        lg.addColorStop(0, on ? 'rgba(90,160,255,0.35)' : 'rgba(255,80,80,0.35)');
        lg.addColorStop(1, 'rgba(0,0,0,0)');
        R.ctx.fillStyle = lg;
        R.ctx.beginPath(); R.ctx.arc(xR0 + (xR1 - xR0) * 0.45, 0, 18, 0, 6.2832); R.ctx.fill();
      }
    }
  }

  /* --- фургон --------------------------------------------------------------- */
  function drawVan(len, base) {
    var hw = CAR_W / 2 + 1, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 9, -hw + 0.5, 7.5);
    vWheel(x0 + 9, hw - 0.5, 7.5);
    vWheel(x1 - 11, -hw + 0.5, 7.5);
    vWheel(x1 - 11, hw - 0.5, 7.5);

    vBody(len, hw, base, 8);

    var xWind0 = x0 + len * 0.64, xWind1 = x0 + len * 0.80;
    // короткий капот
    R.ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(xWind1, -hw + 2, x1 - xWind1 - 2, hw * 2 - 4, 3); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(20,24,32,0.5)';
      rr(x1 - 4, -hw * 0.5, 2.2, hw, 1); R.ctx.fill();
    }
    vGlassQuad([xWind1, -hw * 0.88, xWind1, hw * 0.88, xWind0, hw * 0.98, xWind0, -hw * 0.98]);

    // крыша фургона с рёбрами жёсткости и вентиляцией
    var xR0 = x0 + len * 0.12, xR1 = xWind0;
    R.ctx.fillStyle = shade(base, 0.20);
    rr(xR0, -hw * 0.86, xR1 - xR0, hw * 1.72, 5); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.16)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.13)';
      for (i = 1; i <= 3; i++) {
        R.ctx.fillRect(xR0 + (xR1 - xR0) * (i / 4), -hw * 0.84, 1.6, hw * 1.68);
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.45)';       // люк на крыше
      rr(xR0 + (xR1 - xR0) * 0.62, -hw * 0.26, (xR1 - xR0) * 0.18, hw * 0.52, 2); R.ctx.fill();
    }
    // боковые окна кабины и сдвижная дверь
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xWind0 + 1.5, -hw * 0.99, 3.5, 2.6);
    R.ctx.fillRect(xWind0 + 1.5, hw * 0.99 - 2.6, 3.5, 2.6);
    vSeam(x0 + len * 0.44, hw);
    vGlassQuad([x0 + len * 0.62, -hw * 0.95, x0 + len * 0.62, -hw * 0.55,
                x0 + len * 0.44, -hw * 0.55, x0 + len * 0.44, -hw * 0.95]);
    if (R.fine) { vHandles(x0 + len * 0.40, hw, 7); vHandles(x0 + len * 0.70, hw, 5); }

    vMirrors(xWind1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
    if (R.fine) {                                   // задние двери
      vSeam(x0 + len * 0.05, hw);
      R.ctx.fillStyle = 'rgba(255,255,255,0.35)';
      R.ctx.fillRect(x0 + len * 0.05 - 1.4, -hw + 2, 2.8, 3);
    }
  }

  /* --- спорткар ------------------------------------------------------------- */
  function drawSport(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 8, -hw + 0.5, 8);
    vWheel(x0 + 8, hw - 0.5, 8);
    vWheel(x1 - 11, -hw + 0.5, 8);
    vWheel(x1 - 11, hw - 0.5, 8);

    // низкий клин: нос сходится к острию
    var g = R.ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.40));
    g.addColorStop(0.30, shade(base, 0.10));
    g.addColorStop(0.62, base);
    g.addColorStop(1, shade(base, -0.48));
    R.ctx.beginPath();
    R.ctx.moveTo(x0, -hw);
    R.ctx.lineTo(x1 - 5, -hw * 0.92);
    R.ctx.quadraticCurveTo(x1 + 3, 0, x1 - 5, hw * 0.92);
    R.ctx.lineTo(x0, hw);
    R.ctx.closePath();
    R.ctx.fillStyle = g; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();

    // сплиттер и воздухозаборник
    R.ctx.fillStyle = 'rgba(16,18,24,0.85)';
    rr(x1 - 6, -hw * 0.86, 4, hw * 1.72, 1.5); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(16,18,24,0.6)';
      rr(x1 - 14, -hw * 0.34, 5, hw * 0.68, 1.5); R.ctx.fill();
      R.ctx.strokeStyle = 'rgba(0,0,0,0.22)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 20, -hw * 0.5); R.ctx.lineTo(x1 - 12, -hw * 0.24); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 20, hw * 0.5); R.ctx.lineTo(x1 - 12, hw * 0.24); R.ctx.stroke();
    }
    // гоночная полоса
    R.ctx.fillStyle = 'rgba(255,255,255,0.72)';
    R.ctx.fillRect(x0 + 4, -3.2, len - 12, 2.2);
    R.ctx.fillRect(x0 + 4, 1.0, len - 12, 2.2);

    // фонарь кабины
    vGlassQuad([x0 + len * 0.62, -hw * 0.72, x0 + len * 0.62, hw * 0.72,
                x0 + len * 0.36, hw * 0.86, x0 + len * 0.36, -hw * 0.86]);
    R.ctx.fillStyle = shade(base, 0.22);
    rr(x0 + len * 0.24, -hw * 0.74, len * 0.12, hw * 1.48, 3); R.ctx.fill();

    // антикрыло с боковыми стойками
    R.ctx.fillStyle = '#232833';
    rr(x0 - 3, -hw * 1.06, 6, hw * 2.12, 2); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.16)';
    R.ctx.fillRect(x0 - 3, -hw * 1.02, 6, 1.6);
    R.ctx.fillStyle = shade(base, -0.25);
    R.ctx.fillRect(x0 + 1.5, -hw * 0.86, 3, 4);
    R.ctx.fillRect(x0 + 1.5, hw * 0.86 - 4, 3, 4);

    vMirrors(x0 + len * 0.60, hw, base);
    vHead(x1 - 4.5, hw, true);
    vTail(x0 + 0.6, hw);
    if (R.fine) {                                   // сдвоенный выхлоп
      R.ctx.fillStyle = '#2b3038';
      rr(x0 + 0.4, -hw * 0.42, 3.4, 3, 1.2); R.ctx.fill();
      rr(x0 + 0.4, hw * 0.42 - 3, 3.4, 3, 1.2); R.ctx.fill();
    }
  }

  /* --- пикап ---------------------------------------------------------------- */
  function drawPickup(len, base) {
    var hw = CAR_W / 2 + 1, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 11, -hw + 0.5, 8.5, true);
    vWheel(x0 + 11, hw - 0.5, 8.5, true);
    vWheel(x1 - 12, -hw + 0.5, 8.5, true);
    vWheel(x1 - 12, hw - 0.5, 8.5, true);

    vBody(len, hw, base, 7);

    var xCab0 = x0 + len * 0.46, xCab1 = x0 + len * 0.80;
    // открытый кузов: тёмный пол и рёбра
    R.ctx.fillStyle = '#4a3627';
    rr(x0 + 2.5, -hw + 3, xCab0 - x0 - 3.5, hw * 2 - 6, 2.5); R.ctx.fill();
    if (R.fine) {
      R.ctx.strokeStyle = 'rgba(255,255,255,0.16)'; R.ctx.lineWidth = 1.2;
      for (i = 1; i <= 3; i++) {
        var rx2 = x0 + 2.5 + (xCab0 - x0 - 3.5) * (i / 4);
        R.ctx.beginPath(); R.ctx.moveTo(rx2, -hw + 3.5); R.ctx.lineTo(rx2, hw - 3.5); R.ctx.stroke();
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.22)';       // борта кузова
      R.ctx.fillRect(x0 + 2.5, -hw + 3.2, xCab0 - x0 - 3.5, 1.4);
      R.ctx.fillRect(x0 + 2.5, hw - 4.6, xCab0 - x0 - 3.5, 1.4);
    }
    // кабина
    R.ctx.fillStyle = shade(base, 0.20);
    rr(xCab0, -hw + 1.5, xCab1 - xCab0, hw * 2 - 3, 4); R.ctx.fill();
    vGlassQuad([xCab1, -hw * 0.86, xCab1, hw * 0.86, xCab0 + (xCab1 - xCab0) * 0.45, hw * 0.94, xCab0 + (xCab1 - xCab0) * 0.45, -hw * 0.94]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xCab0 + 2, -hw * 0.97, xCab1 - xCab0 - 6, 2.4);
    R.ctx.fillRect(xCab0 + 2, hw * 0.97 - 2.4, xCab1 - xCab0 - 6, 2.4);
    // капот и решётка
    R.ctx.fillStyle = 'rgba(255,255,255,0.10)';
    rr(xCab1, -hw + 2, x1 - xCab1 - 2, hw * 2 - 4, 3); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(20,24,32,0.6)';
    rr(x1 - 4.5, -hw * 0.62, 3, hw * 1.24, 1); R.ctx.fill();
    if (R.fine) {                                     // дуга за кабиной
      R.ctx.strokeStyle = '#c9ced8'; R.ctx.lineWidth = 2.4;
      R.ctx.beginPath(); R.ctx.arc(xCab1 - 2, 0, hw * 0.92, -Math.PI * 0.5, Math.PI * 0.5); R.ctx.stroke();
      vHandles(xCab0 + 6, hw, 5);
    }
    vSeam(xCab0, hw);
    vMirrors(xCab1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- скорая помощь -------------------------------------------------------- */
  function drawAmbulance(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 10, -hw + 0.5, 8);
    vWheel(x0 + 10, hw - 0.5, 8);
    vWheel(x1 - 12, -hw + 0.5, 8);
    vWheel(x1 - 12, hw - 0.5, 8);

    vBody(len, hw, base, 8);

    var xBox1 = x0 + len * 0.70, xWind0 = x0 + len * 0.74, xWind1 = x0 + len * 0.90;
    // кузов с рёбрами
    R.ctx.fillStyle = shade(base, 0.18);
    rr(x0 + 1.5, -hw * 0.88, xBox1 - x0 - 3, hw * 1.76, 4); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.15)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (i = 1; i <= 3; i++) { R.ctx.fillRect(x0 + 4 + (xBox1 - x0 - 8) * (i / 4), -hw * 0.86, 1.5, hw * 1.72); }
    }
    // кабина и лобовое
    vGlassQuad([xWind1, -hw * 0.86, xWind1, hw * 0.86, xWind0, hw * 0.96, xWind0, -hw * 0.96]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.8)';
    R.ctx.fillRect(xWind0 + 1.2, -hw * 0.99, 3.6, 2.6);
    R.ctx.fillRect(xWind0 + 1.2, hw * 0.99 - 2.6, 3.6, 2.6);

    // красная полоса и крест на обоих бортах
    R.ctx.fillStyle = '#e03b30';
    R.ctx.fillRect(x0 + 1, -hw + 1.4, len * 0.70, 3.4);
    R.ctx.fillRect(x0 + 1, hw - 4.8, len * 0.70, 3.4);
    if (R.fine) {
      for (i = 0; i < 2; i++) {
        var cy = i === 0 ? -hw * 0.42 : hw * 0.42;
        R.ctx.fillStyle = '#e03b30';
        R.ctx.fillRect(x0 + len * 0.30 - 1.8, cy - 3.4, 3.6, 6.8);
        R.ctx.fillRect(x0 + len * 0.30 - 5.2, cy - 1.2, 10.4, 2.4);
      }
    }
    // проблесковая мигалка на крыше кабины
    var bl = Math.floor(G.t * 9) % 3;
    R.ctx.fillStyle = '#20242e';
    rr(xWind0 - 2, -hw * 0.62, 8, hw * 1.24, 2); R.ctx.fill();
    R.ctx.fillStyle = bl === 0 ? '#ef4444' : '#6b7280';
    rr(xWind0 - 1.5, -hw * 0.58, 3.4, hw * 1.16, 1.4); R.ctx.fill();
    R.ctx.fillStyle = bl === 1 ? '#3b82f6' : '#6b7280';
    rr(xWind0 + 2.5, -hw * 0.58, 3.4, hw * 1.16, 1.4); R.ctx.fill();
    if (R.fine) {
      var ag = R.ctx.createRadialGradient(xWind0 + 2, 0, 1, xWind0 + 2, 0, 20);
      ag.addColorStop(0, bl === 0 ? 'rgba(255,70,70,0.34)' : (bl === 1 ? 'rgba(80,150,255,0.34)' : 'rgba(0,0,0,0)'));
      ag.addColorStop(1, 'rgba(0,0,0,0)');
      R.ctx.fillStyle = ag;
      R.ctx.beginPath(); R.ctx.arc(xWind0 + 2, 0, 20, 0, 6.2832); R.ctx.fill();
      vSeam(x0 + len * 0.06, hw);                    // задние створки
      vHandles(xWind0 - 12, hw, 6);
    }
    vMirrors(xWind1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- грузовик ------------------------------------------------------------- */
  function drawTruck(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i;
    var xCab0 = x1 - TS * 1.12;
    // колёса тягача и прицепа
    vWheel(xCab0 + 6, -hw + 0.5, 8, true);
    vWheel(xCab0 + 6, hw - 0.5, 8, true);
    vWheel(xCab0 - 4, -hw + 0.5, 8, true);
    vWheel(xCab0 - 4, hw - 0.5, 8, true);
    vWheel(x0 + 14, -hw + 0.5, 8, true);
    vWheel(x0 + 14, hw - 0.5, 8, true);
    vWheel(x0 + 7, -hw + 0.5, 8, true);
    vWheel(x0 + 7, hw - 0.5, 8, true);

    var xBox1 = xCab0 - TS * 0.22;
    // прицеп: рёбра, юбка, задние двери
    var bg = R.ctx.createLinearGradient(0, -hw, 0, hw);
    bg.addColorStop(0, '#e9edf4');
    bg.addColorStop(0.35, '#cfd6e1');
    bg.addColorStop(1, '#9aa3b1');
    rr(x0, -hw, xBox1 - x0, hw * 2, 4);
    R.ctx.fillStyle = bg; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.45)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (i = 1; i <= 5; i++) { R.ctx.fillRect(x0 + (xBox1 - x0) * (i / 6), -hw + 1.5, 1.6, hw * 2 - 3); }
      R.ctx.fillStyle = 'rgba(255,255,255,0.35)';
      R.ctx.fillRect(x0 + 2, -hw + 2.4, xBox1 - x0 - 4, 1.6);
      R.ctx.fillStyle = '#8d99ae';                     // юбка
      rr(x0 + 3, -hw + 1, xBox1 - x0 - 6, hw * 2 - 2, 3); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(0,0,0,0.18)';
      rr(x0 + 6, -hw * 0.72, xBox1 - x0 - 12, hw * 1.44, 3); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,220,120,0.75)';      // боковые габариты
      for (i = 0; i < 3; i++) {
        var lx = x0 + (xBox1 - x0) * (0.2 + i * 0.3);
        R.ctx.fillRect(lx, -hw - 0.4, 3, 1.6);
        R.ctx.fillRect(lx, hw - 1.2, 3, 1.6);
      }
      vSeam(x0 + (xBox1 - x0) * 0.5, hw, -hw + 2, hw - 2);
    }
    // кабина
    R.ctx.save();
    R.ctx.translate(xCab0 + (x1 - xCab0) / 2, 0);
    var chw = CAR_W / 2, clen = x1 - xCab0;
    vBody(clen, chw, base, 6);
    vGlassQuad([clen * 0.32, -chw * 0.86, clen * 0.32, chw * 0.86, -clen * 0.5, chw * 0.96, -clen * 0.5, -chw * 0.96]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.8)';
    R.ctx.fillRect(-clen * 0.44, -chw * 0.98, clen * 0.24, 2.4);
    R.ctx.fillRect(-clen * 0.44, chw * 0.98 - 2.4, clen * 0.24, 2.4);
    R.ctx.fillStyle = shade(base, 0.2);
    rr(-clen * 0.18, -chw * 0.80, clen * 0.5, chw * 1.6, 3); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(20,24,32,0.6)';
    rr(clen * 0.40, -chw * 0.66, 2.6, chw * 1.32, 1); R.ctx.fill();
    // труба за кабиной
    if (R.fine) {
      R.ctx.fillStyle = '#6b7280';
      rr(-clen * 0.5 - 1.5, -chw * 1.16, 4, 3, 1); R.ctx.fill();
    }
    R.ctx.restore();
    vMirrors(xCab0 + (x1 - xCab0) * 0.30, CAR_W / 2, base);
    vHead(x1 - 2.5, CAR_W / 2, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- автобус -------------------------------------------------------------- */
  function drawBus(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 13, -hw + 0.5, 9, true);
    vWheel(x0 + 13, hw - 0.5, 9, true);
    vWheel(x1 - 16, -hw + 0.5, 9, true);
    vWheel(x1 - 16, hw - 0.5, 9, true);

    vBody(len, hw, base, 10);

    // огромное лобовое и маршрутный указатель
    vGlassQuad([x1 - 3, -hw * 0.90, x1 - 3, hw * 0.90, x0 + len * 0.80, hw * 0.98, x0 + len * 0.80, -hw * 0.98]);
    R.ctx.fillStyle = 'rgba(16,20,28,0.85)';
    rr(x1 - 9, -hw * 0.52, 4, hw * 1.04, 1.5); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,214,102,0.85)';
    R.ctx.fillRect(x1 - 8.2, -hw * 0.14, 2.4, hw * 0.28);

    // крыша с люками и рёбрами
    var xR0 = x0 + len * 0.06, xR1 = x0 + len * 0.78;
    R.ctx.fillStyle = shade(base, 0.22);
    rr(xR0, -hw * 0.88, xR1 - xR0, hw * 1.76, 6); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.15)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.10)';
      for (i = 1; i <= 5; i++) { R.ctx.fillRect(xR0 + (xR1 - xR0) * (i / 6), -hw * 0.86, 1.5, hw * 1.72); }
      R.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      rr(xR0 + (xR1 - xR0) * 0.18, -hw * 0.24, (xR1 - xR0) * 0.16, hw * 0.48, 2); R.ctx.fill();
      rr(xR0 + (xR1 - xR0) * 0.66, -hw * 0.24, (xR1 - xR0) * 0.16, hw * 0.48, 2); R.ctx.fill();
    }
    // ряд боковых окон
    R.ctx.fillStyle = 'rgba(30,40,55,0.88)';
    for (i = 0; i < 5; i++) {
      var wx = x0 + len * 0.12 + i * len * 0.13, ww = len * 0.10;
      R.ctx.fillRect(wx, -hw * 0.995, ww, 2.8);
      R.ctx.fillRect(wx, hw * 0.995 - 2.8, ww, 2.8);
    }
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.28)';
      for (i = 0; i < 5; i++) {
        var wx2 = x0 + len * 0.12 + i * len * 0.13, ww2 = len * 0.10;
        R.ctx.fillRect(wx2, -hw * 0.995 + 2.9, ww2, 0.5);
        R.ctx.fillRect(wx2, hw * 0.995 - 3.4, ww2, 0.5);
      }
      // передняя дверь
      R.ctx.fillStyle = 'rgba(255,255,255,0.35)';
      R.ctx.fillRect(x0 + len * 0.72, -hw * 0.995, 1.6, 3);
      R.ctx.fillRect(x0 + len * 0.72, hw * 0.995 - 3, 1.6, 3);
      vSeam(x0 + len * 0.70, hw);
    }
    // заднее стекло
    vGlassQuad([x0 + len * 0.10, -hw * 0.82, x0 + len * 0.10, hw * 0.82,
                x0 + len * 0.04, hw * 0.90, x0 + len * 0.04, -hw * 0.90]);

    vMirrors(x1 - 12, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- трактор -------------------------------------------------------------- */
  function drawTractor(len, base) {
    var hw = CAR_W / 2, x0 = -len / 2, x1 = len / 2;
    // огромные задние колёса и маленькие передние
    vWheel(x0 + 5, -hw - 1.5, 13, true);
    vWheel(x0 + 5, hw + 1.5, 13, true);
    vWheel(x1 - 9, -hw + 1, 7, true);
    vWheel(x1 - 9, hw - 1, 7, true);
    // крылья над задними колёсами
    R.ctx.fillStyle = '#f2c94c';
    rr(x0 - 3, -hw - 5.5, 15, 5, 2); R.ctx.fill();
    rr(x0 - 3, hw + 0.5, 15, 5, 2); R.ctx.fill();

    // капот с решёткой
    var g = R.ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.34));
    g.addColorStop(0.4, base);
    g.addColorStop(1, shade(base, -0.40));
    rr(x0 - 1, -hw + 1, len * 0.62, hw * 2 - 2, 6);
    R.ctx.fillStyle = g; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    R.ctx.fillStyle = 'rgba(255,255,255,0.14)';
    rr(x0 + 1, -hw + 3, len * 0.58, hw * 0.5, 3); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(20,24,32,0.55)';        // решётка радиатора
      rr(x1 - 8, -hw * 0.66, 3.4, hw * 1.32, 1);
      R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.25)';
      R.ctx.fillRect(x1 - 7.2, -hw * 0.6, 1.8, hw * 1.2);
    }
    // кабина с дугой безопасности
    R.ctx.fillStyle = '#39404f';
    rr(x0 + len * 0.44, -hw * 0.92, len * 0.26, hw * 1.84, 4); R.ctx.fill();
    vGlassQuad([x0 + len * 0.68, -hw * 0.80, x0 + len * 0.68, hw * 0.80,
                x0 + len * 0.46, hw * 0.88, x0 + len * 0.46, -hw * 0.88]);
    R.ctx.strokeStyle = '#f2c94c'; R.ctx.lineWidth = 2.4;
    R.ctx.beginPath(); R.ctx.arc(x0 + len * 0.44, 0, hw * 0.96, -Math.PI * 0.52, Math.PI * 0.52); R.ctx.stroke();
    // выхлопная труба с теплозащитой
    R.ctx.fillStyle = 'rgba(255,255,255,0.14)';
    R.ctx.beginPath(); R.ctx.arc(x1 - 12, -hw * 1.05, 4.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5a6472';
    R.ctx.beginPath(); R.ctx.arc(x1 - 12, -hw * 1.05, 2.8, 0, 6.2832); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = '#20242e';
      R.ctx.beginPath(); R.ctx.arc(x1 - 12, -hw * 1.05, 1.4, 0, 6.2832); R.ctx.fill();
      // фара и сцепка
      R.ctx.fillStyle = '#fff3c4';
      R.ctx.beginPath(); R.ctx.arc(x1 - 3, -hw * 0.5, 2.6, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = '#4a5266';
      rr(x0 - 5, -3, 4, 6, 1.5); R.ctx.fill();
    }
  }

  /* --- мотоцикл ------------------------------------------------------------- */
  // Мотоцикл: узкий, но с читаемыми деталями — рама, бак, седло, вилка,
  // выхлоп, гонщик в шлеме. Раньше детали сливались в одно тёмное пятно.
  function drawMoto(len, base) {
    var ctx = R.ctx;
    var hw = TS * 0.16;                       // полуширина корпуса
    var x0 = -len / 2, x1 = len / 2;
    // лёгкий наклон в повороте — мотоцикл не едет строго прямо
    ctx.rotate(Math.sin(G.t * 2.6) * 0.035);

    // колёса: узкие, но с ободом и спицами
    vWheel(x0 + 4.5, 0, 7);
    vWheel(x1 - 4.5, 0, 7);
    if (R.fine) {
      ctx.strokeStyle = 'rgba(210,220,235,0.45)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x0 + 4.5, -3.6); ctx.lineTo(x0 + 4.5, 3.6); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x1 - 4.5, -3.6); ctx.lineTo(x1 - 4.5, 3.6); ctx.stroke();
    }

    // выхлоп по правому борту с хромированным наконечником
    ctx.fillStyle = '#8d99ae';
    rr(x0 + 5, hw * 1.05, len * 0.46, 2.8, 1.4); ctx.fill();
    ctx.fillStyle = '#c9ced8';
    rr(x1 - len * 0.30, hw * 1.0, len * 0.16, 3.4, 1.7); ctx.fill();

    // рама и маятник — тёмная балка по центру
    ctx.fillStyle = '#20242e';
    rr(x0 + 4, -hw * 0.5, len - 8, hw, 2.5); ctx.fill();

    // бак: самый заметный цветной элемент
    var tg = ctx.createLinearGradient(0, -hw * 1.1, 0, hw * 1.1);
    tg.addColorStop(0, shade(base, 0.5));
    tg.addColorStop(0.45, base);
    tg.addColorStop(1, shade(base, -0.45));
    rr(-len * 0.02, -hw * 1.1, len * 0.38, hw * 2.2, 4);
    ctx.fillStyle = tg; ctx.fill();
    ctx.strokeStyle = 'rgba(15,20,30,0.45)'; ctx.lineWidth = 1; ctx.stroke();
    if (R.fine) {
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      rr(-len * 0.005, -hw * 0.8, len * 0.34, 1.7, 1); ctx.fill();
    }

    // седло и задний обтекатель
    ctx.fillStyle = '#161a22';
    rr(-len * 0.30, -hw * 0.9, len * 0.26, hw * 1.8, 3); ctx.fill();
    ctx.fillStyle = shade(base, -0.2);
    rr(x0 + 2, -hw * 0.7, len * 0.16, hw * 1.4, 3); ctx.fill();
    if (R.fine) {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      rr(x0 + 3, -hw * 0.55, len * 0.12, 1.4, 0.7); ctx.fill();
    }

    // вилка от руля к переднему колесу
    ctx.strokeStyle = '#b9c1cd'; ctx.lineWidth = 2.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(len * 0.16, -hw * 0.9); ctx.lineTo(x1 - 4.5, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len * 0.16, hw * 0.9); ctx.lineTo(x1 - 4.5, 0); ctx.stroke();
    // руль
    ctx.fillStyle = '#e6ebf3';
    rr(len * 0.12, -hw * 1.9, 3, hw * 3.8, 1.5); ctx.fill();

    // гонщик: корпус, руки к рулю, шлем с визором
    ctx.fillStyle = '#2b3240';
    ctx.beginPath(); ctx.ellipse(-len * 0.06, 0, hw * 1.45, hw * 1.25, 0, 0, 6.2832); ctx.fill();
    ctx.fillStyle = shade(base, -0.32);
    ctx.beginPath(); ctx.ellipse(-len * 0.11, 0, hw * 1.05, hw * 0.9, 0, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = '#2b3240'; ctx.lineWidth = 2.8;
    ctx.beginPath(); ctx.moveTo(len * 0.0, -hw * 0.6); ctx.lineTo(len * 0.12, -hw * 1.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(len * 0.0, hw * 0.6); ctx.lineTo(len * 0.12, hw * 1.2); ctx.stroke();
    ctx.fillStyle = '#f2f5fa';
    ctx.beginPath(); ctx.arc(len * 0.05, 0, hw * 1.3, 0, 6.2832); ctx.fill();
    ctx.strokeStyle = 'rgba(120,132,155,0.5)'; ctx.lineWidth = 1; ctx.stroke();
    ctx.fillStyle = 'rgba(18,24,38,0.88)';
    ctx.beginPath();
    ctx.arc(len * 0.05 + hw * 0.34, 0, hw * 1.05, -1.2, 1.2);
    ctx.lineTo(len * 0.05 + hw * 0.34, 0);
    ctx.closePath(); ctx.fill();
    if (R.fine) {
      ctx.fillStyle = 'rgba(255,255,255,0.45)';
      ctx.fillRect(len * 0.05 - hw * 0.9, -hw * 0.55, hw * 0.7, 1.2);
    }

    // фара и стоп-сигнал
    ctx.fillStyle = '#fff3c4';
    ctx.beginPath(); ctx.arc(x1 - 3, 0, 2.4, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(255,243,196,0.25)';
    ctx.beginPath(); ctx.arc(x1 - 3, 0, 5.5, 0, 6.2832); ctx.fill();
    ctx.fillStyle = '#e8352a';
    rr(x0 + 1, -2.6, 3, 5.2, 1.4); ctx.fill();
  }

  /* --- снегоуборщик --------------------------------------------------------- */
  function drawSnowplow(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i, j;
    var pw = hw * 1.34;                              // отвал заметно шире кузова
    var xBlade = x1 + 7;                             // режущая кромка выступает за нос
    // колёса: ведущие задние с цепями противоскольжения
    vWheel(x0 + 11, -hw + 0.5, 9, true);
    vWheel(x0 + 11, hw - 0.5, 9, true);
    vWheel(x1 - 17, -hw + 0.5, 8, true);
    vWheel(x1 - 17, hw - 0.5, 8, true);
    if (R.fine) {                                    // цепи: поперечные звенья по протектору
      R.ctx.strokeStyle = 'rgba(214,222,234,0.8)'; R.ctx.lineWidth = 1;
      for (j = 0; j < 2; j++) {
        var cwy = j === 0 ? -hw + 0.5 : hw - 0.5;
        for (i = 0; i < 3; i++) {
          var cl = cwy - 3.2 + i * 3.2;
          R.ctx.beginPath(); R.ctx.moveTo(x0 + 5.5, cl); R.ctx.lineTo(x0 + 16.5, cl); R.ctx.stroke();
          R.ctx.beginPath(); R.ctx.moveTo(x1 - 22.5, cl); R.ctx.lineTo(x1 - 11.5, cl); R.ctx.stroke();
        }
      }
    }

    // кузов и швы панелей
    vBody(len, hw, base, 6);
    vSeam(x0 + len * 0.30, hw);
    vSeam(x1 - len * 0.24, hw);
    if (R.fine) {                                    // рёбра борта и потёртости от реагентов
      R.ctx.fillStyle = 'rgba(0,0,0,0.12)';
      for (i = 1; i <= 4; i++) { R.ctx.fillRect(x0 + len * 0.30 * (i / 5), -hw + 1.8, 1.6, hw * 2 - 3.6); }
      R.ctx.fillStyle = 'rgba(255,255,255,0.10)';
      rr(x1 - len * 0.22, -hw + 2.2, len * 0.14, hw * 2 - 4.4, 3); R.ctx.fill();
    }

    // широкая кабина: лобовое занимает переднюю часть, крыша — остальное
    var xc0 = x0 + len * 0.34, xc1 = x1 - len * 0.22, cw = xc1 - xc0;
    R.ctx.fillStyle = shade(base, 0.22);
    rr(xc0, -hw + 1.2, cw, hw * 2 - 2.4, 4); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.16)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    vGlassQuad([xc1, -hw * 0.84, xc1, hw * 0.84, xc1 - cw * 0.34, hw * 0.95, xc1 - cw * 0.34, -hw * 0.95]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';         // боковые окна кабины
    R.ctx.fillRect(xc0 + 1.5, -hw * 0.98, cw * 0.42, 2.6);
    R.ctx.fillRect(xc0 + 1.5, hw * 0.98 - 2.6, cw * 0.42, 2.6);
    if (R.fine) { vHandles(xc0 + 1.5, hw, 5); }
    // крыша кабины — до основания лобового стекла
    R.ctx.fillStyle = shade(base, 0.32);
    rr(xc0 + 1.5, -hw * 0.72, cw * 0.62, hw * 1.44, 3); R.ctx.fill();

    // отвал: скошенные края, рёбра жёсткости, хромированная кромка, штанги
    var bg = R.ctx.createLinearGradient(0, -pw, 0, pw);
    bg.addColorStop(0, shade(base, 0.44));
    bg.addColorStop(0.45, base);
    bg.addColorStop(1, shade(base, -0.46));
    R.ctx.beginPath();
    R.ctx.moveTo(x1 - 5, -pw);
    R.ctx.lineTo(xBlade, -pw * 0.62);
    R.ctx.lineTo(xBlade, pw * 0.62);
    R.ctx.lineTo(x1 - 5, pw);
    R.ctx.closePath();
    R.ctx.fillStyle = bg; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.save(); R.ctx.clip();
      R.ctx.fillStyle = 'rgba(255,255,255,0.20)';    // блик по верхней кромке отвала
      R.ctx.fillRect(x1 - 5, -pw, 11, pw * 2);
      R.ctx.strokeStyle = 'rgba(0,0,0,0.28)'; R.ctx.lineWidth = 1;
      for (i = 0; i < 4; i++) {                      // рёбра жёсткости поперёк отвала
        var ry = -pw * 0.70 + i * (pw * 1.40 / 3);
        R.ctx.beginPath(); R.ctx.moveTo(x1 - 4, ry); R.ctx.lineTo(xBlade - 2, ry); R.ctx.stroke();
      }
      R.ctx.restore();
      R.ctx.fillStyle = '#d7dde8';                   // хром режущей кромки
      rr(xBlade - 2.6, -pw * 0.62, 2.6, pw * 1.24, 1); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.55)';
      R.ctx.fillRect(xBlade - 2.4, -pw * 0.55, 1, pw * 1.1);
      R.ctx.strokeStyle = '#3a4150'; R.ctx.lineWidth = 2.4;   // толкающие штанги к раме
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 13, -hw * 0.46); R.ctx.lineTo(x1 - 4, -hw * 0.86); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 13, hw * 0.46); R.ctx.lineTo(x1 - 4, hw * 0.86); R.ctx.stroke();
      R.ctx.strokeStyle = '#c9ced8'; R.ctx.lineWidth = 2;     // гидроцилиндр поворота
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 7, 0); R.ctx.lineTo(xBlade - 4, 0); R.ctx.stroke();
    }

    vMirrors(xc1 - 1, hw, base);
    vHead(x1 - 12, hw, true);                        // фары вынесены на отвал
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);

    // проблесковая мигалка на крыше кабины
    var bl = Math.floor(G.t * 7) % 2 === 0;
    R.ctx.fillStyle = '#20242e';
    rr(xc0 + cw * 0.34, -hw * 0.30, 7.5, hw * 0.60, 2); R.ctx.fill();
    R.ctx.fillStyle = bl ? '#f6a623' : '#6b7280';
    rr(xc0 + cw * 0.34 + 0.9, -hw * 0.26, 5.7, hw * 0.52, 1.6); R.ctx.fill();
    if (R.fine && bl) {
      var sg = R.ctx.createRadialGradient(xc0 + cw * 0.34 + 3, 0, 1, xc0 + cw * 0.34 + 3, 0, 19);
      sg.addColorStop(0, 'rgba(255,190,80,0.34)');
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      R.ctx.fillStyle = sg;
      R.ctx.beginPath(); R.ctx.arc(xc0 + cw * 0.34 + 3, 0, 19, 0, 6.2832); R.ctx.fill();
    }
  }

  /* --- пожарная машина ------------------------------------------------------ */
  function drawFireTruck(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i;
    // три оси: передняя и две задние
    vWheel(x1 - 15, -hw + 0.5, 8.5, true);
    vWheel(x1 - 15, hw - 0.5, 8.5, true);
    vWheel(x0 + 12, -hw + 0.5, 8.5, true);
    vWheel(x0 + 12, hw - 0.5, 8.5, true);
    vWheel(x0 + 23, -hw + 0.5, 8.5, true);
    vWheel(x0 + 23, hw - 0.5, 8.5, true);

    vBody(len, hw, base, 7);

    var xCab0 = x1 - len * 0.26, xCab1 = x1 - 2;
    // лобовое стекло впереди, крыша кабины — за ним
    vGlassQuad([xCab1, -hw * 0.88, xCab1, hw * 0.88,
                xCab1 - (xCab1 - xCab0) * 0.36, hw * 0.96, xCab1 - (xCab1 - xCab0) * 0.36, -hw * 0.96]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xCab0 + 2, -hw * 0.99, 4, 2.8);
    R.ctx.fillRect(xCab0 + 2, hw * 0.99 - 2.8, 4, 2.8);
    R.ctx.fillStyle = shade(base, 0.24);             // крыша кабины
    rr(xCab0 + 2, -hw * 0.80, (xCab1 - xCab0) * 0.60, hw * 1.60, 3); R.ctx.fill();
    vSeam(xCab0 - 2, hw);

    // лестница на крыше: два прогона с поперечинами
    var xL0 = x0 + 8, xL1 = xCab0 - 8;
    R.ctx.fillStyle = '#c9ced8';
    R.ctx.fillRect(xL0, -hw * 0.58, xL1 - xL0, 2.4);
    R.ctx.fillRect(xL0, hw * 0.58 - 2.4, xL1 - xL0, 2.4);
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(70,80,96,0.85)';
      for (i = 0; i * 7 < xL1 - xL0; i++) {
        R.ctx.fillRect(xL0 + i * 7, -hw * 0.58, 1.8, hw * 1.16);
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.30)';
      R.ctx.fillRect(xL0, -hw * 0.58, xL1 - xL0, 0.7);
    }

    // боковые отсеки с хромированными ручками и защёлками
    var xB0 = x0 + 4, xB1 = xCab0 - 6, n = 4, bw = (xB1 - xB0) / n;
    for (i = 0; i < n; i++) {
      R.ctx.fillStyle = i % 2 === 0 ? shade(base, -0.06) : shade(base, -0.16);
      rr(xB0 + i * bw + 1, -hw + 1.8, bw - 2, hw * 2 - 3.6, 3); R.ctx.fill();
    }
    R.ctx.strokeStyle = 'rgba(0,0,0,0.22)'; R.ctx.lineWidth = 1;
    for (i = 1; i < n; i++) { vSeam(xB0 + i * bw, hw, -hw + 2, hw - 2); }
    if (R.fine) {
      R.ctx.fillStyle = '#cfd6e1';                   // ручки отсеков
      for (i = 0; i < n; i++) {
        rr(xB0 + i * bw + bw * 0.22, -hw + 3.2, bw * 0.5, 1.8, 0.9);
        R.ctx.fill();
        rr(xB0 + i * bw + bw * 0.22, hw - 5.0, bw * 0.5, 1.8, 0.9);
        R.ctx.fill();
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.35)';    // хром по борту и порог
      R.ctx.fillRect(x0 + 3, -hw + 1.0, len - 8, 1.1);
      R.ctx.fillRect(x0 + 3, hw - 2.1, len - 8, 1.1);
      R.ctx.fillStyle = 'rgba(0,0,0,0.16)';
      for (i = 0; i < 4; i++) { R.ctx.fillRect(x0 + 12 + i * 9, hw - 4.4, 3, 1.4); }   // грязевики
    }

    // лебёдка на носу: барабан, трос и крюк
    R.ctx.fillStyle = '#3a4150';
    rr(x1 - 9, -hw * 0.52, 6, hw * 1.04, 1.6); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = '#c9ced8';
      R.ctx.fillRect(x1 - 8, -hw * 0.44, 1.6, hw * 0.88);
      R.ctx.strokeStyle = 'rgba(40,46,58,0.9)'; R.ctx.lineWidth = 1.2;
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 3, -hw * 0.16); R.ctx.lineTo(x1 + 1, -hw * 0.16); R.ctx.stroke();
      R.ctx.beginPath();
      R.ctx.arc(x1 + 2, -hw * 0.16, 2.2, -1.1, 2.1); R.ctx.stroke();     // крюк
    }
    R.ctx.fillStyle = '#b9c1cd';                     // хромированный бампер
    rr(x1 - 3.5, -hw * 0.96, 3, hw * 1.92, 1.2); R.ctx.fill();

    // красно-синяя мигалка на крыше кабины
    var bl = Math.floor(G.t * 9) % 2 === 0;
    R.ctx.fillStyle = '#20242e';
    rr(xCab0 + 6, -hw * 0.64, 10, hw * 1.28, 2); R.ctx.fill();
    R.ctx.fillStyle = bl ? '#ef4444' : '#6b7280';
    rr(xCab0 + 6.8, -hw * 0.60, 4.2, hw * 1.20, 1.4); R.ctx.fill();
    R.ctx.fillStyle = bl ? '#6b7280' : '#3b82f6';
    rr(xCab0 + 11.4, -hw * 0.60, 4.2, hw * 1.20, 1.4); R.ctx.fill();
    if (R.fine) {
      var lg = R.ctx.createRadialGradient(xCab0 + 11, 0, 1, xCab0 + 11, 0, 20);
      lg.addColorStop(0, bl ? 'rgba(255,80,80,0.32)' : 'rgba(90,150,255,0.32)');
      lg.addColorStop(1, 'rgba(0,0,0,0)');
      R.ctx.fillStyle = lg;
      R.ctx.beginPath(); R.ctx.arc(xCab0 + 11, 0, 20, 0, 6.2832); R.ctx.fill();
      vHandles(xCab0 + 5, hw, 6);
    }

    vMirrors(xCab1 - 2, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- фургон с мороженым --------------------------------------------------- */
  function drawIceCream(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 10, -hw + 0.5, 7.5);
    vWheel(x0 + 10, hw - 0.5, 7.5);
    vWheel(x1 - 12, -hw + 0.5, 7.5);
    vWheel(x1 - 12, hw - 0.5, 7.5);

    vBody(len, hw, base, 8);

    var xWind0 = x0 + len * 0.66, xWind1 = x0 + len * 0.84;
    R.ctx.fillStyle = 'rgba(255,255,255,0.10)';      // короткий капот
    rr(xWind1, -hw + 2, x1 - xWind1 - 2, hw * 2 - 4, 3); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(20,24,32,0.5)';
      rr(x1 - 4.5, -hw * 0.52, 2.4, hw * 1.04, 1); R.ctx.fill();
    }
    vGlassQuad([xWind1, -hw * 0.88, xWind1, hw * 0.88, xWind0, hw * 0.97, xWind0, -hw * 0.97]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';         // боковые окна кабины
    R.ctx.fillRect(xWind0 + 1.5, -hw * 0.99, 4.5, 2.8);
    R.ctx.fillRect(xWind0 + 1.5, hw * 0.99 - 2.8, 4.5, 2.8);

    // крыша фургона и люк вытяжки
    var xR0 = x0 + len * 0.10, xR1 = xWind0 - 2;
    R.ctx.fillStyle = shade(base, 0.16);
    rr(xR0, -hw * 0.86, xR1 - xR0, hw * 1.72, 5); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.15)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.11)';
      for (i = 1; i <= 3; i++) { R.ctx.fillRect(xR0 + (xR1 - xR0) * (i / 4), -hw * 0.84, 1.6, hw * 1.68); }
      R.ctx.fillStyle = 'rgba(255,255,255,0.40)';
      rr(xR0 + (xR1 - xR0) * 0.06, -hw * 0.30, (xR1 - xR0) * 0.14, hw * 0.60, 2); R.ctx.fill();
    }

    // окно-раздача с поднятым ставнем на верхнем борту
    var xS0 = x0 + len * 0.22, xS1 = x0 + len * 0.58;
    vGlassQuad([xS1, -hw * 0.52, xS1, -hw * 0.99, xS0, -hw * 0.99, xS0, -hw * 0.52]);
    R.ctx.fillStyle = 'rgba(255,255,255,0.42)';      // ставень, поднятый на крышу
    rr(xS0 + 1, -hw * 0.50, xS1 - xS0 - 2, hw * 0.28, 2); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.22)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = '#c9ced8';                   // хром-направляющие ставня
      R.ctx.fillRect(xS0 + 1, -hw * 0.99, 2, hw * 0.48);
      R.ctx.fillRect(xS1 - 3, -hw * 0.99, 2, hw * 0.48);
      R.ctx.fillStyle = 'rgba(255,255,255,0.55)';    // прилавок-полка
      R.ctx.fillRect(xS0 + 2, -hw * 1.02, xS1 - xS0 - 4, 1.6);
    }

    // полосатый красно-белый навес над раздачей
    var xA0 = x0 + len * 0.18, xA1 = x0 + len * 0.62, aw = (xA1 - xA0) / 5;
    for (i = 0; i < 5; i++) {
      R.ctx.fillStyle = i % 2 === 0 ? '#f7f2e8' : '#d94f4f';
      R.ctx.fillRect(xA0 + i * aw, -hw - 7.5, aw, 7.5);
    }
    R.ctx.strokeStyle = 'rgba(18,22,32,0.35)'; R.ctx.lineWidth = 1;
    R.ctx.strokeRect(xA0, -hw - 7.5, xA1 - xA0, 7.5);
    if (R.fine) {
      R.ctx.strokeStyle = '#c9ced8'; R.ctx.lineWidth = 1.6;   // стойки навеса
      R.ctx.beginPath(); R.ctx.moveTo(xA0 + 1, -hw - 7.5); R.ctx.lineTo(xA0 + 1, -hw * 0.9); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(xA1 - 1, -hw - 7.5); R.ctx.lineTo(xA1 - 1, -hw * 0.9); R.ctx.stroke();
    }

    // эмблема-рожок мороженого на борту
    var ex = x0 + len * 0.13, ey = -hw * 0.20;
    R.ctx.fillStyle = '#c98a4b';
    R.ctx.beginPath();
    R.ctx.moveTo(ex - 4, ey - 4); R.ctx.lineTo(ex + 4, ey - 4); R.ctx.lineTo(ex, ey + 5.4);
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#f7d9e2';
    R.ctx.beginPath(); R.ctx.arc(ex, ey - 5.6, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f2f5fa';
    R.ctx.beginPath(); R.ctx.arc(ex - 2.6, ey - 7.6, 2.6, 0, 6.2832); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.5)';
      R.ctx.fillRect(ex - 3.4, ey - 3.4, 1.2, 4.4);
      vHandles(x0 + len * 0.30, hw, 6);
    }

    vMirrors(xWind1 - 1, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- лимузин -------------------------------------------------------------- */
  function drawLimo(len, base) {
    var hw = CAR_W / 2 + 1, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 11, -hw + 0.5, 6.4);                 // низкий кузов — колёса небольшие
    vWheel(x0 + 11, hw - 0.5, 6.4);
    vWheel(x0 + len * 0.50, -hw + 0.5, 6.4);
    vWheel(x0 + len * 0.50, hw - 0.5, 6.4);
    vWheel(x1 - 11, -hw + 0.5, 6.4);
    vWheel(x1 - 11, hw - 0.5, 6.4);

    vBody(len, hw, base, Math.min(10, len * 0.10));

    var xHood = x0 + len * 0.76, xTrunk = x0 + len * 0.16;
    R.ctx.fillStyle = 'rgba(255,255,255,0.09)';      // длинный капот
    rr(xHood, -hw + 2, x1 - xHood - 2.5, hw * 2 - 4, 3); R.ctx.fill();
    if (R.fine) {
      R.ctx.strokeStyle = 'rgba(0,0,0,0.18)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.moveTo(xHood + 2, -hw * 0.40); R.ctx.lineTo(x1 - 5, -hw * 0.28); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(xHood + 2, hw * 0.40); R.ctx.lineTo(x1 - 5, hw * 0.28); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(20,24,32,0.55)';       // решётка радиатора
      rr(x1 - 5, -hw * 0.58, 2.6, hw * 1.16, 1); R.ctx.fill();
    }
    vSeam(xTrunk, hw);
    vSeam(x0 + len * 0.22, hw);

    // длинная кабина: крыша между задним и лобовым стеклом
    R.ctx.fillStyle = shade(base, 0.20);
    rr(x0 + len * 0.24, -hw * 0.84, len * 0.44, hw * 1.68, 5); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.16)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    vGlassQuad([x0 + len * 0.78, -hw * 0.76, x0 + len * 0.78, hw * 0.76,
                x0 + len * 0.68, hw * 0.93, x0 + len * 0.68, -hw * 0.93]);
    vGlassQuad([x0 + len * 0.28, -hw * 0.90, x0 + len * 0.28, hw * 0.90,
                x0 + len * 0.18, hw * 0.96, x0 + len * 0.18, -hw * 0.96]);
    R.ctx.fillStyle = 'rgba(20,28,40,0.94)';         // тонировка: почти чёрное стекло
    for (i = 0; i < 3; i++) {
      var wx = x0 + len * (0.30 + i * 0.155), ww = len * 0.115;
      R.ctx.fillRect(wx, -hw * 0.995, ww, 3.6);
      R.ctx.fillRect(wx, hw * 0.995 - 3.6, ww, 3.6);
    }
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.32)';    // хром окантовки стёкол
      for (i = 0; i < 3; i++) {
        var wx2 = x0 + len * (0.30 + i * 0.155), ww2 = len * 0.115;
        R.ctx.fillRect(wx2, -hw * 0.995 + 3.7, ww2, 0.6);
        R.ctx.fillRect(wx2, hw * 0.995 - 4.3, ww2, 0.6);
      }
      R.ctx.fillStyle = 'rgba(24,32,46,0.85)';       // люк на крыше
      rr(x0 + len * 0.46, -hw * 0.34, len * 0.16, hw * 0.68, 2); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
      rr(x0 + len * 0.47, -hw * 0.30, len * 0.14, hw * 0.22, 1.5); R.ctx.fill();
      vHandles(x0 + len * 0.34, hw, 7);
      vHandles(x0 + len * 0.60, hw, 7);
    }

    // хромированная линия по борту, пороги и колпаки колёс
    R.ctx.fillStyle = '#d7dde8';
    R.ctx.fillRect(x0 + 3, -hw + 1.3, len - 6, 1.2);
    R.ctx.fillRect(x0 + 3, hw - 2.5, len - 6, 1.2);
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.20)';
      rr(x0 + 6, -hw + 0.4, len - 12, 1.4, 0.7); R.ctx.fill();
      rr(x0 + 6, hw - 1.8, len - 12, 1.4, 0.7); R.ctx.fill();
    }
    // флажок на носу: древко и полотнище, колышущееся на ветру
    var wav = Math.sin(G.t * 4) * 1.3;
    R.ctx.fillStyle = '#cfd6e1';
    R.ctx.fillRect(x1 - 9, -hw - 5.2, 1.7, 5.2);
    R.ctx.fillStyle = '#2f6fb0';
    R.ctx.beginPath();
    R.ctx.moveTo(x1 - 9, -hw - 5.2);
    R.ctx.lineTo(x1 - 15.5, -hw - 4.4 + wav);
    R.ctx.lineTo(x1 - 9, -hw - 1.6);
    R.ctx.closePath(); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.45)';
      R.ctx.fillRect(x1 - 9.6, -hw - 5.0, 0.7, 3.4);
    }

    vMirrors(x0 + len * 0.74, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
    if (R.fine) { vPlate(x1 - 1.6, 0); }
  }

  /* --- катафалк ------------------------------------------------------------- */
  function drawHearse(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 12, -hw + 0.5, 7.5, true);
    vWheel(x0 + 12, hw - 0.5, 7.5, true);
    vWheel(x1 - 12, -hw + 0.5, 7.5, true);
    vWheel(x1 - 12, hw - 0.5, 7.5, true);

    vBody(len, hw, base, 8);

    var xCab0 = x0 + len * 0.60, xCab1 = x1 - 2.5;
    // кабина: лобовое стекло впереди, крыша — за ним
    vGlassQuad([xCab1, -hw * 0.86, xCab1, hw * 0.86,
                xCab1 - (xCab1 - xCab0) * 0.38, hw * 0.95, xCab1 - (xCab1 - xCab0) * 0.38, -hw * 0.95]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xCab0 + 1.5, -hw * 0.99, 4, 2.8);
    R.ctx.fillRect(xCab0 + 1.5, hw * 0.99 - 2.8, 4, 2.8);
    R.ctx.fillStyle = shade(base, 0.20);             // крыша кабины
    rr(xCab0 + 2, -hw * 0.82, (xCab1 - xCab0) * 0.58, hw * 1.64, 4); R.ctx.fill();
    vSeam(xCab0 - 2, hw);

    // высокий стеклянный отсек сзади: рама, рейлинги, панели
    var xr0 = x0 + 4, xr1 = xCab0 - 6;
    R.ctx.fillStyle = shade(base, 0.14);
    rr(xr0, -hw * 0.92, xr1 - xr0, hw * 1.84, 4); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.22)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    // большие стёкла отсека по обоим бортам (с бликом неба)
    vGlassQuad([xr1 - 4, -hw * 0.86, xr1 - 4, -hw * 0.34, xr0 + 6, -hw * 0.34, xr0 + 6, -hw * 0.86]);
    vGlassQuad([xr1 - 4, hw * 0.34, xr1 - 4, hw * 0.86, xr0 + 6, hw * 0.86, xr0 + 6, hw * 0.34]);
    // задняя дверь отсека со стеклом
    vGlassQuad([x0 + 6, -hw * 0.72, x0 + 6, hw * 0.72, x0 + 4, hw * 0.80, x0 + 4, -hw * 0.80]);
    vSeam(x0 + 9, hw);
    if (R.fine) {
      R.ctx.strokeStyle = 'rgba(0,0,0,0.20)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.moveTo(xr0 + 3, -hw * 0.30); R.ctx.lineTo(xr1 - 2, -hw * 0.30); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(xr0 + 3, hw * 0.30); R.ctx.lineTo(xr1 - 2, hw * 0.30); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(255,255,255,0.10)';    // драпировка: мягкие складки
      for (i = 0; i < 5; i++) { R.ctx.fillRect(xr0 + 8 + i * ((xr1 - xr0 - 14) / 4), -hw * 0.26, 1.2, hw * 0.52); }
    }
    // хромированные рейлинги на крыше отсека
    R.ctx.fillStyle = '#cfd6e1';
    R.ctx.fillRect(xr0 + 3, -hw * 0.64, xr1 - xr0 - 8, 1.6);
    R.ctx.fillRect(xr0 + 3, hw * 0.64 - 1.6, xr1 - xr0 - 8, 1.6);
    // хромированные поручни-ручки по бортам (без религиозной символики)
    R.ctx.fillStyle = '#c2cad6';
    rr(xr0 + 10, -hw - 1.9, (xr1 - xr0) * 0.42, 1.9, 0.9); R.ctx.fill();
    rr(xr0 + 10, hw, (xr1 - xr0) * 0.42, 1.9, 0.9); R.ctx.fill();
    rr(xr0 + (xr1 - xr0) * 0.60, -hw - 1.9, (xr1 - xr0) * 0.30, 1.9, 0.9); R.ctx.fill();
    rr(xr0 + (xr1 - xr0) * 0.60, hw, (xr1 - xr0) * 0.30, 1.9, 0.9); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.28)';          // кронштейны поручней
      R.ctx.fillRect(xr0 + 10, -hw - 1.2, 1.2, 1.2);
      R.ctx.fillRect(xr0 + (xr1 - xr0) * 0.60, -hw - 1.2, 1.2, 1.2);
      R.ctx.fillStyle = 'rgba(255,255,255,0.4)';     // хром-полоса по борту
      R.ctx.fillRect(x0 + 5, -hw + 1.1, len - 12, 1.1);
      R.ctx.fillRect(x0 + 5, hw - 2.2, len - 12, 1.1);
    }

    vMirrors(xCab1 - 3, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- мусоровоз ------------------------------------------------------------ */

  /* --- транспорт отдельных карт --------------------------------------------
     Стройка: бетономешалка, каток и вышка-подъёмник.
     Киберпанк: парящая машина с неоновой подсветкой. */
  function drawMixer(len, base) {
    var hw = CAR_W / 2 + 3, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 13, -hw + 1, 10, true);
    vWheel(x0 + 13, hw - 1, 10, true);
    vWheel(x1 - 15, -hw + 1, 9, true);
    vWheel(x1 - 15, hw - 1, 9, true);
    // рама и бак с водой
    R.ctx.fillStyle = '#3a4450';
    rr(x0, -hw * 0.72, len, hw * 1.44, 3); R.ctx.fill();
    vBody(Math.max(20, len * 0.34), hw, base, 5);
    R.ctx.save();
    R.ctx.translate(x1 - len * 0.32, 0);
    R.ctx.fillStyle = '#2f3a46';
    R.ctx.fillRect(-len * 0.15 - 2, -hw * 0.9, 4, hw * 1.8);
    R.ctx.restore();
    // вращающийся барабан: наклонные полосы бегут по кругу
    var cx = -len * 0.12, rx = len * 0.30, ry = hw * 0.78;
    R.ctx.fillStyle = '#e8e2d4';
    R.ctx.beginPath(); R.ctx.ellipse(cx, 0, rx, ry, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(30,36,46,0.45)'; R.ctx.lineWidth = 1.4; R.ctx.stroke();
    R.ctx.save();
    R.ctx.beginPath(); R.ctx.ellipse(cx, 0, rx, ry, 0, 0, 6.2832); R.ctx.clip();
    R.ctx.fillStyle = base;
    for (i = 0; i < 5; i++) {
      var off = ((G.t * 26 + i * (rx * 0.55)) % (rx * 2.6)) - rx * 1.3;
      R.ctx.save();
      R.ctx.translate(cx + off, 0);
      R.ctx.rotate(0.35);
      R.ctx.fillRect(-2.6, -ry, 5.2, ry * 2);
      R.ctx.restore();
    }
    R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
    R.ctx.beginPath(); R.ctx.ellipse(cx - rx * 0.3, -ry * 0.4, rx * 0.5, ry * 0.25, -0.3, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
    R.ctx.fillStyle = '#c8ccd2';
    R.ctx.beginPath(); R.ctx.ellipse(cx - rx, 0, 3.4, ry * 0.9, 0, 0, 6.2832); R.ctx.fill();
    // кабина
    var xc0 = x1 - len * 0.26;
    vGlassQuad([x1 - 3, -hw * 0.86, x1 - 3, hw * 0.86, xc0 + 2, hw * 0.94, xc0 + 2, -hw * 0.94]);
    vSeam(xc0, hw);
    vHead(x1 - 1, hw, false);
  }

  function drawRoller(len, base) {
    var hw = CAR_W / 2 + 1, x0 = -len / 2, x1 = len / 2;
    // задние колёса и большой стальной валец впереди
    vWheel(x0 + 14, -hw + 2, 11, true);
    vWheel(x0 + 14, hw - 2, 11, true);
    R.ctx.fillStyle = '#8b929c';
    rr(x1 - 15, -hw - 1, 15, hw * 2 + 2, 6); R.ctx.fill();
    R.ctx.fillStyle = '#a8b0bb';
    rr(x1 - 13, -hw + 1, 11, hw * 2 - 2, 5); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.28)';
    rr(x1 - 12, -hw + 2.5, 9, 3, 1.5); R.ctx.fill();
    // рама и кабина
    R.ctx.fillStyle = '#3f4854';
    rr(x0, -hw * 0.66, len * 0.86, hw * 1.32, 3); R.ctx.fill();
    vBody(len * 0.5, hw * 0.92, base, 5);
    vGlassQuad([x1 - len * 0.34, -hw * 0.84, x1 - len * 0.34, hw * 0.84,
                x0 + len * 0.3, hw * 0.9, x0 + len * 0.3, -hw * 0.9]);
    // проблесковый маячок
    var blink = Math.sin(G.t * 7) > 0;
    R.ctx.fillStyle = blink ? '#ffd75e' : '#c9a13a';
    rr(-len * 0.02, -3, 5, 6, 2); R.ctx.fill();
  }

  function drawLift(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2;
    vWheel(x0 + 12, -hw + 1, 9, true);
    vWheel(x0 + 12, hw - 1, 9, true);
    vWheel(x1 - 14, -hw + 1, 9, true);
    vWheel(x1 - 14, hw - 1, 9, true);
    vBody(len * 0.8, hw, base, 5);
    vGlassQuad([x1 - 3, -hw * 0.84, x1 - 3, hw * 0.84, x1 - len * 0.3, hw * 0.9, x1 - len * 0.3, -hw * 0.9]);
    // поднятая стрела с корзиной: плавно покачивается
    var swing = Math.sin(G.t * 1.6) * 2.2;
    R.ctx.save();
    R.ctx.translate(x0 + len * 0.34, 0);
    R.ctx.rotate(-0.5 + swing * 0.012);
    R.ctx.fillStyle = '#e8b23c';
    rr(-4, -3, len * 0.62, 6, 3); R.ctx.fill();
    R.ctx.fillStyle = '#f0c95e';
    rr(-4, -3, len * 0.62, 2.4, 1.2); R.ctx.fill();
    R.ctx.translate(len * 0.58, 0);
    R.ctx.fillStyle = '#d9a52f';
    rr(-9, -9, 18, 18, 3); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(40,48,60,0.6)';
    rr(-7, -7, 14, 14, 2); R.ctx.fill();
    R.ctx.restore();
  }

  function drawHover(len, base) {
    var hw = CAR_W / 2 - 1, x0 = -len / 2, x1 = len / 2;
    // светящееся поле под корпусом вместо колёс
    var glow = R.ctx.createLinearGradient(0, hw, 0, hw + 12);
    glow.addColorStop(0, 'rgba(120,240,255,0.55)');
    glow.addColorStop(1, 'rgba(120,240,255,0)');
    R.ctx.fillStyle = glow;
    rr(x0 + 3, hw - 1, len - 6, 12, 6); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,80,200,0.35)';
    rr(x0 + 6, -hw - 4, len - 12, 5, 2.5); R.ctx.fill();
    // обтекаемый корпус
    R.ctx.beginPath();
    R.ctx.moveTo(x0 + 2, -hw * 0.5);
    R.ctx.lineTo(x0 + len * 0.3, -hw);
    R.ctx.lineTo(x1 - len * 0.22, -hw);
    R.ctx.lineTo(x1, 0);
    R.ctx.lineTo(x1 - len * 0.22, hw);
    R.ctx.lineTo(x0 + len * 0.3, hw);
    R.ctx.lineTo(x0 + 2, hw * 0.5);
    R.ctx.closePath();
    var g = R.ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.4));
    g.addColorStop(0.5, base);
    g.addColorStop(1, shade(base, -0.5));
    R.ctx.fillStyle = g; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(12,16,26,0.55)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    // фонарь-полоса и кабина
    R.ctx.fillStyle = 'rgba(20,26,40,0.9)';
    rr(x1 - len * 0.42, -hw * 0.72, len * 0.3, hw * 1.44, 4); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(150,240,255,0.75)';
    rr(x1 - len * 0.4, -hw * 0.6, len * 0.26, 2.2, 1); R.ctx.fill();
    R.ctx.fillStyle = '#ff4fd0';
    rr(x0 + 4, -hw * 0.8, 3.4, hw * 1.6, 1.6); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(200,255,255,0.85)';
    rr(x1 - 3.5, -hw * 0.5, 3, hw, 1.4); R.ctx.fill();
  }

  function drawGarbage(len, base) {
    var hw = CAR_W / 2 + 2, x0 = -len / 2, x1 = len / 2, i;
    vWheel(x0 + 12, -hw + 0.5, 9, true);
    vWheel(x0 + 12, hw - 0.5, 9, true);
    vWheel(x0 + 24, -hw + 0.5, 9, true);
    vWheel(x0 + 24, hw - 0.5, 9, true);
    vWheel(x1 - 14, -hw + 0.5, 8.5, true);
    vWheel(x1 - 14, hw - 0.5, 8.5, true);

    vBody(len, hw, base, 7);

    var xCab0 = x1 - len * 0.28, xCab1 = x1 - 2;
    // тяжёлая кабина: большое лобовое впереди, крыша за ним
    vGlassQuad([xCab1, -hw * 0.88, xCab1, hw * 0.88,
                xCab1 - (xCab1 - xCab0) * 0.40, hw * 0.97, xCab1 - (xCab1 - xCab0) * 0.40, -hw * 0.97]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xCab0 + 2, -hw * 0.99, 4.5, 2.8);
    R.ctx.fillRect(xCab0 + 2, hw * 0.99 - 2.8, 4.5, 2.8);
    R.ctx.fillStyle = shade(base, 0.24);
    rr(xCab0 + 2, -hw * 0.80, (xCab1 - xCab0) * 0.56, hw * 1.60, 3); R.ctx.fill();
    vSeam(xCab0 - 2, hw);

    // бункер: рёбра, задняя крышка с петлями, потёртости
    var xB0 = x0 + 3, xB1 = xCab0 - 6;
    R.ctx.fillStyle = shade(base, -0.14);
    rr(xB0, -hw * 0.96, xB1 - xB0, hw * 1.92, 5); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(0,0,0,0.24)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.14)';    // верхняя грань бункера
      R.ctx.fillRect(xB0 + 2, -hw * 0.94, xB1 - xB0 - 4, 1.6);
      R.ctx.fillStyle = 'rgba(0,0,0,0.20)';          // рёбра жёсткости
      for (i = 1; i <= 5; i++) { R.ctx.fillRect(xB0 + (xB1 - xB0) * (i / 6) - 0.9, -hw * 0.94, 1.9, hw * 1.88); }
      R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (i = 1; i <= 5; i++) { R.ctx.fillRect(xB0 + (xB1 - xB0) * (i / 6) + 1.0, -hw * 0.94, 0.8, hw * 1.88); }
      R.ctx.fillStyle = 'rgba(0,0,0,0.13)';          // потёртости и вмятины
      R.ctx.fillRect(xB0 + 7, -hw * 0.70, 6, 2.2);
      R.ctx.fillRect(xB0 + (xB1 - xB0) * 0.55, hw * 0.52, 8, 2.0);
      R.ctx.fillRect(xB0 + (xB1 - xB0) * 0.30, -hw * 0.34, 4, 1.8);
    }
    // задняя крышка с петлями и запорами
    vSeam(xB0 + 6, hw);
    R.ctx.fillStyle = shade(base, -0.30);
    rr(xB0, -hw * 0.90, 6, hw * 1.80, 2.5); R.ctx.fill();
    R.ctx.fillStyle = '#c2cad6';
    R.ctx.fillRect(xB0 + 2.2, -hw * 0.72, 1.6, 4.2);
    R.ctx.fillRect(xB0 + 2.2, hw * 0.72 - 4.2, 1.6, 4.2);

    // гидроцилиндр по верхнему борту
    R.ctx.save();
    R.ctx.strokeStyle = '#3a4150'; R.ctx.lineWidth = 3.4;
    R.ctx.beginPath(); R.ctx.moveTo(xB0 + 12, -hw * 0.72); R.ctx.lineTo(xB1 - 10, -hw * 0.60); R.ctx.stroke();
    R.ctx.strokeStyle = '#cfd6e1'; R.ctx.lineWidth = 1.8;
    R.ctx.beginPath(); R.ctx.moveTo(xB0 + (xB1 - xB0) * 0.55, -hw * 0.665); R.ctx.lineTo(xB1 - 10, -hw * 0.60); R.ctx.stroke();
    R.ctx.restore();
    if (R.fine) { vHandles(xCab0 + 6, hw, 6); }

    vMirrors(xCab1 - 3, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);

    // проблесковая мигалка над кабиной
    var bl = Math.floor(G.t * 7) % 2 === 0;
    R.ctx.fillStyle = '#20242e';
    rr(xCab0 + 10, -hw * 0.34, 8, hw * 0.68, 2); R.ctx.fill();
    R.ctx.fillStyle = bl ? '#f6a623' : '#6b7280';
    rr(xCab0 + 10.9, -hw * 0.30, 6.2, hw * 0.60, 1.6); R.ctx.fill();
    if (R.fine && bl) {
      var gg = R.ctx.createRadialGradient(xCab0 + 14, 0, 1, xCab0 + 14, 0, 19);
      gg.addColorStop(0, 'rgba(255,190,80,0.32)');
      gg.addColorStop(1, 'rgba(0,0,0,0)');
      R.ctx.fillStyle = gg;
      R.ctx.beginPath(); R.ctx.arc(xCab0 + 14, 0, 19, 0, 6.2832); R.ctx.fill();
    }
  }

  /* --- эвакуатор ------------------------------------------------------------ */
  function drawTow(len, base) {
    var hw = CAR_W / 2 + 1.5, x0 = -len / 2, x1 = len / 2, i;
    var xCab0 = x1 - len * 0.34, xCab1 = x1 - 2;
    vWheel(x0 + 13, -hw + 0.5, 8.5, true);
    vWheel(x0 + 13, hw - 0.5, 8.5, true);
    vWheel(x1 - 13, -hw + 0.5, 8, true);
    vWheel(x1 - 13, hw - 0.5, 8, true);

    vBody(len, hw, base, 7);

    // наклонная платформа сзади: сужается к корме, стальная с рёбрами
    var xBed0 = x0 + 3, xBed1 = xCab0 - 5;
    R.ctx.beginPath();
    R.ctx.moveTo(xBed1, -hw * 0.94);
    R.ctx.lineTo(xBed0 + 4, -hw * 0.78);
    R.ctx.lineTo(xBed0 + 4, hw * 0.78);
    R.ctx.lineTo(xBed1, hw * 0.94);
    R.ctx.closePath();
    var pg = R.ctx.createLinearGradient(0, -hw, 0, hw);
    pg.addColorStop(0, shade(base, 0.30));
    pg.addColorStop(0.5, shade(base, -0.10));
    pg.addColorStop(1, shade(base, -0.42));
    R.ctx.fillStyle = pg; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.18)';
      for (i = 1; i <= 4; i++) {
        var bx = xBed0 + 4 + (xBed1 - xBed0 - 4) * (i / 5);
        R.ctx.fillRect(bx, -hw * 0.86, 1.6, hw * 1.72);
      }
      R.ctx.fillStyle = '#c9ced8';                   // хром-борта платформы
      R.ctx.fillRect(xBed0 + 4, -hw * 0.80, xBed1 - xBed0 - 4, 1.7);
      R.ctx.fillRect(xBed0 + 4, hw * 0.80 - 1.7, xBed1 - xBed0 - 4, 1.7);
      R.ctx.fillStyle = '#3a4150';                   // колёсные упоры
      rr(xBed0 + 12, -hw * 0.70, 3.4, 5, 1); R.ctx.fill();
      rr(xBed0 + 12, hw * 0.70 - 5, 3.4, 5, 1); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,220,120,0.8)';     // боковые фонари платформы
      for (i = 0; i < 3; i++) {
        R.ctx.fillRect(xBed0 + 8 + i * 11, -hw - 1.4, 3.4, 1.8);
        R.ctx.fillRect(xBed0 + 8 + i * 11, hw - 0.4, 3.4, 1.8);
      }
    }
    // лебёдка у кабины: барабан и трос с крюком
    R.ctx.fillStyle = '#3a4150';
    rr(xBed1 - 8, -hw * 0.30, 5.5, hw * 0.60, 1.6); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(40,46,58,0.9)'; R.ctx.lineWidth = 1.2;
    R.ctx.beginPath(); R.ctx.moveTo(xBed1 - 7, 0); R.ctx.lineTo(xBed0 + 10, 0); R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = '#c9ced8';
      R.ctx.fillRect(xBed1 - 7.5, -hw * 0.24, 1.4, hw * 0.48);
      R.ctx.strokeStyle = '#c9ced8'; R.ctx.lineWidth = 1.6;    // крюк на конце троса
      R.ctx.beginPath(); R.ctx.arc(xBed0 + 11, 0, 2.6, -1.2, 2.2); R.ctx.stroke();
    }
    // стрела-кран над платформой с хром-секцией
    R.ctx.fillStyle = shade(base, -0.34);
    R.ctx.beginPath();
    R.ctx.moveTo(xBed1 - 3, -hw * 0.24);
    R.ctx.lineTo(xBed0 + 8, -hw * 0.06);
    R.ctx.lineTo(xBed0 + 8, hw * 0.20);
    R.ctx.lineTo(xBed1 - 3, hw * 0.12);
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.45)'; R.ctx.lineWidth = 1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.fillStyle = '#cfd6e1';                   // выдвижная секция стрелы
      R.ctx.fillRect(xBed0 + 9, -hw * 0.04, (xBed1 - xBed0) * 0.28, hw * 0.20);
      R.ctx.fillStyle = 'rgba(255,255,255,0.25)';
      R.ctx.fillRect(xBed1 - 4, -hw * 0.22, (xBed1 - xBed0) * 0.5, 1.2);
      R.ctx.strokeStyle = 'rgba(40,46,58,0.8)'; R.ctx.lineWidth = 1.1;   // трос стрелы
      R.ctx.beginPath(); R.ctx.moveTo(xBed0 + 12, hw * 0.08); R.ctx.lineTo(xBed0 + 12, hw * 0.42); R.ctx.stroke();
    }

    // кабина: лобовое впереди, крыша — за ним
    vGlassQuad([xCab1, -hw * 0.86, xCab1, hw * 0.86,
                xCab1 - (xCab1 - xCab0) * 0.36, hw * 0.95, xCab1 - (xCab1 - xCab0) * 0.36, -hw * 0.95]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(xCab0 + 2, -hw * 0.99, 4, 2.8);
    R.ctx.fillRect(xCab0 + 2, hw * 0.99 - 2.8, 4, 2.8);
    R.ctx.fillStyle = shade(base, 0.24);
    rr(xCab0 + 2, -hw * 0.80, (xCab1 - xCab0) * 0.58, hw * 1.60, 3); R.ctx.fill();
    vSeam(xCab0 - 2, hw);
    if (R.fine) { vHandles(xCab0 + 5, hw, 6); }

    // мигалка на крыше кабины
    var bl = Math.floor(G.t * 7) % 2 === 0;
    R.ctx.fillStyle = '#20242e';
    rr(xCab0 + 10, -hw * 0.30, 8, hw * 0.60, 2); R.ctx.fill();
    R.ctx.fillStyle = bl ? '#f6a623' : '#6b7280';
    rr(xCab0 + 10.9, -hw * 0.26, 6.2, hw * 0.52, 1.6); R.ctx.fill();

    vMirrors(xCab1 - 3, hw, base);
    vHead(x1 - 2.5, hw, true);
    vTail(x0 + 0.6, hw);
    vPlate(x0 + 0.6, 0);
  }

  /* --- болид ---------------------------------------------------------------- */
  function drawF1(len, base) {
    var hw = TS * 0.17, x0 = -len / 2, x1 = len / 2;
    var wy = TS * 0.27, ww = TS * 0.38;               // открытые колёса вынесены за кузов
    // колёса снаружи кузова: передняя и задняя оси
    vWheel(x1 - 10, -wy, 8.5, true);
    vWheel(x1 - 10, wy, 8.5, true);
    vWheel(x0 + 10, -wy, 9, true);
    vWheel(x0 + 10, wy, 9, true);
    if (R.fine) {                                     // диски и крылышки над колёсами
      R.ctx.fillStyle = 'rgba(24,28,36,0.55)';
      rr(x1 - 13, -wy - 6, 7, 4, 1.5); R.ctx.fill();
      rr(x1 - 13, wy + 2, 7, 4, 1.5); R.ctx.fill();
    }

    // узкий монокок: острый нос
    var g = R.ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.42));
    g.addColorStop(0.35, base);
    g.addColorStop(1, shade(base, -0.46));
    R.ctx.beginPath();
    R.ctx.moveTo(x1 - 6, -hw * 0.55);
    R.ctx.quadraticCurveTo(x1 + 4, 0, x1 - 6, hw * 0.55);
    R.ctx.lineTo(x0 + 4, hw * 1.05);
    R.ctx.lineTo(x0 + 2, -hw * 1.05);
    R.ctx.closePath();
    R.ctx.fillStyle = g; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();

    // гоночные полосы по корпусу
    R.ctx.fillStyle = 'rgba(255,255,255,0.72)';
    R.ctx.fillRect(x0 + 6, -hw * 0.46, len - 16, 1.8);
    R.ctx.fillRect(x0 + 6, hw * 0.46 - 1.8, len - 16, 1.8);
    // понтоны по бокам кокпита
    R.ctx.fillStyle = shade(base, -0.16);
    rr(x0 + len * 0.18, -hw * 1.55, len * 0.30, hw * 0.55, 2); R.ctx.fill();
    rr(x0 + len * 0.18, hw * 1.00, len * 0.30, hw * 0.55, 2); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(0,0,0,0.30)';           // воздухозаборники понтонов
      rr(x0 + len * 0.20, -hw * 1.48, len * 0.09, hw * 0.42, 1.4); R.ctx.fill();
      rr(x0 + len * 0.20, hw * 1.06, len * 0.09, hw * 0.42, 1.4); R.ctx.fill();
    }

    // кокпит с пилотом в шлеме
    R.ctx.fillStyle = 'rgba(18,24,34,0.9)';
    rr(x0 + len * 0.42, -hw * 0.86, len * 0.17, hw * 1.72, 3); R.ctx.fill();
    R.ctx.fillStyle = shade(base, -0.30);
    R.ctx.beginPath(); R.ctx.ellipse(x0 + len * 0.50, 0, hw * 0.75, hw * 0.92, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f2f5fa';                      // шлем
    R.ctx.beginPath(); R.ctx.arc(x0 + len * 0.52, 0, hw * 0.62, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(18,24,38,0.9)';           // визор
    R.ctx.beginPath();
    R.ctx.arc(x0 + len * 0.52 + hw * 0.2, 0, hw * 0.5, -1.2, 1.2);
    R.ctx.lineTo(x0 + len * 0.52 + hw * 0.2, 0);
    R.ctx.closePath(); R.ctx.fill();
    if (R.fine) {
      R.ctx.strokeStyle = '#c9ced8'; R.ctx.lineWidth = 1.8;      // дуга безопасности (halo)
      R.ctx.beginPath(); R.ctx.arc(x0 + len * 0.46, 0, hw * 0.95, -Math.PI * 0.5, Math.PI * 0.5); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      R.ctx.fillRect(x0 + len * 0.50, -hw * 0.55, hw * 0.5, 1.1);
    }

    // переднее антикрыло с концевыми пластинами
    R.ctx.fillStyle = '#232833';
    rr(x1 - 3, -ww, 5, ww * 2, 1.6); R.ctx.fill();
    R.ctx.fillStyle = shade(base, -0.20);
    R.ctx.fillRect(x1 - 3, -ww, 5, 3);
    R.ctx.fillRect(x1 - 3, ww - 3, 5, 3);
    // заднее антикрыло: две плоскости и стойки
    R.ctx.fillStyle = '#232833';
    rr(x0 - 3, -ww * 0.94, 6, ww * 1.88, 1.8); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.18)';
    R.ctx.fillRect(x0 - 3, -ww * 0.90, 6, 1.6);
    R.ctx.fillStyle = shade(base, -0.28);
    R.ctx.fillRect(x0 + 4, -ww * 0.62, 3, 4);
    R.ctx.fillRect(x0 + 4, ww * 0.62 - 4, 3, 4);
    if (R.fine) {
      R.ctx.fillStyle = '#c9ced8';                    // концевые пластины
      R.ctx.fillRect(x0 - 4, -ww * 1.02, 2, ww * 0.30);
      R.ctx.fillRect(x0 - 4, ww * 0.72, 2, ww * 0.30);
      R.ctx.fillRect(x1 - 4, -ww * 1.0, 1.8, ww * 0.24);
      R.ctx.fillRect(x1 - 4, ww * 0.76, 1.8, ww * 0.24);
      R.ctx.fillStyle = '#2b3240';                    // выхлоп по центру кормы
      rr(x0 + 0.5, -2.6, 3.4, 5.2, 1.2); R.ctx.fill();
    }

    // фары и стопы болида
    R.ctx.fillStyle = '#dde5f0';
    rr(x1 - 8, -hw * 0.92, 3, 3, 1.2); R.ctx.fill();
    rr(x1 - 8, hw * 0.92 - 3, 3, 3, 1.2); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,250,215,0.95)';
    rr(x1 - 7.4, -hw * 0.80, 1.8, 1.8, 0.8); R.ctx.fill();
    rr(x1 - 7.4, hw * 0.80 - 1.8, 1.8, 1.8, 0.8); R.ctx.fill();
    R.ctx.fillStyle = '#e8352a';
    rr(x0 + 2, -hw * 0.92, 3, 3.4, 1.2); R.ctx.fill();
    rr(x0 + 2, hw * 0.92 - 3.4, 3, 3.4, 1.2); R.ctx.fill();
  }

  /* --- дрон ----------------------------------------------------------------- */
  function drawDrone(len, base) {
    var hw = TS * 0.22, x0 = -len / 2, x1 = len / 2, i;
    var rx = len * 0.40, ry = len * 0.42;             // X-рама: винты в четырёх углах
    // усиленная тень: корпус висит в воздухе, тень мягче и шире
    shadow(0, 7, len * 0.68, TS * 0.32, 0.22);
    shadow(0, 4, len * 0.42, TS * 0.20, 0.16);

    // четыре луча крест-накрест к мотор-гондолам
    R.ctx.strokeStyle = shade(base, -0.28); R.ctx.lineWidth = 3.4;
    R.ctx.beginPath(); R.ctx.moveTo(x0 + 4, -hw * 0.7); R.ctx.lineTo(-rx, -ry); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(x0 + 4, hw * 0.7); R.ctx.lineTo(-rx, ry); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(x1 - 4, -hw * 0.7); R.ctx.lineTo(rx, -ry); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(x1 - 4, hw * 0.7); R.ctx.lineTo(rx, ry); R.ctx.stroke();
    // гондолы моторов по углам рамы
    R.ctx.fillStyle = '#2b3240';
    R.ctx.beginPath(); R.ctx.arc(-rx, -ry, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(-rx, ry, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(rx, -ry, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(rx, ry, 3.4, 0, 6.2832); R.ctx.fill();

    // пропеллеры: два вращающихся лезвия и размытый диск
    var rot = G.t * 22;
    var px = [-rx, -rx, rx, rx];
    var py = [-ry, ry, -ry, ry];
    for (i = 0; i < 4; i++) {
      R.ctx.fillStyle = 'rgba(200,212,228,0.16)';
      R.ctx.beginPath(); R.ctx.arc(px[i], py[i], 8.4, 0, 6.2832); R.ctx.fill();
      R.ctx.save();
      R.ctx.translate(px[i], py[i]);
      R.ctx.rotate(rot + i * 0.9);
      R.ctx.fillStyle = 'rgba(226,232,242,0.72)';
      rr(-8.2, -1.1, 16.4, 2.2, 1.1); R.ctx.fill();
      R.ctx.restore();
    }

    // центральный корпус
    var g = R.ctx.createLinearGradient(0, -hw, 0, hw);
    g.addColorStop(0, shade(base, 0.40));
    g.addColorStop(0.4, base);
    g.addColorStop(1, shade(base, -0.44));
    rr(x0, -hw, len, hw * 2, 5);
    R.ctx.fillStyle = g; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    // крышка отсека и швы
    vSeam(x0 + len * 0.30, hw, -hw + 1.5, hw - 1.5);
    vSeam(x0 + len * 0.68, hw, -hw + 1.5, hw - 1.5);
    R.ctx.fillStyle = shade(base, 0.18);
    rr(x0 + len * 0.16, -hw * 0.74, len * 0.42, hw * 1.48, 3); R.ctx.fill();
    // камера-«глаз» под носом
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.arc(x1 - 5, 0, 4.2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#2c3f56';
    R.ctx.beginPath(); R.ctx.arc(x1 - 5, 0, 2.6, 0, 6.2832); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(169,201,232,0.9)';
      R.ctx.beginPath(); R.ctx.arc(x1 - 4.2, -1.0, 1.1, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(0,0,0,0.18)';
      rr(x0 + len * 0.20, -hw * 0.60, len * 0.34, hw * 1.20, 2); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
      R.ctx.fillRect(x0 + 2, -hw + 1.0, len - 4, 1.3);
    }
    // полозья-шасси под корпусом
    R.ctx.fillStyle = '#20242e';
    rr(x0 + 3, -hw - 2.2, len * 0.62, 2.2, 1); R.ctx.fill();
    rr(x0 + 3, hw, len * 0.62, 2.2, 1); R.ctx.fill();

    // навигационные огни: мигают через G.t
    var st = Math.floor(G.t * 6) % 2 === 0;
    var st2 = Math.floor(G.t * 9 + 1) % 2 === 0;
    R.ctx.fillStyle = st ? '#46d67a' : '#5b6472';
    R.ctx.beginPath(); R.ctx.arc(x0 + 6, -hw - 1.0, 1.8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = st ? '#ef4444' : '#5b6472';
    R.ctx.beginPath(); R.ctx.arc(x0 + 6, hw + 1.0, 1.8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = st2 ? '#f2f5fa' : '#5b6472';
    R.ctx.beginPath(); R.ctx.arc(x0 + 2, 0, 1.9, 0, 6.2832); R.ctx.fill();
    if (R.fine) {
      var ng = R.ctx.createRadialGradient(x0 + 2, 0, 1, x0 + 2, 0, 16);
      ng.addColorStop(0, st2 ? 'rgba(255,255,255,0.30)' : 'rgba(0,0,0,0)');
      ng.addColorStop(1, 'rgba(0,0,0,0)');
      R.ctx.fillStyle = ng;
      R.ctx.beginPath(); R.ctx.arc(x0 + 2, 0, 16, 0, 6.2832); R.ctx.fill();
    }
  }

  /* --- самолёт на взлётной полосе ------------------------------------------- */
  function drawPlane(len, base) {
    var hw = TS * 0.30, x0 = -len / 2, x1 = len / 2, i;
    var wsp = TS * 0.66;                              // размах крыла
    var xW0 = -TS * 0.34, xW1 = TS * 0.30;

    // широкие крылья со стреловидностью и законцовками
    var wg = R.ctx.createLinearGradient(0, -wsp, 0, wsp);
    wg.addColorStop(0, shade(base, 0.34));
    wg.addColorStop(0.5, shade(base, 0.02));
    wg.addColorStop(1, shade(base, -0.40));
    R.ctx.beginPath();
    R.ctx.moveTo(xW1, -hw * 0.7);
    R.ctx.lineTo(xW0 - TS * 0.10, -wsp);
    R.ctx.lineTo(xW0 - TS * 0.22, -wsp);
    R.ctx.lineTo(xW0 + TS * 0.06, -hw * 0.7);
    R.ctx.lineTo(xW0 + TS * 0.06, hw * 0.7);
    R.ctx.lineTo(xW0 - TS * 0.22, wsp);
    R.ctx.lineTo(xW0 - TS * 0.10, wsp);
    R.ctx.lineTo(xW1, hw * 0.7);
    R.ctx.closePath();
    R.ctx.fillStyle = wg; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.45)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();
    if (R.fine) {
      R.ctx.save(); R.ctx.clip();
      R.ctx.fillStyle = 'rgba(255,255,255,0.20)';     // блик по передней кромке крыла
      R.ctx.fillRect(xW0 - TS * 0.22, -wsp, TS * 0.10, wsp * 2);
      R.ctx.restore();
      R.ctx.fillStyle = 'rgba(30,40,60,0.35)';        // закрылки и элероны
      R.ctx.fillRect(xW0 - TS * 0.22, -wsp + 2, TS * 0.10, wsp * 0.42);
      R.ctx.fillRect(xW0 - TS * 0.22, wsp * 0.58, TS * 0.10, wsp * 0.42);
    }

    // два двигателя на крыльях
    R.ctx.fillStyle = shade(base, -0.24);
    rr(xW0 - TS * 0.04, -wsp * 0.62, TS * 0.52, TS * 0.20, 3); R.ctx.fill();
    rr(xW0 - TS * 0.04, wsp * 0.62 - TS * 0.20, TS * 0.52, TS * 0.20, 3); R.ctx.fill();
    R.ctx.fillStyle = '#3a4150';
    R.ctx.beginPath(); R.ctx.arc(xW0 + TS * 0.48, -wsp * 0.52, TS * 0.095, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(xW0 + TS * 0.48, wsp * 0.52, TS * 0.095, 0, 6.2832); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = '#c9ced8';                    // хром воздухозаборников
      R.ctx.beginPath(); R.ctx.arc(xW0 + TS * 0.48, -wsp * 0.52, TS * 0.055, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(xW0 + TS * 0.48, wsp * 0.52, TS * 0.055, 0, 6.2832); R.ctx.fill();
    }

    // хвостовое оперение: стабилизаторы и киль
    R.ctx.fillStyle = shade(base, 0.08);
    R.ctx.beginPath();
    R.ctx.moveTo(x0 + TS * 0.54, -TS * 0.06);
    R.ctx.lineTo(x0 + TS * 0.16, -TS * 0.44);
    R.ctx.lineTo(x0 + TS * 0.02, -TS * 0.44);
    R.ctx.lineTo(x0 + TS * 0.30, -TS * 0.06);
    R.ctx.lineTo(x0 + TS * 0.30, TS * 0.06);
    R.ctx.lineTo(x0 + TS * 0.02, TS * 0.44);
    R.ctx.lineTo(x0 + TS * 0.16, TS * 0.44);
    R.ctx.lineTo(x0 + TS * 0.54, TS * 0.06);
    R.ctx.closePath();
    R.ctx.fillStyle = shade(base, 0.10); R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.45)'; R.ctx.lineWidth = 1; R.ctx.stroke();

    // фюзеляж с заострённым носом и скошенной кормой
    var fg = R.ctx.createLinearGradient(0, -hw, 0, hw);
    fg.addColorStop(0, shade(base, 0.38));
    fg.addColorStop(0.32, shade(base, 0.06));
    fg.addColorStop(0.72, base);
    fg.addColorStop(1, shade(base, -0.42));
    R.ctx.beginPath();
    R.ctx.moveTo(x1 - TS * 0.34, -hw * 0.92);
    R.ctx.quadraticCurveTo(x1, -hw * 0.5, x1, 0);
    R.ctx.quadraticCurveTo(x1, hw * 0.5, x1 - TS * 0.34, hw * 0.92);
    R.ctx.lineTo(x0 + TS * 0.22, hw);
    R.ctx.lineTo(x0 + TS * 0.04, hw * 0.52);          // скошенная корма под киль
    R.ctx.lineTo(x0 + TS * 0.04, -hw * 0.52);
    R.ctx.lineTo(x0 + TS * 0.22, -hw);
    R.ctx.closePath();
    R.ctx.fillStyle = fg; R.ctx.fill();
    R.ctx.strokeStyle = 'rgba(18,22,32,0.5)'; R.ctx.lineWidth = 1.1; R.ctx.stroke();

    // киль по центру и мигалка на нём
    R.ctx.fillStyle = shade(base, 0.16);
    R.ctx.beginPath();
    R.ctx.moveTo(x0 + TS * 0.34, -1.9);
    R.ctx.lineTo(x0 + TS * 0.06, -1.9);
    R.ctx.lineTo(x0 + TS * 0.02, 0);
    R.ctx.lineTo(x0 + TS * 0.06, 1.9);
    R.ctx.lineTo(x0 + TS * 0.34, 1.9);
    R.ctx.closePath(); R.ctx.fill();
    // кабина пилотов
    vGlassQuad([x1 - TS * 0.30, -hw * 0.66, x1 - TS * 0.30, hw * 0.66,
                x1 - TS * 0.62, hw * 0.76, x1 - TS * 0.62, -hw * 0.76]);
    R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
    R.ctx.fillRect(x1 - TS * 0.64, -hw * 0.99, TS * 0.30, 2.4);
    R.ctx.fillRect(x1 - TS * 0.64, hw * 0.99 - 2.4, TS * 0.30, 2.4);
    // иллюминаторы вдоль пассажирской кабины (до хвоста, не заходя на остекление пилотов)
    for (i = 0; i < 8; i++) {
      var pxp = x1 - TS * 0.78 - i * 8.4;
      R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
      R.ctx.beginPath(); R.ctx.arc(pxp, -hw * 0.72, 1.7, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(pxp, hw * 0.72, 1.7, 0, 6.2832); R.ctx.fill();
      if (R.fine) {
        R.ctx.fillStyle = 'rgba(255,255,255,0.35)';   // хром-окантовка иллюминаторов
        R.ctx.beginPath(); R.ctx.arc(pxp - 2.4, -hw * 0.72, 0.9, 0, 6.2832); R.ctx.fill();
        R.ctx.beginPath(); R.ctx.arc(pxp - 2.4, hw * 0.72, 0.9, 0, 6.2832); R.ctx.fill();
        R.ctx.fillStyle = 'rgba(30,40,55,0.85)';
      }
    }
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.18)';     // блик по всей длине фюзеляжа
      R.ctx.fillRect(x0 + TS * 0.26, -hw * 0.52, len - TS * 0.7, 1.8);
      R.ctx.fillStyle = 'rgba(0,0,0,0.12)';           // ливрея-полоса по борту
      R.ctx.fillRect(x0 + TS * 0.26, hw * 0.40, len - TS * 0.7, 2.4);
      R.ctx.fillRect(x0 + TS * 0.26, -hw * 0.62, len - TS * 0.7, 2.4);
    }

    // мигалка на киле
    var bl = Math.floor(G.t * 8) % 2 === 0;
    R.ctx.fillStyle = bl ? '#ef4444' : '#6b7280';
    R.ctx.beginPath(); R.ctx.arc(x0 + TS * 0.10, 0, 2.4, 0, 6.2832); R.ctx.fill();
    if (R.fine && bl) {
      var bg2 = R.ctx.createRadialGradient(x0 + TS * 0.10, 0, 1, x0 + TS * 0.10, 0, 18);
      bg2.addColorStop(0, 'rgba(255,80,80,0.34)');
      bg2.addColorStop(1, 'rgba(0,0,0,0)');
      R.ctx.fillStyle = bg2;
      R.ctx.beginPath(); R.ctx.arc(x0 + TS * 0.10, 0, 18, 0, 6.2832); R.ctx.fill();
    }
    // бортовые огни на законцовках крыла
    R.ctx.fillStyle = '#46d67a';
    R.ctx.beginPath(); R.ctx.arc(xW0 - TS * 0.16, -wsp + 2, 1.8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#ef4444';
    R.ctx.beginPath(); R.ctx.arc(xW0 - TS * 0.16, wsp - 2, 1.8, 0, 6.2832); R.ctx.fill();
    // посадочные фары под носом
    R.ctx.fillStyle = '#dde5f0';
    rr(x1 - TS * 0.40, -hw * 0.42, 3, 3, 1.2); R.ctx.fill();
    rr(x1 - TS * 0.40, hw * 0.42 - 3, 3, 3, 1.2); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,250,215,0.95)';
    rr(x1 - TS * 0.38, -hw * 0.34, 1.8, 1.8, 0.8); R.ctx.fill();
    rr(x1 - TS * 0.38, hw * 0.34 - 1.8, 1.8, 1.8, 0.8); R.ctx.fill();
  }

  /* --- кастомизация: шапки, следы, питомцы --------------------------------- */
  // Всё рисуется в системе координат курицы, поэтому наклон и squash работают сами
  function drawHatOnChicken(kind, t) {
    if (!kind || kind === 'none') { return; }
    var ctx = R.ctx;
    if (kind === 'cap') {
      ctx.fillStyle = '#3d7ce0';
      ctx.beginPath(); ctx.arc(0, -19, 9.2, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#2f63b8';
      ctx.fillRect(-1, -21, 12, 4);
      ctx.fillStyle = '#ffd75e';
      ctx.beginPath(); ctx.arc(0, -25, 2, 0, 6.2832); ctx.fill();
    } else if (kind === 'crown') {
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath();
      ctx.moveTo(-9.5, -19); ctx.lineTo(-9.5, -26); ctx.lineTo(-4.5, -22);
      ctx.lineTo(0, -28.5); ctx.lineTo(4.5, -22); ctx.lineTo(9.5, -26); ctx.lineTo(9.5, -19);
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#e0a91c';
      ctx.fillRect(-9.5, -20, 19, 3);
      ctx.fillStyle = '#e8453c';
      ctx.beginPath(); ctx.arc(0, -24, 1.7, 0, 6.2832); ctx.fill();
    } else if (kind === 'helmet') {
      ctx.fillStyle = '#8b99ab';
      ctx.beginPath(); ctx.arc(0, -17, 10.4, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.35)';
      ctx.fillRect(-10.4, -18.5, 21, 2.6);
      ctx.fillStyle = '#5d6a7a';
      ctx.fillRect(-10.4, -16.5, 21, 2);
    } else if (kind === 'ushanka') {
      ctx.fillStyle = '#8a6a3a';
      ctx.beginPath(); ctx.arc(0, -18, 10.2, Math.PI, 0); ctx.closePath(); ctx.fill();
      ctx.fillRect(-11.2, -19.5, 22.4, 4.4);
      ctx.fillStyle = '#e8e2cf';
      ctx.beginPath(); ctx.arc(-9.4, -15.6, 3.6, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(9.4, -15.6, 3.6, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(0, -27, 3, 0, 6.2832); ctx.fill();
    }
  }

  function drawTrailOnChicken(kind, t, airborne) {
    if (!kind || kind === 'none') { return; }
    var ctx = R.ctx;
    var n = 3;
    for (var i = 0; i < n; i++) {
      var ph = t * 3 + i * 1.1;
      var a = 0.5 - i * 0.13;
      var yy = 20 + i * 4;
      var xx = Math.sin(ph) * 3;
      ctx.globalAlpha = Math.max(0.1, a);
      if (kind === 'feather') {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath(); ctx.ellipse(xx, yy, 4, 1.8, ph * 0.4, 0, 6.2832); ctx.fill();
      } else if (kind === 'spark') {
        ctx.fillStyle = '#ffd75e';
        ctx.fillRect(xx - 2, yy - 0.8, 4, 1.6);
        ctx.fillRect(xx - 0.8, yy - 2, 1.6, 4);
      } else if (kind === 'snow') {
        ctx.fillStyle = '#dff1ff';
        ctx.beginPath(); ctx.arc(xx, yy, 2, 0, 6.2832); ctx.fill();
      } else if (kind === 'fire') {
        ctx.fillStyle = i % 2 ? '#ff8a3d' : '#ffd75e';
        ctx.beginPath(); ctx.arc(xx, yy, 3 - i * 0.5, 0, 6.2832); ctx.fill();
      } else if (kind === 'rainbow') {
        ctx.fillStyle = 'hsl(' + ((t * 120 + i * 60) % 360) + ',85%,62%)';
        ctx.beginPath(); ctx.arc(xx, yy, 2.6, 0, 6.2832); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // Питомец: маленькая модель, идёт рядом с курицей
  function drawPet(kind, x, y, t) {
    if (!kind || kind === 'none') { return; }
    var ctx = R.ctx;
    var bob = Math.sin(t * 7) * 1.8;
    var flap = Math.sin(t * 9) * 0.3;
    ctx.save();
    ctx.translate(x, y + bob);
    shadow(0, 9 - bob, 9, 4, 0.20);
    if (kind === 'chick') {
      ctx.fillStyle = '#ffd84d';
      ctx.beginPath(); ctx.ellipse(0, 0, 8, 7, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#ffe98a';
      ctx.beginPath(); ctx.ellipse(-1, -1.4, 6, 5, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#f0a91c';
      ctx.beginPath(); ctx.ellipse(-7, 1, 3, 2, -flap, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(7, 1, 3, 2, flap, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#f5a623';
      ctx.beginPath(); ctx.moveTo(-2, -6); ctx.lineTo(2, -6); ctx.lineTo(0, -9.5); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#20242e';
      ctx.beginPath(); ctx.arc(-2.6, -5, 1.1, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(2.6, -5, 1.1, 0, 6.2832); ctx.fill();
    } else if (kind === 'duck') {
      ctx.fillStyle = '#f7f9fc';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7.5, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#e9eef6';
      ctx.beginPath(); ctx.ellipse(-6, 1, 4, 3, -flap, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#f7f9fc';
      ctx.beginPath(); ctx.arc(0, -8, 5.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.moveTo(-2.4, -8); ctx.lineTo(2.4, -8); ctx.lineTo(0, -12); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#20242e';
      ctx.beginPath(); ctx.arc(-2, -9, 1, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(2, -9, 1, 0, 6.2832); ctx.fill();
    } else if (kind === 'dragon') {
      ctx.fillStyle = '#4aa858';
      ctx.beginPath(); ctx.ellipse(0, 0, 9, 7, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#7fd18f';
      ctx.beginPath(); ctx.ellipse(0, 1, 6, 4.6, 0, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#3f8f4a';
      ctx.beginPath(); ctx.ellipse(-8, -2, 5, 2.6, -0.5 - flap, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.ellipse(8, -2, 5, 2.6, 0.5 + flap, 0, 6.2832); ctx.fill();
      // дымок из ноздрей
      ctx.fillStyle = 'rgba(255,255,255,' + (0.25 + Math.abs(Math.sin(t * 4)) * 0.3).toFixed(2) + ')';
      ctx.beginPath(); ctx.arc(0, -12 - Math.sin(t * 3) * 2, 3.4, 0, 6.2832); ctx.fill();
      ctx.fillStyle = '#f2c94c';
      ctx.beginPath(); ctx.arc(-2.4, -6, 1.2, 0, 6.2832); ctx.fill();
      ctx.beginPath(); ctx.arc(2.4, -6, 1.2, 0, 6.2832); ctx.fill();
    }
    ctx.restore();
  }

  // Превью для магазина: те же модели, увеличенные
  function drawHatPreview(id) {
    var ctx = R.ctx;
    if (id === 'none') {
      ctx.fillStyle = 'rgba(120,130,150,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, 13, 0, 6.2832); ctx.fill();
      return;
    }
    ctx.scale(1.5, 1.5);
    drawHatOnChicken(id, 0);
  }

  function drawTrailPreview(id) {
    var ctx = R.ctx;
    if (id === 'none') {
      ctx.fillStyle = 'rgba(120,130,150,0.5)';
      ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.2832); ctx.fill();
      return;
    }
    ctx.scale(1.6, 1.6);
    drawTrailOnChicken(id, G.t, false);
  }

  function drawVoicePreview(id) {
    var ctx = R.ctx;
    var col = id === 'squeak' ? '#ffd75e' : (id === 'robot' ? '#8fd3ff' : (id === 'duck' ? '#f2c94c' : '#c9ced8'));
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.arc(0, 2, 9, 0, 6.2832); ctx.fill();
    ctx.fillStyle = 'rgba(20,26,40,0.75)';
    ctx.beginPath(); ctx.moveTo(-2, 6); ctx.lineTo(-2, -2); ctx.lineTo(4, -6); ctx.lineTo(4, 10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = col; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(0, 2, 13, -0.9, 0.9); ctx.stroke();
  }

  /* --- диспетчер моделей ---------------------------------------------------- */
  function drawVehicle(x, y, kind, dir, color, ph) {
    var spec = KIND[kind] || KIND.car;
    var len = spec.len * TS;
    var base = color || '#e05a47';
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.scale(dir, 1);

    if (kind === 'snowplow') {
      vShadowBox(len, CAR_W + 14);
      drawSnowplow(len, base);
    } else if (kind === 'firetruck') {
      vShadowBox(len, CAR_W + 4);
      drawFireTruck(len, base);
    } else if (kind === 'icecream') {
      vShadowBox(len, CAR_W + 2);
      drawIceCream(len, base);
    } else if (kind === 'limo') {
      vShadowBox(len, CAR_W + 2);
      drawLimo(len, base);
    } else if (kind === 'hearse') {
      vShadowBox(len, CAR_W + 3);
      drawHearse(len, base);
    } else if (kind === 'garbage') {
      vShadowBox(len, CAR_W + 4);
      drawGarbage(len, base);
    } else if (kind === 'mixer') {
      vShadowBox(len, CAR_W + 6);
      drawMixer(len, base);
    } else if (kind === 'roller') {
      vShadowBox(len, CAR_W + 4);
      drawRoller(len, base);
    } else if (kind === 'lift') {
      vShadowBox(len, CAR_W + 4);
      drawLift(len, base);
    } else if (kind === 'hover') {
      vShadowBox(len, CAR_W + 2);
      drawHover(len, base);
    } else if (kind === 'tow') {
      vShadowBox(len, CAR_W + 3);
      drawTow(len, base);
    } else if (kind === 'f1') {
      vShadowBox(len, TS * 0.72);
      drawF1(len, base);
    } else if (kind === 'drone') {
      vShadowBox(len, TS * 0.68);
      drawDrone(len, base);
    } else if (kind === 'plane') {
      vShadowBox(len, TS * 1.16);
      drawPlane(len, base);
    } else if (kind === 'moto') {
      vShadowBox(len + 6, TS * 0.30);
      drawMoto(len, base);
    } else if (kind === 'tractor') {
      vShadowBox(len + 4, CAR_W + 8);
      drawTractor(len, base);
    } else if (kind === 'bus') {
      vShadowBox(len, CAR_W + 4);
      drawBus(len, base);
    } else if (kind === 'truck') {
      vShadowBox(len, CAR_W + 4);
      drawTruck(len, base);
    } else if (kind === 'ambulance') {
      vShadowBox(len, CAR_W + 2);
      drawAmbulance(len, base);
    } else if (kind === 'pickup') {
      vShadowBox(len, CAR_W + 2);
      drawPickup(len, base);
    } else if (kind === 'sport') {
      vShadowBox(len, CAR_W + 3);
      drawSport(len, base);
    } else if (kind === 'van') {
      vShadowBox(len, CAR_W + 2);
      drawVan(len, base);
    } else {
      vShadowBox(len, CAR_W);
      drawSedan(len, base, kind);
    }
    R.ctx.restore();
  }


  function drawChicken(x, y, hopT, facing, dead, t) {
    var sk = SK.colors(SK.skinOf(G.skin), t);
    var body = sk.body[0], bodyMid = sk.body[1], bodyDark = sk.body[2];
    var airborne = hopT !== null;
    var arc = airborne ? Math.sin(Math.PI * hopT) : 0;
    var lift = arc * 20;
    var sq = 1 + arc * 0.13;                       // squash & stretch
    var breathe = airborne ? 0 : Math.sin(t * 3.4) * 0.02;

    shadow(x, y + 12 - lift * 0.15, 15 * (1 + arc * 0.25), 6.5 * (1 + arc * 0.2), 0.26 - arc * 0.10);
    if (dead) { return; }

    R.ctx.save();
    R.ctx.translate(x, y - lift);
    R.ctx.scale(sk.size || 1, sk.size || 1);         // цыплёнок меньше остальных
    R.ctx.scale(1 - breathe, 1 + breathe);
    R.ctx.scale(1 / sq, sq);
    var ang = facing === 'up' ? 0 : facing === 'right' ? Math.PI / 2 : facing === 'down' ? Math.PI : -Math.PI / 2;
    R.ctx.rotate(ang);

    var flap = airborne ? Math.sin(hopT * Math.PI * 2) * 0.35 : Math.sin(t * 6) * 0.06;

    // лапки (прячутся в прыжке)
    if (!airborne) {
      R.ctx.strokeStyle = sk.legs; R.ctx.lineWidth = 3; R.ctx.lineCap = 'round';
      R.ctx.beginPath(); R.ctx.moveTo(-5, 13); R.ctx.lineTo(-6, 20); R.ctx.lineTo(-10, 21); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(5, 13); R.ctx.lineTo(6, 20); R.ctx.lineTo(10, 21); R.ctx.stroke();
    }
    // хвост
    R.ctx.fillStyle = sk.tail[0];
    R.ctx.beginPath(); R.ctx.ellipse(0, 16, 11, 7, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = sk.tail[1];
    R.ctx.beginPath(); R.ctx.ellipse(-5, 19, 5, 6, -0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(5, 19, 5, 6, 0.5, 0, 6.2832); R.ctx.fill();

    // крылья
    R.ctx.save();
    R.ctx.translate(-12, 2); R.ctx.rotate(-flap);
    R.ctx.fillStyle = sk.wing;
    R.ctx.beginPath(); R.ctx.ellipse(0, 0, 7, 12, 0.15, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
    R.ctx.save();
    R.ctx.translate(12, 2); R.ctx.rotate(flap);
    R.ctx.fillStyle = sk.wing;
    R.ctx.beginPath(); R.ctx.ellipse(0, 0, 7, 12, -0.15, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();

    // тело
    var bg = R.ctx.createLinearGradient(-10, -12, 10, 14);
    bg.addColorStop(0, body); bg.addColorStop(0.6, bodyMid); bg.addColorStop(1, bodyDark);
    R.ctx.fillStyle = bg;
    R.ctx.beginPath(); R.ctx.ellipse(0, 1, 14, 16, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.strokeStyle = sk.line; R.ctx.lineWidth = 1.2; R.ctx.stroke();

    // голова
    R.ctx.fillStyle = body;
    R.ctx.beginPath(); R.ctx.arc(0, -14, 9.5, 0, 6.2832); R.ctx.fill();
    R.ctx.strokeStyle = sk.line; R.ctx.stroke();

    // гребешок
    R.ctx.fillStyle = sk.comb;
    R.ctx.beginPath(); R.ctx.arc(-3.4, -21.5, 3.2, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(1.6, -22.5, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(6, -20, 2.8, 0, 6.2832); R.ctx.fill();

    // клюв
    R.ctx.fillStyle = sk.beak;
    R.ctx.beginPath();
    R.ctx.moveTo(-3.6, -22.5); R.ctx.lineTo(3.6, -22.5); R.ctx.lineTo(0, -29.5);
    R.ctx.closePath(); R.ctx.fill();

    // глаза
    R.ctx.fillStyle = sk.eye;
    R.ctx.beginPath(); R.ctx.arc(-4.6, -15.5, 1.7, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(4.6, -15.5, 1.7, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = sk.eye === '#ffffff' ? 'rgba(32,36,46,0.8)' : 'rgba(255,255,255,0.85)';
    R.ctx.beginPath(); R.ctx.arc(-5.1, -16.1, 0.6, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(4.1, -16.1, 0.6, 0, 6.2832); R.ctx.fill();

    // украшения скина (рисуются поверх и вращаются вместе с курицей)
    if (sk.extra) { drawSkinExtra(sk, t, airborne); }
    // шапка из слота кастомизации и эффект следа
    drawHatOnChicken(G.hat, t);
    drawTrailOnChicken(G.trail, t, airborne);

    R.ctx.restore();

    // щит неуязвимости
    if (G.invuln > 0) {
      R.ctx.strokeStyle = 'rgba(255,230,128,' + (0.35 + 0.35 * Math.sin(t * 14)) + ')';
      R.ctx.lineWidth = 2.5;
      R.ctx.beginPath(); R.ctx.arc(x, y - 2, 24 * (sk.size || 1), 0, 6.2832); R.ctx.stroke();
    }
  }

  // Украшения скинов: шляпы, швы, визоры, блики — всё тоже кодом
  function drawSkinExtra(sk, t, airborne) {
    var i, a;
    if (sk.extra === 'fluff') {                     // цыплёнок: пух и хохолок
      R.ctx.fillStyle = 'rgba(255,255,255,0.55)';
      for (i = 0; i < 7; i++) {
        a = (i / 7) * 6.2832 + t * 0.6;
        R.ctx.beginPath();
        R.ctx.arc(Math.cos(a) * 15, 2 + Math.sin(a) * 17, 3.6 + Math.sin(t * 5 + i) * 0.5, 0, 6.2832);
        R.ctx.fill();
      }
      R.ctx.fillStyle = sk.comb;
      R.ctx.beginPath(); R.ctx.arc(0, -25.5, 3.2, 0, 6.2832); R.ctx.fill();
      return;
    }
    if (sk.extra === 'bandit') {                    // разбойник: бандана и повязка
      R.ctx.fillStyle = '#2b3140';
      rr(-11, -19.5, 22, 7, 2.5); R.ctx.fill();
      R.ctx.beginPath();
      R.ctx.moveTo(-10, -18); R.ctx.lineTo(-19, -22 + Math.sin(t * 4) * 1.6); R.ctx.lineTo(-17, -13);
      R.ctx.closePath(); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(0,0,0,0.9)';
      R.ctx.beginPath(); R.ctx.arc(-4.6, -15.5, 3.4, 0, 6.2832); R.ctx.fill();
      R.ctx.strokeStyle = 'rgba(0,0,0,0.9)'; R.ctx.lineWidth = 1.4;
      R.ctx.beginPath(); R.ctx.moveTo(-8, -16.6); R.ctx.lineTo(9, -18.4); R.ctx.stroke();
      return;
    }
    if (sk.extra === 'ninja') {                     // ниндзя: лента с развевающимися концами
      R.ctx.fillStyle = '#e8453c';
      rr(-11, -19.5, 22, 6.5, 2.5); R.ctx.fill();
      R.ctx.beginPath();
      R.ctx.moveTo(-9, -18);
      R.ctx.lineTo(-20 - Math.sin(t * 5) * 2, -23 + Math.sin(t * 6) * 3);
      R.ctx.lineTo(-19, -16 + Math.cos(t * 5) * 2.5);
      R.ctx.closePath(); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.25)';
      rr(-11, -19.5, 22, 2, 1); R.ctx.fill();
      return;
    }
    if (sk.extra === 'zombie') {                    // зомби: швы и заплатка
      R.ctx.strokeStyle = 'rgba(40,60,20,0.75)'; R.ctx.lineWidth = 1.4;
      for (i = -1; i <= 1; i++) {
        R.ctx.beginPath();
        R.ctx.moveTo(-9, 4 + i * 7);
        R.ctx.lineTo(9, 3 + i * 7);
        R.ctx.stroke();
      }
      R.ctx.fillStyle = 'rgba(90,110,60,0.85)';
      rr(4, -4, 9, 8, 2); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.20)';
      R.ctx.beginPath(); R.ctx.arc(-6, -2, 4, 0, 6.2832); R.ctx.fill();
      return;
    }
    if (sk.extra === 'robot') {                     // робот: визор, антенна, заклёпки
      R.ctx.fillStyle = '#1f2937';
      rr(-8, -18, 16, 5.5, 2.5); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(80,230,255,' + (0.55 + 0.45 * Math.sin(t * 9)) + ')';
      rr(-6.5, -17, 6, 3, 1.4); R.ctx.fill();
      rr(0.5, -17, 6, 3, 1.4); R.ctx.fill();
      R.ctx.strokeStyle = '#9aa6b6'; R.ctx.lineWidth = 1.6;
      R.ctx.beginPath(); R.ctx.moveTo(2, -23); R.ctx.lineTo(5, -30); R.ctx.stroke();
      R.ctx.fillStyle = (Math.floor(t * 4) % 2) ? '#ff3b30' : '#5c1f1c';
      R.ctx.beginPath(); R.ctx.arc(5.4, -30.6, 2.2, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.35)';
      for (i = 0; i < 4; i++) {
        R.ctx.beginPath(); R.ctx.arc(-9 + i * 6, 12, 1.3, 0, 6.2832); R.ctx.fill();
      }
      return;
    }
    if (sk.extra === 'gold') {                      // золотая: бегущий блик и искры
      R.ctx.save();
      R.ctx.globalAlpha = 0.5;
      R.ctx.beginPath(); R.ctx.ellipse(0, 1, 14, 16, 0, 0, 6.2832); R.ctx.clip();
      var sx = -20 + ((t * 26) % 40);
      R.ctx.fillStyle = 'rgba(255,255,255,0.85)';
      R.ctx.save(); R.ctx.rotate(0.5);
      R.ctx.fillRect(sx, -22, 5, 46);
      R.ctx.restore();
      R.ctx.restore();
      R.ctx.fillStyle = 'rgba(255,245,190,0.95)';
      for (i = 0; i < 3; i++) {
        var ph = t * 2.4 + i * 2.1;
        var px = Math.cos(ph) * 18, py = Math.sin(ph * 1.3) * 16 - 2;
        var sz = 2.6 + Math.abs(Math.sin(ph * 2)) * 2.4;
        R.ctx.save(); R.ctx.translate(px, py); R.ctx.rotate(ph);
        R.ctx.fillRect(-sz / 2, -0.8, sz, 1.6);
        R.ctx.fillRect(-0.8, -sz / 2, 1.6, sz);
        R.ctx.restore();
      }
      return;
    }
    if (sk.extra === 'rainbow') {                   // радуга: светящийся контур и искры
      R.ctx.strokeStyle = 'hsla(' + ((t * 140) % 360) + ',90%,75%,0.85)';
      R.ctx.lineWidth = 2;
      R.ctx.beginPath(); R.ctx.ellipse(0, 1, 14.5, 16.5, 0, 0, 6.2832); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(255,255,255,0.9)';
      for (i = 0; i < 4; i++) {
        a = t * 3 + i * 1.6;
        R.ctx.beginPath();
        R.ctx.arc(Math.cos(a) * 17, Math.sin(a) * 18 - 1, 1.8 + Math.abs(Math.sin(a * 2)) * 1.4, 0, 6.2832);
        R.ctx.fill();
      }
      return;
    }
  }

  // Превью скина для магазина: тот же спрайт в отдельном маленьком контексте
  function drawSkinPreview(g, skinId, size) {
    var keepSkin = G.skin, keepInv = G.invuln;
    G.skin = skinId; G.invuln = 0;
    withCtx(g, function () {
      g.save();
      g.translate(size / 2, size * 0.56);
      g.scale(size / 78, size / 78);
      drawChicken(0, 0, null, 'up', false, G.t + skinId.length * 0.7);
      g.restore();
    });
    G.skin = keepSkin; G.invuln = keepInv;
  }



  /* --- кэш спрайтов машин --------------------------------------------------
     Машина едет строго горизонтально и не меняет масштаб между кадрами, поэтому
     её выгодно один раз нарисовать в offscreen-canvas и дальше просто копировать:
     это в разы дешевле, чем заново собирать кузов из десятков примитивов.
     Модели с анимацией (мигалки полиции и скорой, наклон мотоцикла) остаются
     живыми — их немного, и они дешёвые. */
  var LIVE_KINDS = { police: 1, ambulance: 1, moto: 1, snowplow: 1, firetruck: 1,
    garbage: 1, tow: 1, drone: 1, plane: 1, limo: 1,
    mixer: 1, roller: 1, lift: 1, hover: 1 };

  function vehicleSprite(kind, color, dir) {
    var spec = KIND[kind] || KIND.car;
    var len = spec.len * TS;
    var w = len + TS * 0.8;          // запас на зеркала, антикрыло и отвал
    var h = TS * 1.45;               // запас на тень и боковые детали
    var k = (R.DPR || 1) * (R.scale || 1);
    var key = 'v|' + kind + '|' + color + '|' + dir + '|' + k.toFixed(2) + '|' + G.themeId + '|' + (R.fine ? 1 : 0);
    return U.sprite(key, w, h, k, function (g, cx, cy) {
      drawVehicle(cx, cy, kind, dir, color, 0);
    });
  }

  // Рисует машину: из кэша, если модель статичная, иначе честно каждый кадр.
  function drawVehicleCached(x, y, kind, dir, color, ph) {
    if (R.spritesOn === false || LIVE_KINDS[kind] || !U.sprite) { drawVehicle(x, y, kind, dir, color, ph); return; }
    var s = vehicleSprite(kind, color, dir);
    R.ctx.drawImage(s.cv, x - s.w / 2, y - s.h / 2, s.w, s.h);
  }

  function clearVehicleSprites() { /* спрайты живут в общем кэше ядра */ }

  U.expose(CC.actors, {
    drawVehicle: drawVehicle, drawVehicleCached: drawVehicleCached,
    drawChicken: drawChicken, drawSkinExtra: drawSkinExtra,
    drawSkinPreview: drawSkinPreview, clearVehicleSprites: clearVehicleSprites,
    drawPet: drawPet, drawHatOnChicken: drawHatOnChicken, drawTrailOnChicken: drawTrailOnChicken,
    drawHatPreview: drawHatPreview, drawTrailPreview: drawTrailPreview, drawVoicePreview: drawVoicePreview
  });
})(window.CC);
