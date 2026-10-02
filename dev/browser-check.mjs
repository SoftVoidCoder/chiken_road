/* ============================================================================
   browser-check.mjs — проверка игры в настоящем Chromium через CDP.
   ----------------------------------------------------------------------------
   Что проверяет:
     • загрузку, отсутствие ошибок в консоли и звуковой банк (все ogg декодированы);
     • каждый экран: нет ли в подписях сырых ключей перевода, все ли иконки видны,
       не вылезает ли панель за экран (на телефоне, десктопе и телевизоре);
     • режимы: выбор сохраняется, подсвечивается и не сбрасывается;
     • покупку бустов за монеты и в меню, и прямо в паузе;
     • карты: у каждой свой транспорт и свои плавучие опоры;
     • погоду: осадки должны покрывать весь экран, а не «квадрат» в углу.
   Запуск:  node dev/browser-check.mjs            (нужен поднятый локальный сервер)
            GAME_URL=... node dev/browser-check.mjs
   ========================================================================== */
import { spawn } from 'node:child_process';

const PORT = process.env.CDP_PORT || '9441';
const GAME = process.env.GAME_URL || 'http://127.0.0.1:8080/?ysdk=off&debug=1';
const CHROME = process.env.CHROME || process.env.HOME +
  '/.cache/ms-playwright/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell';
const SIZE = process.env.WINSIZE || '900,700';

const chrome = spawn(CHROME, [`--remote-debugging-port=${PORT}`, '--no-sandbox', '--disable-gpu',
  '--hide-scrollbars', `--window-size=${SIZE}`, '--autoplay-policy=no-user-gesture-required', 'about:blank'],
  { stdio: 'ignore' });
process.on('exit', () => chrome.kill());

async function target() {
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/new?about:blank`, { method: 'PUT' });
      const j = await r.json();
      if (j.webSocketDebuggerUrl) { return j.webSocketDebuggerUrl; }
    } catch (e) { /* браузер ещё поднимается */ }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error('CDP недоступен на порту ' + PORT);
}

const ws = new WebSocket(await target());
await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
let msgId = 0;
const pending = new Map();
const errors = [];
ws.onmessage = (ev) => {
  const m = JSON.parse(ev.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); return; }
  if (m.method === 'Runtime.exceptionThrown') {
    errors.push(m.params.exceptionDetails?.exception?.description || 'исключение');
  }
};
const send = (method, params = {}) => new Promise((res) => {
  const id = ++msgId;
  pending.set(id, res);
  ws.send(JSON.stringify({ id, method, params }));
});
const ev = async (expr) => {
  const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
  if (r.result?.exceptionDetails) { throw new Error(JSON.stringify(r.result.exceptionDetails.exception)); }
  return r.result?.result?.value;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
function check(ok, msg) {
  console.log((ok ? '  ok  ' : '  FAIL ') + msg);
  if (!ok) { fails.push(msg); }
}

await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', { url: GAME });
let state = null;
for (let i = 0; i < 80; i++) {
  await wait(250);
  state = await ev('window.__CHICKEN__ ? window.__CHICKEN__.G.state : null');
  if (state && state !== 'loading') { break; }
}
check(state === 'menu', 'игра дошла до меню (состояние: ' + state + ')');

await ev(`window.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true})); window.__CHICKEN__.closeScreens(); 1`);
await wait(1200);

const audio = await ev('window.__CHICKEN__.audio()');
check(audio && audio.buffers === audio.total && audio.total > 0,
  'звуковой банк загружен целиком: ' + audio.buffers + '/' + audio.total);
check(audio.music === 'menu', 'в меню играет музыкальная тема меню (сейчас: ' + audio.music + ')');

// --- экраны: сырые ключи, иконки, размеры ---------------------------------
const screens = [['меню', null], ['режимы', 'modes'], ['задания', 'quests'], ['достижения', 'ach'],
  ['магазин', 'store'], ['статистика', 'stats'], ['настройки', 'settings'], ['карты', 'maps'], ['скины', 'skins']];
for (const [name, key] of screens) {
  await ev(`(() => { const c = window.__CHICKEN__; c.closeScreens(); ${key ? `c.openScreen('${key}');` : ''} return 1; })()`);
  await wait(420);
  const info = await ev(`(() => {
    const panel = document.querySelector('.overlay.on .panel');
    if (!panel) { return { err: 'нет открытой панели' }; }
    const pr = panel.getBoundingClientRect();
    const text = panel.innerText;
    const rawKeys = text.match(/\\b(ach|q|st|set|mode|th|pass|bundle|reward|tip|slot)_[a-z0-9_]+\\b/g);
    const icons = [...panel.querySelectorAll('svg.ic')];
    const broken = icons.filter((s) => { const r = s.getBoundingClientRect(); return r.width < 8 || r.height < 8; }).length;
    const emoji = text.match(/[\\u{1F300}-\\u{1FAFF}\\u{2600}-\\u{27BF}]/gu);
    return {
      raw: rawKeys ? [...new Set(rawKeys)].join(', ') : '',
      emoji: emoji ? emoji.join('') : '',
      icons: icons.length, broken,
      outside: pr.top < 4 || pr.bottom > innerHeight - 4 || pr.left < 4 || pr.right > innerWidth - 4
    };
  })()`);
  check(!info.err && !info.raw && !info.emoji && !info.broken && !info.outside,
    'экран «' + name + '»: ' + (info.err || ('иконок ' + info.icons +
      (info.raw ? ', сырые ключи: ' + info.raw : '') +
      (info.emoji ? ', эмодзи: ' + info.emoji : '') +
      (info.broken ? ', невидимых иконок: ' + info.broken : '') +
      (info.outside ? ', панель вылезает за экран' : ''))));
}

// --- режимы ---------------------------------------------------------------
const modes = await ev(`(() => {
  const c = window.__CHICKEN__;
  c.closeScreens(); c.openScreen('modes');
  const card = [...document.querySelectorAll('#modeGrid .themecard')].find((x) => x.getAttribute('data-mode') === 'extreme');
  card.click();
  return {
    cards: document.querySelectorAll('#modeGrid .themecard').length,
    mode: c.G.modeId, saved: c.profile().mode,
    marked: document.querySelectorAll('#modeGrid .thc-mark').length,
    hint: document.getElementById('tModesHint').textContent,
    toast: document.getElementById('toast').textContent
  };
})()`);
check(modes.cards === 6 && modes.mode === 'extreme' && modes.saved === 'extreme' &&
  modes.marked === 1 && modes.toast.length > 0,
  'раздел «Режимы»: выбор сохраняется и подтверждается (' + modes.toast + ')');
check(modes.hint.indexOf('Extreme') >= 0 || modes.hint.indexOf('Экстрим') >= 0,
  'под заголовком видно выбранный режим: ' + modes.hint.slice(0, 60));
await ev(`window.__CHICKEN__.setMode('classic'); window.__CHICKEN__.closeScreens(); 1`);

// --- покупка бустов -------------------------------------------------------
const boost = await ev(`(() => {
  const c = window.__CHICKEN__;
  c.setCoins(500);
  c.start();
  c.pause();
  const card = document.querySelector('#pauseBoostRow [data-boost="shield"]');
  const label = card ? card.textContent : '';
  card.click();
  return { label, coins: c.G.totalCoins, shield: c.G.shield };
})()`);
check(boost.shield === 1 && boost.coins < 500,
  'щит покупается за монеты прямо в паузе (монет осталось ' + boost.coins + ')');

const shop = await ev(`(() => {
  const c = window.__CHICKEN__;
  c.closeScreens(); c.toMenu(); c.setCoins(400); c.openScreen('modes');
  document.querySelector('#boostRow [data-boost="magnet"]').click();
  return { stock: JSON.parse(JSON.stringify(c.boostStock())), label: document.querySelector('#boostRow [data-boost="magnet"]').textContent };
})()`);
check(shop.stock.magnet === 1 && /1/.test(shop.label),
  'буст покупается в запас и запас виден на карточке (' + shop.label + ')');
await ev(`window.__CHICKEN__.closeScreens(); window.__CHICKEN__.meta().stats.rows = 100000; 1`);

// --- карты: транспорт, плавучие опоры, погода -----------------------------
const report = {};
for (const id of await ev('window.__CHICKEN__.themes()')) {
  await ev(`(() => { const c = window.__CHICKEN__; c.setTheme('${id}'); c.start(); c.G.state = 'playing'; return 1; })()`);
  await wait(700);
  const tr = await ev('window.__CHICKEN__.traffic()');
  const th = await ev(`window.CC.themes.get('${id}')`);
  const cars = Object.keys(tr.cars);
  const water = Object.keys(tr.water);
  report[id] = { cars, water, pool: th.cars, waterMain: th.waterMain };
  const extra = cars.filter((k) => th.cars.indexOf(k) < 0);
  check(extra.length === 0, 'карта «' + id + '»: только свой транспорт (' + cars.join(', ') + ')');
  check(water.indexOf(th.waterMain) >= 0 || water.length === 0,
    'карта «' + id + '»: плавучая опора «' + th.waterMain + '» (' + water.join(', ') + ')');
}
const pools = Object.keys(report).map((id) => report[id].pool.slice().sort().join(','));
check(new Set(pools).size === pools.length, 'у каждой карты свой набор машин');
check(new Set(Object.keys(report).map((id) => report[id].waterMain)).size >= 4,
  'плавучие опоры различаются между картами');

// --- погода: осадки по всему экрану, без «квадрата» -----------------------
for (const id of ['winter', 'cyberpunk']) {
  await ev(`(() => { const c = window.__CHICKEN__; c.setTheme('${id}'); c.start(); c.G.state = 'playing'; return 1; })()`);
  await wait(700);
  const w = await ev(`(() => {
    const CC = window.CC, st = CC.mech.state();
    if (!st.weather.length) { return { n: 0 }; }
    const cv = document.getElementById('game'), g = cv.getContext('2d');
    const W = cv.width, H = cv.height;
    const withW = g.getImageData(0, 0, W, H).data;
    const saved = st.weather.slice();
    st.weather.length = 0;
    CC.render.frame();
    const noW = g.getImageData(0, 0, W, H).data;
    saved.forEach((p) => st.weather.push(p));
    CC.render.frame();
    let n = 0, minX = 1e9, maxX = -1, minY = 1e9, maxY = -1;
    for (let y = 0; y < H; y += 2) {
      for (let x = 0; x < W; x += 2) {
        const o = (y * W + x) * 4;
        const d = Math.abs(withW[o] - noW[o]) + Math.abs(withW[o + 1] - noW[o + 1]) + Math.abs(withW[o + 2] - noW[o + 2]);
        if (d > 12) { n++; if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
      }
    }
    return { n, coverX: Math.round((maxX - minX) / W * 100), coverY: Math.round((maxY - minY) / H * 100) };
  })()`);
  check(w.n > 0 && w.coverX > 85 && w.coverY > 85,
    'погода на карте «' + id + '»: ' + w.n + ' точек, покрытие ' + w.coverX + '%×' + w.coverY + '%');
}

check(errors.length === 0, 'ошибок в консоли нет' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));

console.log('');
console.log(fails.length ? 'ПРОВАЛОВ: ' + fails.length + '\n' + fails.map((f) => '  · ' + f).join('\n')
  : 'ВСЁ ОК — интерфейс, покупки, карты и погода работают.');
ws.close();
chrome.kill();
process.exit(fails.length ? 1 : 0);
