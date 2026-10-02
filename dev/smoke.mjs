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
