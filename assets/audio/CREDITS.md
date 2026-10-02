# Звук и музыка — источники и лицензии

Все файлы в этом каталоге собраны скриптом `dev/build-audio.sh` из свободных
наборов ниже. Фоновая музыка — спокойная «кафешная»: босса-нова, lo-fi и
лёгкий эмбиент; все музыкальные треки под CC0, то есть без обязательств
по атрибуции (авторы всё равно перечислены). Скрипт скачивает исходники, приводит громкость к единому уровню
и кодирует в Ogg Vorbis. Ничего лицензионно-обременительного здесь нет:
CC0 не требует указания автора, CC-BY требует — авторы перечислены и в игре
(экран «Настройки» → «Об игре»), и в этом файле.

| Файл | Что это | Источник | Автор | Лицензия |
|------|---------|----------|-------|----------|
| `hop.ogg`, `sink.ogg`, `boost.ogg` | короткие блипы: шаг, уход под воду, включение буста | [Kenney Digital Audio](https://kenney.nl/assets/digital-audio) | Kenney | CC0 |
| `land.ogg`, `hop.ogg` (слой), `shield.ogg` | удары: приземление, шаг, треск щита | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 |
| `click.ogg`, `open.ogg`, `close.ogg`, `select.ogg`, `error.ogg`, `buy.ogg` | интерфейс: клик, открытие и закрытие панели, выбор, ошибка, покупка | [Kenney UI Audio](https://kenney.nl/assets/ui-audio), [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 |
| `coin.ogg` | звон монеты (8-бит) | [10 8bit coin sounds](https://opengameart.org/content/10-8bit-coin-sounds) | Luke.RUSTLTD | CC0 |
| `splash.ogg` | всплеск воды | [40 CC0 water splash slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | CC0 |
| `record.ogg`, `levelup.ogg`, `gameover.ogg` | 8-битные джинглы: новый рекорд, награда, проигрыш | [Kenney Music Jingles](https://kenney.nl/assets/music-jingles) | Kenney | CC0 |
| `horn.ogg` | сигнал автомобиля | [Car signal](https://opengameart.org/content/car-signal) | Yaroslav_Novikov | CC0 |
| `crash.ogg`, `brake.ogg` | авария и визг тормозов | [8-Bit Car Game Sound Effects](https://opengameart.org/content/pack-8-bit-car-game-sound-effects) | Snabisch | CC-BY 3.0 |
| `music/menu.ogg` | босса-нова для меню (автор подтверждает зацикливание) | [Shop theme](https://opengameart.org/content/shop-theme) | CleytonKauffman | CC0 |
| `music/game1.ogg` | спокойный lo-fi для лёгкой и обычной сложности | [Chill lo-fi inspired](https://opengameart.org/content/chill-lofi-inspired) | omfgdude | CC0 |
| `music/game2.ogg` | lo-fi hip hop для обычной сложности | [Lo-fi hip hop](https://opengameart.org/content/lofi-hip-hop) | omfgdude | CC0 |
| `music/game3.ogg` | тёплый светлый трек для сложных режимов | [Apple cider](https://opengameart.org/content/apple-cider) | Zane Little Music | CC0 |
| `music/over.ogg` | спокойный эмбиент для экрана итогов | [Another August](https://opengameart.org/content/another-august) | cynicmusic | CC0 |

Иконки интерфейса — набор [Lucide](https://lucide.dev) (лицензия ISC),
собираются в спрайт скриптом `dev/build-icons.sh`.

## Пересборка

```bash
bash dev/build-audio.sh          # скачает исходники в /tmp/cc-audio-src и соберёт ogg
bash dev/build-audio.sh /путь    # или взять исходники из своего каталога
```

Требуется `ffmpeg` с кодером `libvorbis`, `curl` и `unzip`.
