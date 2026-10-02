#!/usr/bin/env bash
# ============================================================================
# build-icons.sh — сборка SVG-спрайта интерфейса
# ----------------------------------------------------------------------------
# Скачивает набор иконок Lucide (лицензия ISC, разрешена коммерческая
# разработка) и вставляет их в index.html между маркерами ICONS:START/END.
# Раньше интерфейс рисовался эмодзи — на разных системах они выглядели
# по-разному и «дёшево». Теперь это один векторный спрайт: <symbol id="i-*">,
# который используется через <svg class="ic"><use href="#i-*"/></svg>.
#
# Запуск: bash dev/build-icons.sh
# ============================================================================
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
CACHE="${ICON_CACHE:-/tmp/cc-icons}"
VER="${LUCIDE_VERSION:-0.545.0}"
BASE="https://unpkg.com/lucide-static@$VER/icons"
mkdir -p "$CACHE"

# локальный id символа           файл иконки Lucide
ICONS="
i-play:play
i-chicken:bird
i-map:map
i-modes:gamepad-2
i-quests:clipboard-list
i-trophy:trophy
i-ticket:ticket
i-chart:chart-column
i-gem:gem
i-stats:chart-line
i-gear:settings
i-calendar:calendar-days
i-help:circle-help
i-coin:coins
i-lock:lock
i-check:check
i-home:house
i-restart:rotate-ccw
i-sound:volume-2
i-mute:volume-x
i-pause:pause
i-star:star
i-lock2:lock-keyhole
i-water:waves
i-rails:train-front
i-zap:zap
i-moon:moon
i-flame:flame
i-magnet:magnet
i-slow:snail
i-shield:shield
i-double:copy
i-egg:egg
i-banknote:banknote
i-box:package
i-ban:ban
i-tv:tv
i-gift:gift
i-flag:flag
i-ruler:ruler
i-medal:medal
i-skull:skull
i-globe:globe
i-clapper:clapperboard
i-user:user
i-lang:languages
i-mail:mail
i-tap:pointer
i-car:car
i-leaf:leaf
i-eagle:feather
i-log:tree-pine
i-sparkle:sparkles
i-hourglass:hourglass
i-party:party-popper
i-paw:paw-print
i-crown:crown
i-trail:footprints
i-voice:audio-lines
i-palette:palette
i-daily:calendar-check
i-heart:heart
i-plus:plus
i-close:x
i-back:chevron-left
i-shop:shopping-bag
i-target:target
i-clock:clock
i-bolt:zap
i-train:train-front
i-anchor:anchor
i-eye:eye
i-key:key-round
i-snow:snowflake
i-orbit:orbit
i-pine:tree-pine
i-ghost:ghost
i-storm:cloud-lightning
i-autumn:tree-deciduous
i-desert:sun-medium
i-palm:tree-palm
i-umbrella:umbrella
i-tractor:tractor
i-build:construction
i-city:building-2
i-sunset:sunset
i-railtrack:train-track
i-plane:plane
i-rocket:rocket
i-mountain:mountain
i-canyon:mountain-snow
i-ferris:ferris-wheel
i-cave:layers
i-pancake:layers
i-lamp:lamp
i-wheat:wheat
i-sprout:sprout
i-boat:sailboat
i-fish:fish
i-water-drop:droplets
i-moon-star:moon-star
i-timer:timer
i-flame-2:flame
i-shop-2:store
i-tag:tag
i-gauge:gauge
i-shield-check:shield-check
i-download:download
i-upload:upload
i-wifi:wifi
i-alert:triangle-alert
i-info:info
i-rotate:refresh-cw
"

fetch_icon() { # $1 имя файла lucide
  # Битый или недокачанный файл (сервер отдал ошибку) качаем заново
  if [ ! -s "$CACHE/$1.svg" ] || ! grep -q "<svg" "$CACHE/$1.svg"; then
    rm -f "$CACHE/$1.svg"
    curl -sSL --retry 3 --retry-delay 1 --max-time 40 -o "$CACHE/$1.svg" "$BASE/$1.svg" || true
  fi
  [ -s "$CACHE/$1.svg" ] && grep -q "<svg" "$CACHE/$1.svg"
}

# Внутренности <svg>…</svg> без служебных атрибутов — то, что кладётся в <symbol>
inner() {
  python3 - "$1" <<'PY'
import re, sys, io
s = io.open(sys.argv[1], encoding='utf-8').read()
s = re.sub(r'<!--.*?-->', '', s, flags=re.S)
body = re.search(r'<svg[^>]*>(.*)</svg>', s, re.S)
if not body:
    sys.exit('bad svg: ' + sys.argv[1])
out = body.group(1)
out = re.sub(r'\s+', ' ', out).strip()
print(out)
PY
}

echo "Собираю спрайт Lucide $VER в $CACHE"
SPRITE=""
for pair in $ICONS; do
  [ -z "$pair" ] && continue
  id="${pair%%:*}"; name="${pair##*:}"
  if ! fetch_icon "$name"; then echo "  ! нет иконки $name" >&2; continue; fi
  body="$(inner "$CACHE/$name.svg" || true)"
  if [ -z "$body" ]; then echo "  ! пропускаю $name" >&2; continue; fi
  SPRITE="$SPRITE    <symbol id=\"$id\" viewBox=\"0 0 24 24\">$body</symbol>"$'\n'
done

python3 - "$ROOT/index.html" "$SPRITE" <<'PY'
import sys, io, re
path, sprite = sys.argv[1], sys.argv[2]
s = io.open(path, encoding='utf-8').read()
start = '<!-- ICONS:START -->'
end = '<!-- ICONS:END -->'
block = start + '\n  <svg class="sprite" aria-hidden="true" focusable="false">\n' + sprite + '  </svg>\n  ' + end
if start in s and end in s:
    s = re.sub(re.escape(start) + r'.*?' + re.escape(end), lambda m: block, s, flags=re.S)
else:
    s = s.replace('<body>', '<body>\n  ' + block, 1)
io.open(path, 'w', encoding='utf-8').write(s)
print('Спрайт вставлен в', path)
PY

echo "Готово: $(echo "$SPRITE" | grep -c '<symbol') иконок"
