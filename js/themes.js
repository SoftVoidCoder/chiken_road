/* themes.js — 25 биомов-карт: только данные и мелкие функции доступа.
   Никакой отрисовки и никаких строк интерфейса здесь нет: имена берутся
   из локализации по ключу 'th_<id>' (этим занимается другой файл).
   Файл чистый ES5: только var, без стрелочных функций, шаблонных строк и классов.

   ОПИСАНИЕ ПОЛЕЙ БИОМА:
     id            — латинский уникальный идентификатор (ключ локализации: 'th_' + id)
     icon          — эмодзи для меню выбора карты
     unlockRows    — сколько ВСЕГО рядов надо пройти (суммарный пробег), чтобы карта открылась
     sky           — [2] градиент фона за пределами поля: верх, низ
     grass         — [3] три тона клеток «земли» (выбираются хешем клетки)
     grassTop      — rgba-цвет верхней кромки блока земли («толщина» блока)
     road          — [3] асфальт, боковая разметка, центральная разметка
     water         — [3] цвета воды (градиент по ряду: верх, середина, низ)
     rail          — [3] гравий (щебень), шпалы, рельсы
     decor         — чем заменяются препятствия на земле; id из списка kinds движка
     decorWeights  — веса для decor (неотрицательные, сумма ровно 1, длина как у decor)
     coinStyle     — во что превращаются монеты: coin | candy | gift | pancake | shell |
                     star | crystal | lantern | egg | bolt | pearl
     weather       — осадки/эффект: null | snow | rain | sand | ash | leaf | spark |
                     petal | bubble | steam | neon
     fog           — 0..1: насколько темнеют дальние ряды (ограничивает обзор)
     dark          — 0..1: общая темнота, вокруг курицы остаётся светлое пятно
     mechanic      — механика карты: строка или массив строк, null — без механик
     cars          — пул машин биома (id; неизвестные движок заменяет на 'car')
     eagle         — кто прилетает за простой: eagle | owl | dragon | ufo | hawk |
                     seagull | bat
*/
(function (global) {
  'use strict';

  var THEMES = [

    /* 1. Лужайка — базовая карта: обычный городской транспорт, брёвна и лилии. */
    {
      id: 'meadow',
      icon: 'i-leaf',
      unlockRows: 0,
      sky: ['#131c2b', '#0b1119'],
      grass: ['#7ec850', '#78c24b', '#86d158'],
      grassTop: 'rgba(0,0,0,0.10)',
      road: ['#4b5059', 'rgba(255,255,255,0.75)', 'rgba(250,250,250,0.55)'],
      water: ['#2b6fc4', '#3482de', '#2a67b8'],
      rail: ['#9a927f', '#6d4a2f', '#cdd3dc'],
      decor: ['tree', 'rock'],
      decorWeights: [0.62, 0.38],
      coinStyle: 'coin',
      weather: null,
      fog: 0,
      dark: 0,
      mechanic: null,
      cars: ['car', 'taxi', 'van', 'bus', 'truck', 'police', 'sport', 'pickup', 'ambulance', 'moto', 'tractor'],
      waterMain: 'log',
      waterAlt: 'lily',
      eagle: 'eagle'
    },

    /* 2. Зима — снег и лёд: прыжок по льду проскальзывает на лишнюю клетку.
       По рекам плывут льдины, по дорогам ездит снегоуборочная техника. */
    {
      id: 'winter',
      icon: 'i-snow',
      unlockRows: 0,
      sky: ['#1b2740', '#0d1421'],
      grass: ['#eef4fb', '#e6eef8', '#f7fbff'],
      grassTop: 'rgba(120,150,190,0.35)',
      road: ['#5b6470', 'rgba(255,255,255,0.55)', 'rgba(240,248,255,0.45)'],
      water: ['#8fc4e8', '#a9d6f2', '#7bb4de'],
      rail: ['#b9c0c9', '#5d4a3a', '#e3e9f2'],
      decor: ['snowman', 'fir', 'iceBlock', 'rock'],
      decorWeights: [0.30, 0.30, 0.22, 0.18],
      coinStyle: 'coin',
      weather: 'snow',
      fog: 0.20,
      dark: 0.05,
      mechanic: 'ice',
      cars: ['snowplow', 'truck', 'van', 'bus', 'pickup', 'car', 'tractor'],
      waterMain: 'ice',
      waterAlt: 'log',
      eagle: 'eagle'
    },

    /* 3. Стройка — краны, кирпичи и котлованы: бетономешалки, катки, вышки.
       Вода — понтоны с бочками. */
    {
      id: 'construction',
      icon: 'i-build',
      unlockRows: 20,
      sky: ['#2d2a26', '#141312'],
      grass: ['#8a7a58', '#82724f', '#948363'],
      grassTop: 'rgba(0,0,0,0.18)',
      road: ['#4d4d4f', 'rgba(255,235,120,0.60)', 'rgba(250,225,100,0.45)'],
      water: ['#4a5a63', '#566972', '#3d4b53'],
      rail: ['#8f8a7e', '#5f432b', '#c2c7ce'],
      decor: ['crate', 'cone', 'pipe'],
      decorWeights: [0.40, 0.32, 0.28],
      coinStyle: 'bolt',
      weather: null,
      fog: 0.15,
      dark: 0.05,
      mechanic: ['crane', 'narrow'],
      cars: ['mixer', 'truck', 'roller', 'garbage', 'pickup', 'tow', 'van', 'lift'],
      waterMain: 'pontoon',
      waterAlt: 'log',
      eagle: 'eagle'
    },

    /* 4. Киберпанк — неон, лазеры и парящий транспорт. */
    {
      id: 'cyberpunk',
      icon: 'i-sunset',
      unlockRows: 60,
      sky: ['#1a0f2e', '#08040f'],
      grass: ['#2b2a4a', '#252444', '#33325a'],
      grassTop: 'rgba(0,0,0,0.28)',
      road: ['#26243a', 'rgba(0,255,240,0.55)', 'rgba(255,0,200,0.50)'],
      water: ['#1b2f6b', '#2543a0', '#152450'],
      rail: ['#5a5a72', '#3a2a4a', '#b9c6ff'],
      decor: ['pipe', 'neonSign', 'antenna'],
      decorWeights: [0.34, 0.36, 0.30],
      coinStyle: 'bolt',
      weather: 'neon',
      fog: 0.30,
      dark: 0.45,
      mechanic: 'laser',
      cars: ['hover', 'f1', 'sport', 'drone', 'moto', 'limo'],
      waterMain: 'neon',
      waterAlt: 'neon',
      eagle: 'ufo'
    },

    /* 5. Аэропорт — самолёты, тягачи и перронные автобусы; по воде ходят катера. */
    {
      id: 'airport',
      icon: 'i-plane',
      unlockRows: 120,
      sky: ['#27405e', '#0f1a28'],
      grass: ['#6f9c56', '#689350', '#79a65f'],
      grassTop: 'rgba(0,0,0,0.14)',
      road: ['#4a4d52', 'rgba(255,255,255,0.70)', 'rgba(255,215,80,0.50)'],
      water: ['#2c6b8f', '#357ba3', '#245b7a'],
      rail: ['#9aa0a8', '#5f4a35', '#d0d6de'],
      decor: ['cone', 'bench', 'fence'],
      decorWeights: [0.36, 0.32, 0.32],
      coinStyle: 'coin',
      weather: null,
      fog: 0.10,
      dark: 0,
      mechanic: ['plane', 'wind'],
      cars: ['plane', 'bus', 'tow', 'firetruck', 'van', 'limo'],
      waterMain: 'boat',
      waterAlt: 'pontoon',
      eagle: 'seagull'
    }
  ];

  var BY_ID = {};
  for (var i = 0; i < THEMES.length; i++) { BY_ID[THEMES[i].id] = THEMES[i]; }

  var Themes = {
    list: THEMES,
    byId: BY_ID,
    get: function (id) { return BY_ID[id] || THEMES[0]; },
    ids: function () { var a = []; for (var i = 0; i < THEMES.length; i++) { a.push(THEMES[i].id); } return a; },
    // сколько карт открыто при данном суммарном пробеге игрока
    unlocked: function (totalRows) {
      var a = [];
      for (var i = 0; i < THEMES.length; i++) { if ((totalRows || 0) >= THEMES[i].unlockRows) { a.push(THEMES[i].id); } }
      return a;
    },
    isUnlocked: function (id, totalRows) {
      var t = BY_ID[id] || THEMES[0];
      return (totalRows || 0) >= t.unlockRows;
    },
    next: function (totalRows) {   // следующая закрытая карта и сколько до неё рядов
      for (var i = 0; i < THEMES.length; i++) {
        if ((totalRows || 0) < THEMES[i].unlockRows) { return { id: THEMES[i].id, need: THEMES[i].unlockRows - (totalRows || 0) }; }
      }
      return null;
    }
  };
  global.Themes = Themes;
  // шина модулей: остальным модулям нужен именно CC.themes
  if (global.CC) { global.CC.themes = Themes; }
})(typeof window !== 'undefined' ? window : this);
