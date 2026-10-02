/* ============================================================================
   platform.js — слой интеграции с Yandex Games SDK v2 (+ локальный фолбэк)
   ----------------------------------------------------------------------------
   Что делает:
     • Грузит SDK асинхронно (не блокирует старт игры) с таймаутом и фолбэком
     • LoadingAPI.ready()      — сообщаем платформе, что игра загружена
     • GameplayAPI.start/stop  — обязательные вызовы при старте/паузе геймплея
     • События game_api_pause / game_api_resume через ysdk.on() (п. 1.19.4)
     • Межстраничная реклама   — кулдаун + только после длинного забега
     • Rewarded video          — удвоение монет, второй шанс, сундук, ×2 дистанции
     • Липкий баннер           — включается осознанно
     • Инап-покупки            — каталог, покупка и ОБЯЗАТЕЛЬНОЕ консумирование
                                 (п. 1.13.1), портальная валюта из SDK (п. 1.13.2)
     • Сохранения              — player.setData/getData + зеркало в localStorage
     • Лидерборды              — общий, по сложностям, испытание дня и недели
     • Оценка игры             — feedback.canReview/requestReview (п. 6.1)
     • Авторизация             — только по осознанному нажатию (п. 1.2.1)
     • A/B-разметка игроков    — стабильный бакет для экспериментов
     • Метрики                 — локальный счётчик событий для экрана статистики
     • Локализация             — ru / en; базовые строки здесь, контент в strings.js
   ========================================================================== */
(function (global) {
  'use strict';

  /* --- настройки ---------------------------------------------------------- */
  // id таблиц лидеров из консоли разработчика; '' = таблица выключена
  var LEADERBOARDS = {
    best: '',          // общий рекорд
    easy: '',
    normal: '',
    hard: '',
    daily: '',         // испытание дня
    weekly: ''         // недельный челлендж
  };
  var SDK_URL           = 'https://yandex.ru/games/sdk/v2';
  var SDK_TIMEOUT_MS    = 6000;    // сколько ждём SDK, прежде чем играть без него
  var AD_COOLDOWN_MS    = 62000;   // Яндекс: межстраничная реклама не чаще 1 раза в минуту
  var AD_MIN_RUN_MS     = 20000;   // не показываем рекламу после коротких забегов
  var USE_STICKY_BANNER = false;   // липкий баннер: включать осознанно
  var FEEDBACK_EMAIL    = 'tehnoblogery754@gmail.com';   // п. 6.1 — обратная связь
  var REWARDED_COOLDOWN_MS = 3000; // антиспам для кнопок «за рекламу»

  /* --- локализация: базовые строки ---------------------------------------- */
  var STRINGS = {
    ru: {
      play: 'Играть', loading: 'Загрузка…', tap: 'Тап — шаг вперёд, свайп — в сторону',
      best: 'Рекорд', coins: 'Монеты', score: 'Очки', total: 'Всего',
      gameOver: 'Игра окончена', record: 'Новый рекорд!',
      playAgain: 'Играть снова', revive: 'Продолжить за рекламу', reviveWait: 'Загрузка рекламы…',
      paused: 'Пауза', resume: 'Продолжить', restart: 'Заново', sound: 'Звук',
      controlsDesktop: 'WASD / стрелки — шаг, P — пауза, M — звук',
      controlsMobile: 'Тап — вперёд, свайп — в сторону',
      r_car: 'Курицу сбила машина', r_train: 'Курицу переехал поезд', r_water: 'Курица утонула',
      r_edge: 'Курицу унесло течением', r_eagle: 'Курицу унёс орёл',
      r_lava: 'Курица сгорела в лаве', r_brick: 'Курицу придавило кирпичом',
      r_meteor: 'В курицу попал метеорит', r_laser: 'Курицу разрезал лазер',
      r_lightning: 'В курицу попала молния', r_crane: 'Курицу сбил кран',
      r_carousel: 'Курицу снесла карусель', r_plane: 'Курицу переехал самолёт',
      hintEagle: 'Не стой на месте — прилетит орёл!',

      /* сложность */
      diffEasy: 'Легко', diffEasySub: 'без спешки',
      diffNormal: 'Обычно', diffNormalSub: 'как в оригинале',
      diffHard: 'Сложно', diffHardSub: 'трафик и орёл',
      diffEasyHint: 'Машины едут медленнее, зазоры шире, орёл ждёт дольше.',
      diffNormalHint: 'Классический баланс: средний трафик и орёл через 10 секунд.',
      diffHardHint: 'Плотный поток, быстрые реки и орёл уже через 7 секунд — зато монет больше.',
      pauseHint: 'P / Esc — продолжить, M — звук', toMenu: 'В меню',

      /* скины */
      skins: 'Скины', wallet: 'Монеты', back: 'Назад', close: 'Закрыть',
      skinsHint: 'Купи скин за монеты и надень его — курица сразу изменится.',
      buy: 'Купить', equip: 'Надеть', equipped: 'Надето', owned: 'Куплено',
      poor: 'Мало монет', bought: 'Куплено!', notEnough: 'Не хватает монет',
      watch_ad: 'За рекламу', boost_on: 'Включено: {s}', soon: 'Недоступно', stock: 'Запас',
      store_local_note: 'Витрина и реклама работают внутри Яндекс Игр',
      st_min: 'мин', st_inter: 'Межстраничная реклама',
      sk_classic: 'Классика', sk_chick: 'Цыплёнок', sk_bandit: 'Разбойник', sk_ninja: 'Ниндзя',
      sk_zombie: 'Зомби', sk_robot: 'Робот', sk_gold: 'Золотая', sk_rainbow: 'Радуга',

      /* меню и разделы */
      shop: 'Магазин', quests: 'Задания', achievements: 'Достижения', stats: 'Статистика',
      settings: 'Настройки', maps: 'Карты', pass: 'Сезон', chest: 'Сундук', modes: 'Режимы',
      daily: 'Испытание дня', weekly: 'Челлендж недели', leaders: 'Рейтинг', about: 'Об игре',
      boosts: 'Бусты', tutorial: 'Как играть',
      locked: 'Закрыто', open: 'Открыть', unlockIn: 'Ещё {n} рядов', selected: 'Выбрана',

      /* магазин по слотам */
      slot_skin: 'Курицы', slot_pet: 'Питомцы', slot_trail: 'Следы', slot_hat: 'Шапки', slot_voice: 'Голоса',
      slot_boost: 'Бусты', slot_coins: 'Монеты', slot_bundle: 'Наборы', slot_pass: 'Сезон',
      pet_none: 'Без питомца', pet_chick: 'Цыплёнок', pet_duck: 'Утёнок', pet_dragon: 'Дракончик',
      trail_none: 'Без следа', trail_feather: 'Перья', trail_spark: 'Искры', trail_snow: 'Снежинки',
      trail_rainbow: 'Радуга', trail_fire: 'Огонь',
      hat_none: 'Без шапки', hat_cap: 'Кепка', hat_crown: 'Корона', hat_helmet: 'Шлем', hat_ushanka: 'Ушанка',
      voice_classic: 'Обычный', voice_squeak: 'Писк', voice_robot: 'Робот', voice_duck: 'Кря',
      boost_magnet: 'Магнит монет', boost_slow: 'Замедление', boost_shield: 'Щит',
      boost_double: 'Двойные монеты', boost_mini: 'Малыш',
      boost_magnet_d: '10 секунд притягивает монеты в радиусе двух клеток.',
      boost_slow_d: '7 секунд весь мир движется вдвое медленнее.',
      boost_shield_d: 'Один раз спасает от смерти.',
      boost_double_d: 'Удваивает монеты за забег.',
      boost_mini_d: 'Курица становится меньше, но не неуязвимой.',
      getForAd: 'Смотреть рекламу', getForCoins: 'За монеты', use: 'Применить', active: 'Активно',

      /* задания и достижения */
      quest_daily: 'Задания дня', quest_weekly: 'Задания недели',
      q_progress: 'Прогресс', q_claim: 'Забрать', q_claimed: 'Получено', q_done: 'Готово',
      q_reset: 'Обновление через', q_rows: 'Пройди {n} рядов за один забег',
      q_rows_total: 'Пройди {n} рядов всего', q_coins: 'Собери {n} монет',
      q_coins_total: 'Собери {n} монет всего', q_runs: 'Сыграй {n} забегов',
      q_biome: 'Поиграй в биоме «{b}»', q_diff: 'Сыграй забег на сложности «{d}»',
      q_boost: 'Используй {n} бустов', q_combo: 'Доведи комбо до {n}',
      q_daily: 'Пройди испытание дня', q_rows_nostop: 'Пройди {n} рядов без остановок',
      ach_unlocked: 'Достижение получено', ach_locked: 'Ещё не открыто',
      ach_first: 'Первый шаг', ach_first_d: 'Пройди хотя бы один ряд',
      ach_rows50: 'Пятьдесят', ach_rows50_d: 'Пройди 50 рядов за забег',
      ach_rows100: 'Сотка', ach_rows100_d: 'Пройди 100 рядов за забег',
      ach_rows250: 'Легенда дороги', ach_rows250_d: 'Пройди 250 рядов за один забег',
      ach_coins1000: 'Копилка', ach_coins1000_d: 'Собери 1000 монет всего',
      ach_coins5000: 'Богач', ach_coins5000_d: 'Собери 5000 монет всего',
      ach_eagle: 'Лёгкая добыча', ach_eagle_d: 'Дай орлу себя унести',
      ach_deaths: 'Коллекционер', ach_deaths_d: 'Умри от пяти разных причин',
      ach_biomes5: 'Путешественник', ach_biomes5_d: 'Поиграй в 5 биомах',
      ach_biomes_all: 'Все дороги мира', ach_biomes_all_d: 'Поиграй во всех биомах',
      ach_skins5: 'Модник', ach_skins5_d: 'Собери 5 скинов',
      ach_hard50: 'Хардкор', ach_hard50_d: 'Пройди 50 рядов на «сложно»',
      ach_daily7: 'Верный игрок', ach_daily7_d: 'Заходи 7 дней подряд',
      ach_combo50: 'Без остановок', ach_combo50_d: 'Доведи комбо до 50',
      ach_boost: 'Со способностями', ach_boost_d: 'Используй буст',
      ach_pet: 'Не один', ach_pet_d: 'Заведи питомца',
      ach_pass: 'Сезонный', ach_pass_d: 'Пройди 10 уровней сезона',
      ach_allmodes: 'Всеядный', ach_allmodes_d: 'Поиграй во всех режимах',
      ach_ghost: 'Быстрее себя', ach_ghost_d: 'Побей собственный рекорд',

      /* статистика */
      st_runs: 'Забегов', st_rows: 'Рядов всего', st_best: 'Лучший забег', st_coins: 'Монет собрано',
      st_time: 'Время в игре', st_deaths: 'Смертей', st_biomes: 'Биомов открыто', st_skins: 'Скинов',
      st_boosts: 'Бустов использовано', st_ads: 'Рекламы просмотрено', st_level: 'Уровень',
      st_combo: 'Лучшее комбо', st_rank: 'Ранг', st_fav: 'Любимый биом', st_reset: 'Сбросить прогресс',
      st_reset_q: 'Точно сбросить весь прогресс? Это нельзя отменить.', st_reset_done: 'Прогресс сброшен',

      /* сезонный пропуск и сундук */
      pass_level: 'Уровень', pass_free: 'Бесплатно', pass_premium: 'Премиум', pass_claim: 'Забрать',
      pass_need: 'Нужен {n} уровень', pass_xp: 'опыта сезона', pass_premium_buy: 'Купить премиум',
      chest_streak: 'Дней подряд', chest_claim: 'Открыть сундук', chest_today: 'Сегодня получено',
      chest_ready: 'Сундук готов!', chest_note: 'Заходи каждый день — награда растёт',
      reward_coins: '+{n} монет', reward_skin: 'Скин: {s}', reward_boost: 'Буст: {b}',
      reward_trail: 'След: {s}', reward_hat: 'Шапка: {s}', reward_pet: 'Питомец: {s}',
      reward_voice: 'Голос: {s}', reward_pass: '+{n} опыта сезона',

      /* настройки */
      set_sound: 'Звук', set_music: 'Музыка', set_vibro: 'Вибрация', set_ui: 'Размер интерфейса',
      set_left: 'Режим для левой руки', set_quality: 'Качество графики', set_colorblind: 'Режим для дальтоников',
      set_lang: 'Язык', set_on: 'Вкл', set_off: 'Выкл',
      set_low: 'Низкое', set_mid: 'Среднее', set_high: 'Высокое', set_big: 'Крупный', set_normal: 'Обычный',
      cb_off: 'Выкл', cb_protan: 'Протанопия', cb_deutan: 'Дейтеранопия', cb_tritan: 'Тританопия',
      auto: 'Авто', tv_hint: 'Пульт: стрелки — шаг, OK — вперёд, Back — пауза',

      /* прочее */
      backToGame: 'В игру', rate: 'Оценить игру', rated: 'Спасибо за оценку!',
      feedback: 'Написать автору', auth: 'Войти в Яндекс', authWhy: 'Чтобы прогресс сохранялся на всех устройствах',
      loggedIn: 'Вы вошли как {n}', cloudOn: 'Облачное сохранение включено',
      daily_used: 'Сегодня уже пройдено', daily_best: 'Лучший результат дня',
      ghost: 'Личный рекорд',
      combo: 'Комбо', weather: 'Погода', mode: 'Режим', biome: 'Биом',
      mode_classic: 'Классика', mode_water: 'Только вода', mode_rails: 'Только рельсы',
      mode_nostop: 'Без остановок', mode_night: 'Ночь', mode_extreme: 'Экстрим',
      mode_classic_d: 'Обычные правила: дороги, реки, рельсы и трава.',
      mode_water_d: 'Мир состоит только из рек и островков травы.',
      mode_rails_d: 'Одни рельсы: поезда идут один за другим.',
      mode_nostop_d: 'Останавливаться нельзя — орёл прилетает вдвое быстрее.',
      mode_night_d: 'Темно: видно только вокруг курицы.',
      mode_extreme_d: 'Поток плотнее, монет вдвое больше.',
      tip_move: 'Шагай вперёд — тап, свайп в сторону',
      tip_wait: 'Подожди окно в потоке машин',
      tip_water: 'В воде спасают только брёвна и лилии',
      tip_eagle: 'Долго стоять нельзя — прилетит орёл',
      tip_done: 'Понятно!',
      noAds: 'Отключить рекламу', adsOff: 'Реклама отключена',
      coinsForAd: 'Монеты за рекламу', doubleCoins: 'Удвоить монеты за забег',
      secondChance: 'Второй шанс', freeChest: 'Бесплатный сундук',
      purchased: 'Покупка прошла!', purchaseFail: 'Покупка не прошла',
      store_unavailable: 'Магазин недоступен вне Яндекс Игр',
      season_1: 'Зимний сезон', season_2: 'Весенний сезон',
      season_3: 'Летний сезон', season_4: 'Осенний сезон'
    },
    en: {
      play: 'Play', loading: 'Loading…', tap: 'Tap to hop, swipe to steer',
      best: 'Best', coins: 'Coins', score: 'Score', total: 'Total',
      gameOver: 'Game over', record: 'New record!',
      playAgain: 'Play again', revive: 'Continue for an ad', reviveWait: 'Loading ad…',
      paused: 'Paused', resume: 'Resume', restart: 'Restart', sound: 'Sound',
      controlsDesktop: 'WASD / arrows to hop, P to pause, M for sound',
      controlsMobile: 'Tap to hop, swipe to steer',
      r_car: 'The chicken got hit by a car', r_train: 'The chicken got hit by a train',
      r_water: 'The chicken drowned', r_edge: 'The chicken drifted away',
      r_eagle: 'The chicken was taken by an eagle',
      r_lava: 'The chicken burned in lava', r_brick: 'The chicken was crushed by a brick',
      r_meteor: 'A meteor hit the chicken', r_laser: 'The chicken was cut by a laser',
      r_lightning: 'The chicken was struck by lightning', r_crane: 'A crane hit the chicken',
      r_carousel: 'A carousel swept the chicken away', r_plane: 'A plane ran over the chicken',
      hintEagle: 'Keep moving or the eagle will get you!',

      diffEasy: 'Easy', diffEasySub: 'no rush',
      diffNormal: 'Normal', diffNormalSub: 'the original',
      diffHard: 'Hard', diffHardSub: 'traffic & eagle',
      diffEasyHint: 'Slower cars, wider gaps, the eagle waits longer.',
      diffNormalHint: 'Classic balance: average traffic, the eagle strikes after 10 seconds.',
      diffHardHint: 'Dense traffic, fast rivers, the eagle dives at 7 seconds — but coins are plentiful.',
      pauseHint: 'P / Esc to resume, M for sound', toMenu: 'Menu',

      skins: 'Skins', wallet: 'Coins', back: 'Back', close: 'Close',
      skinsHint: 'Buy a skin with coins and put it on — the chicken changes right away.',
      buy: 'Buy', equip: 'Wear', equipped: 'Worn', owned: 'Owned',
      poor: 'Too few coins', bought: 'Bought!', notEnough: 'Not enough coins',
      watch_ad: 'Watch ad', boost_on: 'On: {s}', soon: 'Unavailable', stock: 'In stock',
      store_local_note: 'Store and ads work inside Yandex Games',
      st_min: 'min', st_inter: 'Interstitial ads',
      sk_classic: 'Classic', sk_chick: 'Chick', sk_bandit: 'Bandit', sk_ninja: 'Ninja',
      sk_zombie: 'Zombie', sk_robot: 'Robot', sk_gold: 'Golden', sk_rainbow: 'Rainbow',

      shop: 'Shop', quests: 'Quests', achievements: 'Achievements', stats: 'Stats',
      settings: 'Settings', maps: 'Maps', pass: 'Season', chest: 'Chest', modes: 'Modes',
      daily: 'Daily challenge', weekly: 'Weekly challenge', leaders: 'Leaders', about: 'About',
      boosts: 'Boosts', tutorial: 'How to play',
      locked: 'Locked', open: 'Open', unlockIn: '{n} rows to go', selected: 'Selected',

      slot_skin: 'Chickens', slot_pet: 'Pets', slot_trail: 'Trails', slot_hat: 'Hats', slot_voice: 'Voices',
      slot_boost: 'Boosts', slot_coins: 'Coins', slot_bundle: 'Bundles', slot_pass: 'Season',
      pet_none: 'No pet', pet_chick: 'Chick', pet_duck: 'Duckling', pet_dragon: 'Baby dragon',
      trail_none: 'No trail', trail_feather: 'Feathers', trail_spark: 'Sparks', trail_snow: 'Snowflakes',
      trail_rainbow: 'Rainbow', trail_fire: 'Fire',
      hat_none: 'No hat', hat_cap: 'Cap', hat_crown: 'Crown', hat_helmet: 'Helmet', hat_ushanka: 'Ushanka',
      voice_classic: 'Normal', voice_squeak: 'Squeak', voice_robot: 'Robot', voice_duck: 'Quack',
      boost_magnet: 'Coin magnet', boost_slow: 'Slow motion', boost_shield: 'Shield',
      boost_double: 'Double coins', boost_mini: 'Tiny',
      boost_magnet_d: 'Pulls coins within two cells for 10 seconds.',
      boost_slow_d: 'The whole world moves twice slower for 7 seconds.',
      boost_shield_d: 'Saves you from death once.',
      boost_double_d: 'Doubles the coins of the run.',
      boost_mini_d: 'Makes the chicken smaller, but not invincible.',
      getForAd: 'Watch an ad', getForCoins: 'For coins', use: 'Use', active: 'Active',

      quest_daily: 'Daily quests', quest_weekly: 'Weekly quests',
      q_progress: 'Progress', q_claim: 'Claim', q_claimed: 'Claimed', q_done: 'Done',
      q_reset: 'Resets in', q_rows: 'Pass {n} rows in one run',
      q_rows_total: 'Pass {n} rows in total', q_coins: 'Collect {n} coins',
      q_coins_total: 'Collect {n} coins in total', q_runs: 'Play {n} runs',
      q_biome: 'Play in the "{b}" biome', q_diff: 'Play a run on "{d}"',
      q_boost: 'Use {n} boosts', q_combo: 'Reach a combo of {n}',
      q_daily: 'Complete the daily challenge', q_rows_nostop: 'Pass {n} rows without stopping',
      ach_unlocked: 'Achievement unlocked', ach_locked: 'Not unlocked yet',
      ach_first: 'First step', ach_first_d: 'Pass at least one row',
      ach_rows50: 'Fifty', ach_rows50_d: 'Pass 50 rows in one run',
      ach_rows100: 'Century', ach_rows100_d: 'Pass 100 rows in one run',
      ach_rows250: 'Road legend', ach_rows250_d: 'Pass 250 rows in one run',
      ach_coins1000: 'Piggy bank', ach_coins1000_d: 'Collect 1000 coins in total',
      ach_coins5000: 'Rich', ach_coins5000_d: 'Collect 5000 coins in total',
      ach_eagle: 'Easy prey', ach_eagle_d: 'Let the eagle carry you away',
      ach_deaths: 'Collector', ach_deaths_d: 'Die from five different causes',
      ach_biomes5: 'Traveller', ach_biomes5_d: 'Play in 5 biomes',
      ach_biomes_all: 'All roads of the world', ach_biomes_all_d: 'Play in every biome',
      ach_skins5: 'Fashionista', ach_skins5_d: 'Own 5 skins',
      ach_hard50: 'Hardcore', ach_hard50_d: 'Pass 50 rows on Hard',
      ach_daily7: 'Loyal player', ach_daily7_d: 'Come back 7 days in a row',
      ach_combo50: 'Non-stop', ach_combo50_d: 'Reach a combo of 50',
      ach_boost: 'Powered up', ach_boost_d: 'Use a boost',
      ach_pet: 'Not alone', ach_pet_d: 'Get a pet',
      ach_pass: 'Seasonal', ach_pass_d: 'Reach season level 10',
      ach_allmodes: 'Omnivore', ach_allmodes_d: 'Play every mode',
      ach_ghost: 'Faster than me', ach_ghost_d: 'Beat your own record',

      st_runs: 'Runs', st_rows: 'Rows total', st_best: 'Best run', st_coins: 'Coins collected',
      st_time: 'Time played', st_deaths: 'Deaths', st_biomes: 'Biomes unlocked', st_skins: 'Skins',
      st_boosts: 'Boosts used', st_ads: 'Ads watched', st_level: 'Level',
      st_combo: 'Best combo', st_rank: 'Rank', st_fav: 'Favourite biome', st_reset: 'Reset progress',
      st_reset_q: 'Reset all progress? This cannot be undone.', st_reset_done: 'Progress reset',

      pass_level: 'Level', pass_free: 'Free', pass_premium: 'Premium', pass_claim: 'Claim',
      pass_need: 'Level {n} required', pass_xp: 'season XP', pass_premium_buy: 'Buy premium',
      chest_streak: 'Days in a row', chest_claim: 'Open the chest', chest_today: 'Claimed today',
      chest_ready: 'Chest is ready!', chest_note: 'Come back daily — the reward grows',
      reward_coins: '+{n} coins', reward_skin: 'Skin: {s}', reward_boost: 'Boost: {b}',
      reward_trail: 'Trail: {s}', reward_hat: 'Hat: {s}', reward_pet: 'Pet: {s}',
      reward_voice: 'Voice: {s}', reward_pass: '+{n} season XP',

      set_sound: 'Sound', set_music: 'Music', set_vibro: 'Vibration', set_ui: 'UI size',
      set_left: 'Left-handed mode', set_quality: 'Graphics quality', set_colorblind: 'Colour blind mode',
      set_lang: 'Language', set_on: 'On', set_off: 'Off',
      set_low: 'Low', set_mid: 'Medium', set_high: 'High', set_big: 'Large', set_normal: 'Normal',
      cb_off: 'Off', cb_protan: 'Protanopia', cb_deutan: 'Deuteranopia', cb_tritan: 'Tritanopia',
      auto: 'Auto', tv_hint: 'Remote: arrows to hop, OK to go, Back to pause',

      backToGame: 'Back to game', rate: 'Rate the game', rated: 'Thanks for your rating!',
      feedback: 'Email the author', auth: 'Sign in with Yandex', authWhy: 'To keep progress on all your devices',
      loggedIn: 'Signed in as {n}', cloudOn: 'Cloud saves enabled',
      daily_used: 'Already done today', daily_best: 'Best of the day',
      ghost: 'Personal best',
      combo: 'Combo', weather: 'Weather', mode: 'Mode', biome: 'Biome',
      mode_classic: 'Classic', mode_water: 'Water only', mode_rails: 'Rails only',
      mode_nostop: 'Non-stop', mode_night: 'Night', mode_extreme: 'Extreme',
      mode_classic_d: 'Regular rules: roads, rivers, rails and grass.',
      mode_water_d: 'The world is only rivers and grassy islands.',
      mode_rails_d: 'Rails only: trains come one after another.',
      mode_nostop_d: 'You cannot stop — the eagle comes twice as fast.',
      mode_night_d: 'Dark: you only see around the chicken.',
      mode_extreme_d: 'Denser traffic, twice the coins.',
      tip_move: 'Hop forward with a tap, steer with a swipe',
      tip_wait: 'Wait for a gap in the traffic',
      tip_water: 'Only logs and lilies save you in water',
      tip_eagle: 'Do not stand still — the eagle is coming',
      tip_done: 'Got it!',
      noAds: 'Remove ads', adsOff: 'Ads disabled',
      coinsForAd: 'Coins for an ad', doubleCoins: 'Double run coins',
      secondChance: 'Second chance', freeChest: 'Free chest',
      purchased: 'Purchase complete!', purchaseFail: 'Purchase failed',
      store_unavailable: 'The store is unavailable outside Yandex Games',
      season_1: 'Winter season', season_2: 'Spring season',
      season_3: 'Summer season', season_4: 'Autumn season'
    }
  };

  // контентные строки (биомы, скины, бусты) лежат в strings.js и подмешиваются сюда
  if (global.EXTRA_STRINGS) {
    for (var langKey in global.EXTRA_STRINGS) {
      if (!global.EXTRA_STRINGS.hasOwnProperty(langKey)) { continue; }
      if (!STRINGS[langKey]) { STRINGS[langKey] = {}; }
      for (var strKey in global.EXTRA_STRINGS[langKey]) {
        if (global.EXTRA_STRINGS[langKey].hasOwnProperty(strKey)) {
          STRINGS[langKey][strKey] = global.EXTRA_STRINGS[langKey][strKey];
        }
      }
    }
  }

  /* --- служебное ---------------------------------------------------------- */
  function ls(key, val) {
    try {
      if (val === undefined) { return global.localStorage.getItem(key); }
      global.localStorage.setItem(key, val);
    } catch (e) { /* приватный режим — игнорируем */ }
    return null;
  }
  function parseNum(v, def) { var n = parseInt(v, 10); return isFinite(n) ? n : def; }
  function parseList(v) {
    if (!v) { return []; }
    var out = [];
    String(v).split(',').forEach(function (s) { s = s.trim(); if (s && out.indexOf(s) < 0) { out.push(s); } });
    return out;
  }
  function now() { return Date.now(); }
  function search() { return (global.location && global.location.search) || ''; }
  function hasFlag(name) { return new RegExp('(\\?|&)' + name + '(=|&|$)').test(search()); }

  function navLang() {
    var l = (global.navigator && (global.navigator.language || global.navigator.userLanguage)) || 'ru';
    l = String(l).toLowerCase().slice(0, 2);
    return STRINGS[l] ? l : 'en';
  }

  /* ======================================================================
     ОСНОВНОЙ ОБЪЕКТ
     ====================================================================== */
  var P = {
    ok: false,                 // SDK реально доступен
    ysdk: null,
    player: null,
    lang: 'ru',
    rewardedAvailable: false,
    purchasesAvailable: false,
    leaderboardsAvailable: false,
    cloudSaves: false,
    debugAd: false,
    isTv: false,
    feedbackEmail: FEEDBACK_EMAIL,
    adCooldownMs: AD_COOLDOWN_MS,
    adsDisabled: false,        // куплено «отключить рекламу»
    currency: { name: 'Ян', icon: '' },

    /* колбэки, которые назначает игра */
    onPause: null,
    onResume: null,
    onPendingPurchase: null,   // оплачено ранее, но не подтверждено — выдать при запуске

    _lastAd: 0,
    _lastRewarded: 0,
    _ready: false,
    _booting: false,
    _payments: null,
    _lb: null,
    _catalog: null,
    _pendingGrant: null,

    /* --- перевод ---------------------------------------------------------- */
    t: function (key, vars) {
      var d = STRINGS[P.lang] || STRINGS.en;
      var s = (d && d[key]) || STRINGS.en[key] || key;
      if (vars) {
        for (var k in vars) {
          if (vars.hasOwnProperty(k)) { s = s.split('{' + k + '}').join(String(vars[k])); }
        }
      }
      return s;
    },

    /* --- асинхронная загрузка SDK (не блокирует старт игры) --------------- */
    loadSdk: function () {
      return new Promise(function (resolve) {
        if (typeof global.YaGames !== 'undefined') { resolve(); return; }
        if (hasFlag('ysdk=off')) { resolve(); return; }
        var finished = false;
        function finish() { if (!finished) { finished = true; resolve(); } }
        try {
          var s = global.document.createElement('script');
          s.src = SDK_URL;
          s.async = true;
          s.onload = finish;
          s.onerror = finish;
          global.document.head.appendChild(s);
        } catch (e) { finish(); return; }
        global.setTimeout(finish, SDK_TIMEOUT_MS);
      });
    },

    /* --- инициализация ---------------------------------------------------- */
    init: function () {
      if (P._booting) { return P._readyPromise; }
      // A/B-разметка: частота межстраничной рекламы у части игроков мягче
      try {
        P.adCooldownMs = (P.ab('ad_cooldown', ['base', 'rare']) === 'rare') ? AD_COOLDOWN_MS * 1.6 : AD_COOLDOWN_MS;
      } catch (e) { P.adCooldownMs = AD_COOLDOWN_MS; }
      P._booting = true;
      P.lang = navLang();
      P.debugAd = hasFlag('debug=1');
      P.isTv = hasFlag('tv=1') ||
        !!(global.navigator && /tv|smart-tv|smarttv|hbbtv|netcast|web0s|appletv/i.test(global.navigator.userAgent || ''));

      P._readyPromise = new Promise(function (resolve) {
        var settled = false;
        function done() { if (!settled) { settled = true; resolve(P); } }

        function localMode() {
          if (P.debugAd) { P.rewardedAvailable = true; }
          global.setTimeout(done, 0);
        }

        if (hasFlag('ysdk=off')) { localMode(); return; }

        P.loadSdk().then(function () {
          if (typeof global.YaGames === 'undefined') { localMode(); return; }

          var timer = global.setTimeout(localMode, SDK_TIMEOUT_MS);
          global.YaGames.init().then(function (ysdk) {
            P.ysdk = ysdk;
            P.ok = true;
            P.rewardedAvailable = true;
            global.clearTimeout(timer);
            try {
              var lang = ysdk.environment.i18n.lang;
              if (STRINGS[lang]) { P.lang = lang; }
            } catch (e) { /* остаётся язык браузера */ }

            // игрок: сохранения, лидерборды, покупки
            try {
              ysdk.getPlayer({ scopes: false }).then(function (pl) {
                P.player = pl;
                P.cloudSaves = true;
                P.initPayments();          // нужен player для консумирования покупок
              }, function () {});
            } catch (e) {}

            // события паузы и возобновления от платформы (п. 1.19.4)
            try {
              if (ysdk.on) {
                ysdk.on('game_api_pause', function () { if (P.onPause) { P.onPause(); } });
                ysdk.on('game_api_resume', function () { if (P.onResume) { P.onResume(); } });
              }
            } catch (e) {}

            P.initLeaderboards();

            if (USE_STICKY_BANNER && !P.adsDisabled) {
              try { ysdk.adv.showBannerAdv(); } catch (e) {}
            }

            try { ysdk.features.LoadingAPI.ready(); } catch (e) {}
            P._ready = true;
            done();
          }, function () {
            global.clearTimeout(timer);
            localMode();
          });
        });
      });
      return P._readyPromise;
    },

    /* --- геймплей (обязательно для игр с рекламой) ------------------------ */
    gameplayStart: function () {
      try { if (P.ysdk && P.ysdk.features.GameplayAPI) { P.ysdk.features.GameplayAPI.start(); } } catch (e) {}
    },
    gameplayStop: function () {
      try { if (P.ysdk && P.ysdk.features.GameplayAPI) { P.ysdk.features.GameplayAPI.stop(); } } catch (e) {}
    },

    /* --- реклама ---------------------------------------------------------- */
    canShowFullscreen: function (runMs) {
      if (!P.ok || P.adsDisabled) { return false; }
      if (runMs !== undefined && runMs < AD_MIN_RUN_MS) { return false; }
      return (now() - P._lastAd) > P.adCooldownMs;
    },
    showFullscreen: function (cb) {
      cb = cb || function () {};
      if (!P.ok || !P.ysdk || P.adsDisabled) { cb(); return; }
      P._lastAd = now();
      var closed = false;
      function finish() { if (!closed) { closed = true; cb(); } }
      try {
        P.ysdk.adv.showFullscreenAdv({
          callbacks: {
            onOpen: function () { if (P.onPause) { P.onPause(); } },
            onClose: function (wasShown) {
              P.metric('ad_interstitial', { shown: wasShown ? 1 : 0 });
              if (P.onResume) { P.onResume(); }
              finish();
            },
            onError: function () { if (P.onResume) { P.onResume(); } finish(); }
          }
        });
      } catch (e) { finish(); }
    },
    // Реклама за вознаграждение. Что именно получит игрок — обязан объяснить
    // интерфейс игры (п. 4.5.1), здесь только показ ролика и выдача награды.
    showRewarded: function (onReward, onFail) {
      if (now() - P._lastRewarded < REWARDED_COOLDOWN_MS) { if (onFail) { onFail('cooldown'); } return; }
      P._lastRewarded = now();
      if (P.debugAd && !P.ok) {
        global.setTimeout(function () { P.metric('ad_rewarded', { debug: 1 }); if (onReward) { onReward(); } }, 250);
        return;
      }
      if (!P.ok || !P.ysdk) { if (onFail) { onFail('unavailable'); } return; }
      var rewarded = false, closed = false;
      function finish() {
        if (closed) { return; }
        closed = true;
        if (rewarded) { P.metric('ad_rewarded', {}); if (onReward) { onReward(); } }
        else if (onFail) { onFail('closed'); }
      }
      try {
        P.ysdk.adv.showRewardedVideo({
          callbacks: {
            onOpen: function () { if (P.onPause) { P.onPause(); } },
            onRewarded: function () { rewarded = true; },
            onClose: function () { if (P.onResume) { P.onResume(); } finish(); },
            onError: function () { if (P.onResume) { P.onResume(); } finish(); }
          }
        });
      } catch (e) { finish(); }
    },
    hideBanner: function () { try { if (P.ysdk && P.ysdk.adv) { P.ysdk.adv.hideBannerAdv(); } } catch (e) {} },

    /* --- покупки (инап через портальную валюту) --------------------------- */
    initPayments: function () {
      if (!P.ok || !P.ysdk || !P.ysdk.getPayments || P._payments) { return; }
      try {
        P.ysdk.getPayments({ signed: false }).then(function (payments) {
          P._payments = payments;
          P.purchasesAvailable = true;
          // характеристики портальной валюты берём из каталога (п. 1.13.2)
          try {
            payments.getCatalog().then(function (products) {
              P._catalog = products || [];
              if (P._catalog.length && P._catalog[0].currency) {
                P.currency = { name: P._catalog[0].currency, icon: P._catalog[0].currencyImage || '' };
              }
            }, function () {});
          } catch (e) {}
          P._consumePending();      // досчитываем необработанные покупки (п. 1.13.1)
        }, function () {});
      } catch (e) {}
    },
    catalog: function () { return P._catalog || []; },
    priceOf: function (productId) {
      var c = P._catalog || [];
      for (var i = 0; i < c.length; i++) { if (c[i].id === productId) { return c[i]; } }
      return null;
    },
    // Покупка: purchase -> выдача -> consumePurchase (обязательно, п. 1.13.1)
    buy: function (productId, onGrant, onFail) {
      onFail = onFail || function () {};
      if (!P._payments) { onFail('unavailable'); return; }
      P._pendingGrant = { id: productId, grant: onGrant };
      try {
        P._payments.purchase({ id: productId }).then(function (purchase) {
          try { if (onGrant) { onGrant(purchase); } } catch (e) {}
          P._pendingGrant = null;
          P._consume(purchase);
        }, function (err) {
          P._pendingGrant = null;
          onFail(err);
        });
      } catch (e) { onFail(e); }
    },
    _consume: function (purchase) {
      if (!P._payments || !purchase) { return; }
      var token = purchase.purchaseToken || purchase.token;
      if (!token) { return; }
      try { P._payments.consumePurchase(token).then(function () {}, function () {}); } catch (e) {}
    },
    // Покупки, оплаченные, но не подтверждённые (страница закрылась во время оплаты)
    _consumePending: function () {
      if (!P._payments) { return; }
      try {
        P._payments.getPurchases().then(function (list) {
          if (!list || !list.length) { return; }
          for (var i = 0; i < list.length; i++) {
            var pr = list[i];
            if (pr.productID && P.onPendingPurchase) {
              try { P.onPendingPurchase(pr.productID); } catch (e) {}
            }
            P._consume(pr);
          }
        }, function () {});
      } catch (e) {}
    },

    /* --- лидерборды ------------------------------------------------------- */
    initLeaderboards: function () {
      if (!P.ok || !P.ysdk || !P.ysdk.getLeaderboards || P._lb) { return; }
      try {
        P.ysdk.getLeaderboards().then(function (lb) {
          P._lb = lb;
          P.leaderboardsAvailable = true;
        }, function () {});
      } catch (e) {}
    },
    leaderboardName: function (board) { return LEADERBOARDS[board] || ''; },
    submitScore: function (score, board) {
      board = board || 'best';
      var name = LEADERBOARDS[board] || '';
      if (!P._lb || !name || !score) { return; }
      try { P._lb.setLeaderboardScore(name, Math.round(score)); } catch (e) {}
    },
    top: function (board, cb) {
      cb = cb || function () {};
      var name = LEADERBOARDS[board] || '';
      if (!P._lb || !name) { cb([]); return; }
      try {
        P._lb.getLeaderboardEntries(name, {
          quantityTop: 10, includeUser: true, quantityAround: 3
        }).then(function (res) {
          var out = [];
          try {
            var entries = (res && res.entries) || [];
            for (var i = 0; i < entries.length; i++) {
              out.push({
                rank: entries[i].rank,
                name: (entries[i].player && entries[i].player.publicName) || '…',
                score: entries[i].score,
                me: !!entries[i].isUser
              });
            }
          } catch (e) {}
          cb(out);
        }, function () { cb([]); });
      } catch (e) { cb([]); }
    },

    /* --- авторизация (только по осознанному действию, п. 1.2.1) ----------- */
    isAuthorized: function () {
      try { return !!(P.player && P.player.getMode && P.player.getMode() !== 'lite'); } catch (e) { return false; }
    },
    authName: function () {
      try { return (P.player && P.player.getName && P.player.getName()) || ''; } catch (e) { return ''; }
    },
    requestAuth: function (cb) {
      cb = cb || function () {};
      if (!P.ok || !P.ysdk || !P.ysdk.auth) { cb(false); return; }
      try {
        P.ysdk.auth.openAuthDialog().then(function () {
          try {
            P.ysdk.getPlayer({ scopes: false }).then(function (pl) { P.player = pl; cb(true); }, function () { cb(true); });
          } catch (e) { cb(true); }
        }, function () { cb(false); });
      } catch (e) { cb(false); }
    },

    /* --- оценка игры (п. 6.1) --------------------------------------------- */
    canReview: function (cb) {
      if (!P.ok || !P.ysdk || !P.ysdk.feedback) { cb(false); return; }
      try {
        P.ysdk.feedback.canReview().then(function (res) { cb(!!(res && res.value)); }, function () { cb(false); });
      } catch (e) { cb(false); }
    },
    requestReview: function (cb) {
      cb = cb || function () {};
      if (!P.ok || !P.ysdk || !P.ysdk.feedback) { cb(false); return; }
      try {
        P.ysdk.feedback.requestReview().then(function (res) {
          cb(!!(res && res.feedbackSent));
        }, function () { cb(false); });
      } catch (e) { cb(false); }
    },

    /* --- A/B-разметка (идея 97) ------------------------------------------- */
    // Игрок навсегда попадает в один вариант эксперимента; вариант хранится
    // локально и уходит в метрики вместе с событиями.
    ab: function (key, variants) {
      variants = variants || ['a', 'b'];
      var store = {};
      try { store = JSON.parse(ls('cc_ab') || '{}') || {}; } catch (e) { store = {}; }
      if (!store[key] || variants.indexOf(store[key]) < 0) {
        store[key] = variants[(Math.random() * variants.length) | 0];
        try { ls('cc_ab', JSON.stringify(store)); } catch (e) {}
      }
      return store[key];
    },
    abAll: function () {
      try { return JSON.parse(ls('cc_ab') || '{}') || {}; } catch (e) { return {}; }
    },

    /* --- события и метрики (идея 96) -------------------------------------- */
    metric: function (name, payload) {
      try {
        var m = JSON.parse(ls('cc_metrics') || '{}') || {};
        var key = name + (payload && payload.shown === 0 ? '_fail' : '');
        m[key] = (m[key] || 0) + 1;
        ls('cc_metrics', JSON.stringify(m));
      } catch (e) {}
      try { if (typeof global.ym === 'function' && global.__YM_ID) { global.ym(global.__YM_ID, 'reachGoal', name); } } catch (e) {}
    },
    metrics: function () {
      try { return JSON.parse(ls('cc_metrics') || '{}') || {}; } catch (e) { return {}; }
    },
    resetMetrics: function () { try { ls('cc_metrics', '{}'); } catch (e) {} },

    /* --- сохранения ------------------------------------------------------- */
    load: function () {
      var local = {
        best: parseNum(ls('cc_best'), 0),
        coins: parseNum(ls('cc_coins'), 0),
        bests: {
          easy: parseNum(ls('cc_best_easy'), 0),
          normal: parseNum(ls('cc_best_normal'), 0),
          hard: parseNum(ls('cc_best_hard'), 0)
        },
        skins: parseList(ls('cc_skins')),
        skin: ls('cc_skin') || '',
        diff: ls('cc_diff') || '',
        pet: ls('cc_pet') || '', trail: ls('cc_trail') || '',
        hat: ls('cc_hat') || '', voice: ls('cc_voice') || '',
        owned: parseList(ls('cc_owned')),
        adsOff: ls('cc_ads_off') === '1',
        stock: (function () { try { return JSON.parse(ls('cc_stock') || 'null'); } catch (e) { return null; } })(),
        meta: null,
        settings: null
      };
      try { local.meta = JSON.parse(ls('cc_meta') || 'null'); } catch (e) { local.meta = null; }
      try { local.settings = JSON.parse(ls('cc_settings') || 'null'); } catch (e) { local.settings = null; }

      if (!P.player) { return Promise.resolve(local); }
      return P.player.getData(['best', 'coins', 'bests', 'skins', 'skin', 'diff', 'meta', 'settings',
        'pet', 'trail', 'hat', 'voice', 'owned', 'adsOff', 'stock']).then(function (d) {
        d = d || {};
        var rBests = (d.bests && typeof d.bests === 'object') ? d.bests : {};
        var bests = {
          easy: Math.max(local.bests.easy, parseNum(rBests.easy, 0)),
          normal: Math.max(local.bests.normal, parseNum(rBests.normal, 0)),
          hard: Math.max(local.bests.hard, parseNum(rBests.hard, 0))
        };
        var skins = local.skins.slice();
        if (Array.isArray(d.skins)) {
          for (var i = 0; i < d.skins.length; i++) {
            var id = String(d.skins[i]);
            if (id && skins.indexOf(id) < 0) { skins.push(id); }
          }
        }
        return {
          best: Math.max(local.best, parseNum(d.best, 0), bests.easy, bests.normal, bests.hard),
          coins: Math.max(local.coins, parseNum(d.coins, 0)),
          bests: bests,
          skins: skins,
          skin: local.skin || (typeof d.skin === 'string' ? d.skin : ''),
          diff: local.diff || (typeof d.diff === 'string' ? d.diff : ''),
          pet: d.pet || '', trail: d.trail || '', hat: d.hat || '', voice: d.voice || '',
          owned: Array.isArray(d.owned) ? d.owned : [],
          adsOff: !!d.adsOff,
          stock: d.stock && typeof d.stock === 'object' ? d.stock : null,
          // мета-прогресс: берём более «продвинутый» из двух сохранений
          meta: pickMeta(local.meta, d.meta),
          settings: local.settings || d.settings || null
        };
      }, function () { return local; });
    },
    save: function (data) {
      var payload = {};
      if (data.best !== undefined) {
        ls('cc_best', String(data.best));
        payload.best = data.best;
      }
      if (data.coins !== undefined) {
        var c = Math.max(0, Math.round(data.coins));
        ls('cc_coins', String(c));
        payload.coins = c;
      }
      if (data.bests && typeof data.bests === 'object') {
        payload.bests = {};
        for (var k in data.bests) {
          if (!data.bests.hasOwnProperty(k)) { continue; }
          payload.bests[k] = Math.max(0, Math.round(data.bests[k] || 0));
          ls('cc_best_' + k, String(payload.bests[k]));
        }
      }
      if (data.skins) {
        payload.skins = data.skins.slice();
        ls('cc_skins', payload.skins.join(','));
      }
      if (data.skin) {
        payload.skin = data.skin;
        ls('cc_skin', data.skin);
      }
      if (data.diff) {
        payload.diff = data.diff;
        ls('cc_diff', data.diff);
      }
      if (data.pet) { payload.pet = data.pet; ls('cc_pet', data.pet); }
      if (data.trail) { payload.trail = data.trail; ls('cc_trail', data.trail); }
      if (data.hat) { payload.hat = data.hat; ls('cc_hat', data.hat); }
      if (data.voice) { payload.voice = data.voice; ls('cc_voice', data.voice); }
      if (data.owned) {
        payload.owned = data.owned.slice();
        ls('cc_owned', payload.owned.join(','));
      }
      if (data.boostStock) {
        payload.stock = data.boostStock;
        try { ls('cc_stock', JSON.stringify(data.boostStock)); } catch (e) {}
      }
      if (data.adsDisabled !== undefined) {
        payload.adsOff = !!data.adsDisabled;
        ls('cc_ads_off', data.adsDisabled ? '1' : '0');
      }
      if (data.meta) {
        payload.meta = data.meta;
        try { ls('cc_meta', JSON.stringify(data.meta)); } catch (e) {}
      }
      if (data.settings) {
        payload.settings = data.settings;
        try { ls('cc_settings', JSON.stringify(data.settings)); } catch (e) {}
      }
      if (P.player) {
        try { P.player.setData(payload, true); } catch (e) {}
      }
    }
  };

  // Из двух сохранений мета-прогресса берём то, где больше наиграно
  function pickMeta(a, b) {
    if (!a) { return b || null; }
    if (!b) { return a; }
    var ra = (a.stats && a.stats.rows) || 0;
    var rb = (b.stats && b.stats.rows) || 0;
    return rb > ra ? b : a;
  }

  global.Platform = P;
  if (global.CC) { global.CC.platform = P; }   // шина модулей
})(typeof window !== 'undefined' ? window : this);
