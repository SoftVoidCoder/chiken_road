# Звук и музыка — источники и лицензии

Все файлы в этом каталоге собраны скриптом `dev/build-audio.sh` из свободных
наборов ниже. Скрипт скачивает исходники, приводит громкость к единому уровню
и кодирует в Ogg Vorbis. Ничего лицензионно-обременительного здесь нет:
CC0 не требует указания автора, CC-BY требует — авторы перечислены и в игре
(экран «Настройки» → «Об игре»), и в этом файле.

| Файл | Что это | Источник | Автор | Лицензия |
|------|---------|----------|-------|----------|
| `hop.ogg`, `sink.ogg`, `boost.ogg`, `record.ogg` | цифровые блипы: прыжок, уход под воду, включение буста, рекорд | [Kenney Digital Audio](https://kenney.nl/assets/digital-audio) | Kenney | CC0 |
| `land.ogg`, `crash.ogg` (слой), `shield.ogg` | удары: приземление, треск щита | [Kenney Impact Sounds](https://kenney.nl/assets/impact-sounds) | Kenney | CC0 |
| `click.ogg`, `open.ogg`, `close.ogg`, `select.ogg`, `error.ogg`, `buy.ogg` | интерфейс: клик, открытие и закрытие панели, выбор, ошибка, покупка | [Kenney UI Audio](https://kenney.nl/assets/ui-audio), [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | Kenney | CC0 |
| `coin.ogg` | звон монеты (8-бит) | [10 8bit coin sounds](https://opengameart.org/content/10-8bit-coin-sounds) | Luke.RUSTLTD | CC0 |
| `splash.ogg` | всплеск воды | [40 CC0 water splash slime SFX](https://opengameart.org/content/40-cc0-water-splash-slime-sfx) | rubberduck | CC0 |
| `levelup.ogg`, `gameover.ogg` | короткие джинглы повышения и проигрыша | [SoundPack01](https://opengameart.org/content/level-up-power-up-coin-get-13-sounds) | wobbleboxx | CC0 |
| `horn.ogg` | сигнал (велосипедный гудок) | [Bicycle Horn](https://opengameart.org/content/bicycle-horn) | AntumDeluge | CC0 |
| `crash.ogg`, `brake.ogg` | авария и визг тормозов | [8-Bit Car Game Sound Effects](https://opengameart.org/content/pack-8-bit-car-game-sound-effects) | Snabisch | CC-BY 3.0 |
| `music/menu.ogg`, `music/game1.ogg`, `music/game2.ogg`, `music/game3.ogg`, `music/over.ogg` | чиптюн-музыка: меню, забеги по сложности, экран итогов | [5 Action Chiptunes](https://opengameart.org/content/5-chiptunes-action) (Juhani Junkala, Retro Game Music Pack) | Juhani Junkala (SubspaceAudio) | CC0 |

Иконки интерфейса — набор [Lucide](https://lucide.dev) (лицензия ISC),
собираются в спрайт скриптом `dev/build-icons.sh`.

## Пересборка

```bash
bash dev/build-audio.sh          # скачает исходники в /tmp/cc-audio-src и соберёт ogg
bash dev/build-audio.sh /путь    # или взять исходники из своего каталога
```

Требуется `ffmpeg` с кодером `libvorbis`, `curl` и `unzip`.
