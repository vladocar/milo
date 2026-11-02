# Architecture

## Standalone C++ runtime

Milo tokenizes and parses `.milo` source into temporary syntax trees, compiles instruction records and constants, verifies control-flow/stack consistency, then executes a stack VM.

`native/milo.cpp` holds the parser, values, built-ins, retained tree interpreter, REPL, and CLI. `native/bytecode.hpp` holds the compiler, verifier, disassembler, variable slots, and VM.

User calls use explicit VM frames. Values remain dynamic and closures capture lexical environments. Ordinary VM execution does not traverse syntax trees.

See [BYTECODE.md](../BYTECODE.md) for detail.

## Other implementations

`--tree` selects the older C++ interpreter. `milo.py` is the Python reference for behavioral tests. Neither is the default native execution path.

The browser demo is under `playground/`. Its adapted source is in `playground/native/`, including an Emscripten bridge in `playground.cpp`. Committed engine assets live under `playground/dist/engine/`.

These are separate snapshots: standalone Milo 0.3 and the later browser adaptation. Do not replace standalone sources with the browser copy or assume they are interchangeable. Port shared language changes deliberately and verify both. A shared-core refactor is a proposal, not an existing build feature.

## Performance

The compiler produces internal bytecode, not machine code. There is no JIT. C++ implementation alone establishes no speed advantage.

The [benchmark guide](../benchmarks/README.md) records historical measurements and reproduction steps. Measure locally before making new claims.
