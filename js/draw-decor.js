/* ============================================================================
   draw-decor.js — 2D-модели украшений по биомам
   ----------------------------------------------------------------------------
   Одна и та же клетка земли в разных биомах украшена по-разному: зимой это
   снеговик, в пустыне — кактус, на стройке — ящики и конусы. Каждая функция
   рисует объект сверху, занимает примерно клетку и получает seed (0..1) для
   вариаций формы, чтобы одинаковые объекты не выглядели копией, и t — время
   для качания, мерцания и вращения.

   Палитры заданы вручную несколькими близкими оттенками: так объект не
   выглядит плоским пятном. Мелкие штрихи (искры, крапины, гвозди, усы)
   рисуются только при крупном масштабе — на телефоне они не видны.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util;
  var TS = C.TS;
  var clamp = U.clamp, hash01 = U.hash01, rnd = U.rnd;
  var rr = CC.draw.rr, shadow = CC.draw.shadow;

  /* ==========================================================================
     9b. ДОПОЛНИТЕЛЬНЫЕ 2D-МОДЕЛИ ДЕКОРАЦИЙ (вид строго сверху)
     --------------------------------------------------------------------------
     Сигнатура: decor<Kind>(x, y, seed, t)
       x, y — центр клетки в мировых координатах (y — центр ряда);
       seed — детерминированное число 0..1: вариация формы, поворота, палитры;
       t    — игровое время в секундах: качание, вращение, мерцание.
     Клетка TS = 48, модель занимает ~34..46 px, тень — через shadow().
     Мелкие штрихи рисуются только при R.scale > 0.68 (экономия кадров на телефоне).
     Палитра каждой модели задана вручную 3–4 близкими оттенками
     (тёмный / средний / светлый), чтобы объект не выглядел плоским пятном.
     ========================================================================== */

  /* --- зима и праздники ----------------------------------------------------- */

  function decorSnowman(x, y, seed, t) {
    var bob = Math.sin(t * 1.4 + seed * 9) * 0.9;          // снеговик чуть «дышит»
    var yy = y + bob;
    var tilt = (seed - 0.5) * 0.35;
    shadow(x + 3, y + 11, 17, 7, 0.24);
    // комы рисуем от дальнего к ближнему: голова → середина → низ
    R.ctx.fillStyle = '#d5dfec';
    R.ctx.beginPath(); R.ctx.ellipse(x, yy - 13, 8.4, 7.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#edf3fb';
    R.ctx.beginPath(); R.ctx.ellipse(x - 1.6, yy - 14, 6.6, 6, 0, 0, 6.2832); R.ctx.fill();
    // ведро-шапка (вид сверху — тёмный круг с полями)
    R.ctx.fillStyle = '#4c5468';
    R.ctx.beginPath(); R.ctx.arc(x, yy - 16, 5.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#7d8794';
    R.ctx.beginPath(); R.ctx.arc(x - 0.8, yy - 16.8, 4.2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#d5dfec';
    R.ctx.beginPath(); R.ctx.ellipse(x, yy + 1.5, 12, 9.5, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f4f8ff';
    R.ctx.beginPath(); R.ctx.ellipse(x - 2, yy + 0.4, 10, 8, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e2eaf6';
    R.ctx.beginPath(); R.ctx.ellipse(x, yy + 11, 15.5, 12, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#fbfdff';
    R.ctx.beginPath(); R.ctx.ellipse(x - 2.4, yy + 9.4, 13.2, 10, 0, 0, 6.2832); R.ctx.fill();
    // руки-веточки в стороны (вид сверху — две палки у среднего кома)
    R.ctx.strokeStyle = '#7a5230'; R.ctx.lineWidth = 2.6; R.ctx.lineCap = 'round';
    R.ctx.beginPath();
    R.ctx.moveTo(x - 9, yy + 2); R.ctx.lineTo(x - 20, yy - 1 - tilt * 6);
    R.ctx.moveTo(x + 9, yy + 2); R.ctx.lineTo(x + 20, yy - 1 + tilt * 6);
    R.ctx.stroke();
    // нос-морковка смотрит вниз, к зрителю
    R.ctx.fillStyle = '#e8862a';
    R.ctx.beginPath();
    R.ctx.moveTo(x - 2.4, yy - 10); R.ctx.lineTo(x + 2.4, yy - 10); R.ctx.lineTo(x, yy - 2);
    R.ctx.closePath(); R.ctx.fill();
    // угольки: глаза и пуговицы
    R.ctx.fillStyle = '#2b3038';
    R.ctx.beginPath(); R.ctx.arc(x - 3.6, yy - 12, 1.5, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(x + 3.6, yy - 12, 1.5, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.beginPath(); R.ctx.arc(x, yy + 6, 1.7, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(x, yy + 11, 1.7, 0, 6.2832); R.ctx.fill();
      // снежинки-искорки на боках
      R.ctx.fillStyle = 'rgba(255,255,255,0.85)';
      R.ctx.beginPath(); R.ctx.arc(x - 14, yy + 4, 1.1, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(x + 15, yy + 7, 1.1, 0, 6.2832); R.ctx.fill();
    }
  }

  function decorIceBlock(x, y, seed, t) {
    var rot = (seed - 0.5) * 0.5;
    var glint = Math.abs(Math.sin(t * 1.6 + seed * 11));
    shadow(x + 3, y + 8, 18, 8, 0.22);
    R.ctx.save();
    R.ctx.translate(x, y + 1);
    R.ctx.rotate(rot);
    // тело глыбы
    rr(-17, -16, 34, 34, 5);
    R.ctx.fillStyle = '#6cb8dd'; R.ctx.fill();
    rr(-15, -14.5, 30, 31, 5);
    R.ctx.fillStyle = '#9fd9f2'; R.ctx.fill();
    // внутренние грани — два ската
    R.ctx.fillStyle = '#c9ecfb';
    R.ctx.beginPath(); R.ctx.moveTo(-15, -3); R.ctx.lineTo(0, -14); R.ctx.lineTo(15, -3); R.ctx.lineTo(0, 8); R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#e7f8ff';
    R.ctx.beginPath(); R.ctx.moveTo(-9, -2); R.ctx.lineTo(0, -9); R.ctx.lineTo(9, -2); R.ctx.lineTo(0, 5); R.ctx.closePath(); R.ctx.fill();
    if (R.scale > 0.68) {
      // трещинки и пузырьки воздуха внутри
      R.ctx.strokeStyle = 'rgba(255,255,255,0.65)'; R.ctx.lineWidth = 1.2;
      R.ctx.beginPath(); R.ctx.moveTo(-11, 8); R.ctx.lineTo(-5, 3); R.ctx.lineTo(-7, -1); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(9, 10); R.ctx.lineTo(14, 5); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(255,255,255,0.55)';
      R.ctx.beginPath(); R.ctx.arc(-4, 9, 1.6, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(6, -8, 1.2, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(-10, -9, 1.4, 0, 6.2832); R.ctx.fill();
    }
    // скользящий блик
    R.ctx.fillStyle = 'rgba(255,255,255,' + (0.18 + glint * 0.30).toFixed(2) + ')';
    R.ctx.beginPath(); R.ctx.ellipse(-7, -7, 4.5, 3, -0.6, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  function decorGift(x, y, seed, t) {
    // палитра подарка выбирается детерминированно: красный / синий / зелёный
    var pal = seed < 0.34
      ? ['#a92f2a', '#d2402f', '#e8604c', '#f6e3b0']
      : (seed < 0.67 ? ['#2b4a9c', '#3d63c4', '#5e83dd', '#e8eefb'] : ['#2f7042', '#3f9c55', '#5fbb72', '#f2e6c2']);
    var rot = (seed - 0.5) * 0.6;
    var bob = Math.sin(t * 1.2 + seed * 7) * 0.6;
    shadow(x + 3, y + 9, 17, 7, 0.26);
    R.ctx.save();
    R.ctx.translate(x, y + bob);
    R.ctx.rotate(rot);
    // коробка
    rr(-16, -15, 32, 30, 3.5);
    R.ctx.fillStyle = pal[0]; R.ctx.fill();
    rr(-15, -14, 30, 28, 3);
    R.ctx.fillStyle = pal[1]; R.ctx.fill();
    if (R.scale > 0.68) {
      // фактура упаковочной бумаги
      R.ctx.fillStyle = 'rgba(255,255,255,0.14)';
      R.ctx.fillRect(-15, -14, 30, 3);
      R.ctx.fillRect(-15, 11, 30, 3);
    }
    // лента: крест
    R.ctx.fillStyle = pal[3];
    R.ctx.fillRect(-3.4, -15, 6.8, 30);
    R.ctx.fillRect(-16, -3.4, 32, 6.8);
    R.ctx.fillStyle = pal[2];
    R.ctx.fillRect(-2.2, -15, 4.4, 30);
    R.ctx.fillRect(-16, -2.2, 32, 4.4);
    // бант: две петли и узел
    R.ctx.fillStyle = pal[3];
    R.ctx.beginPath(); R.ctx.ellipse(-5.4, -3, 5, 4, -0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(5.4, -3, 5, 4, 0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = pal[2];
    R.ctx.beginPath(); R.ctx.arc(-5, -3.4, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(5, -3.4, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = pal[3];
    R.ctx.beginPath(); R.ctx.arc(0, -3, 2.6, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  function decorPumpkin(x, y, seed, t) {
    var turn = (seed - 0.5) * 0.5;
    var yy = y + Math.sin(t * 1.1 + seed * 13) * 0.5;
    var i, a, ex, ey, nx, ny;
    shadow(x + 3, y + 9, 18, 8, 0.26);
    R.ctx.save();
    R.ctx.translate(x, yy);
    R.ctx.rotate(turn);
    // тело: тёмная «чаша» для объёма
    R.ctx.fillStyle = '#b8560f';
    R.ctx.beginPath(); R.ctx.ellipse(0, 1.6, 19, 17, 0, 0, 6.2832); R.ctx.fill();
    // доли-рёбра: шесть ломтиков от центра к краю
    for (i = 0; i < 6; i++) {
      a = i * 1.0472 + 0.3;
      ex = Math.cos(a) * 18; ey = Math.sin(a) * 16;
      nx = -Math.sin(a) * 6.2; ny = Math.cos(a) * 6.2;
      R.ctx.fillStyle = i % 2 ? '#e8862a' : '#f09a34';
      R.ctx.beginPath(); R.ctx.moveTo(0, 0);
      R.ctx.quadraticCurveTo(ex * 0.55 + nx, ey * 0.55 + ny, ex, ey);
      R.ctx.quadraticCurveTo(ex * 0.55 - nx, ey * 0.55 - ny, 0, 0);
      R.ctx.fill();
    }
    // внешний контур и блик
    R.ctx.strokeStyle = '#b8560f'; R.ctx.lineWidth = 2;
    R.ctx.beginPath(); R.ctx.ellipse(0, 0, 18.2, 16.2, 0, 0, 6.2832); R.ctx.stroke();
    R.ctx.fillStyle = 'rgba(255,196,106,0.28)';
    R.ctx.beginPath(); R.ctx.ellipse(-8, -7, 6, 4.2, -0.6, 0, 6.2832); R.ctx.fill();
    // плодоножка с усиком и листом
    R.ctx.fillStyle = '#5b7f2c';
    R.ctx.beginPath(); R.ctx.arc(-1.6, 2.4, 4.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#7a9c3c';
    R.ctx.beginPath(); R.ctx.arc(-1, 2, 3.2, 0, 6.2832); R.ctx.fill();
    R.ctx.strokeStyle = '#57b465'; R.ctx.lineWidth = 1.6;
    R.ctx.beginPath(); R.ctx.arc(3, 3, 4.4, 3.6, 6.4); R.ctx.stroke();
    if (R.scale > 0.68) {
      R.ctx.fillStyle = '#3f8f3a';
      R.ctx.beginPath(); R.ctx.ellipse(7, -2, 4.6, 2.6, -0.5, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = '#6fb84a';
      R.ctx.beginPath(); R.ctx.ellipse(7, -2, 3.4, 1.6, -0.5, 0, 6.2832); R.ctx.fill();
    }
    R.ctx.restore();
  }

  function decorGhost(x, y, seed, t) {
    var bob = Math.sin(t * 1.5 + seed * 7) * 1.6;
    var tilt = Math.sin(t * 0.9 + seed * 4) * 0.06;
    var k;
    shadow(x + 2, y + 11, 13, 5, 0.18);
    R.ctx.save();
    R.ctx.translate(x, y + bob);
    R.ctx.rotate(tilt);
    // тело-простыня: купол сверху, волнистый низ из четырёх фестонов
    R.ctx.fillStyle = '#c9d3e2';
    R.ctx.beginPath();
    R.ctx.arc(0, -2, 14.4, Math.PI, 0);
    for (k = 0; k < 4; k++) { R.ctx.arc(10.8 - k * 7.2, 9.6, 3.6, 0, Math.PI); }
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(247,249,253,0.95)';
    R.ctx.beginPath();
    R.ctx.arc(-0.6, -3, 13.2, Math.PI, 0);
    for (k = 0; k < 4; k++) { R.ctx.arc(9.3 - k * 6.6, 7.8, 3.3, 0, Math.PI); }
    R.ctx.closePath(); R.ctx.fill();
    if (R.scale > 0.68) {
      // складки простыни
      R.ctx.strokeStyle = 'rgba(160,175,200,0.45)'; R.ctx.lineWidth = 1.2;
      R.ctx.beginPath(); R.ctx.moveTo(-8, -8); R.ctx.quadraticCurveTo(-4, -2, -7, 5); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(6, -9); R.ctx.quadraticCurveTo(9, -2, 5, 5); R.ctx.stroke();
    }
    // глаза и рот
    R.ctx.fillStyle = '#3a4152';
    R.ctx.beginPath(); R.ctx.ellipse(-5, -4, 2.6, 3.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(5, -4, 2.6, 3.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e8eef8';
    R.ctx.beginPath(); R.ctx.arc(-5.6, -5.4, 1, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(4.4, -5.4, 1, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#3a4152';
    R.ctx.beginPath(); R.ctx.ellipse(0, 2, 2.2, 3, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  /* --- природа -------------------------------------------------------------- */

  function decorCactus(x, y, seed, t) {
    var sway = Math.sin(t * 0.9 + seed * 11) * 0.4;
    var i, a;
    shadow(x + 3, y + 8, 16, 7, 0.24);
    R.ctx.save();
    R.ctx.translate(x - 3 + sway, y);
    R.ctx.rotate(seed * 6.2832);
    // перемычка и отросток-«рука» сбоку
    R.ctx.fillStyle = '#2f7042';
    R.ctx.fillRect(6, -3.2, 13, 6.6);
    R.ctx.beginPath(); R.ctx.ellipse(16, -1, 8.2, 7.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#3f8f52';
    R.ctx.beginPath(); R.ctx.ellipse(15.2, -1.8, 7, 6.2, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#4fa864';
    R.ctx.beginPath(); R.ctx.ellipse(14.8, -2.2, 4.8, 4.2, 0, 0, 6.2832); R.ctx.fill();
    // главная «лепёшка» кактуса
    R.ctx.fillStyle = '#2f7042';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 14, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#3f8f52';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 13, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#4fa864';
    R.ctx.beginPath(); R.ctx.arc(-0.6, -0.8, 10.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5cbb70';
    R.ctx.beginPath(); R.ctx.arc(-1.6, -1.8, 7, 0, 6.2832); R.ctx.fill();
    // колючки по краю
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = '#e8e4c8'; R.ctx.lineWidth = 1.1; R.ctx.lineCap = 'round';
      for (i = 0; i < 14; i++) {
        a = i * (6.2832 / 14);
        R.ctx.beginPath();
        R.ctx.moveTo(Math.cos(a) * 11.6, Math.sin(a) * 11.6);
        R.ctx.lineTo(Math.cos(a) * 15.4, Math.sin(a) * 15.4);
        R.ctx.stroke();
      }
    }
    // цветок на макушке
    R.ctx.fillStyle = '#d94f7d';
    R.ctx.beginPath(); R.ctx.arc(-3.4, -4, 5.2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f27ba4';
    R.ctx.beginPath(); R.ctx.arc(-4, -4.6, 3.8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f7d24a';
    R.ctx.beginPath(); R.ctx.arc(-4.4, -5, 1.8, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  function decorBones(x, y, seed, t) {
    var i;
    shadow(x + 3, y + 8, 17, 6.5, 0.22);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(seed * 6.2832);
    // две кости крест-накрест
    for (i = 0; i < 2; i++) {
      R.ctx.save();
      R.ctx.rotate(i ? 0.5 : -0.5);
      rr(-17, -3.6, 34, 7.2, 3.6);
      R.ctx.fillStyle = '#ded9c6'; R.ctx.fill();
      rr(-16, -2.6, 32, 5.2, 2.6);
      R.ctx.fillStyle = '#f7f5ec'; R.ctx.fill();
      // головки на концах
      R.ctx.fillStyle = '#efebdc';
      R.ctx.beginPath(); R.ctx.arc(-16.5, -4, 4, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(-16.5, 4, 4, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(16.5, -4, 4, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.arc(16.5, 4, 4, 0, 6.2832); R.ctx.fill();
      if (R.scale > 0.68) {
        R.ctx.strokeStyle = 'rgba(140,130,105,0.45)'; R.ctx.lineWidth = 1;
        R.ctx.beginPath(); R.ctx.moveTo(-13, -1.4); R.ctx.lineTo(13, -1.4); R.ctx.stroke();
        R.ctx.beginPath(); R.ctx.moveTo(-13, 1.4); R.ctx.lineTo(13, 1.4); R.ctx.stroke();
      }
      R.ctx.restore();
    }
    // череп поверх костей
    R.ctx.fillStyle = '#b9b4a1';
    R.ctx.beginPath(); R.ctx.ellipse(0, 0.6, 8.8, 8.2, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f7f5ec';
    R.ctx.beginPath(); R.ctx.ellipse(-0.6, -0.4, 8, 7.4, 0, 0, 6.2832); R.ctx.fill();
    // морда-сужение
    R.ctx.fillStyle = '#efebdc';
    R.ctx.beginPath(); R.ctx.moveTo(-4.2, 3.6); R.ctx.lineTo(4.2, 3.6); R.ctx.lineTo(0, 10); R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#3a3a34';
    R.ctx.beginPath(); R.ctx.ellipse(-3.2, -1.6, 2.3, 2.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(3.2, -1.6, 2.3, 2.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(0, 3.6, 1.1, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(120,112,92,0.55)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.moveTo(0, -7.4); R.ctx.lineTo(0, -3.4); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(-6.6, -3); R.ctx.lineTo(-3.4, -2); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(6.6, -3); R.ctx.lineTo(3.4, -2); R.ctx.stroke();
    }
    R.ctx.restore();
  }

  function decorMushroom(x, y, seed, t) {
    var sway = Math.sin(t * 1.1 + seed * 8) * 0.5;
    var i;
    var dots = [[-8, -5, 3], [2, -9, 2.6], [8, 1, 2.8], [-4, 6, 2.4], [-11, 3, 2]];
    shadow(x + 3, y + 9, 16, 7, 0.24);
    // маленький грибок сзади
    shadow(x - 9.5, y - 1, 7, 3.2, 0.16);
    R.ctx.fillStyle = '#7a5230';
    R.ctx.beginPath(); R.ctx.arc(x - 9.5 + sway * 0.6, y - 3.6, 7, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#a9743f';
    R.ctx.beginPath(); R.ctx.arc(x - 10 + sway * 0.6, y - 4.2, 5.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#c08a4e';
    R.ctx.beginPath(); R.ctx.arc(x - 10.6 + sway * 0.6, y - 4.8, 3.4, 0, 6.2832); R.ctx.fill();
    // ножка большого гриба (виден только нижний край из-под шляпки)
    R.ctx.fillStyle = '#e8dfc9';
    rr(x - 4.5, y + 6, 9, 14, 4); R.ctx.fill();
    R.ctx.fillStyle = '#f7f2e8';
    rr(x - 3.4, y + 6, 6.8, 13, 3.4); R.ctx.fill();
    // шляпка
    R.ctx.fillStyle = '#a82f24';
    R.ctx.beginPath(); R.ctx.arc(x + 1 + sway, y - 1, 17, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#d2402f';
    R.ctx.beginPath(); R.ctx.arc(x + 0.2 + sway, y - 1.8, 15.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e8604c';
    R.ctx.beginPath(); R.ctx.arc(x - 1.6 + sway, y - 3.4, 13.2, 0, 6.2832); R.ctx.fill();
    // белые крапины
    R.ctx.fillStyle = '#f7f2e8';
    for (i = 0; i < dots.length; i++) {
      R.ctx.beginPath();
      R.ctx.ellipse(x + dots[i][0] + sway, y + dots[i][1] - 1, dots[i][2], dots[i][2] * 0.85, 0.3, 0, 6.2832);
      R.ctx.fill();
    }
    if (R.scale > 0.68) {
      // пластинки под шляпкой по нижнему краю
      R.ctx.strokeStyle = 'rgba(140,60,45,0.45)'; R.ctx.lineWidth = 1.1;
      for (i = 0; i < 6; i++) {
        R.ctx.beginPath();
        R.ctx.moveTo(x - 10 + i * 4 + sway, y + 13.4);
        R.ctx.lineTo(x - 12 + i * 4.8 + sway, y + 16.6);
        R.ctx.stroke();
      }
    }
  }

  function decorPalm(x, y, seed, t) {
    var rot = seed * 6.2832 + Math.sin(t * 0.7 + seed * 5) * 0.07;   // качание кроны
    var i, a, ex, ey, nx, ny;
    shadow(x + 4, y + 10, 19, 8, 0.24);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(rot);
    // листья-лопасти: узкие линзы от центра к краю
    for (i = 0; i < 7; i++) {
      a = i * (6.2832 / 7) + 0.25;
      ex = Math.cos(a) * 21; ey = Math.sin(a) * 19;
      nx = -Math.sin(a) * 6.4; ny = Math.cos(a) * 5.8;
      R.ctx.fillStyle = i % 2 ? '#2f7d43' : '#39934f';
      R.ctx.beginPath(); R.ctx.moveTo(0, 0);
      R.ctx.quadraticCurveTo(ex * 0.55 + nx, ey * 0.55 + ny, ex, ey);
      R.ctx.quadraticCurveTo(ex * 0.55 - nx, ey * 0.55 - ny, 0, 0);
      R.ctx.fill();
      if (R.scale > 0.68) {
        R.ctx.strokeStyle = 'rgba(20,70,35,0.35)'; R.ctx.lineWidth = 0.9;
        R.ctx.beginPath(); R.ctx.moveTo(0, 0); R.ctx.lineTo(ex * 0.92, ey * 0.92); R.ctx.stroke();
      }
    }
    // кокосы под листьями
    R.ctx.fillStyle = '#6b4a28';
    R.ctx.beginPath(); R.ctx.arc(-3.6, 3.4, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(4, -1.6, 3.2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#8b5f34';
    R.ctx.beginPath(); R.ctx.arc(-4.2, 2.8, 2.4, 0, 6.2832); R.ctx.fill();
    // верхушка ствола
    R.ctx.fillStyle = '#6b4a28';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 5.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#a9743f';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 4.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#c08a4e';
    R.ctx.beginPath(); R.ctx.arc(-1, -1, 2.4, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  function decorVine(x, y, seed, t) {
    var wob = Math.sin(t * 0.9 + seed * 8);
    var i, u, lx, ly, la, la2, len;
    var x0 = x - 15, y0 = y + 11, x1 = x + 14, y1 = y - 11;
    shadow(x + 2, y + 8, 17, 6, 0.20);
    // стебель-лиана тянется через клетку наискось
    R.ctx.strokeStyle = '#2f7a3e'; R.ctx.lineWidth = 4; R.ctx.lineCap = 'round';
    R.ctx.beginPath();
    R.ctx.moveTo(x0, y0);
    R.ctx.quadraticCurveTo(x - 4 + wob * 2, y + 6, x + 2, y - 2);
    R.ctx.quadraticCurveTo(x + 8, y - 8, x1, y1);
    R.ctx.stroke();
    R.ctx.strokeStyle = '#3d964e'; R.ctx.lineWidth = 1.8;
    R.ctx.beginPath();
    R.ctx.moveTo(x0, y0);
    R.ctx.quadraticCurveTo(x - 4 + wob * 2, y + 6, x + 2, y - 2);
    R.ctx.quadraticCurveTo(x + 8, y - 8, x1, y1);
    R.ctx.stroke();
    // листья вдоль стебля
    for (i = 0; i < 5; i++) {
      u = i / 4;
      lx = x0 + (x1 - x0) * u + Math.sin(u * 6 + seed * 5) * 5 + wob * (0.5 + u);
      ly = y0 + (y1 - y0) * u + Math.cos(u * 5 + seed * 3) * 4;
      la = -0.7 + u * 1.1 + wob * 0.1;
      len = i % 2 ? 7.4 : 6.2;
      R.ctx.save();
      R.ctx.translate(lx, ly);
      R.ctx.rotate(la);
      R.ctx.fillStyle = i % 2 ? '#3d964e' : '#57b465';
      R.ctx.beginPath(); R.ctx.moveTo(0, 0);
      R.ctx.quadraticCurveTo(len * 0.6, -4.2, len, 0);
      R.ctx.quadraticCurveTo(len * 0.6, 4.2, 0, 0);
      R.ctx.fill();
      if (R.scale > 0.68) {
        R.ctx.strokeStyle = 'rgba(20,60,25,0.45)'; R.ctx.lineWidth = 0.9;
        R.ctx.beginPath(); R.ctx.moveTo(0, 0); R.ctx.lineTo(len - 1, 0); R.ctx.stroke();
      }
      R.ctx.restore();
    }
    // усики-завитки и мелкий цветочек
    R.ctx.strokeStyle = '#57b465'; R.ctx.lineWidth = 1.6;
    R.ctx.beginPath(); R.ctx.arc(x + 11, y + 9, 3.6, 0.6, 4.6); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.arc(x - 12, y - 8, 3.2, 3.4, 7.4); R.ctx.stroke();
    la2 = Math.sin(t * 7 + seed * 3) * 6;
    R.ctx.fillStyle = '#f2d06b';
    R.ctx.beginPath(); R.ctx.arc(x + 5 + la2 * 0.1, y + 8, 2.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#fff0b8';
    R.ctx.beginPath(); R.ctx.arc(x + 4.6 + la2 * 0.1, y + 7.6, 1.4, 0, 6.2832); R.ctx.fill();
  }

  function decorTallgrass(x, y, seed, t) {
    var i, u, bx, sway, tipX, tipY;
    shadow(x + 2, y + 9, 15, 5, 0.18);
    // кочка-основание
    R.ctx.fillStyle = '#4a8a30';
    R.ctx.beginPath(); R.ctx.ellipse(x, y + 8, 15, 6.5, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5aa03c';
    R.ctx.beginPath(); R.ctx.ellipse(x, y + 7.4, 13.4, 5.4, 0, 0, 6.2832); R.ctx.fill();
    var n = 9;
    for (i = 0; i < n; i++) {
      u = i / (n - 1) - 0.5;
      sway = Math.sin(t * 1.3 + i * 0.7 + seed * 6) * 2.6;
      bx = x + u * 26;
      tipX = bx + u * 10 + sway;
      tipY = y - 12 - (1 - Math.abs(u) * 1.6) * 7.6;
      R.ctx.strokeStyle = i % 3 === 0 ? '#6fb84a' : (i % 3 === 1 ? '#5aa03c' : '#7fc95a');
      R.ctx.lineWidth = 2.6; R.ctx.lineCap = 'round';
      R.ctx.beginPath();
      R.ctx.moveTo(bx, y + 8);
      R.ctx.quadraticCurveTo(bx + u * 6 + sway * 0.4, y - 4, tipX, tipY);
      R.ctx.stroke();
    }
    if (R.scale > 0.68) {
      // колоски на верхушках
      R.ctx.fillStyle = '#c9d96a';
      for (i = 0; i < 3; i++) {
        u = (i - 1) * 0.32;
        sway = Math.sin(t * 1.3 + i * 1.9 + seed * 6) * 2.6;
        R.ctx.beginPath();
        R.ctx.ellipse(x + u * 26 + u * 10 + sway, y - 17 - (1 - Math.abs(u) * 1.6) * 7.6, 1.7, 3, u * 0.6, 0, 6.2832);
        R.ctx.fill();
      }
    }
  }

  function decorAcacia(x, y, seed, t) {
    var i;
    var sway = Math.sin(t * 0.8 + seed * 10) * 0.9;
    var blobs = [[-11, 2, 10.4, 8, '#2f7a35'], [11, 1, 10, 7.5, '#357f38'], [0, -6, 12.6, 9, '#3f8f42'],
      [-6, 6, 8.6, 6, '#2b6f30'], [6, 6, 8.2, 5.5, '#38863c'], [0, 3, 11.6, 8, '#43963f']];
    shadow(x + 4, y + 10, 17.5, 7.5, 0.24);
    // ствол-«ножка», виден из-под кроны
    R.ctx.fillStyle = '#6b4a28';
    R.ctx.beginPath(); R.ctx.arc(x, y + 6, 5, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#8b5f34';
    R.ctx.beginPath(); R.ctx.arc(x - 0.8, y + 5.4, 3.4, 0, 6.2832); R.ctx.fill();
    // плоская зонтичная крона — набор перекрывающихся овалов
    for (i = 0; i < blobs.length; i++) {
      R.ctx.fillStyle = blobs[i][4];
      R.ctx.beginPath();
      R.ctx.ellipse(x + blobs[i][0] + sway * (i % 2 ? 1 : -1), y + blobs[i][1], blobs[i][2], blobs[i][3], 0, 0, 6.2832);
      R.ctx.fill();
    }
    if (R.scale > 0.68) {
      // листва: мелкие тёмные точки и колючки
      R.ctx.fillStyle = 'rgba(20,60,25,0.28)';
      for (i = 0; i < 14; i++) {
        var a = i * 0.9 + seed * 5;
        var rad = 6 + (i % 4) * 3;
        R.ctx.beginPath();
        R.ctx.arc(x + Math.cos(a) * rad + sway, y + Math.sin(a) * rad * 0.75, 1.5, 0, 6.2832);
        R.ctx.fill();
      }
      R.ctx.fillStyle = 'rgba(255,255,255,0.16)';
      R.ctx.beginPath(); R.ctx.ellipse(x - 8, y - 7, 5, 3, -0.5, 0, 6.2832); R.ctx.fill();
    }
  }

  function decorBamboo(x, y, seed, t) {
    var i, k, a, aa, len;
    var base = (seed - 0.5) * 0.5;
    shadow(x + 3, y + 9, 18, 7, 0.22);
    // три бамбуковых ствола, чуть качаются
    for (i = 0; i < 3; i++) {
      a = base + (i - 1) * 0.28 + Math.sin(t * 1.1 + i * 1.7 + seed * 8) * 0.045;
      R.ctx.save();
      R.ctx.translate(x + (i - 1) * 9, y + 2);
      R.ctx.rotate(a);
      rr(-3.4, -17, 6.8, 32, 3.2);
      R.ctx.fillStyle = i === 1 ? '#8fbf4a' : (i === 0 ? '#7aab3c' : '#a3d05a');
      R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.18)';
      R.ctx.fillRect(-3.4, -17, 2.2, 32);
      // узлы-коленца
      R.ctx.fillStyle = '#5b7f2c';
      R.ctx.fillRect(-3.7, -8, 7.4, 1.8);
      R.ctx.fillRect(-3.7, 1, 7.4, 1.8);
      R.ctx.fillRect(-3.7, 10, 7.4, 1.8);
      // листья на верхушке
      for (k = 0; k < 2; k++) {
        aa = (k ? 1 : -1) * (0.55 + i * 0.12);
        len = 9 - i * 0.9;
        R.ctx.fillStyle = k ? '#6f9c38' : '#7fb045';
        R.ctx.beginPath();
        R.ctx.moveTo(0, -17);
        R.ctx.quadraticCurveTo(Math.sin(aa) * len * 0.7, -17 - len * 0.8, Math.sin(aa) * len, -17 - len * 0.25);
        R.ctx.quadraticCurveTo(Math.sin(aa) * len * 0.55, -17 + len * 0.2, 0, -15.4);
        R.ctx.fill();
      }
      R.ctx.restore();
    }
  }

  function decorBush(x, y, seed, t) {
    var i, bx, by;
    var sway = Math.sin(t * 1.0 + seed * 9) * 0.8;
    var lobes = [[-10, 1, 11, '#2f7a3a'], [10, 0, 10.5, '#358840'], [0, -8, 12, '#3f9c4c'],
      [-4, 7, 9.5, '#2b6f34'], [6, 6, 9, '#43964f'], [0, -1, 11, '#4aa858']];
    var berries = [[-8, -4], [3, -9], [10, 2], [-2, 8], [7, 9], [-11, 5]];
    shadow(x + 3, y + 9, 19, 8, 0.24);
    for (i = 0; i < lobes.length; i++) {
      R.ctx.fillStyle = lobes[i][3];
      R.ctx.beginPath(); R.ctx.arc(x + lobes[i][0] + sway, y + lobes[i][1], lobes[i][2], 0, 6.2832); R.ctx.fill();
    }
    // ягоды — главное отличие куста от обычного дерева
    for (i = 0; i < berries.length; i++) {
      bx = x + berries[i][0] + sway;
      by = y + berries[i][1];
      R.ctx.fillStyle = '#a8202a';
      R.ctx.beginPath(); R.ctx.arc(bx + 1, by + 1, 3.1, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = '#e04a4a';
      R.ctx.beginPath(); R.ctx.arc(bx, by, 3, 0, 6.2832); R.ctx.fill();
      if (R.scale > 0.68) {
        R.ctx.fillStyle = '#ffd0d0';
        R.ctx.beginPath(); R.ctx.arc(bx - 1, by - 1.1, 1.1, 0, 6.2832); R.ctx.fill();
      }
    }
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(255,255,255,0.22)'; R.ctx.lineWidth = 1.4;
      R.ctx.beginPath(); R.ctx.arc(x - 4 + sway, y - 9, 6, 3.4, 5.2); R.ctx.stroke();
    }
  }

  function decorSunflower(x, y, seed, t) {
    var i, a;
    var rot = seed * 6.2832 + t * 0.15;                     // медленно «ищет солнце»
    var sway = Math.sin(t * 1.2 + seed * 6) * 0.9;
    shadow(x + 3, y + 9, 17, 7, 0.24);
    R.ctx.save();
    R.ctx.translate(x + sway, y);
    R.ctx.rotate(rot);
    // листья под цветком
    R.ctx.fillStyle = '#3f8f3a';
    R.ctx.beginPath(); R.ctx.ellipse(0, -17.6, 6.4, 3.8, 0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(0, 17.6, 6.4, 3.8, -0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#4aa847';
    R.ctx.beginPath(); R.ctx.ellipse(-1, -18.2, 4.4, 2.4, 0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(1, 18.2, 4.4, 2.4, -0.5, 0, 6.2832); R.ctx.fill();
    // лепестки: 14 ланцетов по кругу
    for (i = 0; i < 14; i++) {
      a = i * (6.2832 / 14);
      R.ctx.save();
      R.ctx.rotate(a);
      R.ctx.fillStyle = i % 2 ? '#f0b429' : '#ffd75e';
      R.ctx.beginPath(); R.ctx.moveTo(0, -8.4);
      R.ctx.quadraticCurveTo(4, -14.2, 0, -19.4);
      R.ctx.quadraticCurveTo(-4, -14.2, 0, -8.4);
      R.ctx.fill();
      R.ctx.restore();
    }
    // серединка с семечками
    R.ctx.fillStyle = '#6b4526';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 9.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#8f6238';
    R.ctx.beginPath(); R.ctx.arc(-0.8, -0.8, 8.2, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.fillStyle = 'rgba(60,38,16,0.55)';
      for (i = 0; i < 16; i++) {
        a = i * 1.1;
        R.ctx.beginPath();
        R.ctx.arc(Math.cos(a) * (2 + (i % 3) * 2.4), Math.sin(a) * (2 + (i % 3) * 2.4), 1, 0, 6.2832);
        R.ctx.fill();
      }
      R.ctx.fillStyle = 'rgba(255,235,170,0.35)';
      R.ctx.beginPath(); R.ctx.arc(-3, -3.4, 3, 0, 6.2832); R.ctx.fill();
    }
    R.ctx.restore();
  }

  /* --- пляж и ферма --------------------------------------------------------- */

  function decorUmbrella(x, y, seed, t) {
    var i, a0, a1;
    var tilt = (seed - 0.5) * 0.5 + Math.sin(t * 0.6 + seed * 9) * 0.03;
    var pal = seed < 0.5 ? ['#e0574a', '#f7f2e8'] : ['#3f7fd0', '#f7f2e8'];
    shadow(x + 4, y + 10, 20, 8, 0.26);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(tilt);
    // восемь секторов купола
    for (i = 0; i < 8; i++) {
      a0 = i * (6.2832 / 8);
      a1 = a0 + 6.2832 / 8;
      R.ctx.fillStyle = i % 2 ? pal[1] : pal[0];
      R.ctx.beginPath(); R.ctx.moveTo(0, 0); R.ctx.arc(0, 0, 20, a0, a1); R.ctx.closePath(); R.ctx.fill();
    }
    // рёбра и обод
    R.ctx.strokeStyle = 'rgba(60,50,45,0.35)'; R.ctx.lineWidth = 1.2;
    for (i = 0; i < 8; i++) {
      a0 = i * (6.2832 / 8);
      R.ctx.beginPath(); R.ctx.moveTo(0, 0); R.ctx.lineTo(Math.cos(a0) * 20, Math.sin(a0) * 20); R.ctx.stroke();
    }
    R.ctx.strokeStyle = '#8f8a80'; R.ctx.lineWidth = 2;
    R.ctx.beginPath(); R.ctx.arc(0, 0, 20, 0, 6.2832); R.ctx.stroke();
    // верхушка
    R.ctx.fillStyle = '#5c6470';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 3.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#c9ced8';
    R.ctx.beginPath(); R.ctx.arc(-0.8, -0.8, 1.8, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // стойка, торчащая из-под купола
      R.ctx.strokeStyle = '#8f8a80'; R.ctx.lineWidth = 1.6;
      R.ctx.beginPath(); R.ctx.moveTo(0, 0); R.ctx.lineTo(0, 22); R.ctx.stroke();
    }
    R.ctx.restore();
  }

  function decorShell(x, y, seed, t) {
    var i, a;
    var rot = (seed - 0.5) * 0.7;
    shadow(x + 3, y + 8, 16, 6.5, 0.22);
    R.ctx.save();
    R.ctx.translate(x, y + 2);
    R.ctx.rotate(rot);
    // веер раковины раскрыт вверх
    R.ctx.fillStyle = '#d98a7c';
    R.ctx.beginPath();
    R.ctx.moveTo(0, 10);
    R.ctx.arc(0, 10, 19, Math.PI + 0.30, -0.30);
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#e8a99c';
    R.ctx.beginPath();
    R.ctx.moveTo(0, 10);
    R.ctx.arc(0, 10, 15, Math.PI + 0.34, -0.34);
    R.ctx.closePath(); R.ctx.fill();
    R.ctx.fillStyle = '#f5c8bf';
    R.ctx.beginPath();
    R.ctx.moveTo(0, 10);
    R.ctx.arc(0, 10, 10, Math.PI + 0.36, -0.36);
    R.ctx.closePath(); R.ctx.fill();
    // рёбра
    R.ctx.strokeStyle = 'rgba(190,120,105,0.55)'; R.ctx.lineWidth = 1.4;
    for (i = 0; i <= 6; i++) {
      a = Math.PI + 0.30 + (i / 6) * (Math.PI - 0.60);
      R.ctx.beginPath(); R.ctx.moveTo(0, 10); R.ctx.lineTo(Math.cos(a) * 18.4, 10 + Math.sin(a) * 18.4); R.ctx.stroke();
    }
    // замок-петля
    R.ctx.fillStyle = '#c9857a';
    rr(-5, 6, 10, 8, 3); R.ctx.fill();
    R.ctx.fillStyle = '#e8a99c';
    rr(-3.6, 7.4, 7.2, 5, 2.4); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.fillStyle = 'rgba(255,255,255,0.5)';
      R.ctx.beginPath(); R.ctx.ellipse(-6, -4, 3.4, 2.2, -0.7, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.55)';
      R.ctx.beginPath(); R.ctx.arc(1, 8, 1.2, 0, 6.2832); R.ctx.fill();
    }
    R.ctx.restore();
  }

  function decorHaystack(x, y, seed, t) {
    var i, a, a2;
    shadow(x + 3, y + 9, 18, 7.5, 0.24);
    // копна: три слоя от тёмного к светлому
    R.ctx.fillStyle = '#b8873a';
    R.ctx.beginPath(); R.ctx.arc(x, y + 1, 18, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#cfa146';
    R.ctx.beginPath(); R.ctx.arc(x - 0.8, y - 0.4, 16.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e0b657';
    R.ctx.beginPath(); R.ctx.arc(x - 1.8, y - 1.6, 13.6, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // солома: короткие штрихи по кругу и вихор на макушке
      R.ctx.strokeStyle = 'rgba(150,110,40,0.45)'; R.ctx.lineWidth = 1.2; R.ctx.lineCap = 'round';
      for (i = 0; i < 12; i++) {
        a = i * (6.2832 / 12) + seed * 3;
        R.ctx.beginPath();
        R.ctx.moveTo(x + Math.cos(a) * 6, y + Math.sin(a) * 6);
        R.ctx.lineTo(x + Math.cos(a) * 16.5, y + Math.sin(a) * 16.5 + 1.2);
        R.ctx.stroke();
      }
      R.ctx.strokeStyle = '#f0cf7a'; R.ctx.lineWidth = 1.4;
      for (i = 0; i < 5; i++) {
        a2 = i * 1.26 + seed * 6;
        R.ctx.beginPath();
        R.ctx.moveTo(x - 1, y - 2);
        R.ctx.quadraticCurveTo(x + Math.cos(a2) * 5, y - 6, x + Math.cos(a2) * 8, y - 9 - Math.sin(a2) * 2);
        R.ctx.stroke();
      }
    }
    // тёмная кромка снизу — «толщина» копны
    R.ctx.fillStyle = 'rgba(90,60,20,0.26)';
    R.ctx.beginPath(); R.ctx.ellipse(x, y + 12, 15, 5, 0, 0, 6.2832); R.ctx.fill();
  }

  function decorFence(x, y, seed, t) {
    var i, px;
    var rot = (seed - 0.5) * 0.16;
    shadow(x + 3, y + 7, 21, 6, 0.24);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(rot);
    // две перекладины (вид сверху — узкие доски)
    R.ctx.fillStyle = '#6f4520';
    R.ctx.fillRect(-20.5, -9, 41, 6.5);
    R.ctx.fillRect(-20.5, 2.5, 41, 6.5);
    R.ctx.fillStyle = '#a9743f';
    R.ctx.fillRect(-20.5, -8.4, 41, 4.4);
    R.ctx.fillRect(-20.5, 3.1, 41, 4.4);
    // столбики поперёк
    for (i = 0; i < 3; i++) {
      px = -19 + i * 19;
      R.ctx.fillStyle = '#5d3a1c';
      rr(px - 3.5, -12.4, 7, 24.8, 2); R.ctx.fill();
      R.ctx.fillStyle = '#c08a4e';
      rr(px - 2.6, -11.4, 5.2, 22.8, 2); R.ctx.fill();
      R.ctx.fillStyle = '#d9a869';
      rr(px - 2.6, -11.4, 2.2, 22.8, 1.1); R.ctx.fill();
      if (R.scale > 0.68) {
        R.ctx.fillStyle = '#5d3a1c';
        R.ctx.beginPath(); R.ctx.arc(px, -8, 1.1, 0, 6.2832); R.ctx.fill();
        R.ctx.beginPath(); R.ctx.arc(px, 8, 1.1, 0, 6.2832); R.ctx.fill();
      }
    }
    R.ctx.restore();
  }

  /* --- стройка и город ------------------------------------------------------ */

  function decorCrate(x, y, seed, t) {
    var i;
    var rot = (seed - 0.5) * 0.45;
    var nails = [[-13, -12], [13, -12], [-13, 12], [13, 12]];
    shadow(x + 3, y + 9, 18, 7.5, 0.26);
    R.ctx.save();
    R.ctx.translate(x, y + 1);
    R.ctx.rotate(rot);
    // корпус
    rr(-17, -16, 34, 32, 2.5);
    R.ctx.fillStyle = '#8b5a2b'; R.ctx.fill();
    rr(-16, -15, 32, 30, 2);
    R.ctx.fillStyle = '#b0793f'; R.ctx.fill();
    // доски
    R.ctx.fillStyle = '#a9743f';
    R.ctx.fillRect(-16, -15, 32, 9.4);
    R.ctx.fillRect(-16, -5.2, 32, 9.4);
    R.ctx.fillRect(-16, 4.6, 32, 9.4);
    R.ctx.fillStyle = 'rgba(60,36,14,0.28)';
    R.ctx.fillRect(-16, -6, 32, 1.2);
    R.ctx.fillRect(-16, 3.8, 32, 1.2);
    // диагональные укосины
    R.ctx.strokeStyle = '#8b5a2b'; R.ctx.lineWidth = 3.4;
    R.ctx.beginPath(); R.ctx.moveTo(-14, -13); R.ctx.lineTo(14, 13); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(14, -13); R.ctx.lineTo(-14, 13); R.ctx.stroke();
    R.ctx.strokeStyle = '#c08a4e'; R.ctx.lineWidth = 1.6;
    R.ctx.beginPath(); R.ctx.moveTo(-14, -13.6); R.ctx.lineTo(14, 12.4); R.ctx.stroke();
    // рамка и гвозди
    R.ctx.strokeStyle = '#6f4520'; R.ctx.lineWidth = 2;
    rr(-16.5, -15.5, 33, 31, 2); R.ctx.stroke();
    if (R.scale > 0.68) {
      R.ctx.fillStyle = '#5c6470';
      for (i = 0; i < 4; i++) {
        R.ctx.beginPath(); R.ctx.arc(nails[i][0], nails[i][1], 1.2, 0, 6.2832); R.ctx.fill();
      }
      // светлая кромка — объём
      R.ctx.fillStyle = 'rgba(255,255,255,0.16)';
      R.ctx.fillRect(-16, -15, 32, 2.4);
    }
    R.ctx.restore();
  }

  function decorCone(x, y, seed, t) {
    var rot = (seed - 0.5) * 0.9;
    var wob = Math.sin(t * 1.5 + seed * 7) * 0.3;
    shadow(x + 3, y + 6, 17, 7, 0.28);
    R.ctx.save();
    R.ctx.translate(x + wob, y);
    R.ctx.rotate(rot);
    // квадратное основание конуса
    rr(-16, -16, 32, 32, 4);
    R.ctx.fillStyle = '#a83c14'; R.ctx.fill();
    rr(-14.6, -14.6, 29.2, 29.2, 3.4);
    R.ctx.fillStyle = '#e06a22'; R.ctx.fill();
    // кольца воронки к вершине
    R.ctx.fillStyle = '#c2551f';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 12, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f7f2e8';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 9, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e8802f';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f7f2e8';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 2.8, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(80,40,10,0.35)'; R.ctx.lineWidth = 1.2;
      R.ctx.beginPath(); R.ctx.arc(0, 0, 12, 0, 6.2832); R.ctx.stroke();
      // затёртые углы основания
      R.ctx.fillStyle = 'rgba(255,255,255,0.20)';
      R.ctx.beginPath(); R.ctx.ellipse(-9.6, -10.6, 4, 2.2, 0.6, 0, 6.2832); R.ctx.fill();
    }
    R.ctx.restore();
  }

  function decorPipe(x, y, seed, t) {
    shadow(x + 4, y + 9, 19, 7.5, 0.24);
    // малая труба сзади
    R.ctx.fillStyle = '#7c828c';
    R.ctx.beginPath(); R.ctx.arc(x - 8, y - 8, 8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#b9bec6';
    R.ctx.beginPath(); R.ctx.arc(x - 8, y - 8.6, 6.8, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#4a5058';
    R.ctx.beginPath(); R.ctx.arc(x - 8, y - 8, 4.2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#33383f';
    R.ctx.beginPath(); R.ctx.arc(x - 8.4, y - 7.6, 3.4, 0, 6.2832); R.ctx.fill();
    // большая бетонная труба: кольцо с тёмным отверстием
    R.ctx.fillStyle = '#6f757f';
    R.ctx.beginPath(); R.ctx.arc(x + 3, y + 4.6, 16.5, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#b9bec6';
    R.ctx.beginPath(); R.ctx.arc(x + 3, y + 3, 15.2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#cfd3d9';
    R.ctx.beginPath(); R.ctx.arc(x + 3, y + 3, 12.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#4a5058';
    R.ctx.beginPath(); R.ctx.arc(x + 3, y + 3, 9.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#33383f';
    R.ctx.beginPath(); R.ctx.arc(x + 2.4, y + 4, 8.4, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // сколы и потёки бетона
      R.ctx.strokeStyle = 'rgba(90,96,104,0.5)'; R.ctx.lineWidth = 1.1;
      R.ctx.beginPath(); R.ctx.arc(x + 3, y + 3, 14, 2.2, 4.4); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(255,255,255,0.28)';
      R.ctx.beginPath(); R.ctx.ellipse(x - 3, y - 5, 3.6, 2, -0.6, 0, 6.2832); R.ctx.fill();
    }
  }

  function decorBench(x, y, seed, t) {
    var i;
    var rot = (seed - 0.5) * 0.14;
    shadow(x + 3, y + 8, 21, 6.5, 0.24);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(rot);
    // сиденье: четыре доски
    for (i = 0; i < 4; i++) {
      R.ctx.fillStyle = i % 2 ? '#a9743f' : '#b8834a';
      rr(-19, -6 + i * 3.6, 38, 3.2, 1.2); R.ctx.fill();
    }
    // спинка — полоса по дальнему краю
    R.ctx.fillStyle = '#8b5a2b';
    rr(-19, -14, 38, 6, 1.6); R.ctx.fill();
    R.ctx.fillStyle = '#c08a4e';
    rr(-19, -13.4, 38, 4.4, 1.2); R.ctx.fill();
    // металлические боковины-ножки
    R.ctx.fillStyle = '#3f6b4a';
    rr(-21, -15, 3.8, 22, 1.4); R.ctx.fill();
    rr(17.2, -15, 3.8, 22, 1.4); R.ctx.fill();
    R.ctx.fillStyle = '#4f8059';
    rr(-20.5, -15, 2.2, 22, 1.1); R.ctx.fill();
    rr(17.7, -15, 2.2, 22, 1.1); R.ctx.fill();
    if (R.scale > 0.68) {
      // щели между досками
      R.ctx.strokeStyle = 'rgba(60,36,14,0.35)'; R.ctx.lineWidth = 0.9;
      for (i = 1; i < 4; i++) {
        R.ctx.beginPath(); R.ctx.moveTo(-18, -6.4 + i * 3.6); R.ctx.lineTo(18, -6.4 + i * 3.6); R.ctx.stroke();
      }
    }
    R.ctx.restore();
  }

  function decorTrashbin(x, y, seed, t) {
    var i, a0;
    var wob = Math.sin(t * 2.2 + seed * 9) * 0.5;   // бак чуть покачивается на ветру
    shadow(x + 3, y + 8, 17, 7, 0.26);
    R.ctx.save();
    R.ctx.translate(x + wob, y);
    // корпус бака
    R.ctx.fillStyle = '#2f4a35';
    R.ctx.beginPath(); R.ctx.arc(0, 1.4, 17, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#3d5440';
    R.ctx.beginPath(); R.ctx.arc(0, 0.4, 15.6, 0, 6.2832); R.ctx.fill();
    // крышка с секторами
    R.ctx.fillStyle = '#4f6b52';
    R.ctx.beginPath(); R.ctx.arc(0, -0.4, 14, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5d7c61';
    R.ctx.beginPath(); R.ctx.arc(0, -1, 12.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#436048';
    for (i = 0; i < 6; i++) {
      a0 = i * (6.2832 / 6) + 0.3;
      R.ctx.beginPath(); R.ctx.moveTo(0, -1); R.ctx.arc(0, -1, 12.4, a0, a0 + 0.22); R.ctx.closePath(); R.ctx.fill();
    }
    // ручка
    R.ctx.fillStyle = '#8b929c';
    rr(-5.5, -3.2, 11, 4.4, 2.2); R.ctx.fill();
    R.ctx.fillStyle = '#b9bec6';
    rr(-4.4, -2.6, 8.8, 2, 1); R.ctx.fill();
    // пакет, вылезающий из-под крышки
    R.ctx.fillStyle = '#c9ced8';
    R.ctx.beginPath(); R.ctx.ellipse(9, 9.4, 6.2, 4.8, 0.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f2f5fa';
    R.ctx.beginPath(); R.ctx.ellipse(9.4, 8.6, 4.8, 3.4, 0.6, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(255,255,255,0.22)'; R.ctx.lineWidth = 1.4;
      R.ctx.beginPath(); R.ctx.arc(0, -1, 11, 3.4, 5.2); R.ctx.stroke();
    }
    R.ctx.restore();
  }

  function decorNeonSign(x, y, seed, t) {
    var flick = 0.55 + 0.45 * Math.abs(Math.sin(t * 3.1 + seed * 12));
    if (Math.sin(t * 19 + seed * 30) > 0.86) { flick *= 0.35; }   // случайные «моргания»
    var cyan = seed < 0.5;
    var rgb = cyan ? '90,240,255' : '255,90,190';
    var tube = cyan ? '#22c1c3' : '#e0459b';
    shadow(x + 3, y + 8, 17, 7, 0.26);
    // тёмная плита
    rr(x - 17, y - 15, 34, 30, 4);
    R.ctx.fillStyle = '#20242e'; R.ctx.fill();
    rr(x - 15.4, y - 13.4, 30.8, 26.8, 3);
    R.ctx.fillStyle = '#2b3038'; R.ctx.fill();
    // свечение: три кольца с малой альфой
    R.ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.16 * flick).toFixed(2) + ')';
    R.ctx.lineWidth = 9;
    R.ctx.beginPath(); R.ctx.arc(x, y - 1, 8, 0, 6.2832); R.ctx.stroke();
    R.ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.30 * flick).toFixed(2) + ')';
    R.ctx.lineWidth = 5;
    R.ctx.beginPath(); R.ctx.arc(x, y - 1, 8, 0, 6.2832); R.ctx.stroke();
    R.ctx.strokeStyle = 'rgba(' + rgb + ',' + (0.55 * flick).toFixed(2) + ')';
    R.ctx.lineWidth = 2;
    R.ctx.beginPath(); R.ctx.arc(x, y - 1, 8, 0, 6.2832); R.ctx.stroke();
    // сама неоновая трубка
    R.ctx.strokeStyle = tube; R.ctx.lineWidth = 2.6; R.ctx.lineCap = 'round';
    R.ctx.beginPath(); R.ctx.arc(x, y - 1, 8, 0, 6.2832); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(x - 4.4, y - 1); R.ctx.lineTo(x + 4.4, y - 1); R.ctx.stroke();
    R.ctx.fillStyle = 'rgba(255,255,255,' + (0.85 * flick).toFixed(2) + ')';
    R.ctx.beginPath(); R.ctx.arc(x - 8, y - 1, 1.5, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // стойка и блик на стекле
      R.ctx.fillStyle = '#8b929c';
      rr(x - 2, y + 14, 4, 5, 1.4); R.ctx.fill();
      R.ctx.fillStyle = 'rgba(255,255,255,0.10)';
      R.ctx.fillRect(x - 15.4, y - 13.4, 30.8, 3);
    }
  }

  function decorAntenna(x, y, seed, t) {
    var i, a, b, ab;
    var mast = Math.sin(t * 1.7 + seed * 10) * 0.9;    // мачта слегка гуляет
    var on = Math.sin(t * 2.6 + seed * 6) > -0.2;      // маячок мигает
    shadow(x + 3, y + 8, 16, 6.5, 0.24);
    // оттяжки с анкерами
    R.ctx.strokeStyle = '#6f767f'; R.ctx.lineWidth = 1.4;
    for (i = 0; i < 3; i++) {
      a = seed * 6.2832 + i * 2.0944;
      R.ctx.beginPath(); R.ctx.moveTo(x + mast * 0.4, y);
      R.ctx.lineTo(x + Math.cos(a) * 20, y + Math.sin(a) * 18); R.ctx.stroke();
      R.ctx.fillStyle = '#5c6470';
      R.ctx.beginPath(); R.ctx.arc(x + Math.cos(a) * 20, y + Math.sin(a) * 18, 2.4, 0, 6.2832); R.ctx.fill();
    }
    // бетонная плита-основание
    R.ctx.fillStyle = '#8b929c';
    R.ctx.beginPath(); R.ctx.arc(x, y, 12.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#a9aeb6';
    R.ctx.beginPath(); R.ctx.arc(x - 0.6, y - 0.8, 11.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#c1c6cd';
    R.ctx.beginPath(); R.ctx.arc(x - 1.4, y - 1.6, 9, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.fillStyle = '#6f767f';
      for (b = 0; b < 4; b++) {
        ab = b * 1.5708 + 0.78;
        R.ctx.beginPath(); R.ctx.arc(x + Math.cos(ab) * 9.6, y + Math.sin(ab) * 9.6, 1.3, 0, 6.2832); R.ctx.fill();
      }
    }
    // верхушка мачты: короб с маячком
    R.ctx.save();
    R.ctx.translate(x + mast, y - 1);
    R.ctx.fillStyle = '#5c6470';
    rr(-5.4, -4.4, 10.8, 7.4, 2.4); R.ctx.fill();
    R.ctx.fillStyle = '#9aa0aa';
    rr(-4.6, -3.6, 9.2, 5.8, 1.8); R.ctx.fill();
    R.ctx.fillStyle = '#c1c6cd';
    rr(-4.6, -3.6, 9.2, 1.8, 0.9); R.ctx.fill();
    R.ctx.fillStyle = on ? 'rgba(255,70,60,0.35)' : 'rgba(120,30,30,0.22)';
    R.ctx.beginPath(); R.ctx.arc(0, -1, 5.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = on ? '#ff4b3e' : '#7a2320';
    R.ctx.beginPath(); R.ctx.arc(0, -1, 3, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68 && on) {
      R.ctx.fillStyle = '#ffd0cc';
      R.ctx.beginPath(); R.ctx.arc(-0.8, -1.8, 1.1, 0, 6.2832); R.ctx.fill();
    }
    R.ctx.restore();
  }

  function decorCrater(x, y, seed, t) {
    var i, a;
    var rocks = [[-16, -9, 2.4], [13, -12, 2], [16, 7, 2.6], [-12, 12, 2.2], [4, 17, 1.8]];
    shadow(x + 3, y + 7, 19, 8, 0.22);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(seed * 6.2832);
    // вал выброшенной земли
    R.ctx.fillStyle = '#6f625a';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 20, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5d5148';
    R.ctx.beginPath(); R.ctx.arc(-0.6, 0.8, 18, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#7d6d61';
    R.ctx.beginPath(); R.ctx.arc(-1.2, -0.6, 16, 0, 6.2832); R.ctx.fill();
    // воронка
    R.ctx.fillStyle = '#4a4038';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 13, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#332b25';
    R.ctx.beginPath(); R.ctx.arc(-0.4, 0.4, 10, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#241d18';
    R.ctx.beginPath(); R.ctx.arc(0, 0, 7, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // трещины-лучи и мелкие камешки по краю
      R.ctx.strokeStyle = 'rgba(40,32,26,0.5)'; R.ctx.lineWidth = 1.2;
      for (i = 0; i < 6; i++) {
        a = i * 1.0472 + seed * 2;
        R.ctx.beginPath();
        R.ctx.moveTo(Math.cos(a) * 8, Math.sin(a) * 8);
        R.ctx.lineTo(Math.cos(a) * 18.4, Math.sin(a) * 18.4);
        R.ctx.stroke();
      }
      R.ctx.fillStyle = '#8b7b6c';
      for (i = 0; i < rocks.length; i++) {
        R.ctx.beginPath(); R.ctx.arc(rocks[i][0], rocks[i][1], rocks[i][2], 0, 6.2832); R.ctx.fill();
      }
    }
    R.ctx.restore();
  }

  /* --- прочее --------------------------------------------------------------- */

  function decorBalloon(x, y, seed, t) {
    var sway = Math.sin(t * 1.15 + seed * 7) * 3;      // шарик качается на верёвочке
    var lift = Math.sin(t * 1.6 + seed * 5) * 1.4;
    var pal = seed < 0.33 ? ['#a92f3a', '#d2404f', '#f2707c']
      : (seed < 0.66 ? ['#2b4a9c', '#3d63c4', '#7e9ce8'] : ['#2f7042', '#3f9c55', '#7fd18f']);
    var bx = x + sway, by = y - 4 + lift;
    // тень лежит на земле, верёвочка идёт к колышку
    shadow(x + sway * 0.5, y + 17, 8, 3.5, 0.22);
    R.ctx.strokeStyle = 'rgba(240,240,240,0.75)'; R.ctx.lineWidth = 1.2;
    R.ctx.beginPath();
    R.ctx.moveTo(bx, by + 13);
    R.ctx.quadraticCurveTo(bx + sway * 0.8, y + 4, x, y + 15);
    R.ctx.stroke();
    R.ctx.fillStyle = '#8b5a2b';
    rr(x - 1.6, y + 14, 3.2, 6, 1.4); R.ctx.fill();
    // тело шарика (вид сверху — овал с бликом)
    R.ctx.fillStyle = pal[0];
    R.ctx.beginPath(); R.ctx.ellipse(bx, by + 1.6, 11.4, 13.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = pal[1];
    R.ctx.beginPath(); R.ctx.ellipse(bx, by, 11, 13, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = pal[2];
    R.ctx.beginPath(); R.ctx.ellipse(bx - 2.2, by - 2.2, 8.4, 10, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,255,255,0.55)';
    R.ctx.beginPath(); R.ctx.ellipse(bx - 4.4, by - 5.4, 2.6, 3.8, -0.4, 0, 6.2832); R.ctx.fill();
    // узелок
    R.ctx.fillStyle = pal[0];
    R.ctx.beginPath();
    R.ctx.moveTo(bx - 2.6, by + 12); R.ctx.lineTo(bx + 2.6, by + 12); R.ctx.lineTo(bx, by + 16.4);
    R.ctx.closePath(); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(255,255,255,0.30)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.ellipse(bx + 4.6, by + 3.4, 4.4, 6, 0.35, 0, 6.2832); R.ctx.stroke();
    }
  }

  function decorSamovar(x, y, seed, t) {
    var i, a, k, p, pr, pa;
    shadow(x + 3, y + 8, 16, 7, 0.26);
    // корпус: три слоя меди
    R.ctx.fillStyle = '#8f6218';
    R.ctx.beginPath(); R.ctx.arc(x, y + 1.4, 16, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#c8862c';
    R.ctx.beginPath(); R.ctx.arc(x, y, 15.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e0a33c';
    R.ctx.beginPath(); R.ctx.arc(x - 0.6, y - 0.6, 13.6, 0, 6.2832); R.ctx.fill();
    // «ушки»-ручки по бокам
    R.ctx.strokeStyle = '#8f6218'; R.ctx.lineWidth = 3;
    for (i = 0; i < 4; i++) {
      a = i * 1.5708 + 0.7854;
      R.ctx.beginPath(); R.ctx.arc(x + Math.cos(a) * 13, y + Math.sin(a) * 13, 3.4, 0, 6.2832); R.ctx.stroke();
    }
    // крышка с конфоркой
    R.ctx.fillStyle = '#a86a1e';
    R.ctx.beginPath(); R.ctx.arc(x, y - 0.6, 7.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#d9a044';
    R.ctx.beginPath(); R.ctx.arc(x - 0.4, y - 1.2, 6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#8f6218';
    R.ctx.beginPath(); R.ctx.arc(x, y - 1, 2.6, 0, 6.2832); R.ctx.fill();
    // краник снизу
    R.ctx.fillStyle = '#8f6218';
    rr(x - 2.4, y + 12, 4.8, 7, 1.6); R.ctx.fill();
    // пар: три облачка, всплывающие по кругу
    for (k = 0; k < 3; k++) {
      p = (t * 0.42 + k / 3 + seed * 0.3) % 1;
      pr = 2.4 + p * 5.4;
      pa = (1 - p) * 0.42;
      R.ctx.fillStyle = 'rgba(255,255,255,' + pa.toFixed(2) + ')';
      R.ctx.beginPath();
      R.ctx.arc(x + Math.sin(p * 6 + k) * 5, y - 5 - p * 11, pr, 0, 6.2832);
      R.ctx.fill();
    }
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(120,70,10,0.35)'; R.ctx.lineWidth = 1.1;
      R.ctx.beginPath(); R.ctx.arc(x, y, 11, 2.6, 4.8); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.arc(x, y, 6.4, 3.2, 5.4); R.ctx.stroke();
      R.ctx.fillStyle = 'rgba(255,225,160,0.35)';
      R.ctx.beginPath(); R.ctx.ellipse(x - 5, y - 6, 4.4, 2.6, -0.6, 0, 6.2832); R.ctx.fill();
    }
  }

  function decorMatryoshka(x, y, seed, t) {
    var i, a;
    var lean = Math.sin(t * 1.3 + seed * 8) * 0.05;    // чуть покачивается
    shadow(x + 3, y + 9, 15, 7, 0.26);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(lean);
    // тёмная «изнанка» для объёма
    R.ctx.fillStyle = '#9c2f2f';
    R.ctx.beginPath(); R.ctx.ellipse(1.8, 2.6, 16.5, 18.5, 0, 0, 6.2832); R.ctx.fill();
    // платок
    R.ctx.fillStyle = '#c0392b';
    R.ctx.beginPath(); R.ctx.ellipse(0, 1, 16.5, 18.5, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#d94f4f';
    R.ctx.beginPath(); R.ctx.ellipse(-0.8, 0, 14.8, 17.2, 0, 0, 6.2832); R.ctx.fill();
    // лицо
    R.ctx.fillStyle = '#f7e6cf';
    R.ctx.beginPath(); R.ctx.ellipse(0, -5.4, 8.6, 9, 0, 0, 6.2832); R.ctx.fill();
    // верх платка
    R.ctx.fillStyle = '#c0392b';
    R.ctx.beginPath(); R.ctx.ellipse(0, -11.6, 8.8, 5.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#d94f4f';
    R.ctx.beginPath(); R.ctx.ellipse(-0.4, -12.2, 6.8, 4, 0, 0, 6.2832); R.ctx.fill();
    // цветочек на «фартуке»
    R.ctx.fillStyle = '#e8b84b';
    for (i = 0; i < 5; i++) {
      a = i * 1.2566;
      R.ctx.beginPath(); R.ctx.arc(-1 + Math.cos(a) * 3.4, 7 + Math.sin(a) * 3.4, 2.2, 0, 6.2832); R.ctx.fill();
    }
    R.ctx.fillStyle = '#c0392b';
    R.ctx.beginPath(); R.ctx.arc(-1, 7, 1.8, 0, 6.2832); R.ctx.fill();
    // лицо: глаза, румяна, рот
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.arc(-3.2, -6, 1.3, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(3.2, -6, 1.3, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(230,120,120,0.6)';
    R.ctx.beginPath(); R.ctx.arc(-5.8, -2.6, 2, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(5.8, -2.6, 2, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#a84040';
    R.ctx.beginPath(); R.ctx.ellipse(0, -1.4, 1.6, 1, 0, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // мелкий узор по краю платка
      R.ctx.fillStyle = 'rgba(255,236,220,0.65)';
      for (i = 0; i < 8; i++) {
        a = 0.6 + i * 0.72;
        R.ctx.beginPath();
        R.ctx.arc(Math.cos(a) * 12.4, 4 + Math.sin(a) * 7.4, 1.1, 0, 6.2832);
        R.ctx.fill();
      }
    }
    R.ctx.restore();
  }

  function decorLantern(x, y, seed, t) {
    // фонарик мерцает: плавное «дыхание» пламени плюс редкие вспышки
    var flick = 0.62 + 0.38 * Math.abs(Math.sin(t * 2.4 + seed * 11));
    if (Math.sin(t * 13 + seed * 40) > 0.9) { flick *= 0.55; }
    var sway = Math.sin(t * 1.5 + seed * 6) * 1.4;      // качается на столбе
    shadow(x + 3, y + 8, 14, 6.5, 0.26);
    // столб и перекладина
    R.ctx.fillStyle = '#3a4048';
    R.ctx.beginPath(); R.ctx.arc(x, y + 3, 6.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5c6470';
    R.ctx.beginPath(); R.ctx.arc(x, y + 3, 5.2, 0, 6.2832); R.ctx.fill();
    R.ctx.strokeStyle = '#8b929c'; R.ctx.lineWidth = 2.2; R.ctx.lineCap = 'round';
    R.ctx.beginPath(); R.ctx.moveTo(x, y + 2); R.ctx.lineTo(x + sway * 0.6, y - 6); R.ctx.stroke();
    // корпус фонаря (вид сверху — «шапка» с рёбрами и светящимся стеклом)
    var lx = x + sway, ly = y - 8;
    // ореол света
    R.ctx.fillStyle = 'rgba(255,214,120,' + (0.22 * flick).toFixed(2) + ')';
    R.ctx.beginPath(); R.ctx.arc(lx, ly, 15, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,226,150,' + (0.30 * flick).toFixed(2) + ')';
    R.ctx.beginPath(); R.ctx.arc(lx, ly, 11.4, 0, 6.2832); R.ctx.fill();
    // крыша
    R.ctx.fillStyle = '#2b3038';
    R.ctx.beginPath(); R.ctx.arc(lx, ly, 10.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#3a4048';
    R.ctx.beginPath(); R.ctx.arc(lx, ly - 0.6, 9.2, 0, 6.2832); R.ctx.fill();
    // стекло
    R.ctx.fillStyle = 'rgba(255,226,150,' + (0.55 + 0.45 * flick).toFixed(2) + ')';
    R.ctx.beginPath(); R.ctx.arc(lx, ly, 6.6, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = 'rgba(255,247,214,' + (0.55 + 0.45 * flick).toFixed(2) + ')';
    R.ctx.beginPath(); R.ctx.arc(lx - 0.6, ly - 0.6, 4.2, 0, 6.2832); R.ctx.fill();
    // рёбра-прутья решётки
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(43,48,56,0.75)'; R.ctx.lineWidth = 1.2;
      for (var i = 0; i < 4; i++) {
        var a = i * 1.5708 + 0.7854;
        R.ctx.beginPath();
        R.ctx.moveTo(lx + Math.cos(a) * 6.6, ly + Math.sin(a) * 6.6);
        R.ctx.lineTo(lx + Math.cos(a) * 10.4, ly + Math.sin(a) * 10.4);
        R.ctx.stroke();
      }
      R.ctx.fillStyle = '#8b929c';
      R.ctx.beginPath(); R.ctx.arc(lx, ly, 1.8, 0, 6.2832); R.ctx.fill();
    }
  }

  /* --- животные (чистая декорация: чуть шевелятся от t, логику не трогают) --- */

  function decorPanda(x, y, seed, t) {
    var bob = Math.sin(t * 0.9 + seed * 6) * 0.7;
    var rot = (seed - 0.5) * 0.5;
    shadow(x + 3, y + 10, 18, 8, 0.26);
    R.ctx.save();
    R.ctx.translate(x, y + bob);
    R.ctx.rotate(rot);
    // лапы и хвост (видны из-под туловища)
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.ellipse(-13, 6, 5.4, 4.2, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(13, 6, 5.4, 4.2, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(-10, -9, 4.6, 5.4, 0.3, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(10, -9, 4.6, 5.4, -0.3, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(0, 13, 4, 0, 6.2832); R.ctx.fill();
    // туловище
    R.ctx.fillStyle = '#c9ced8';
    R.ctx.beginPath(); R.ctx.ellipse(0, 2, 15.6, 13.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f7f9fc';
    R.ctx.beginPath(); R.ctx.ellipse(-0.8, 1, 14.2, 12.2, 0, 0, 6.2832); R.ctx.fill();
    // чёрная «накидка» через плечи
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.ellipse(0, -3, 15.4, 5.2, 0, 0, 6.2832); R.ctx.fill();
    // уши
    R.ctx.beginPath(); R.ctx.arc(-7.6, -19.4, 4.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(7.6, -19.4, 4.4, 0, 6.2832); R.ctx.fill();
    // голова
    R.ctx.fillStyle = '#f7f9fc';
    R.ctx.beginPath(); R.ctx.ellipse(0, -13.4, 9.8, 9.2, 0, 0, 6.2832); R.ctx.fill();
    // глазные пятна и глаза
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.ellipse(-3.8, -14.4, 2.8, 3.4, 0.35, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(3.8, -14.4, 2.8, 3.4, -0.35, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f7f9fc';
    R.ctx.beginPath(); R.ctx.arc(-4.2, -14.8, 1.2, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(3.4, -14.8, 1.2, 0, 6.2832); R.ctx.fill();
    // нос и мордочка
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.ellipse(0, -9.6, 2, 1.4, 0, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.strokeStyle = 'rgba(40,45,55,0.6)'; R.ctx.lineWidth = 1;
      R.ctx.beginPath(); R.ctx.arc(0, -8.6, 3, 0.4, 2.6); R.ctx.stroke();
    }
    R.ctx.restore();
  }

  function decorGiraffe(x, y, seed, t) {
    var i;
    var step = Math.sin(t * 3.2 + seed * 5);           // переступает ногами на месте
    var lo;
    var legs = [[-10, -7], [10, -7], [-10, 8], [10, 8]];
    var spots = [[-4, -6, 3.4], [5, -2, 3], [-2, 3, 3.6], [5, 8, 2.8], [-6, 7, 2.6], [1, -1, 2.4]];
    shadow(x + 4, y + 10, 17, 13, 0.24);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(seed * 6.2832);
    // ноги-копытца
    R.ctx.fillStyle = '#b98c37';
    for (i = 0; i < 4; i++) {
      lo = (i % 2 ? step : -step) * 1.6;
      rr(legs[i][0] - 3, legs[i][1] - 3.5 + lo, 6, 7.5, 2.6); R.ctx.fill();
    }
    R.ctx.fillStyle = '#8f6a2c';
    for (i = 0; i < 4; i++) {
      lo = (i % 2 ? step : -step) * 1.6;
      rr(legs[i][0] - 2.4, legs[i][1] + 1.2 + lo, 4.8, 2.8, 1.4); R.ctx.fill();
    }
    // хвост с кисточкой
    R.ctx.strokeStyle = '#b98c37'; R.ctx.lineWidth = 2;
    R.ctx.beginPath(); R.ctx.moveTo(0, 11); R.ctx.quadraticCurveTo(step * 2, 15, -3, 16); R.ctx.stroke();
    R.ctx.fillStyle = '#5d4517';
    R.ctx.beginPath(); R.ctx.arc(-3.4, 16.4, 2.4, 0, 6.2832); R.ctx.fill();
    // туловище
    R.ctx.fillStyle = '#c99a3c';
    R.ctx.beginPath(); R.ctx.ellipse(0, -1, 11.6, 13, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e0b45e';
    R.ctx.beginPath(); R.ctx.ellipse(-0.8, -2, 10.2, 11.4, 0, 0, 6.2832); R.ctx.fill();
    // пятна
    R.ctx.fillStyle = '#a3762c';
    for (i = 0; i < spots.length; i++) {
      R.ctx.beginPath();
      R.ctx.ellipse(spots[i][0], spots[i][1], spots[i][2], spots[i][2] * 0.8, 0.4, 0, 6.2832);
      R.ctx.fill();
    }
    // шея с гривой
    R.ctx.fillStyle = '#d9a94c';
    rr(-4.4, -18, 8.8, 11, 4); R.ctx.fill();
    R.ctx.fillStyle = '#c99a3c';
    rr(-4.4, -18, 3.2, 11, 1.6); R.ctx.fill();
    if (R.scale > 0.68) {
      R.ctx.fillStyle = '#8f6a2c';
      for (i = 0; i < 3; i++) {
        R.ctx.beginPath(); R.ctx.arc(-3.6, -16 + i * 3.4, 1.5, 0, 6.2832); R.ctx.fill();
      }
    }
    // голова
    R.ctx.fillStyle = '#e0b45e';
    R.ctx.beginPath(); R.ctx.ellipse(0, -20, 5.6, 6.2, 0, 0, 6.2832); R.ctx.fill();
    // ушки и рожки
    R.ctx.fillStyle = '#b98c37';
    R.ctx.beginPath(); R.ctx.ellipse(-6, -22.2, 3, 2, -0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(6, -22.2, 3, 2, 0.5, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5d4517';
    R.ctx.beginPath(); R.ctx.arc(-2.4, -24.6, 1.7, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(2.4, -24.6, 1.7, 0, 6.2832); R.ctx.fill();
    // морда
    R.ctx.fillStyle = '#f0d9a8';
    R.ctx.beginPath(); R.ctx.ellipse(0, -22.6, 3.2, 2.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#5d4517';
    R.ctx.beginPath(); R.ctx.arc(0, -24.4, 1.1, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  function decorCrab(x, y, seed, t) {
    var i, s;
    var scuttle = Math.sin(t * 6 + seed * 4);            // сучит лапками
    var drift = Math.sin(t * 1.6 + seed * 9) * 0.6;      // чуть подползает
    var pinch = 0.2 + Math.abs(scuttle) * 0.25;
    shadow(x + 3, y + 8, 17, 7, 0.26);
    R.ctx.save();
    R.ctx.translate(x + drift, y);
    R.ctx.rotate(seed * 6.2832);
    // лапки: три пары
    R.ctx.strokeStyle = '#c9402c'; R.ctx.lineWidth = 3; R.ctx.lineCap = 'round';
    for (i = 0; i < 3; i++) {
      var o = Math.sin(t * 6 + i * 0.9) * 1.4;
      R.ctx.beginPath(); R.ctx.moveTo(-8, -4 + i * 5); R.ctx.lineTo(-17.4, -8 + i * 7 + o); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.moveTo(8, -4 + i * 5); R.ctx.lineTo(17.4, -8 + i * 7 - o); R.ctx.stroke();
    }
    // клешни
    for (s = -1; s <= 1; s += 2) {
      R.ctx.save();
      R.ctx.translate(s * 13.8, -11);
      R.ctx.rotate(s * (0.4 + pinch));
      R.ctx.fillStyle = '#c9402c';
      R.ctx.beginPath(); R.ctx.ellipse(0, -3.4, 4.6, 2.6, 0, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.ellipse(0, 3.4, 4.6, 2.6, 0, 0, 6.2832); R.ctx.fill();
      R.ctx.fillStyle = '#e2543c';
      R.ctx.beginPath(); R.ctx.ellipse(s * 0.6, -2.8, 4, 2, 0, 0, 6.2832); R.ctx.fill();
      R.ctx.beginPath(); R.ctx.ellipse(s * 0.6, 2.8, 4, 2, 0, 0, 6.2832); R.ctx.fill();
      R.ctx.restore();
    }
    // панцирь
    R.ctx.fillStyle = '#a82f24';
    R.ctx.beginPath(); R.ctx.ellipse(0, 1.4, 14.4, 12.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e2543c';
    R.ctx.beginPath(); R.ctx.ellipse(0, 0, 13.6, 11.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#f47a5c';
    R.ctx.beginPath(); R.ctx.ellipse(-1.4, -1.4, 10.6, 8.8, 0, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // сегменты панциря
      R.ctx.strokeStyle = 'rgba(150,50,35,0.45)'; R.ctx.lineWidth = 1.2;
      R.ctx.beginPath(); R.ctx.ellipse(0, 0, 8.4, 11.6, 0, 0, 6.2832); R.ctx.stroke();
      R.ctx.beginPath(); R.ctx.ellipse(0, 0, 13.6, 6, 0, 0, 6.2832); R.ctx.stroke();
    }
    // глазные стебельки
    R.ctx.strokeStyle = '#e2543c'; R.ctx.lineWidth = 2.4;
    R.ctx.beginPath(); R.ctx.moveTo(-4, -10); R.ctx.lineTo(-5, -15); R.ctx.stroke();
    R.ctx.beginPath(); R.ctx.moveTo(4, -10); R.ctx.lineTo(5, -15); R.ctx.stroke();
    R.ctx.fillStyle = '#f7f2e8';
    R.ctx.beginPath(); R.ctx.arc(-5, -16, 2.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(5, -16, 2.4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.arc(-5.2, -16.4, 1.2, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(4.8, -16.4, 1.2, 0, 6.2832); R.ctx.fill();
    R.ctx.restore();
  }

  function decorRat(x, y, seed, t) {
    var i;
    var wig = Math.sin(t * 4.5 + seed * 8);              // хвост виляет
    var sniff = Math.sin(t * 8 + seed * 3) * 0.6;        // носик принюхивается
    shadow(x + 3, y + 9, 15, 11, 0.24);
    R.ctx.save();
    R.ctx.translate(x, y);
    R.ctx.rotate(seed * 6.2832);
    // хвост
    R.ctx.strokeStyle = '#c9a3a8'; R.ctx.lineWidth = 2.6; R.ctx.lineCap = 'round';
    R.ctx.beginPath();
    R.ctx.moveTo(0, 12);
    R.ctx.quadraticCurveTo(7 + wig * 4, 17, 13 + wig * 5, 9 + wig * 3);
    R.ctx.stroke();
    // лапки
    R.ctx.fillStyle = '#d9a3a8';
    R.ctx.beginPath(); R.ctx.ellipse(-8, -6, 3, 2.2, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(8, -6, 3, 2.2, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(-7, 9, 3.2, 2.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.ellipse(7, 9, 3.2, 2.4, 0, 0, 6.2832); R.ctx.fill();
    // туловище
    R.ctx.fillStyle = '#6f767f';
    R.ctx.beginPath(); R.ctx.ellipse(0, 2, 11, 14, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#8b929c';
    R.ctx.beginPath(); R.ctx.ellipse(-0.8, 1, 9.8, 12.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#a9aeb6';
    R.ctx.beginPath(); R.ctx.ellipse(-1.6, 0, 7.4, 9.8, 0, 0, 6.2832); R.ctx.fill();
    // ушки
    R.ctx.fillStyle = '#6f767f';
    R.ctx.beginPath(); R.ctx.arc(-6, -12, 4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(6, -12, 4, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e0a8b0';
    R.ctx.beginPath(); R.ctx.arc(-6, -12, 2.4, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(6, -12, 2.4, 0, 6.2832); R.ctx.fill();
    // мордочка
    R.ctx.fillStyle = '#9aa0aa';
    R.ctx.beginPath(); R.ctx.ellipse(0, -15 + sniff, 6.4, 5.6, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#c1c6cd';
    R.ctx.beginPath(); R.ctx.ellipse(-0.4, -15.6 + sniff, 5.2, 4.4, 0, 0, 6.2832); R.ctx.fill();
    R.ctx.fillStyle = '#e0a8b0';
    R.ctx.beginPath(); R.ctx.arc(0, -18 + sniff, 1.8, 0, 6.2832); R.ctx.fill();
    // глазки-бусинки
    R.ctx.fillStyle = '#20242e';
    R.ctx.beginPath(); R.ctx.arc(-3.2, -15 + sniff, 1.2, 0, 6.2832); R.ctx.fill();
    R.ctx.beginPath(); R.ctx.arc(3.2, -15 + sniff, 1.2, 0, 6.2832); R.ctx.fill();
    if (R.scale > 0.68) {
      // усы
      R.ctx.strokeStyle = 'rgba(240,240,245,0.75)'; R.ctx.lineWidth = 0.9;
      for (i = -1; i <= 1; i++) {
        R.ctx.beginPath();
        R.ctx.moveTo(-4, -18 + sniff + i);
        R.ctx.lineTo(-13, -21 + sniff + i * 2.4);
        R.ctx.stroke();
        R.ctx.beginPath();
        R.ctx.moveTo(4, -18 + sniff + i);
        R.ctx.lineTo(13, -21 + sniff + i * 2.4);
        R.ctx.stroke();
      }
    }
    R.ctx.restore();
  }

  /* ==========================================================================
     9c. ДИСПЕТЧЕР ДЕКОРАЦИЙ
     Ключи — id из themes.js, значения — функции вида decor<Kind>(x, y, seed, t).
     ========================================================================== */

  // Диспетчер: ключи совпадают с id украшений из themes.js.
  var DECOR = {
    snowman: decorSnowman,
    iceBlock: decorIceBlock,
    gift: decorGift,
    pumpkin: decorPumpkin,
    ghost: decorGhost,
    cactus: decorCactus,
    bones: decorBones,
    mushroom: decorMushroom,
    palm: decorPalm,
    vine: decorVine,
    tallgrass: decorTallgrass,
    acacia: decorAcacia,
    bamboo: decorBamboo,
    bush: decorBush,
    sunflower: decorSunflower,
    umbrella: decorUmbrella,
    shell: decorShell,
    haystack: decorHaystack,
    fence: decorFence,
    crate: decorCrate,
    cone: decorCone,
    pipe: decorPipe,
    bench: decorBench,
    trashbin: decorTrashbin,
    neonSign: decorNeonSign,
    antenna: decorAntenna,
    crater: decorCrater,
    balloon: decorBalloon,
    samovar: decorSamovar,
    matryoshka: decorMatryoshka,
    lantern: decorLantern,
    panda: decorPanda,
    giraffe: decorGiraffe,
    crab: decorCrab,
    rat: decorRat
  };

  U.expose(CC.decor, {
    list: DECOR,
    has: function (kind) { return !!DECOR[kind]; },
    // Рисует украшение, если такое есть; иначе возвращает false, и вызывающий
    // код рисует запасное дерево или камень.
    draw: function (kind, x, y, seed, t) {
      var f = DECOR[kind];
      if (!f) { return false; }
      f(x, y, seed === undefined ? 0.5 : seed, t === undefined ? 0 : t);
      return true;
    }
  });
})(window.CC);
