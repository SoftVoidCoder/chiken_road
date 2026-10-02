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
      th_construction: 'Стройка', th_construction_d: 'Краны, ямы и падающие кирпичи.',
      th_cyberpunk: 'Киберпанк', th_cyberpunk_d: 'Лазерные ворота включаются по циклу.',
      th_airport: 'Аэропорт', th_airport_d: 'Самолёты вместо поездов и ветер от турбин.',

      /* магазин: названия слотов и товаров, цены и состояния */
      coinsShort: '', price_coins: '{n} монет', price_ad: 'реклама',
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
      th_construction: 'Construction', th_construction_d: 'Cranes, pits and falling bricks.',
      th_cyberpunk: 'Cyberpunk', th_cyberpunk_d: 'Laser gates switch on a cycle.',
      th_airport: 'Airport', th_airport_d: 'Planes instead of trains and turbine wind.',

      coinsShort: '', price_coins: '{n} coins', price_ad: 'an ad',
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
