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

    /* 1. Лужайка — базовая палитра игры, без механик и эффектов. */
    {
      id: 'meadow',
      icon: '🌿',
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
      cars: ['car', 'taxi', 'van', 'bus', 'truck', 'police', 'sport', 'pickup', 'ambulance', 'tractor', 'moto'],
      eagle: 'eagle'
    },

    /* 2. Зима — снег и лёд: прыжок по льду проскальзывает на лишнюю клетку. */
    {
      id: 'winter',
      icon: '❄️',
      unlockRows: 0,
      sky: ['#1b2740', '#0d1421'],
      grass: ['#eef4fb', '#e6eef8', '#f7fbff'],
      grassTop: 'rgba(120,150,190,0.35)',
      road: ['#5b6470', 'rgba(255,255,255,0.55)', 'rgba(240,248,255,0.45)'],
      water: ['#bcdcf5', '#d6ecfb', '#a8cdea'],
      rail: ['#b9c0c9', '#5d4a3a', '#e3e9f2'],
      decor: ['snowman', 'fir', 'iceBlock', 'rock'],
      decorWeights: [0.30, 0.30, 0.22, 0.18],
      coinStyle: 'coin',
      weather: 'snow',
      fog: 0.20,
      dark: 0.05,
      mechanic: 'ice',
      cars: ['car', 'taxi', 'van', 'bus', 'truck', 'pickup', 'snowplow', 'sport', 'police', 'moto'],
      eagle: 'eagle'
    },

    /* 3. Арктика — полярная ночь и северное сияние: холод сковывает, сияние слепит. */
    {
      id: 'arctic',
      icon: '🌌',
      unlockRows: 40,
      sky: ['#0a1230', '#050a18'],
      grass: ['#cfe0f2', '#c2d6ee', '#dcebfb'],
      grassTop: 'rgba(90,130,180,0.35)',
      road: ['#3c4654', 'rgba(190,220,255,0.55)', 'rgba(200,230,255,0.40)'],
      water: ['#123a6e', '#1a4f92', '#0f2f5c'],
      rail: ['#8f9aa8', '#4a3a2c', '#c6d3e2'],
      decor: ['iceBlock', 'fir', 'crystal'],
      decorWeights: [0.45, 0.32, 0.23],
      coinStyle: 'crystal',
      weather: 'snow',
      fog: 0.25,
      dark: 0.30,
      mechanic: ['freeze', 'aurora'],
      cars: ['car', 'van', 'truck', 'bus', 'snowplow', 'pickup'],
      eagle: 'owl'
    },

    /* 4. Новый год — ёлки, подарки и гирлянды вместо монет. */
    {
      id: 'newyear',
      icon: '🎄',
      unlockRows: 60,
      sky: ['#0f2033', '#071018'],
      grass: ['#e8f1fb', '#dbe8f7', '#f4faff'],
      grassTop: 'rgba(80,120,170,0.30)',
      road: ['#4a5160', 'rgba(255,235,180,0.65)', 'rgba(255,220,150,0.50)'],
      water: ['#2f6fb0', '#3d82c8', '#285f9c'],
      rail: ['#9fa8b4', '#6a4a30', '#e8eef7'],
      decor: ['fir', 'gift', 'snowman'],
      decorWeights: [0.45, 0.30, 0.25],
      coinStyle: 'gift',
      weather: 'spark',
      fog: 0.15,
      dark: 0.15,
      mechanic: null,
      cars: ['car', 'taxi', 'bus', 'van', 'truck', 'sleigh', 'pickup', 'police'],
      eagle: 'eagle'
    },

    /* 5. Хэллоуин — густой туман, конфеты вместо монет, прилетает летучая мышь. */
    {
      id: 'halloween',
      icon: '🎃',
      unlockRows: 80,
      sky: ['#1a1024', '#0a0610'],
      grass: ['#3f5a34', '#37502e', '#48663c'],
      grassTop: 'rgba(0,0,0,0.22)',
      road: ['#3a3540', 'rgba(255,200,120,0.55)', 'rgba(240,170,90,0.40)'],
      water: ['#2a3f56', '#31506b', '#22334a'],
      rail: ['#6b6459', '#4a3020', '#a8a294'],
      decor: ['pumpkin', 'tree', 'ghost'],
      decorWeights: [0.40, 0.35, 0.25],
      coinStyle: 'candy',
      weather: null,
      fog: 0.55,
      dark: 0.30,
      mechanic: 'fog',
      cars: ['car', 'van', 'truck', 'bus', 'pickup', 'moto'],
      eagle: 'bat'
    },

    /* 6. Гроза — ливень и молнии: вспышка бьёт по открытым клеткам. */
    {
      id: 'storm',
      icon: '⛈️',
      unlockRows: 100,
      sky: ['#151b26', '#080b12'],
      grass: ['#4f7a42', '#48713c', '#578548'],
      grassTop: 'rgba(0,0,0,0.20)',
      road: ['#3f444d', 'rgba(230,235,240,0.60)', 'rgba(220,228,238,0.45)'],
      water: ['#1f4f8f', '#2660a8', '#1b4478'],
      rail: ['#8a8474', '#5f4028', '#b9bfc8'],
      decor: ['tree', 'rock'],
      decorWeights: [0.60, 0.40],
      coinStyle: 'coin',
      weather: 'rain',
      fog: 0.30,
      dark: 0.35,
      mechanic: 'lightning',
      cars: ['car', 'taxi', 'van', 'bus', 'truck', 'police', 'pickup', 'ambulance', 'moto'],
      eagle: 'hawk'
    },

    /* 7. Осень — листопад и грязь: грязь замедляет прыжок. */
    {
      id: 'autumn',
      icon: '🍂',
      unlockRows: 120,
      sky: ['#2a1d15', '#150e09'],
      grass: ['#c9873f', '#bf7c37', '#d4944a'],
      grassTop: 'rgba(90,50,10,0.18)',
      road: ['#4a4640', 'rgba(255,240,210,0.60)', 'rgba(250,230,190,0.45)'],
      water: ['#3a6b8f', '#457ba3', '#325d7d'],
      rail: ['#93876f', '#63432a', '#c4c9d2'],
      decor: ['tree', 'mushroom', 'bush'],
      decorWeights: [0.50, 0.25, 0.25],
      coinStyle: 'coin',
      weather: 'leaf',
      fog: 0.15,
      dark: 0.05,
      mechanic: 'mud',
      cars: ['car', 'taxi', 'van', 'bus', 'truck', 'pickup', 'tractor', 'moto'],
      eagle: 'eagle'
    },

    /* 8. Пустыня — песчаная буря и миражи: часть препятствий только чудится. */
    {
      id: 'desert',
      icon: '🏜️',
      unlockRows: 140,
      sky: ['#3a2a1c', '#1c130c'],
      grass: ['#e3c98b', '#d9bd7c', '#edd79b'],
      grassTop: 'rgba(120,90,40,0.18)',
      road: ['#5c5348', 'rgba(255,250,230,0.60)', 'rgba(250,240,210,0.45)'],
      water: ['#2f8f8a', '#3aa39c', '#267a75'],
      rail: ['#a89676', '#6b4a2c', '#d5d9e0'],
      decor: ['cactus', 'rock', 'bones'],
      decorWeights: [0.45, 0.35, 0.20],
      coinStyle: 'coin',
      weather: 'sand',
      fog: 0.45,
      dark: 0,
      mechanic: 'mirage',
      cars: ['car', 'pickup', 'truck', 'van', 'bus', 'moto'],
      eagle: 'hawk'
    },

    /* 9. Саванна — высокая жёлто-зелёная трава скрывает машины до последнего. */
    {
      id: 'savanna',
      icon: '🦒',
      unlockRows: 170,
      sky: ['#3b2f1e', '#1d1710'],
      grass: ['#cbbf5c', '#c2b551', '#d6cb6a'],
      grassTop: 'rgba(90,80,20,0.16)',
      road: ['#5b5446', 'rgba(255,245,215,0.60)', 'rgba(250,235,190,0.45)'],
      water: ['#3e7f9e', '#4a91b3', '#356f8c'],
      rail: ['#9a8f6c', '#644530', '#c9ced6'],
      decor: ['acacia', 'bush', 'tallgrass'],
      decorWeights: [0.40, 0.28, 0.32],
      coinStyle: 'coin',
      weather: null,
      fog: 0.20,
      dark: 0,
      mechanic: 'hidegrass',
      cars: ['car', 'pickup', 'truck', 'van', 'bus', 'moto', 'sport'],
      eagle: 'hawk'
    },

    /* 10. Джунгли — лианы и мутный брод с крокодилами вместо воды. */
    {
      id: 'jungle',
      icon: '🌴',
      unlockRows: 200,
      sky: ['#10261c', '#071410'],
      grass: ['#3f7a3a', '#377032', '#4a8a44'],
      grassTop: 'rgba(0,0,0,0.22)',
      road: ['#454b41', 'rgba(230,255,225,0.50)', 'rgba(220,250,215,0.35)'],
      water: ['#3f6b3a', '#4a7d44', '#345a30'],
      rail: ['#8d8a76', '#5c4327', '#c0c7cc'],
      decor: ['palm', 'bush', 'vine'],
      decorWeights: [0.40, 0.30, 0.30],
      coinStyle: 'coin',
      weather: null,
      fog: 0.25,
      dark: 0.10,
      mechanic: 'croc',
      cars: ['car', 'pickup', 'van', 'truck', 'moto'],
      eagle: 'eagle'
    },

    /* 11. Пляж — тёплая вода, прилив и крабы; ракушки вместо монет. */
    {
      id: 'beach',
      icon: '🏖️',
      unlockRows: 230,
      sky: ['#2e6d94', '#123449'],
      grass: ['#eed9a8', '#e6cf97', '#f6e4b6'],
      grassTop: 'rgba(150,120,60,0.16)',
      road: ['#5f5a52', 'rgba(255,255,255,0.70)', 'rgba(250,250,250,0.50)'],
      water: ['#2fa8c4', '#3ec0d8', '#2693ae'],
      rail: ['#a3977a', '#6b4a2f', '#d3d8de'],
      decor: ['palm', 'umbrella', 'shell'],
      decorWeights: [0.40, 0.32, 0.28],
      coinStyle: 'shell',
      weather: null,
      fog: 0.10,
      dark: 0,
      mechanic: ['tide', 'crab'],
      cars: ['car', 'taxi', 'van', 'bus', 'pickup', 'sport'],
      eagle: 'seagull'
    },

    /* 12. Ферма — стога и плетни, рядом идут гуси; первым в пуле трактор. */
    {
      id: 'farm',
      icon: '🚜',
      unlockRows: 260,
      sky: ['#2b3f5c', '#111c2b'],
      grass: ['#8cc24a', '#84b945', '#98ce56'],
      grassTop: 'rgba(0,0,0,0.12)',
      road: ['#574f43', 'rgba(255,245,220,0.65)', 'rgba(250,235,200,0.50)'],
      water: ['#2f7a86', '#3a8d99', '#276872'],
      rail: ['#9c937c', '#6a4629', '#ccd2da'],
      decor: ['haystack', 'fence', 'sunflower'],
      decorWeights: [0.36, 0.34, 0.30],
      coinStyle: 'egg',
      weather: null,
      fog: 0.05,
      dark: 0,
      mechanic: 'geese',
      cars: ['tractor', 'pickup', 'car', 'van', 'truck', 'bus', 'moto'],
      eagle: 'eagle'
    },

    /* 13. Стройка — краны, ямы и кирпичи: половина пути перекопана. */
    {
      id: 'construction',
      icon: '🏗️',
      unlockRows: 300,
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
      mechanic: ['crane', 'brick', 'pit'],
      cars: ['truck', 'van', 'pickup', 'car', 'bus', 'moto'],
      eagle: 'eagle'
    },

    /* 14. Ночной город — видно только пятно света вокруг курицы. */
    {
      id: 'nightcity',
      icon: '🌃',
      unlockRows: 340,
      sky: ['#0d1626', '#05080f'],
      grass: ['#3a4a3a', '#334333', '#435343'],
      grassTop: 'rgba(0,0,0,0.28)',
      road: ['#2f333c', 'rgba(255,255,255,0.55)', 'rgba(255,240,180,0.50)'],
      water: ['#1b3550', '#22425f', '#152a41'],
      rail: ['#5f6470', '#3d2a1a', '#8f98a8'],
      decor: ['tree', 'bench', 'trashbin'],
      decorWeights: [0.45, 0.30, 0.25],
      coinStyle: 'coin',
      weather: null,
      fog: 0.40,
      dark: 0.60,
      mechanic: 'lights',
      cars: ['taxi', 'car', 'van', 'bus', 'truck', 'police', 'sport', 'moto'],
      eagle: 'owl'
    },

    /* 15. Киберпанк — неон и лазерные ворота, которые включаются по такту. */
    {
      id: 'cyberpunk',
      icon: '🌆',
      unlockRows: 380,
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
      cars: ['sport', 'car', 'taxi', 'moto', 'van', 'police'],
      eagle: 'ufo'
    },

    /* 16. Метро — эскалаторы, турникеты и крысы; поезда здесь ходят чаще
       (частоту задаёт движок, палитра rail — узкоколейка метро). */
    {
      id: 'subway',
      icon: '🚇',
      unlockRows: 420,
      sky: ['#181b20', '#080a0d'],
      grass: ['#5a5c60', '#52545a', '#63666c'],
      grassTop: 'rgba(0,0,0,0.25)',
      road: ['#3a3d43', 'rgba(255,240,190,0.60)', 'rgba(255,225,150,0.45)'],
      water: ['#3d4a52', '#495a63', '#33403a'],
      rail: ['#7c7c80', '#4a3a2c', '#cfd6e0'],
      decor: ['bench', 'trashbin', 'pipe'],
      decorWeights: [0.40, 0.32, 0.28],
      coinStyle: 'coin',
      weather: null,
      fog: 0.35,
      dark: 0.40,
      mechanic: 'escalator',
      cars: ['car', 'van', 'taxi', 'bus', 'moto'],
      eagle: 'bat'
    },

    /* 17. Аэропорт — самолёты вместо поездов и ветер от турбин. */
    {
      id: 'airport',
      icon: '✈️',
      unlockRows: 460,
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
      cars: ['bus', 'van', 'car', 'taxi', 'truck', 'pickup'],
      eagle: 'seagull'
    },

    /* 18. Космос — низкая гравитация и метеориты; вместо монет звёзды. */
    {
      id: 'space',
      icon: '🚀',
      unlockRows: 500,
      sky: ['#0a0a1e', '#02020a'],
      grass: ['#3a3a52', '#33334a', '#43435e'],
      grassTop: 'rgba(255,255,255,0.10)',
      road: ['#2e2e40', 'rgba(180,220,255,0.50)', 'rgba(150,200,255,0.40)'],
      water: ['#1a3a6e', '#224a8a', '#132c56'],
      rail: ['#6d6d80', '#443a52', '#c8d4e8'],
      decor: ['crystal', 'crater', 'antenna'],
      decorWeights: [0.34, 0.36, 0.30],
      coinStyle: 'star',
      weather: null,
      fog: 0.25,
      dark: 0.75,
      mechanic: ['lowgrav', 'meteor'],
      cars: ['sport', 'car', 'van', 'truck', 'moto', 'bus'],
      eagle: 'ufo'
    },

    /* 19. Вулкан — вода становится лавой, с неба сыпется пепел. */
    {
      id: 'volcano',
      icon: '🌋',
      unlockRows: 550,
      sky: ['#2a1108', '#0d0503'],
      grass: ['#4a3a34', '#42332e', '#54423a'],
      grassTop: 'rgba(0,0,0,0.25)',
      road: ['#3d3630', 'rgba(255,180,80,0.55)', 'rgba(255,120,40,0.50)'],
      water: ['#e2541c', '#f4762a', '#c33f10'],
      rail: ['#7a6a5c', '#4a2f22', '#c0b0a0'],
      decor: ['rock', 'bones', 'crystal'],
      decorWeights: [0.42, 0.30, 0.28],
      coinStyle: 'coin',
      weather: 'ash',
      fog: 0.30,
      dark: 0.30,
      mechanic: ['lava', 'geyser'],
      cars: ['truck', 'pickup', 'van', 'car', 'moto'],
      eagle: 'hawk'
    },

    /* 20. Каньон — узкие мосты и порывы ветра, сносящие в сторону. */
    {
      id: 'canyon',
      icon: '🏞️',
      unlockRows: 600,
      sky: ['#3a2418', '#150d08'],
      grass: ['#b4744a', '#ab6c44', '#c07f53'],
      grassTop: 'rgba(60,30,10,0.20)',
      road: ['#5a4f45', 'rgba(255,240,215,0.60)', 'rgba(250,230,200,0.45)'],
      water: ['#2f6b7a', '#387d8e', '#275866'],
      rail: ['#9a8a72', '#63432b', '#cbd0d8'],
      decor: ['rock', 'cactus', 'bones'],
      decorWeights: [0.50, 0.28, 0.22],
      coinStyle: 'coin',
      weather: 'sand',
      fog: 0.30,
      dark: 0.10,
      mechanic: ['wind', 'narrow'],
      cars: ['pickup', 'truck', 'car', 'van', 'moto'],
      eagle: 'hawk'
    },

    /* 21. Зоопарк — вольеры перегораживают ряды, ров вокруг вольера. */
    {
      id: 'zoo',
      icon: '🦓',
      unlockRows: 650,
      sky: ['#3a6b8f', '#16283a'],
      grass: ['#7dbd52', '#75b54b', '#88c95d'],
      grassTop: 'rgba(0,0,0,0.12)',
      road: ['#565049', 'rgba(255,250,230,0.65)', 'rgba(250,240,210,0.50)'],
      water: ['#2f86a8', '#3a98bd', '#277394'],
      rail: ['#9c937c', '#6a4629', '#ccd2da'],
      decor: ['fence', 'tree', 'bench'],
      decorWeights: [0.40, 0.35, 0.25],
      coinStyle: 'coin',
      weather: null,
      fog: 0.10,
      dark: 0,
      mechanic: 'enclosure',
      cars: ['car', 'van', 'bus', 'taxi', 'pickup', 'truck'],
      eagle: 'eagle'
    },

    /* 22. Парк аттракционов — карусель, шарики и мыльные пузыри. */
    {
      id: 'funfair',
      icon: '🎡',
      unlockRows: 700,
      sky: ['#3a1f4a', '#140a1c'],
      grass: ['#79b854', '#71af4c', '#85c45e'],
      grassTop: 'rgba(0,0,0,0.14)',
      road: ['#5a4f5c', 'rgba(255,220,240,0.70)', 'rgba(255,200,230,0.50)'],
      water: ['#2f6fc4', '#3d82de', '#2a63b0'],
      rail: ['#a09780', '#6d4a2f', '#d8dde6'],
      decor: ['balloon', 'bench', 'cone'],
      decorWeights: [0.42, 0.32, 0.26],
      coinStyle: 'candy',
      weather: 'bubble',
      fog: 0.10,
      dark: 0.20,
      mechanic: ['carousel', 'balloon'],
      cars: ['car', 'taxi', 'van', 'bus', 'sport', 'moto', 'police'],
      eagle: 'eagle'
    },

    /* 23. Канализация — тоннели, пар и грязная вода, крысы под ногами. */
    {
      id: 'sewer',
      icon: '🕳️',
      unlockRows: 760,
      sky: ['#171b16', '#070907'],
      grass: ['#4a5242', '#434a3c', '#525a49'],
      grassTop: 'rgba(0,0,0,0.28)',
      road: ['#3a4038', 'rgba(200,220,180,0.45)', 'rgba(180,200,160,0.35)'],
      water: ['#4a5a2f', '#586b38', '#3d4b26'],
      rail: ['#6b6a5c', '#42332a', '#a9b0a0'],
      decor: ['pipe', 'trashbin', 'rat'],
      decorWeights: [0.40, 0.30, 0.30],
      coinStyle: 'coin',
      weather: 'steam',
      fog: 0.35,
      dark: 0.50,
      mechanic: ['tunnel', 'steam'],
      cars: ['van', 'truck', 'car', 'bus', 'moto'],
      eagle: 'bat'
    },

    /* 24. Масленица — русский двор: блины вместо монет, самовар и медведь. */
    {
      id: 'maslenitsa',
      icon: '🥞',
      unlockRows: 820,
      sky: ['#2a2a44', '#12121f'],
      grass: ['#e6ecf2', '#dde5ee', '#f0f5fa'],
      grassTop: 'rgba(120,140,170,0.30)',
      road: ['#54493f', 'rgba(255,225,160,0.65)', 'rgba(255,205,120,0.50)'],
      water: ['#3a6f9c', '#457fb0', '#2f5d85'],
      rail: ['#a09478', '#6a4629', '#d2d8e0'],
      decor: ['samovar', 'matryoshka', 'haystack'],
      decorWeights: [0.34, 0.34, 0.32],
      coinStyle: 'pancake',
      weather: 'snow',
      fog: 0.10,
      dark: 0.10,
      mechanic: null,
      cars: ['car', 'van', 'truck', 'bus', 'pickup', 'tractor'],
      eagle: 'eagle'
    },

    /* 25. Азиатский квартал — фонарики, панда и поезд-дракон (палитра rail
       в золоте дракона; самого дракона рисует движок). */
    {
      id: 'asia',
      icon: '🏮',
      unlockRows: 900,
      sky: ['#2b1620', '#100709'],
      grass: ['#8a6f52', '#82674a', '#96795b'],
      grassTop: 'rgba(0,0,0,0.18)',
      road: ['#463f3a', 'rgba(255,225,150,0.65)', 'rgba(255,190,110,0.50)'],
      water: ['#2f6f8f', '#3a82a3', '#276078'],
      rail: ['#8f7a5c', '#5c3a24', '#e0c98f'],
      decor: ['lantern', 'bamboo', 'panda'],
      decorWeights: [0.36, 0.34, 0.30],
      coinStyle: 'lantern',
      weather: 'petal',
      fog: 0.15,
      dark: 0.25,
      mechanic: null,
      cars: ['car', 'taxi', 'van', 'bus', 'truck', 'moto', 'pickup'],
      eagle: 'dragon'
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
