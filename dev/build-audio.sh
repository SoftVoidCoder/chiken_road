#!/usr/bin/env bash
# ============================================================================
# build-audio.sh — сборка звукового банка игры из свободных источников
# ----------------------------------------------------------------------------
# Скачивает исходники (CC0 и CC-BY) и кодирует их в assets/audio/*.ogg.
# Скрипт идемпотентный: уже скачанные архивы не перекачиваются.
# Запуск:  bash dev/build-audio.sh [каталог-для-исходников]
# Требуется: ffmpeg с libvorbis, curl, unzip.
#
# Источники и лицензии перечислены в assets/audio/CREDITS.md.
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SRC="${1:-${AUDIO_SRC:-/tmp/cc-audio-src}}"
OUT="$ROOT/assets/audio"
MUS="$OUT/music"
mkdir -p "$SRC" "$OUT" "$MUS"

fetch() { # $1 url, $2 файл-назначения
  if [ -s "$SRC/$2" ]; then return 0; fi
  echo "  · качаю $2"
  curl -sSL --max-time 180 -o "$SRC/$2" "$1"
}

unpack() { # $1 архив, $2 каталог
  [ -d "$SRC/$2" ] && return 0
  echo "  · распаковываю $1"
  unzip -o -q "$SRC/$1" -d "$SRC/$2"
}

# --- источники ---------------------------------------------------------------
echo "Источники: $SRC"
fetch "https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip" kenney-interface.zip
fetch "https://kenney.nl/media/pages/assets/impact-sounds/87b4ddecda-1677589768/kenney_impact-sounds.zip"           kenney-impact.zip
fetch "https://kenney.nl/media/pages/assets/digital-audio/216eac4753-1677590265/kenney_digital-audio.zip"           kenney-digital.zip
fetch "https://kenney.nl/media/pages/assets/ui-audio/490d233f68-1677590494/kenney_ui-audio.zip"                     kenney-ui.zip
fetch "https://opengameart.org/sites/default/files/coin_sounds.zip"                                                 oga-coins.zip
fetch "https://opengameart.org/sites/default/files/water-splash-slime-sfx.zip"                                      oga-water.zip
fetch "https://opengameart.org/sites/default/files/SoundPack01.zip"                                                 oga-soundpack01.zip
fetch "https://opengameart.org/sites/default/files/bicycle-horn-1.wav"                                              oga-bicycle-horn.wav
fetch "https://opengameart.org/sites/default/files/8-Bit%20Car%20Game%20Sound%20Effects.zip"                        oga-car8.zip
fetch "https://opengameart.org/sites/default/files/5%20Action%20Chiptunes%20By%20Juhani%20Junkala.zip"              oga-chiptunes.zip

unpack kenney-interface.zip k-interface
unpack kenney-impact.zip    k-impact
unpack kenney-digital.zip   k-digital
unpack kenney-ui.zip        k-ui
unpack oga-coins.zip        oga-coins
unpack oga-water.zip        oga-water
unpack oga-soundpack01.zip  oga-sp01
unpack oga-car8.zip         oga-car8
unpack oga-chiptunes.zip    oga-music

# --- помощники ---------------------------------------------------------------
peak_db() { # пиковый уровень файла в дБFS
  ffmpeg -hide_banner -i "$1" -af volumedetect -f null - 2>&1 |
    sed -n 's/.*max_volume: \(-*[0-9.]*\) dB.*/\1/p' | tail -1
}

# sfx <вход> <выход> [целевой пик дБ] [доп. фильтры]
sfx() {
  local in="$1" out="$2" target="${3:--1.5}" extra="${4:-}" peak gain
  peak="$(peak_db "$in")"
  [ -z "$peak" ] && peak=0
  gain="$(python3 -c "print(round($target - ($peak), 2))")"
  local af="volume=${gain}dB"
  [ -n "$extra" ] && af="$extra,$af"
  ffmpeg -v error -y -i "$in" -af "$af" -ac 1 -ar 44100 -c:a libvorbis -q:a 2 "$OUT/$out"
}

# music <вход> <выход> [целевой пик дБ]
music() {
  local in="$1" out="$2" target="${3:--1.5}" peak gain
  peak="$(peak_db "$in")"
  [ -z "$peak" ] && peak=0
  gain="$(python3 -c "print(round($target - ($peak), 2))")"
  ffmpeg -v error -y -i "$in" -af "volume=${gain}dB" -ac 2 -ar 44100 -c:a libvorbis -q:a 2 "$MUS/$out"
}

echo "Собираю эффекты…"
sfx "$SRC/k-digital/Audio/pepSound3.ogg"                 hop.ogg
sfx "$SRC/k-impact/Audio/impactWood_light_000.ogg"       land.ogg
sfx "$SRC/oga-coins/coin1.wav"                           coin.ogg
sfx "$SRC/oga-car8/WAV/Accident.wav"                     crash.ogg -1.5 "atrim=0:2.2,afade=t=out:st=1.7:d=0.5"
sfx "$SRC/oga-water/splash_02.ogg"                       splash.ogg
sfx "$SRC/oga-bicycle-horn.wav"                          horn.ogg -3
sfx "$SRC/oga-car8/WAV/Active Brake.wav"                 brake.ogg -2
sfx "$SRC/k-digital/Audio/lowDown.ogg"                   sink.ogg
sfx "$SRC/k-ui/Audio/click1.ogg"                         click.ogg -3
sfx "$SRC/k-interface/Audio/open_001.ogg"                open.ogg
sfx "$SRC/k-interface/Audio/close_001.ogg"               close.ogg
sfx "$SRC/k-interface/Audio/select_001.ogg"              select.ogg
sfx "$SRC/k-interface/Audio/error_004.ogg"               error.ogg -2
sfx "$SRC/k-digital/Audio/powerUp5.ogg"                  boost.ogg -2
sfx "$SRC/k-interface/Audio/confirmation_001.ogg"        buy.ogg
sfx "$SRC/k-impact/Audio/impactGlass_light_001.ogg"      shield.ogg
sfx "$SRC/k-digital/Audio/highUp.ogg"                    record.ogg
sfx "$SRC/oga-sp01/Rise01.aif"                           levelup.ogg -1
sfx "$SRC/oga-sp01/Downer01.aif"                         gameover.ogg -1

echo "Собираю музыку…"
music "$SRC/oga-music/Juhani Junkala [Retro Game Music Pack] Title Screen.wav" menu.ogg
music "$SRC/oga-music/Juhani Junkala [Retro Game Music Pack] Level 1.wav"      game1.ogg
music "$SRC/oga-music/Juhani Junkala [Retro Game Music Pack] Level 2.wav"      game2.ogg
music "$SRC/oga-music/Juhani Junkala [Retro Game Music Pack] Level 3.wav"      game3.ogg
music "$SRC/oga-music/Juhani Junkala [Retro Game Music Pack] Ending.wav"       over.ogg

echo
echo "Готово. Размер банка:"
du -sh "$OUT"
ls -la "$OUT" | tail -n +2 | awk '{printf "  %-16s %8.1f КБ\n", $9, $5/1024}' | grep -v '^  \.$' || true
ls -la "$MUS" | tail -n +2 | awk '{printf "  music/%-10s %8.1f КБ\n", $9, $5/1024}' | grep -v '^  music/\.\.$' || true
