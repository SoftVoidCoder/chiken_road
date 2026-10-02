/* ============================================================================
   smoke.mjs — прогон движка Crossy Chicken без браузера.
   Подменяет DOM/Canvas заглушками и прогоняет сценарии: загрузка, старт,
   движение, смерть, продолжение, вода, рельсы, пауза, ресайз.
   Запуск: node dev/smoke.mjs
   ========================================================================== */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

// Маркер корня игры — index.html: рядом с ним лежат css/, js/ и assets/.
const root = fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'index.html'))
  ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')            // dev/ внутри репозитория игры
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'crossy'); // dev/ рядом с папкой crossy
// Модульная сборка: порядок тот же, что в index.html — от ядра к точке входа.
const MODULES = [
  'js/core.js', 'js/i18n.js', 'js/themes.js', 'js/skins.js', 'js/settings.js',
  'js/platform.js', 'js/meta.js', 'js/audio.js',
  'js/draw-world.js', 'js/draw-decor.js', 'js/draw-actors.js',
  'js/world.js', 'js/mechanics.js', 'js/gameplay.js', 'js/render.js', 'js/input.js',
  'js/ui.js', 'js/screens.js', 'js/main.js'
];
const sources = MODULES.map((f) => ({ file: f, code: fs.readFileSync(path.join(root, f), 'utf8') }));

let now = 0;
let rafQueue = [];
const listeners = { window: {}, document: {}, byId: {} };

/* ---------- заглушка Canvas 2D ---------- */
const gradient = { addColorStop() {} };
const ctxTarget = {
  canvas: { width: 800, height: 600 },
  globalAlpha: 1, lineWidth: 1, lineCap: 'butt', font: '', textAlign: 'left',
  fillStyle: '#000', strokeStyle: '#000',
  createLinearGradient: () => gradient,
  createRadialGradient: () => gradient,
  createPattern: () => ({}),
  measureText: () => ({ width: 10 })
};
const ctx = new Proxy(ctxTarget, {
  get(t, k) { if (k in t) { return t[k]; } return () => {}; },
  set(t, k, v) { t[k] = v; return true; }
});

/* ---------- заглушка DOM ---------- */
function makeEl(id) {
  const ls = {};
  const el = {
    id, textContent: '', innerHTML: '', hidden: false, disabled: false,
    title: '', width: 800, height: 600, clientWidth: 800, clientHeight: 600,
    style: { setProperty() {} },
    dataset: {},
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) {
        const on = force === undefined ? !this._s.has(c) : !!force;
        if (on) { this._s.add(c); } else { this._s.delete(c); }
        return on;
      }
    },
    addEventListener(t, f) { (ls[t] = ls[t] || []).push(f); },
    removeEventListener() {},
    _attrs: {},
    setAttribute(k, v) { this._attrs[k] = String(v); },
    getAttribute(k) { return this._attrs[k] === undefined ? null : this._attrs[k]; },
    removeAttribute(k) { delete this._attrs[k]; },
    getContext() { return ctx; },
    appendChild(node) { if (node && node.onerror) { setTimeout(() => node.onerror(), 0); } },
    focus() {}, blur() {},
    querySelector() { return makeEl('sub'); }, querySelectorAll() { return []; },
    _fire(t, e) { (ls[t] || []).forEach((f) => f(e || { preventDefault() {} })); },
    // заглушка тега <script>: SDK в песочнице не грузится, поэтому сразу сигналим ошибку
    set onerror(f) { this._onerror = f; }, get onerror() { return this._onerror; },
    set onload(f) { this._onload = f; }, get onload() { return this._onload; }
  };
  return el;
}
const documentStub = {
  hidden: false,
  title: '',
  body: makeEl('body'),
  head: makeEl('head'),
  documentElement: makeEl('html'),
  addEventListener(t, f) { (listeners.document[t] = listeners.document[t] || []).push(f); },
  getElementById(id) { return (listeners.byId[id] = listeners.byId[id] || makeEl(id)); },
  createElement: (t) => makeEl(t),
  querySelector: () => makeEl('q'),
  querySelectorAll: () => []
};
const storage = new Map();
const localStorageStub = {
  getItem: (k) => (storage.has(k) ? storage.get(k) : null),
  setItem: (k, v) => storage.set(k, String(v)),
  removeItem: (k) => storage.delete(k)
};
const windowStub = {
  innerWidth: 900, innerHeight: 640, devicePixelRatio: 2,
  addEventListener(t, f) { (listeners.window[t] = listeners.window[t] || []).push(f); },
  removeEventListener() {},
  matchMedia: () => ({ matches: false, addListener() {}, addEventListener() {} }),
  location: { search: '?ysdk=off&debug=1' },
  navigator: { language: 'ru-RU' },
  localStorage: localStorageStub,
  performance: { now: () => now },
  requestAnimationFrame(cb) { rafQueue.push(cb); return rafQueue.length; },
  setTimeout, clearTimeout, setInterval, clearInterval,
  console
};

const sandbox = {
  console, Math, JSON, Date, Promise, Error, Array, Object, String, Number, Boolean,
  isFinite, isNaN, parseInt, parseFloat, RegExp, Map, Set, Symbol,
  document: documentStub,
  navigator: windowStub.navigator,
  location: windowStub.location,
  localStorage: localStorageStub,
  performance: windowStub.performance,
  requestAnimationFrame: windowStub.requestAnimationFrame,
  setTimeout, clearTimeout, setInterval, clearInterval
};
sandbox.window = sandbox;
sandbox.self = sandbox;
sandbox.globalThis = sandbox;
// window-специфичные методы и поля — прямо на глобальный объект песочницы
sandbox.addEventListener = windowStub.addEventListener;
sandbox.removeEventListener = windowStub.removeEventListener;
sandbox.innerWidth = windowStub.innerWidth;
sandbox.innerHeight = windowStub.innerHeight;
sandbox.devicePixelRatio = windowStub.devicePixelRatio;
sandbox.matchMedia = windowStub.matchMedia;
sandbox.AudioContext = undefined;
vm.createContext(sandbox);

/* ---------- прогон ---------- */
let frames = 0;
function tick(n = 1, dtms = 16.7) {
  for (let i = 0; i < n; i++) {
    now += dtms;
    const q = rafQueue;
    rafQueue = [];
    for (const cb of q) { cb(now); frames++; }
    if (q.length === 0) { throw new Error('игра перестала запрашивать кадры (rAF-цикл оборвался)'); }
  }
}
function fireWin(type, evt) { (listeners.window[type] || []).forEach((f) => f(evt || {})); }
function key(code, up) {
  fireWin(up ? 'keyup' : 'keydown', { code, preventDefault() {} });
}
// отпустить все клавиши: иначе залипшее «вперёд» уводит курицу с тестируемого ряда
function releaseAll() {
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD'].forEach((c) => key(c, true));
}
const flush = (ms = 30) => new Promise((r) => setTimeout(r, ms));

function assert(cond, msg) { if (!cond) { throw new Error('ПРОВАЛ: ' + msg); } }
function step(title, fn) {
  try { fn(); console.log('  ok  ' + title); }
  catch (e) { console.error('  FAIL ' + title + '\n       ' + e.message); throw e; }
}

(async function run() {
  console.log('Crossy Chicken — прогон движка в песочнице\n');

  for (const m of sources) { vm.runInContext(m.code, sandbox, { filename: m.file }); }

  const G = sandbox.window.__CHICKEN__;
  const CC_SETTINGS = sandbox.window.CC.settings;
  assert(!!G, 'движок не выставил __CHICKEN__');

  step('кадры идут в состоянии загрузки/меню', () => {
    tick(10);
    assert(G.G.state === 'loading' || G.G.state === 'menu', 'неожиданное состояние: ' + G.G.state);
  });

  await flush(60);

  step('после init состояние menu, строки локализованы', () => {
    tick(5);
    assert(G.G.state === 'menu', 'ожидалось menu, получили ' + G.G.state);
    assert(listeners.byId.btnPlay.textContent === 'Играть', 'кнопка не локализована: ' + listeners.byId.btnPlay.textContent);
    // при первом запуске поверх меню показывается обучение — это нормально
    const menuOn = listeners.byId.ovMenu.classList.contains('on');
    const tutOn = listeners.byId.ovTutorial.classList.contains('on');
    assert(menuOn || tutOn, 'ни меню, ни обучение не показаны');
    // пролистываем обучение до конца и проверяем, что открывается меню
    for (let i = 0; i < 6 && listeners.byId.ovTutorial.classList.contains('on'); i++) {
      listeners.byId.btnTutNext._fire('click');
    }
    assert(listeners.byId.ovMenu.classList.contains('on'), 'после обучения меню не открылось');
  });

  step('запуск игры кнопкой', () => {
    listeners.byId.btnPlay._fire('click');
    assert(G.G.state === 'playing', 'не стартовало: ' + G.G.state);
    assert(Object.keys(G.rows()).length > 20, 'мир не сгенерирован');
  });

  step('удержание «вперёд» двигает курицу и растит счёт', () => {
    key('ArrowUp');
    tick(240);
    key('ArrowUp', true);
    assert(G.G.maxRow > 0, 'курица не продвинулась, maxRow=' + G.G.maxRow);
    assert(G.G.score === Math.max(0, G.G.maxRow), 'счёт не совпадает с maxRow');
  });

  step('случайный ввод 1200 кадров без исключений', () => {
    const codes = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];
    for (let i = 0; i < 1200; i++) {
      if (Math.random() < 0.14) {
        const c = codes[(Math.random() * codes.length) | 0];
        key(c);
        setTimeout(() => key(c, true), 0);
      }
      if (G.G.state === 'over') { G.start(); }
      tick(1);
    }
    assert(G.G.particles.length < 600, 'частицы не чистятся: ' + G.G.particles.length);
  });

  step('пауза и продолжение по клавише P', () => {
    if (G.G.state !== 'playing') { G.start(); }
    key('KeyP');
    assert(G.G.state === 'paused', 'пауза не включилась');
    tick(5);
    key('KeyP');
    assert(G.G.state === 'playing', 'пауза не выключилась');
  });

  step('смерть под машиной → экран конца игры', () => {
    G.die('car');
    tick(90);
    assert(G.G.state === 'over', 'состояние не over: ' + G.G.state);
    assert(listeners.byId.oScore.textContent !== '', 'очки не выведены');
    assert(/сбила машина/.test(listeners.byId.tReason.textContent), 'неверная причина: ' + listeners.byId.tReason.textContent);
  });

  step('продолжение после рекламы возвращает в игру', () => {
    G.revive();
    assert(G.G.state === 'playing', 'не возродился');
    assert(G.G.invuln > 0, 'нет неуязвимости после возрождения');
    tick(120);
  });

  step('вода: курица тонет без бревна', () => {
    releaseAll();
    G.start();
    const rows = G.rows();
    const water = Object.keys(rows).map(Number).find((r) => rows[r].type === 'water');
    assert(water !== undefined, 'в мире нет водных рядов');
    G.teleport(6, water);
    tick(3);
    assert(G.G.state === 'playing', 'игра не в игре перед проверкой воды');
    assert(G.G.deathReason === 'water', 'вода не убивает (reason=' + G.G.deathReason + ')');
    tick(80);
    assert(G.G.state === 'over', 'после утопления нет экрана конца игры');
  });

  step('рельсы: поезд появляется и едет', () => {
    releaseAll();
    G.start();
    const rows = G.rows();
    const rail = Object.keys(rows).map(Number).find((r) => rows[r].type === 'rail');
    if (rail === undefined) { return; }
    G.teleport(6, rail);
    let sawTrain = false;
    for (let i = 0; i < 600; i++) { tick(1); if (rows[rail].train) { sawTrain = true; } if (G.G.state !== 'playing') { break; } }
    assert(sawTrain, 'поезд так и не приехал');
    if (G.G.state !== 'playing') { G.start(); }
  });

  step('монеты начисляются при подборе', () => {
    releaseAll();
    // на дорогах теперь настоящий трафик, поэтому клетку для проверки
    // выбираем там, где курицу гарантированно не собьют
    let got = false, tries = 0;
    while (!got && tries < 12) {
      tries++;
      G.start();
      const rows = G.rows();
      const cand = Object.keys(rows).map(Number).filter((r) => {
        const o = rows[r];
        return o.type === 'grass' && o.coins.length && rows[r - 1] && rows[r - 1].type === 'grass'
          && rows[r].coins[0] > 0;
      });
      if (!cand.length) { continue; }
      const row = cand[0], obj = rows[row];
      const before = G.G.totalCoins;
      // встаём на соседнюю клетку и шагаем на монету — так срабатывает приземление
      G.teleport(obj.coins[0] - 1, row - 1);
      G.tryMove(1, 1);
      tick(20);
      if (G.G.totalCoins > before) { got = true; }
    }
    assert(got, 'монета не начислилась за ' + tries + ' попыток');
  });

  step('награда за дистанцию: монеты капают каждые 10 рядов', () => {
    releaseAll();
    let ok = false, tries = 0;
    while (!ok && tries < 30) {
      tries++;
      G.start();
      const rows = G.rows();
      const safe = (r) => rows[r] && rows[r].type === 'grass' && !(6 in rows[r].obstacles);
      if (!safe(9) || !safe(10)) { continue; }
      const before = G.G.totalCoins;
      G.teleport(6, 9);
      tick(2);
      if (G.G.state !== 'playing') { continue; }
      G.tryMove(0, 1);
      tick(20);
      if (G.G.totalCoins >= before + 2) { ok = true; }
    }
    assert(ok, 'награда за 10 рядов не начислилась за ' + tries + ' попыток');
  });

  step('ресайз и смена ориентации', () => {
    listeners.byId.game.clientWidth = 420;
    listeners.byId.game.clientHeight = 900;
    fireWin('resize');
    fireWin('orientationchange');
    tick(3);
    listeners.byId.game.clientWidth = 900;
    listeners.byId.game.clientHeight = 640;
    fireWin('resize');
    tick(3);
  });

  step('звук и пауза вкладки', () => {
    key('KeyM');
    key('KeyM');
    documentStub.hidden = true;
    (listeners.document.visibilitychange || []).forEach((f) => f());
    assert(G.G.state === 'paused' || G.G.state === 'over', 'вкладка не поставила игру на паузу: ' + G.G.state);
    documentStub.hidden = false;
    (listeners.document.visibilitychange || []).forEach((f) => f());
  });

  step('три уровня сложности: темп, поток и терпение орла', () => {
    releaseAll();
    assert(G.diffs().join(',') === 'easy,normal,hard', 'ожидались три режима, получено: ' + G.diffs().join(','));
    const roadsSpeed = () => {
      let sum = 0, n = 0;
      const rows = G.rows();
      for (const k of Object.keys(rows)) {
        const r = rows[k];
        if (r.type === 'road') { sum += r.speed; n++; }
      }
      return n ? sum / n : 0;
    };
    const avgSpeed = (id) => {
      G.setDiff(id);
      let sum = 0;
      for (let i = 0; i < 3; i++) { G.start(); sum += roadsSpeed(); }
      return sum / 3;
    };
    G.setDiff('easy');
    const easyEagle = G.eagleLimit();
    const easySpeed = avgSpeed('easy');
    const hardEagle = (G.setDiff('hard'), G.eagleLimit());
    const hardSpeed = avgSpeed('hard');
    assert(hardEagle < easyEagle, 'орёл на «сложно» должен прилетать раньше: ' + hardEagle + ' vs ' + easyEagle);
    assert(hardSpeed > easySpeed, 'на «сложно» поток быстрее: ' + easySpeed.toFixed(2) + ' vs ' + hardSpeed.toFixed(2));
    assert(G.ramp(300) > 0 && G.ramp(300) <= 1.4, 'разгон вне разумных пределов: ' + G.ramp(300));
    G.setDiff('normal');
    assert(G.diff() === 'normal', 'не вернулись на обычную сложность: ' + G.diff());
  });

  step('рекорды считаются отдельно по каждой сложности', () => {
    releaseAll();
    G.setDiff('easy');
    G.start();
    G.G.score = 999; G.G.maxRow = 999;
    G.die('car');
    tick(90);
    assert(G.G.bests.easy >= 999, 'рекорд «легко» не записан: ' + G.G.bests.easy);
    G.setDiff('hard');
    assert(G.G.bests.hard < 999, 'рекорд «сложно» не должен получить чужой результат: ' + G.G.bests.hard);
    assert(storage.get('cc_best_easy') === '999', 'рекорд режима не сохранён: ' + storage.get('cc_best_easy'));
    G.setDiff('normal');
  });

  step('поток разреженный: не больше 6 машин в ряду и просвет от 1.4 клетки', () => {
    releaseAll();
    let lanes = 0, cars = 0, minGapCells = Infinity, maxCars = 0;
    for (const id of ['easy', 'normal', 'hard']) {
      G.setDiff(id);
      for (let w = 0; w < 6; w++) {
        G.start();
        const rows = G.rows();
        for (const k of Object.keys(rows)) {
          const r = rows[k];
          if (r.type !== 'road' || !r.items.length) { continue; }
          lanes++;
          cars += r.items.length;
          if (r.items.length > maxCars) { maxCars = r.items.length; }
          assert(r.items.length <= 6, id + ': в ряду ' + r.items.length + ' машин — слишком плотно');
          // просвет между соседними машинами по кольцу
          const xs = r.items.map((it) => it.x).sort((a, b) => a - b);
          for (let i = 1; i < xs.length; i++) {
            const gapCells = (xs[i] - xs[i - 1]) / 48 - r.items[0].len;
            if (gapCells < minGapCells) { minGapCells = gapCells; }
          }
        }
      }
    }
    const avgCars = cars / lanes;
    assert(avgCars < 4.5, 'в среднем слишком много машин в ряду: ' + avgCars.toFixed(1));
    assert(minGapCells > 1.4, 'найден слишком узкий просвет: ' + minGapCells.toFixed(2) + ' клетки');
    console.log('       машин в ряду: в среднем ' + avgCars.toFixed(1) + ', максимум ' + maxCars
      + '; самый узкий просвет: ' + minGapCells.toFixed(2) + ' клетки');
    G.setDiff('normal');
  });

  step('новые 2D-модели машин выезжают на дороги', () => {
    releaseAll();
    const seen = new Set();
    G.setDiff('normal');
    for (let i = 0; i < 12; i++) {
      G.start();
      const rows = G.rows();
      for (const k of Object.keys(rows)) {
        const r = rows[k];
        if (r.type === 'road' && r.items) { r.items.forEach((it) => seen.add(it.kind)); }
      }
    }
    for (const kind of ['sport', 'pickup', 'ambulance', 'tractor', 'moto']) {
      assert(seen.has(kind), 'машина «' + kind + '» ни разу не сгенерировалась');
    }
    assert(seen.size >= 10, 'мало типов машин в потоке: ' + seen.size + ' (' + [...seen].join(', ') + ')');
  });

  step('скины: покупка за монеты, надевание, сохранение', () => {
    releaseAll();
    const list = G.skinList();
    assert(list.length >= 8, 'мало скинов: ' + list.length);
    assert(G.skinCards() === list.length, 'карточки магазина не построены: ' + G.skinCards());
    const paid = list.filter((s) => s.price > 0)[0];
    assert(paid, 'нет ни одного платного скина');

    G.setCoins(0);
    assert(G.buySkin(paid.id) === false, 'скин купился без монет');
    assert(G.skinList().filter((s) => s.id === paid.id)[0].owned === false, 'скин выдан бесплатно');

    G.setCoins(paid.price + 5);
    assert(G.buySkin(paid.id) === true, 'скин не купился при достатке монет');
    assert(G.coins() === 5, 'монеты списались неверно: ' + G.coins());
    assert(G.equipSkin(paid.id) === true, 'скин не наделся');
    assert(G.skin() === paid.id, 'надет не тот скин: ' + G.skin());
    assert(storage.get('cc_skin') === paid.id, 'выбранный скин не сохранился: ' + storage.get('cc_skin'));
    assert(storage.get('cc_skins').indexOf(paid.id) >= 0, 'купленный скин не сохранился: ' + storage.get('cc_skins'));
    assert(G.equipSkin('ninja') === false || G.skinList().filter((s) => s.id === 'ninja')[0].owned, 'надеть некупленный скин нельзя');
  });

  step('каждый скин рисуется без ошибок', () => {
    releaseAll();
    G.start();
    G.setCoins(2000);
    const ids = G.skinList().map((s) => s.id);
    for (const id of ids) {
      if (!G.skinList().filter((s) => s.id === id)[0].owned) {
        assert(G.buySkin(id), 'скин ' + id + ' не купился');
      }
      assert(G.equipSkin(id), 'скин ' + id + ' не наделся');
      tick(8);
    }
    G.equipSkin('classic');
    tick(4);
  });

  step('меню паузы показывает забег и умеет выйти в меню', () => {
    releaseAll();
    G.setDiff('hard');
    G.start();
    for (let i = 0; i < 40 && G.G.score === 0; i++) {
      G.tryMove(0, 1);
      tick(12);
      if (G.G.state !== 'playing') { G.start(); }
    }
    G.pause();
    assert(G.G.state === 'paused', 'пауза не включилась: ' + G.G.state);
    assert(listeners.byId.ovPause.classList.contains('on'), 'оверлей паузы не показан');
    assert(listeners.byId.pScore.textContent === String(G.G.score), 'очки в паузе: ' + listeners.byId.pScore.textContent + ' vs ' + G.G.score);
    assert(listeners.byId.pCoins.textContent !== '', 'монеты в паузе не выведены');
    assert(listeners.byId.pDiff.textContent === 'Сложно', 'сложность в паузе: ' + listeners.byId.pDiff.textContent);

    listeners.byId.btnResume._fire('click');
    assert(G.G.state === 'playing', 'кнопка «продолжить» не вернула в игру: ' + G.G.state);
    listeners.byId.btnPauseSound._fire('click');
    listeners.byId.btnPauseSound._fire('click');

    G.pause();
    listeners.byId.btnToMenu._fire('click');
    assert(G.G.state === 'menu', 'выход в меню не сработал: ' + G.G.state);
    assert(listeners.byId.ovMenu.classList.contains('on'), 'меню не показано после выхода');
    G.setDiff('normal');
  });

  step('экран карт: 25 биомов, открыты только первые', () => {
    releaseAll();
    G.toMenu();
    const themes = G.themes();
    assert(themes.length === 25, 'ожидалось 25 биомов, найдено ' + themes.length);
    assert(G.theme() === 'meadow', 'стартовый биом не meadow: ' + G.theme());
    // лестница открытия проверяется на чистом прогрессе: предыдущие шаги
    // успели набегать ряды, поэтому обнуляем счётчик и возвращаем обратно
    const savedRows = G.meta().stats.rows;
    G.meta().stats.rows = 0;
    assert(G.themeUnlocked('meadow') && G.themeUnlocked('winter'), 'первые две карты должны быть открыты сразу');
    assert(!G.themeUnlocked('asia'), 'дальняя карта не должна быть открыта с нуля');
    assert(G.setTheme('asia') !== 'asia', 'закрытую карту выбрать нельзя');
    assert(G.setTheme('winter') === 'winter', 'открытая карта не выбралась');
    assert(G.theme() === 'winter', 'биом не переключился');
    G.meta().stats.rows = savedRows;
    assert(G.themeUnlocked('meadow'), 'с прогревом открывается лужайка');
    G.setTheme('meadow');
  });

  step('механики биомов действительно включаются', () => {
    releaseAll();
    const saved = G.meta().stats.rows;
    G.meta().stats.rows = 100000;   // открываем все карты для проверки
    const probe = (id, fn) => {
      G.setTheme(id);
      G.start();
      const rows = G.rows();
      let found = 0;
      for (const k of Object.keys(rows)) { if (fn(rows[k])) { found++; } }
      return found;
    };
    assert(probe('winter', (r) => r.ice) > 0, 'зима: лёд не появился ни на одном ряду');
    assert(probe('volcano', (r) => r.lava) > 0, 'вулкан: лава не появилась');
    assert(probe('cyberpunk', (r) => r.laser) > 0, 'киберпанк: лазерные ворота не появились');
    assert(probe('construction', (r) => r.crane) > 0, 'стройка: краны не появились');
    assert(probe('subway', (r) => r.escalator) > 0, 'метро: эскалаторы не появились');
    assert(probe('autumn', (r) => r.mud) > 0, 'осень: грязь не появилась');
    assert(probe('canyon', (r) => r.holes) > 0, 'каньон: провалы не появились');
    G.meta().stats.rows = saved;
    G.setTheme('meadow');
  });

  step('бусты, комбо и щит', () => {
    releaseAll();
    G.start();
    // комбо растёт на шагах вперёд
    for (let i = 0; i < 8; i++) { G.tryMove(0, 1); tick(12); }
    assert(G.G.combo >= 3, 'комбо не растёт на шагах вперёд: ' + G.G.combo);
    assert(G.G.comboBest >= G.G.combo, 'лучшее комбо не запоминается');
    // на всякий случай начинаем с живого забега
    if (G.G.state !== 'playing' || !G.pl.alive) { G.start(); tick(3); }
    assert(G.pl.alive, 'курица должна быть жива перед проверкой бустов');
    // щит принимает смерть на себя
    assert(G.boost('shield') === true, 'щит не активировался');
    assert(G.G.shield === 1, 'щит не выставился');
    G.die('car');
    assert(G.G.state === 'playing', 'щит не спас от смерти: ' + G.G.state);
    assert(G.G.shield === 0, 'щит не израсходовался');
    assert(G.G.invuln > 0, 'после щита нет неуязвимости');
    // буст с таймером
    assert(G.boost('double') === true, 'буст не активировался');
    assert(G.G.boost === 'double' && G.G.boostLeft > 0, 'таймер буста не запустился');
    assert(G.G.boostsUsed >= 2, 'счётчик бустов не растёт');
    assert(G.boost('nonexistent') === false, 'несуществующий буст активировался');
    // мёртвой курице буст не выдаётся
    G.die('car');
    tick(80);
    assert(G.G.state === 'over', 'после смерти нет экрана конца игры');
    assert(G.boost('shield') === false, 'буст выдался после смерти');
    tick(10);
  });

  step('бусты можно применить в паузе', () => {
    releaseAll();
    let tries = 0;
    while (G.G.state !== 'playing' && tries++ < 8) { G.start(); tick(5); }
    G.pause();
    assert(G.G.state === 'paused', 'пауза не включилась: ' + G.G.state);
    assert(G.boost('magnet') === true, 'буст не применился в паузе');
    assert(G.boostState().id === 'magnet', 'буст не отмечен активным: ' + G.boostState().id);
    G.pause();
    G.G.boost = null; G.G.boostLeft = 0; G.G.boostLabel = '';
  });

  step('магнит подбирает монеты рядом', () => {
    releaseAll();
    G.start();
    const rows = G.rows();
    const row = Object.keys(rows).map(Number).find((r) => rows[r].type === 'grass' && rows[r].coins.length);
    if (row === undefined) { return; }
    G.teleport(Math.max(0, rows[row].coins[0] - 1), row);
    tick(2);
    const before = G.G.totalCoins;
    G.G.boost = 'magnet';
    G.G.boostLeft = 3;
    G.magnet();
    assert(G.G.totalCoins > before, 'магнит не собрал монету (было ' + before + ')');
  });

  step('режимы меняют мир, испытание дня детерминировано', () => {
    releaseAll();
    const savedMode = G.mode();
    const typesOf = () => {
      const out = {};
      const rows = G.rows();
      for (const k of Object.keys(rows)) { out[rows[k].type] = 1; }
      return out;
    };
    G.setMode('water');
    G.start();
    let t = typesOf();
    assert(!t.road && !t.rail, 'в режиме «только вода» появилось лишнее: ' + Object.keys(t).join(','));
    G.setMode('rails');
    G.start();
    t = typesOf();
    assert(t.rail, 'в режиме «только рельсы» нет рельсов');
    assert(!t.water, 'в режиме «только рельсы» появилась вода');
    G.setMode(savedMode);
    // испытание дня: одинаковый мир при повторном старте
    G.daily(true);
    G.start();
    const a = Object.keys(G.rows()).map((r) => G.rows()[r].type).join('');
    G.start();
    const b = Object.keys(G.rows()).map((r) => G.rows()[r].type).join('');
    assert(a === b, 'испытание дня должно быть одинаковым');
    G.daily(false);
  });

  step('лёд скользит ровно на одну клетку за шаг', () => {
    releaseAll();
    const saved = G.meta().stats.rows;
    G.meta().stats.rows = 100000;
    G.setTheme('winter');
    let checked = 0;
    for (let attempt = 0; attempt < 25 && checked < 3; attempt++) {
      G.start();
      const rows = G.rows();
      // ищем два ряда земли подряд и делаем их сплошным льдом
      const base = Object.keys(rows).map(Number).find((r) => {
        const a = rows[r], b = rows[r + 1];
        return a && b && a.type === 'grass' && b.type === 'grass'
          && !(6 in a.obstacles) && !(6 in b.obstacles)
          && !a.coins.length && !b.coins.length;
      });
      if (base === undefined) { continue; }
      const ice = {};
      for (let c = 0; c < 13; c++) { ice[c] = 1; }
      rows[base].ice = ice;
      rows[base + 1].ice = ice;
      G.teleport(6, base);
      tick(3);
      if (G.G.state !== 'playing' || !G.pl.alive) { continue; }
      G.tryMove(0, 1);
      tick(90);
      const moved = G.G.maxRow - base;
      assert(moved <= 2, 'на сплошном льду курица уехала на ' + moved + ' рядов вместо двух');
      checked++;
    }
    assert(checked > 0, 'не удалось собрать сцену со льдом');
    G.meta().stats.rows = saved;
    G.setTheme('meadow');
  });

  step('экраны прогрессии открываются и наполняются', () => {
    releaseAll();
    G.toMenu();
    const names = ['modes', 'quests', 'ach', 'pass', 'leaders', 'store', 'stats', 'settings', 'skins', 'maps'];
    for (const name of names) {
      G.openScreen(name);
      assert(G.screens().открыто === true, 'экран не открылся: ' + name);
    }
    G.closeScreens();
    assert(listeners.byId.ovMenu.classList.contains('on'), 'после закрытия экрана меню не показалось');
    // режимы: выбор сохраняется
    const modeList = G.screens();
    assert(modeList.режимов === 6, 'должно быть 6 режимов, есть ' + modeList.режимов);
    G.setMode('water');
    assert(G.mode() === 'water', 'режим не переключился');
    G.setMode('classic');
    // магазин со слотами: покупка питомца и надевание
    G.setCoins(5000);
    G.openScreen('skins');
    assert(G.screens().предметовВМагазине > 0, 'магазин пуст');
    assert(G.pickSlotItem('pet', 'chick') === true, 'питомец не куплен');
    assert(G.cosmetics().pet === 'chick', 'питомец не надет: ' + G.cosmetics().pet);
    assert(G.cosmetics().pets === 2, 'питомец не попал в список купленных');
    assert(G.pickSlotItem('hat', 'cap') === true, 'шапка не куплена');
    assert(G.cosmetics().hat === 'cap', 'шапка не надета');
    assert(G.pickSlotItem('trail', 'spark') === true, 'след не куплен');
    assert(G.cosmetics().trail === 'spark', 'след не надет');
    G.closeScreens();
    // настройки применяются к документу
    CC_SETTINGS.set('ui', 'big');
    assert(documentStub.documentElement.getAttribute('data-ui') === 'big', 'крупный интерфейс не применился');
    CC_SETTINGS.set('ui', 'normal');
    CC_SETTINGS.set('colorblind', 'protan');
    assert(documentStub.documentElement.getAttribute('data-cb') === 'protan', 'режим для дальтоников не применился');
    CC_SETTINGS.set('colorblind', 'off');
  });

  step('питомец, шапка и след рисуются в кадре', () => {
    releaseAll();
    G.start();
    tick(10);
    // все варианты кастомизации должны рисоваться без исключений
    const pets = ['none', 'chick', 'duck', 'dragon'];
    const hats = ['none', 'cap', 'crown', 'helmet', 'ushanka'];
    const trails = ['none', 'feather', 'spark', 'snow', 'rainbow', 'fire'];
    for (const p of pets) {
      for (const h of hats) {
        G.G.pet = p; G.G.hat = h; G.G.trail = trails[(pets.indexOf(p) + hats.indexOf(h)) % trails.length];
        tick(3);
      }
    }
    G.G.pet = 'chick'; G.G.hat = 'crown'; G.G.trail = 'rainbow';
    for (let i = 0; i < 30; i++) { G.tryMove(0, 1); tick(8); }
    assert(G.G.pet === 'chick' && G.G.hat === 'crown', 'кастомизация сбросилась сама');
    G.G.pet = 'none'; G.G.hat = 'none'; G.G.trail = 'none';
  });

  step('ТВ-пульт: стрелки водят выделение, OK нажимает, Back закрывает', () => {
    releaseAll();
    G.toMenu();
    G.openScreen('modes');
    const input = sandbox.CC ? sandbox.CC.input : null;
    assert(input, 'модуль ввода недоступен');
    assert(input.overlayOpen() === true, 'экран не распознан как открытый');
    // на пустом наборе кнопок навигация не должна падать
    input.moveFocus(1);
    input.activateFocus();
    key('Escape');
    assert(listeners.byId.ovMenu.classList.contains('on'), 'Back не вернул в меню');
  });

  step('все 25 биомов играются без ошибок', () => {
    releaseAll();
    const saved = G.meta().stats.rows;
    G.meta().stats.rows = 100000;
    const dirs = [[0, 1], [1, 0], [-1, 0], [0, -1]];
    let biomes = 0, deaths = 0, bestRow = 0;
    for (const id of G.themes()) {
      assert(G.setTheme(id) === id, 'биом не переключился: ' + id);
      G.start();
      for (let i = 0; i < 400; i++) {
        if (Math.random() < 0.22) {
          const d = dirs[(Math.random() * dirs.length) | 0];
          G.tryMove(d[0], d[1]);
        }
        tick(1);
        if (G.G.state === 'over') { deaths++; G.start(); }
        if (G.G.maxRow > bestRow) { bestRow = G.G.maxRow; }
      }
      assert(G.G.particles.length < 600, 'частицы не чистятся в биоме ' + id + ': ' + G.G.particles.length);
      biomes++;
    }
    G.meta().stats.rows = saved;
    G.setTheme('meadow');
    console.log('       биомов: ' + biomes + ', смертей в прогоне: ' + deaths + ', лучший ряд: ' + bestRow);
  });

  step('мета-прогрессия: задания, достижения, сундук, сезон', () => {
    const q = G.quests();
    assert(q.daily.length === 3, 'должно быть 3 задания дня, есть ' + q.daily.length);
    assert(q.weekly.length === 2, 'должно быть 2 задания недели, есть ' + q.weekly.length);
    assert(G.achievements().length >= 20, 'мало достижений: ' + G.achievements().length);
    const lvl = G.levelInfo();
    assert(lvl.level >= 1 && lvl.rank, 'нет уровня или ранга');
    const chest = G.chest();
    assert(chest.canClaim === true, 'сундук должен быть доступен в первый день');
    const got = G.claimChest();
    assert(got && got.coins > 0, 'сундук не выдал награду');
    assert(G.chest().canClaim === false, 'сундук выдаётся дважды за день');
    const pass = G.pass();
    assert(pass.rows.length === 30, 'в сезоне должно быть 30 уровней');
    // забег двигает задания и статистику
    const before = G.meta().stats.runs;
    releaseAll();
    G.start();
    key('ArrowUp');
    tick(200);
    key('ArrowUp', true);
    G.die('car');
    tick(90);
    assert(G.meta().stats.runs > before, 'забег не засчитан в статистику: ' + G.meta().stats.runs);
  });

  step('экран скинов открывается из меню и из паузы', () => {
    releaseAll();
    G.toMenu();
    assert(G.G.state === 'menu', 'не в меню: ' + G.G.state);
    G.openSkins('menu');
    assert(listeners.byId.ovSkins.classList.contains('on'), 'экран скинов не открылся из меню');
    assert(listeners.byId.skCoins.textContent === String(G.coins()), 'кошелёк не совпадает с монетами');
    listeners.byId.btnSkinsClose._fire('click');
    assert(listeners.byId.ovMenu.classList.contains('on'), 'возврат из скинов в меню не сработал');

    G.start();
    G.pause();
    G.openSkins('pause');
    assert(listeners.byId.ovSkins.classList.contains('on'), 'экран скинов не открылся из паузы');
    assert(!listeners.byId.ovPause.classList.contains('on'), 'пауза осталась под магазином');
    listeners.byId.btnSkinsClose._fire('click');
    assert(listeners.byId.ovPause.classList.contains('on'), 'возврат из скинов в паузу не сработал');
    listeners.byId.btnResume._fire('click');
    assert(G.G.state === 'playing', 'после магазина игра не продолжилась: ' + G.G.state);
  });

  step('продолжительная сессия: 4000 кадров с автопродвижением', () => {
    G.start();
    key('ArrowUp');
    let deaths = 0;
    for (let i = 0; i < 4000; i++) {
      tick(1);
      if (G.G.state === 'over') { deaths++; G.start(); key('ArrowUp'); }
    }
    key('ArrowUp', true);
    console.log('       кадров: ' + frames + ', смертей в прогоне: ' + deaths + ', рекорд: ' + G.G.best);
  });

  step('сохранение рекорда в localStorage', () => {
    assert(storage.get('cc_best') !== undefined, 'рекорд не сохраняется');
  });

  console.log('\nВСЁ ОК — движок прожил ' + frames + ' кадров без ошибок.');
})().catch((e) => {
  console.error('\nОШИБКА ПРОГОНА:\n' + (e && e.stack ? e.stack : e));
  process.exit(1);
});
