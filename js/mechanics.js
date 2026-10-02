/* ============================================================================
   mechanics.js — механики биомов: лёд, туман, ветер, лава, молнии и прочее
   ----------------------------------------------------------------------------
   Каждая карта отличается не только палитрой, но и правилами. Механика
   описывается данными в themes.js (поле mechanic) и реализуется здесь, чтобы
   движок забега и генератор мира оставались простыми.

   Как это устроено:
     • decorateRow(row, d) — вызывается генератором сразу после создания ряда:
       механика может пометить ряд (лёд, тоннель, лазер, эскалатор) и добавить
       свои объекты;
     • tick(dt)     — раз в кадр: погода, молнии, метеоры, приливы, карусели;
     • onLand(row, obj) — реакция на приземление: скольжение по льду, тоннель,
       порыв ветра, грязь;
     • hopMul()     — множитель длительности прыжка (низкая гравитация, грязь);
     • drawWorld()  — отрисовка явлений в мире (лучи лазера, тени метеоров);
     • drawScreen() — погода и ограничение обзора в экранных координатах.
   ========================================================================== */
(function (CC) {
  'use strict';

  var C = CC.C, R = CC.R, U = CC.util, G = CC.G, pl = CC.pl;
  var TS = C.TS, COLS = C.COLS, FIELD_HALF = C.FIELD_HALF;
  var clamp = U.clamp, rnd = U.rnd, pick = U.pick, hash01 = U.hash01;
  var colX = U.colX, rowY = U.rowY;
  var TH = CC.themes;

  // Редкие явления храним в состоянии забега, чтобы они сбрасывались вместе с ним
  function mechState() {
    if (!G.mech) {
      G.mech = {
        bolt: null,        // молния: {row, col, t, phase}
        meteor: null,      // метеорит: {col, t, phase}
        tide: 0,           // прилив: сколько рядов позади уже затопило
        tideTimer: 0,
        crane: 0,          // фаза движения крана
        carousel: 0,       // угол карусели
        laser: 0,          // общая фаза лазерных ворот
        wind: 0,           // текущий порыв ветра
        weather: [],       // частицы погоды (экранные координаты)
        weatherNext: 0,
        flash: 0
      };
    }
    return G.mech;
  }

  // Активна ли механика в текущем биоме
  function has(name) {
    var th = TH.get(G.themeId);
    var m = th.mechanic;
    if (!m) { return false; }
    if (typeof m === 'string') { return m === name; }
    for (var i = 0; i < m.length; i++) { if (m[i] === name) { return true; } }
    return false;
  }
  function theme() { return TH.get(G.themeId); }

  /* ==========================================================================
     ГЕНЕРАЦИЯ: помечаем ряды под механику биома
     ========================================================================== */
  function decorateRow(row, d) {
    var th = theme();
    var i;
    // Лёд: часть клеток земли скользит
    if (has('ice') && row.type === 'grass') {
      for (i = 0; i < COLS; i++) {
        if (hash01(row.r * 91 + i * 7) < 0.45) {
          row.ice = row.ice || {};
          row.ice[i] = 1;
        }
      }
    }
    // Грязь: замедляет прыжок
    if (has('mud') && row.type === 'grass') {
      row.mud = {};
      for (i = 0; i < COLS; i++) {
        if (hash01(row.r * 53 + i * 11) < 0.4) { row.mud[i] = 1; }
      }
    }
    // Тоннели: клетка переносит на несколько рядов вперёд
    if (has('tunnel') && row.type === 'grass' && Math.random() < 0.35) {
      row.tunnel = {};
      var tc = (Math.random() * COLS) | 0;
      row.tunnel[tc] = 4 + ((Math.random() * 3) | 0);
    }
    // Лазерные ворота: перекрывают дорогу по циклу
    if (has('laser') && row.type === 'road') {
      row.laser = { period: 2.2 + Math.random() * 1.4, phase: Math.random() * 3 };
    }
    // Эскалатор: тянет назад
    if (has('escalator') && row.type === 'grass' && Math.random() < 0.3) {
      row.escalator = -1;
    }
    // Миражи: часть монет исчезает при приближении
    if (has('mirage') && row.type === 'grass' && row.coins && row.coins.length && Math.random() < 0.5) {
      row.mirage = {};
      for (i = 0; i < row.coins.length; i++) { row.mirage[row.coins[i]] = 1; }
    }
    // Крокодилы: в воде плавают не брёвна, а зубастые
    if (has('croc') && row.type === 'water') {
      for (i = 0; i < row.items.length; i++) {
        if (Math.random() < 0.5) {
          row.items[i].kind = 'croc';
          row.items[i].vx *= 1.35;
        }
      }
    }
    // Самолёты вместо поездов
    if (has('plane') && row.type === 'rail') {
      row.plane = true;
      row.trainSpeed *= 1.15;
      row.timer = rnd(1.2, 3.2);
    }
    // Краны и карусели: движущиеся препятствия
    if (has('crane') && row.type === 'road' && Math.random() < 0.3) {
      row.crane = { x: -FIELD_HALF - TS, dir: Math.random() < 0.5 ? 1 : -1, speed: 60 + Math.random() * 50, arm: 14 };
    }
    if (has('carousel') && row.type === 'grass' && !row.crane && Math.random() < 0.25) {
      row.carousel = { angle: Math.random() * 6.28, speed: 1.4 + Math.random() * 0.9, R: TS * 0.9 };
    }
    // Высокая трава: прячет машины соседнего ряда
    if (has('hidegrass') && row.type === 'grass') {
      row.tall = true;
    }
    // Вулкан: вода превращается в лаву
    if (has('lava') && row.type === 'water') {
      row.lava = true;
      for (i = 0; i < row.items.length; i++) {
        row.items[i].kind = 'stone';
        row.items[i].vx *= 0.75;
      }
    }
    // Вулкан: гейзеры
    if (has('geyser') && row.type === 'grass' && Math.random() < 0.22) {
      row.geyser = { col: (Math.random() * COLS) | 0, t: rnd(0, 2.5), period: 3 + Math.random() * 2 };
    }
    // Зоопарк: вольеры перекрывают клетки
    if (has('enclosure') && row.type === 'grass') {
      var ec = (Math.random() * COLS) | 0;
      row.obstacles[ec] = 'fence';
      if (Math.random() < 0.5 && ec + 1 < COLS) { row.obstacles[ec + 1] = 'fence'; }
    }
    // Каньон: узкие мосты — часть клеток проваливается
    if (has('narrow') && row.type === 'grass') {
      row.holes = {};
      for (i = 0; i < COLS; i++) {
        if (hash01(row.r * 37 + i * 19) < 0.22) {
          row.holes[i] = 1;
          row.obstacles[i] = 'pit';       // шагать в провал нельзя
        }
      }
    }
  }

  /* ==========================================================================
     КАДР: погода, молнии, метеоры, приливы, движущиеся препятствия
     ========================================================================== */
  function tick(dt) {
    var st = mechState();
    var th = theme();

    // --- прилив: вода поднимается позади игрока ---
    if (has('tide')) {
      st.tideTimer += dt;
      if (st.tideTimer > 6) {
        st.tideTimer = 0;
        st.tide++;
      }
      // в затопленном ряду стоять нельзя
      if (pl.alive && G.invuln <= 0 && CC.util.playerRow() < G.maxRow - st.tide) {
        CC.game.die('water');
      }
    } else {
      st.tide = 0; st.tideTimer = 0;
    }

    // --- молния: предупреждение, потом удар ---
    if (has('lightning')) {
      if (!st.bolt) {
        if (Math.random() < dt * 0.35 && pl.alive) {
          st.bolt = { col: (Math.random() * COLS) | 0, t: 0, phase: 0.9 };
        }
      } else {
        st.bolt.t += dt;
        if (st.bolt.t > st.bolt.phase && !st.bolt.struck) {
          st.bolt.struck = true;
          st.flash = 1;
          CC.fx.burst(colX(st.bolt.col), rowY(CC.util.playerRow()), 14, 'rgba(180,220,255,0.95)', 'sparkle', 160);
          if (CC.util.playerCol() === st.bolt.col && pl.alive && G.invuln <= 0) {
            CC.game.die('lightning');
          }
          st.bolt.t = 0;
        }
        if (st.bolt.struck && st.bolt.t > 0.35) { st.bolt = null; }
      }
    } else { st.bolt = null; }

    // --- метеорит ---
    if (has('meteor')) {
      if (!st.meteor) {
        if (Math.random() < dt * 0.3 && pl.alive) {
          st.meteor = { col: (Math.random() * COLS) | 0, t: 0, phase: 1.3 };
        }
      } else {
        st.meteor.t += dt;
        if (st.meteor.t > st.meteor.phase && !st.meteor.struck) {
          st.meteor.struck = true;
          st.flash = 1;
          G.shake = 14;
          CC.fx.burst(colX(st.meteor.col), rowY(CC.util.playerRow()), 20, 'rgba(255,150,80,0.95)', 'dot', 190);
          if (Math.abs(CC.util.playerCol() - st.meteor.col) <= 1 && pl.alive && G.invuln <= 0) {
            CC.game.die('meteor');
          }
          st.meteor.t = 0;
        }
        if (st.meteor.struck && st.meteor.t > 0.5) { st.meteor = null; }
      }
    } else { st.meteor = null; }

    // --- лазерные ворота ---
    st.laser += dt;

    // --- движущиеся препятствия ---
    for (var k in G.rows) {
      if (!G.rows.hasOwnProperty(k)) { continue; }
      var row = G.rows[k];
      if (row.crane) {
        row.crane.x += row.crane.speed * row.crane.dir * dt;
        var lim = FIELD_HALF + TS * 2;
        if (row.crane.x > lim) { row.crane.dir = -1; }
        if (row.crane.x < -lim) { row.crane.dir = 1; }
      }
      if (row.carousel) {
        row.carousel.angle += row.carousel.speed * dt;
      }
    }

    // --- ветер: периодический порыв ---
    if (has('wind')) {
      st.wind += dt;
    }

    // --- погода: частицы в экранных координатах ---
    updateWeather(dt, th);
    if (st.flash > 0) { st.flash = Math.max(0, st.flash - dt * 3); }
  }

  // Профиль погоды по типу: скорость, наклон, размер, цвет
  var WEATHER = {
    snow:   { n: 90, sp: 40, drift: 18, size: 2.6, color: 'rgba(255,255,255,0.85)', spin: 0 },
    rain:   { n: 120, sp: 620, drift: 60, size: 1.6, color: 'rgba(190,220,255,0.75)', spin: 0, line: 9 },
    sand:   { n: 110, sp: 260, drift: 150, size: 2.0, color: 'rgba(226,196,130,0.55)', spin: 0 },
    ash:    { n: 70, sp: 70, drift: 40, size: 2.2, color: 'rgba(120,110,105,0.65)', spin: 0 },
    leaf:   { n: 45, sp: 90, drift: 70, size: 3.4, color: 'rgba(220,150,60,0.85)', spin: 3 },
    spark:  { n: 60, sp: 55, drift: 25, size: 2.2, color: 'rgba(255,225,150,0.9)', spin: 2 },
    petal:  { n: 50, sp: 70, drift: 55, size: 3.0, color: 'rgba(255,200,225,0.85)', spin: 2 },
    steam:  { n: 40, sp: -60, drift: 30, size: 5.0, color: 'rgba(220,230,240,0.35)', spin: 0 },
    neon:   { n: 45, sp: 120, drift: 90, size: 2.4, color: 'rgba(120,240,255,0.7)', spin: 0, line: 7 },
    bubble: { n: 55, sp: -90, drift: 40, size: 3.2, color: 'rgba(255,255,255,0.45)', spin: 0 }
  };

  function updateWeather(dt, th) {
    var st = mechState();
    var spec = WEATHER[th.weather];
    if (!spec || R.quality === 0) {
      if (st.weather.length) { st.weather.length = 0; }
      return;
    }
    var maxN = Math.min(spec.n, R.quality > 1 ? spec.n : Math.round(spec.n * 0.5));
    while (st.weather.length < maxN) {
      st.weather.push({
        x: Math.random() * R.VW,
        y: Math.random() * R.VH,
        v: 0.7 + Math.random() * 0.6,
        ph: Math.random() * 6.28
      });
    }
    while (st.weather.length > maxN) { st.weather.pop(); }
    for (var i = 0; i < st.weather.length; i++) {
      var p = st.weather[i];
      p.y += spec.sp * p.v * dt;
      p.x += spec.drift * p.v * dt * Math.sin(G.t * 0.7 + p.ph);
      if (p.y > R.VH + 10) { p.y = -10; p.x = Math.random() * R.VW; }
      if (p.y < -10) { p.y = R.VH + 10; p.x = Math.random() * R.VW; }
      if (p.x > R.VW + 10) { p.x = -10; }
      if (p.x < -10) { p.x = R.VW + 10; }
    }
  }

  /* ==========================================================================
     РЕАКЦИЯ НА ПРИЗЕМЛЕНИЕ
     ========================================================================== */
  function onLand(row, obj) {
    if (!row) { return; }
    var col = CC.util.playerCol();

    // лёд: проскальзываем ещё на клетку в сторону движения
    if (row.ice && row.ice[col] && pl.facing) {
      var dir = { up: [0, 1], down: [0, -1], left: [-1, 0], right: [1, 0] }[pl.facing];
      if (dir) { G.slide = { dc: dir[0], dr: dir[1] }; }
    }
    // грязь: следующий прыжок медленнее
    if (row.mud && row.mud[col]) {
      G.mudSlow = 0.6;
      CC.fx.burst(pl.px, pl.py + TS * 0.3, 4, 'rgba(90,70,40,0.7)', 'dust', 50);
    }
    // тоннель: переносит вперёд
    if (row.tunnel && row.tunnel[col] && !G.tunnelLock) {
      G.tunnel = { left: row.tunnel[col] };
      G.tunnelLock = true;
    }
    // миражи: фальшивая монета исчезает
    if (row.mirage && row.mirage[col]) {
      var idx = row.coins.indexOf(col);
      if (idx >= 0) { row.coins.splice(idx, 1); }
      CC.fx.burst(colX(col), pl.py, 8, 'rgba(255,255,255,0.6)', 'dust', 60);
    }
    // порыв ветра сносит на клетку в сторону
    if (has('wind') && Math.random() < 0.28) {
      var wc = Math.random() < 0.5 ? 1 : -1;
      G.wind = { dc: wc, left: 0.45 };
    }
    // карусель сбивает с клетки
    if (row.carousel && pl.alive) {
      var ang = Math.atan2(0, 0);
      var dist = Math.abs(pl.px - colX(Math.round((COLS - 1) / 2)));
      if (Math.sin(row.carousel.angle) > 0.9 && dist < row.carousel.R * 1.2) {
        CC.game.die('carousel');
      }
    }
  }

  // Сколько длится прыжок: низкая гравитация и грязь меняют время
  function hopMul() {
    var m = 1;
    if (has('lowgrav')) { m *= 1.7; }
    if (G.mudSlow > 0) { m *= 1.35; }
    if (has('freeze') && pl.idle > 3.5) { m *= 1.25; }
    return m;
  }

  /* ==========================================================================
     ОТРИСОВКА: явления в мире и погода на экране
     ========================================================================== */
  function drawWorld() {
    var st = mechState();
    var ctx = R.ctx;
    var y, i, r;

    // лазерные ворота: луч поперёк ряда
    for (var k in G.rows) {
      if (!G.rows.hasOwnProperty(k)) { continue; }
      var row = G.rows[k];
      if (row.laser) {
        var on = ((G.t + row.laser.phase) % row.laser.period) < row.laser.period * 0.45;
        if (on) {
          y = rowY(row.r);
          ctx.strokeStyle = 'rgba(255,70,110,0.85)';
          ctx.lineWidth = 2.5;
          ctx.beginPath();
          ctx.moveTo(-FIELD_HALF, y);
          ctx.lineTo(FIELD_HALF, y);
          ctx.stroke();
          ctx.strokeStyle = 'rgba(255,150,180,0.35)';
          ctx.lineWidth = 7;
          ctx.stroke();
        }
      }
      if (row.crane) {
        y = rowY(row.r);
        var cx = row.crane.x;
        // рельса крана и тележка с противовесом
        ctx.fillStyle = 'rgba(40,44,52,0.35)';
        ctx.fillRect(-FIELD_HALF - TS, y - TS * 0.46, FIELD_HALF * 2 + TS * 2, 3);
        ctx.fillStyle = '#e0a11c';
        ctx.fillRect(cx - row.crane.arm, y - 5, row.crane.arm * 2, 10);
        ctx.fillStyle = '#8b6a12';
        ctx.fillRect(cx - 5, y - 8, 10, 16);
        ctx.fillStyle = '#3a4152';
        ctx.fillRect(cx + row.crane.arm - 8, y - 6, 8, 12);
      }
      if (row.carousel) {
        y = rowY(row.r);
        var cxx = colX(Math.round((COLS - 1) / 2));
        ctx.save();
        ctx.translate(cxx, y);
        ctx.rotate(row.carousel.angle);
        ctx.fillStyle = 'rgba(255,255,255,0.25)';
        ctx.beginPath(); ctx.arc(0, 0, 10, 0, 6.2832); ctx.fill();
        for (i = 0; i < 4; i++) {
          ctx.save();
          ctx.rotate(i * 1.5708);
          ctx.fillStyle = i % 2 ? '#e0574a' : '#f2c94c';
          ctx.fillRect(8, -3, row.carousel.R * 0.7, 6);
          ctx.restore();
        }
        ctx.fillStyle = '#5c6470';
        ctx.beginPath(); ctx.arc(0, 0, 6, 0, 6.2832); ctx.fill();
        ctx.restore();
      }
      if (row.geyser) {
        y = rowY(row.r);
        var ph = (G.t + row.geyser.t) % row.geyser.period;
        if (ph < 0.6) {
          var hh = (1 - ph / 0.6) * TS * 1.4;
          ctx.fillStyle = 'rgba(255,220,180,0.5)';
          ctx.beginPath();
          ctx.ellipse(colX(row.geyser.col), y, 8 + hh * 0.4, hh * 0.7, 0, 0, 6.2832);
          ctx.fill();
        }
      }
    }

    // предупреждение о молнии и метеорите — тень на земле
    if (st.bolt && !st.bolt.struck) {
      y = rowY(CC.util.playerRow());
      var a = 0.25 + 0.35 * Math.sin(G.t * 22);
      ctx.strokeStyle = 'rgba(140,200,255,' + a.toFixed(2) + ')';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(colX(st.bolt.col), y, TS * 0.44, 0, 6.2832);
      ctx.stroke();
    }
    if (st.meteor && !st.meteor.struck) {
      y = rowY(CC.util.playerRow());
      var k = Math.min(1, st.meteor.t / st.meteor.phase);
      ctx.fillStyle = 'rgba(0,0,0,' + (0.10 + k * 0.35).toFixed(2) + ')';
      ctx.beginPath();
      ctx.ellipse(colX(st.meteor.col), y, 10 + k * 32, 6 + k * 16, 0, 0, 6.2832);
      ctx.fill();
      ctx.fillStyle = 'rgba(255,170,90,' + (0.5 + k * 0.5).toFixed(2) + ')';
      ctx.beginPath();
      ctx.arc(colX(st.meteor.col), y - (1 - k) * 260, 9 + k * 6, 0, 6.2832);
      ctx.fill();
    }
  }

  // Погода и ограничение обзора — уже в экранных координатах
  function drawScreen() {
    var ctx = R.ctx;
    var st = mechState();
    var th = theme();

    // Туман и темнота: вокруг курицы остаётся светлое пятно
    if (th.fog > 0 || th.dark > 0) {
      var camX = R.VW / 2, camY = R.VH * (C.PLAYER_SCREEN_Y - 0.5) + R.VH * 0.5 - (R.camY - R.camY) - 0;
      // экранная позиция курицы: камера стоит так, что курица на PLAYER_SCREEN_Y
      var py = R.VH * C.PLAYER_SCREEN_Y;
      var px = R.VW / 2;
      var dark = Math.max(th.fog * 0.75, th.dark, (G.night || 0) * 0.8);
      if (dark > 0) {
        var g = U.grad('swirl|' + G.themeId + '|' + Math.round(R.VW) + 'x' + Math.round(R.VH), function () {
          var gg = ctx.createRadialGradient(px, py, Math.min(R.VW, R.VH) * (th.dark > 0.5 ? 0.16 : 0.30),
            px, py, Math.max(R.VW, R.VH) * (th.fog > 0.3 ? 0.42 : 0.75));
          gg.addColorStop(0, 'rgba(6,8,14,0)');
          gg.addColorStop(0.55, 'rgba(6,8,14,' + (dark * 0.5).toFixed(2) + ')');
          gg.addColorStop(1, 'rgba(6,8,14,' + dark.toFixed(2) + ')');
          return gg;
        });
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, R.VW, R.VH);
      }
    }

    // Погода
    var spec = WEATHER[th.weather];
    if (spec && st.weather.length) {
      ctx.fillStyle = spec.color;
      ctx.strokeStyle = spec.color;
      ctx.lineWidth = 1.4;
      if (spec.line) {
        for (var i = 0; i < st.weather.length; i++) {
          var p = st.weather[i];
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          ctx.lineTo(p.x - spec.drift * 0.01 * spec.line, p.y - spec.line * p.v);
          ctx.stroke();
        }
      } else {
        for (var j = 0; j < st.weather.length; j++) {
          var q = st.weather[j];
          var sz = spec.size * (0.7 + q.v * 0.5);
          if (spec.spin) {
            ctx.save();
            ctx.translate(q.x, q.y);
            ctx.rotate(G.t * spec.spin + q.ph);
            ctx.fillRect(-sz, -sz * 0.4, sz * 2, sz * 0.8);
            ctx.fillRect(-sz * 0.4, -sz, sz * 0.8, sz * 2);
            ctx.restore();
          } else {
            ctx.beginPath();
            ctx.arc(q.x, q.y, sz, 0, 6.2832);
            ctx.fill();
          }
        }
      }
    }

    // Вспышка молнии
    if (st.flash > 0) {
      ctx.fillStyle = 'rgba(200,225,255,' + (st.flash * 0.35).toFixed(2) + ')';
      ctx.fillRect(0, 0, R.VW, R.VH);
    }
  }

  // Наполняем готовый отсек шины: модули, загруженные раньше, уже
  // держат на него ссылку (важно для world.js, который зовёт decorateRow).
  U.expose(CC.mech, {
    decorateRow: decorateRow,
    tick: tick,
    onLand: onLand,
    hopMul: hopMul,
    drawWorld: drawWorld,
    drawScreen: drawScreen,
    has: has,
    state: mechState,
    reset: function () { G.mech = null; G.slide = null; G.wind = null; G.tunnel = null; G.tunnelLock = false; G.mudSlow = 0; }
  });
})(window.CC);
