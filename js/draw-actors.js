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
  function drawMoto(len, base) {
    var hw = TS * 0.20, x0 = -len / 2, x1 = len / 2;
    // лёгкий наклон в повороте — мотоцикл не едет строго прямо
    R.ctx.rotate(Math.sin(G.t * 3 + base.length) * 0.05);

    vWheel(x0 + 4, 0, 6.5);
    vWheel(x1 - 4, 0, 6.5);
    if (R.fine) {                                    // спицы
      R.ctx.strokeStyle = 'rgba(210,220,235,0.5)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.moveTo(x0 + 4, -3.4); R.ctx.lineTo(x0 + 4, 3.4); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(x1 - 4, -3.4); R.ctx.lineTo(x1 - 4, 3.4); R.ctx.stroke();
    }
    // рама, бак, седло, задний обтекатель
    R.ctx.fillStyle = '#20242e';
    rr(x0 + 2, -hw * 0.42, len - 4, hw * 0.84, 3); R.ctx.fill();
    var tg = R.ctx.createLinearGradient(0, -hw, 0, hw);
    tg.addColorStop(0, shade(base, 0.42));
    tg.addColorStop(0.45, base);
    tg.addColorStop(1, shade(base, -0.42));
    rr(x1 - len * 0.52, -hw, len * 0.34, hw * 2, 4);
    R.ctx.fillStyle = tg; R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.22)';
    R.ctx.fillRect(x1 - len * 0.50, -hw * 0.72, len * 0.28, 1.6);
    R.ctx.fillStyle = '#161a22';                     // седло
    rr(x0 + len * 0.10, -hw * 0.86, len * 0.34, hw * 1.72, 3); R.ctx.fill();
    R.ctx.fillStyle = shade(base, -0.1);             // задний обтекатель
    rr(x0 + 1, -hw * 0.66, len * 0.18, hw * 1.32, 3); R.ctx.fill();
    // выхлоп вдоль борта
    R.ctx.fillStyle = '#b9c1cd';
    rr(x0 + 4, hw * 0.7, len * 0.55, 2.2, 1); R.ctx.fill();
    // руль и вилка
    R.ctx.fillStyle = '#c9ced8';
    rr(x1 - len * 0.20, -hw * 1.8, 3, hw * 3.6, 1.4); R.ctx.fill();
    R.ctx.fillStyle = '#8f98a6';
    R.ctx.fillRect(x1 - len * 0.20, -hw * 1.5, len * 0.16, 2);
    R.ctx.fillRect(x1 - len * 0.20, hw * 1.5 - 2, len * 0.16, 2);
    // гонщик: корпус, руки, шлем с визором
    R.ctx.fillStyle = shade(base, -0.25);
    R.ctx.beginPath(); R.ctx.ellipse(-len * 0.02, 0, hw * 1.5, hw * 1.35, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#2b3240';
    R.ctx.fillRect(-len * 0.02, -hw * 2.1, hw * 1.2, hw * 4.2);
    R.ctx.fillStyle = '#f2f5fa';
    R.ctx.beginPath(); R.ctx.arc(len * 0.04, 0, hw * 1.55, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(18,24,38,0.9)';
    R.ctx.beginPath();
    R.ctx.arc(len * 0.04 + hw * 0.35, 0, hw * 1.3, -1.25, 1.25);
    R.ctx.lineTo(len * 0.04 + hw * 0.35, 0);
    R.ctx.closePath(); R.ctx.fill();
    if (R.fine) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.4)';
      R.ctx.fillRect(len * 0.04 - hw * 1.2, -hw * 0.5, hw * 0.9, 1.2);
    }
    // фара и стоп
    R.ctx.fillStyle = '#fff3c4';
    R.ctx.beginPath(); R.ctx.arc(x1 - 2, 0, 2.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e8352a';
    R.ctx.beginPath(); R.ctx.arc(x0 + 2, 0, 2, 0, 6.2832); R.ctx.fill();
  }

  /* --- диспетчер моделей ---------------------------------------------------- */
  function drawVehicle(x, y, kind, dir, color, ph) {
    var spec = KIND[kind] || KIND.car;
    var len = spec.len * TS;
    var base = color || '#e05a47';
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.scale(dir, 1);

    if (kind === 'moto') {
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
  var LIVE_KINDS = { police: 1, ambulance: 1, moto: 1 };

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
    drawSkinPreview: drawSkinPreview, clearVehicleSprites: clearVehicleSprites
  });
})(window.CC);
