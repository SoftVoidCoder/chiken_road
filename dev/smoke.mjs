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

const root = fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'game.js'))
  ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')            // dev/ внутри репозитория игры
  : path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'crossy'); // dev/ рядом с папкой crossy
const gameSrc = fs.readFileSync(path.join(root, 'game.js'), 'utf8');
const platSrc = fs.readFileSync(path.join(root, 'platform.js'), 'utf8');

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
    setAttribute() {}, getAttribute() { return null; },
    getContext() { return ctx; },
    appendChild() {}, focus() {}, blur() {},
    querySelector() { return makeEl('sub'); }, querySelectorAll() { return []; },
    _fire(t, e) { (ls[t] || []).forEach((f) => f(e || { preventDefault() {} })); }
  };
  return el;
}
const documentStub = {
  hidden: false,
  title: '',
  body: makeEl('body'),
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
  location: { search: '' },
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

  vm.runInContext(platSrc, sandbox, { filename: 'platform.js' });
  vm.runInContext(gameSrc, sandbox, { filename: 'game.js' });

  const G = sandbox.window.__CHICKEN__;
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
    assert(!listeners.byId.ovMenu.classList.contains('on') === false, 'меню не показано');
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
    G.start();
    const rows = G.rows();
    const withCoin = Object.keys(rows).map(Number).find((r) => rows[r].type === 'grass' && rows[r].coins.length);
    if (withCoin === undefined) { return; }
    const obj = rows[withCoin];
    const before = G.G.totalCoins;
    // встаём на соседнюю клетку и шагаем на монету — так срабатывает приземление
    G.teleport(Math.max(0, obj.coins[0] - 1), withCoin - 1);
    G.tryMove(1, 1);
    tick(20);
    assert(G.G.totalCoins > before, 'монета не начислилась (было ' + before + ', стало ' + G.G.totalCoins + ')');
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
