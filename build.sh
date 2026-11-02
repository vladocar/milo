#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")"
MILO_CXX="${CXX:-c++}"
"$MILO_CXX" -std=c++17 -O3 -DNDEBUG -Wall -Wextra -Wpedantic native/milo.cpp -o milo
printf 'Built Milo. Try: ./milo examples/hello.milo\n'
