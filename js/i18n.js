/* ============================================================================
   i18n.js — контентные строки: биомы, слоты кастомизации
   ----------------------------------------------------------------------------
   Базовые строки интерфейса живут в platform.js, а названия карт и прочего
   контента — здесь. Модуль просто выставляет window.EXTRA_STRINGS, а
   platform.js подмешивает их в свою таблицу при загрузке, поэтому порядок
   подключения важен: i18n.js идёт до platform.js.
   ========================================================================== */
(function (global) {
  'use strict';

  global.EXTRA_STRINGS = {
    ru: {
      /* 25 биомов: название и подсказка о механике */
      mapsHint: 'Открываются за пройденные ряды. У каждой карты своя погода и правила.',
      th_meadow: 'Лужайка', th_meadow_d: 'Классическая лужайка: дороги, реки и рельсы.',
      th_winter: 'Зима', th_winter_d: 'Лёд скользит — прыжок проезжает лишнюю клетку.',
      th_arctic: 'Арктика', th_arctic_d: 'Полярная ночь и мороз: стоять долго нельзя.',
      th_newyear: 'Новый год', th_newyear_d: 'Подарки вместо монет и фейерверк за дистанцию.',
      th_halloween: 'Хэллоуин', th_halloween_d: 'Туман: видно только ближние ряды.',
      th_storm: 'Гроза', th_storm_d: 'Молния бьёт в подсвеченную клетку.',
      th_autumn: 'Осень', th_autumn_d: 'Грязь замедляет прыжок, грибы дают монеты.',
      th_desert: 'Пустыня', th_desert_d: 'Песчаная буря и миражи-обманки.',
      th_savanna: 'Саванна', th_savanna_d: 'Высокая трава прячет приближение машин.',
      th_jungle: 'Джунгли', th_jungle_d: 'Крокодилы в воде и лианы над дорогой.',
      th_beach: 'Пляж', th_beach_d: 'Прилив поднимает воду, крабы идут боком.',
      th_farm: 'Ферма', th_farm_d: 'Гуси-сородичи идут рядом и подсказывают путь.',
      th_construction: 'Стройка', th_construction_d: 'Краны, ямы и падающие кирпичи.',
      th_nightcity: 'Ночной город', th_nightcity_d: 'Темно: видно только вокруг курицы.',
      th_cyberpunk: 'Киберпанк', th_cyberpunk_d: 'Лазерные ворота включаются по циклу.',
      th_subway: 'Метро', th_subway_d: 'Эскалаторы тянут назад, поезда идут чаще.',
      th_airport: 'Аэропорт', th_airport_d: 'Самолёты вместо поездов и ветер от турбин.',
      th_space: 'Космос', th_space_d: 'Низкая гравитация и метеориты.',
      th_volcano: 'Вулкан', th_volcano_d: 'Лава вместо воды, гейзеры и пепел.',
      th_canyon: 'Каньон', th_canyon_d: 'Узкие мосты и порывы ветра.',
      th_zoo: 'Зоопарк', th_zoo_d: 'Вольеры с животными перекрывают клетки.',
      th_funfair: 'Парк аттракционов', th_funfair_d: 'Карусель сносит с пути, шарики летают.',
      th_sewer: 'Канализация', th_sewer_d: 'Трубы-тоннели переносят на пять рядов.',
      th_maslenitsa: 'Русский двор', th_maslenitsa_d: 'Блины вместо монет и медведь с балалайкой.',
      th_asia: 'Азиатский квартал', th_asia_d: 'Дракон-поезд, фонарики и панды.',

      /* магазин: названия слотов и товаров, цены и состояния */
      coinsShort: '🪙', price_coins: '{n} монет', price_ad: 'реклама',
      slot_custom: 'Внешний вид', choose: 'Выбрать', chosen: 'Выбрано',
      skins_all: 'Все скины', skins_biome: 'Скины биомов',
      bundle_coins: 'Набор монет', bundle_all: 'Всё сразу',
      bundle_1: 'Горсть монет', bundle_2: 'Мешок монет', bundle_3: 'Сундук монет',
      bundle_1_n: '500 монет', bundle_2_n: '1500 монет', bundle_3_n: '5000 монет',
      no_bundle: 'Наборы появятся на площадке Яндекс Игр',
      new_badge: 'Новинка', rare_badge: 'Редкий', season_badge: 'Сезонный',
      unlocked_by_ach: 'Откроется за достижение: {s}'
    },
    en: {
      mapsHint: 'Unlocked by the rows you have passed. Every map has its own weather and rules.',
      th_meadow: 'Meadow', th_meadow_d: 'The classic meadow: roads, rivers and rails.',
      th_winter: 'Winter', th_winter_d: 'Ice slides — a hop carries one extra cell.',
      th_arctic: 'Arctic', th_arctic_d: 'Polar night and frost: do not stand still.',
      th_newyear: 'New Year', th_newyear_d: 'Gifts instead of coins and fireworks for distance.',
      th_halloween: 'Halloween', th_halloween_d: 'Fog: you only see the nearest rows.',
      th_storm: 'Thunderstorm', th_storm_d: 'Lightning strikes the marked cell.',
      th_autumn: 'Autumn', th_autumn_d: 'Mud slows hops, mushrooms give coins.',
      th_desert: 'Desert', th_desert_d: 'Sandstorm and decoy mirages.',
      th_savanna: 'Savanna', th_savanna_d: 'Tall grass hides approaching cars.',
      th_jungle: 'Jungle', th_jungle_d: 'Crocodiles in the water and vines above.',
      th_beach: 'Beach', th_beach_d: 'The tide rises, crabs walk sideways.',
      th_farm: 'Farm', th_farm_d: 'Fellow geese walk beside you and show the way.',
      th_construction: 'Construction', th_construction_d: 'Cranes, pits and falling bricks.',
      th_nightcity: 'Night city', th_nightcity_d: 'Dark: you only see around the chicken.',
      th_cyberpunk: 'Cyberpunk', th_cyberpunk_d: 'Laser gates switch on a cycle.',
      th_subway: 'Subway', th_subway_d: 'Escalators pull back, trains come often.',
      th_airport: 'Airport', th_airport_d: 'Planes instead of trains and turbine wind.',
      th_space: 'Space', th_space_d: 'Low gravity and meteors.',
      th_volcano: 'Volcano', th_volcano_d: 'Lava instead of water, geysers and ash.',
      th_canyon: 'Canyon', th_canyon_d: 'Narrow bridges and gusts of wind.',
      th_zoo: 'Zoo', th_zoo_d: 'Animal enclosures block the cells.',
      th_funfair: 'Funfair', th_funfair_d: 'The carousel sweeps you away, balloons float.',
      th_sewer: 'Sewer', th_sewer_d: 'Pipes teleport you five rows ahead.',
      th_maslenitsa: 'Russian yard', th_maslenitsa_d: 'Pancakes instead of coins and a bear with a balalaika.',
      th_asia: 'Asian quarter', th_asia_d: 'Dragon train, lanterns and pandas.',

      coinsShort: '🪙', price_coins: '{n} coins', price_ad: 'an ad',
      slot_custom: 'Looks', choose: 'Choose', chosen: 'Chosen',
      skins_all: 'All skins', skins_biome: 'Biome skins',
      bundle_coins: 'Coin bundle', bundle_all: 'Everything',
      bundle_1: 'Handful of coins', bundle_2: 'Bag of coins', bundle_3: 'Chest of coins',
      bundle_1_n: '500 coins', bundle_2_n: '1500 coins', bundle_3_n: '5000 coins',
      no_bundle: 'Bundles appear on Yandex Games',
      new_badge: 'New', rare_badge: 'Rare', season_badge: 'Seasonal',
      unlocked_by_ach: 'Unlocks with the achievement: {s}'
    }
  };
})(typeof window !== 'undefined' ? window : this);
