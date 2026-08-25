#!/usr/bin/env bash
# ============================================================
#  CRIMSON BORIS — lancement macOS
#
#  Synchronise le code source avec le depot distant, recompile si
#  necessaire, puis demarre l'application. Tout se fait en silence :
#  la seule chose que l'operateur voit, c'est Boris qui s'ouvre.
#
#  Double-clic depuis le Finder, ou : ./boris.command
# ============================================================
set -uo pipefail

# --- Localisation du projet ---------------------------------
# Le script vit dans scripts/launch/ : la racine est deux niveaux au-dessus.
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
cd "$ROOT" || exit 1

LOG="$HOME/Library/Logs/CrimsonBoris-launch.log"
mkdir -p "$(dirname "$LOG")"
exec 3>&1 4>&2            # on garde la sortie reelle sous la main
exec >>"$LOG" 2>&1        # tout le reste part au journal
echo "===== $(date '+%Y-%m-%d %H:%M:%S') lancement ====="

# Un echec de mise a jour ne doit JAMAIS empecher Boris de demarrer :
# une panne de reseau ou de depot laisse l'operateur avec sa version
# locale, ce qui vaut infiniment mieux qu'un tableau de bord absent.
UPDATED=0

# --- 1 · Verification du depot distant ----------------------
if command -v git >/dev/null 2>&1 && [ -d .git ]; then
  echo "-- verification du depot"
  BRANCH="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo main)"

  if git fetch --quiet origin "$BRANCH" 2>/dev/null; then
    LOCAL="$(git rev-parse HEAD 2>/dev/null || echo none)"
    REMOTE="$(git rev-parse "origin/$BRANCH" 2>/dev/null || echo none)"

    if [ "$LOCAL" != "$REMOTE" ] && [ "$REMOTE" != "none" ]; then
      echo "-- version distante detectee : ${REMOTE:0:8}"

      # Les modifications locales sont mises de cote plutot que perdues.
      if ! git diff --quiet || ! git diff --cached --quiet; then
        echo "-- modifications locales mises de cote"
        git stash push --quiet --include-untracked \
          --message "boris-launch $(date '+%Y-%m-%d %H:%M:%S')" || true
      fi

      if git merge --ff-only "origin/$BRANCH" --quiet 2>/dev/null; then
        UPDATED=1
        echo "-- code source mis a jour"
      else
        echo "!! avance rapide impossible, la version locale est conservee"
      fi
    else
      echo "-- deja a jour"
    fi
  else
    echo "!! depot injoignable, on continue sur la version locale"
  fi
else
  echo "-- pas de depot git : etape de synchronisation ignoree"
fi

# --- 2 · Recompilation si le source a bouge -----------------
NEEDS_BUILD=0
[ "$UPDATED" = "1" ] && NEEDS_BUILD=1
[ ! -f out/main/index.js ] && NEEDS_BUILD=1

# Un source plus recent que la compilation trahit une edition manuelle.
if [ -f out/main/index.js ]; then
  NEWER="$(find src package.json -newer out/main/index.js -print -quit 2>/dev/null || true)"
  [ -n "$NEWER" ] && NEEDS_BUILD=1
fi

if [ "$NEEDS_BUILD" = "1" ]; then
  echo "-- compilation necessaire"
  if command -v npm >/dev/null 2>&1; then
    [ "$UPDATED" = "1" ] && npm ci --silent 2>/dev/null || npm install --silent 2>/dev/null || true
    if npm run build --silent; then
      echo "-- compilation terminee"
    else
      echo "!! compilation en echec, on tente de lancer la version precedente"
    fi
  else
    echo "!! npm introuvable, compilation impossible"
  fi
else
  echo "-- compilation a jour"
fi

# --- 3 · Demarrage ------------------------------------------
APP="$ROOT/dist/mac-arm64/Crimson Boris.app"
INSTALLED="/Applications/Crimson Boris.app"

if [ -d "$INSTALLED" ]; then
  echo "-- ouverture de l'application installee"
  open -a "$INSTALLED"
elif [ -d "$APP" ]; then
  echo "-- ouverture de l'application compilee"
  open -a "$APP"
elif [ -f out/main/index.js ]; then
  echo "-- aucune application empaquetee, demarrage direct"
  npx electron out/main/index.js >/dev/null 2>&1 &
else
  echo "!! rien a lancer"
  echo "Crimson Boris n'a pas pu demarrer. Journal : $LOG" >&4
  exit 1
fi

echo "-- demarre"
exit 0
