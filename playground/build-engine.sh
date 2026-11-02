#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
MILO_EMXX="${EMXX:-em++}"
case "$("$MILO_EMXX" --version)" in
  *3.1.6*) MILO_STACK_FLAG=TOTAL_STACK ;;
  *) MILO_STACK_FLAG=STACK_SIZE ;;
esac
"$MILO_EMXX" -std=c++17 -O2 -fexceptions native/playground.cpp \
  -sASYNCIFY=1 -sMODULARIZE=1 -sEXPORT_NAME=createMilo \
  -sALLOW_MEMORY_GROWTH=1 -sMAXIMUM_MEMORY=268435456 -s"$MILO_STACK_FLAG"=2097152 \
  -sENVIRONMENT=web,worker,node -sEXPORTED_FUNCTIONS='["_milo_run","_malloc"]' \
  -sEXPORTED_RUNTIME_METHODS='["ccall","lengthBytesUTF8","stringToUTF8"]' --no-entry \
  -o dist/engine/milo-engine.js
