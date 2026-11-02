# Changes

## 0.3.0 — Bytecode compiler and virtual machine

- Existing Milo source syntax retained; the C++ bytecode VM is now the default.
- Programs compile once to opcode records, constants, and nested function code.
- Compiler-output verifier checks reachable control flow, operand indices, and stack-depth consistency before execution.
- Direct global/local variable slots replace repeated string lookups on common paths. Unbound local reads still fall back to captured outer environments, preserving Milo 0.2 behavior.
- Explicit operand stack and function frames; checked integer arithmetic has dedicated fast paths.
- Compiled jumps implement decisions, loops, short-circuit logic, and chained comparisons.
- Closures, recursion, mutable collections, Unicode text indexing, and source-line errors preserved.
- `--dump-bytecode` lists instructions without running code. `--check` now compiles and verifies as well as parsing.
- `--tree` retains the old C++ execution engine for comparisons.
- New VM regression tests, REPL tests, and deterministic generated-expression differential tests.
- Benchmarks compare equivalent CPython source, C++ tree execution, and default bytecode execution. Longer workload variants reduce the proportion of process-startup overhead.

### Limits and compatibility

Bytecode is internal and in-memory; no serialization or public bytecode loader is provided. This is not machine-code compilation. Existing numeric limits, ASCII case conversion, linear dictionary lookup, and environment-cycle cleanup at interpreter shutdown still apply. The VM keeps the 128-user-call limit and compilation limits. A step now usually means one VM instruction, so a previous `--max-steps` value may stop a program at a different point. No promise is made that every program will outperform CPython or the old engine.

## 0.2.0 — C++ runtime

- Main runtime rewritten in C++17; no Python runtime required.
- Original surface syntax retained: `say`, `ask`, `repeat`, `function`, and `end`.
- Native command line, interactive prompt, and syntax checking.
- Lists, ordered dictionaries, lexical closures, recursion, and the existing built-ins.
- Checked 64-bit integer arithmetic and nonfinite-number errors.
- UTF-8 text indexing, length, and iteration operate on code points.
- Function, expression, block, and collection nesting limits.
- Lazy inclusive numeric loops.
- Build scripts for Linux/macOS and Windows; optional CMake project.
- Original Python interpreter retained for comparison and regression testing.
- Reproducible benchmarks and native regression tests.

### Differences from the Python prototype

This is an implementation migration, not complete Python-runtime emulation:

- Integers have a signed 64-bit range. Overflow raises an error instead of expanding to arbitrary precision. The most negative value can be formed as `-9223372036854775807 - 1`; writing its unsigned magnitude as a positive literal is rejected.
- `upper`/`lower` currently convert ASCII letters only. Other Unicode characters are preserved. `split(text)` without a separator recognizes ASCII whitespace.
- Floating-point text formatting and decimal rounding can differ from the Python reference. Native `round` uses nearest/ties-to-even on the scaled binary float; decimal halfway cases can differ from Python. Complex numbers, NaN, and infinities are not supported.
- Dictionary keys are restricted to text, numbers, booleans, and `nothing`. Dictionary lookup is currently linear, unlike Python's hash table.
- User-function call nesting is limited to 128; expression evaluation to 512; parsed expression nesting and nested value operations to 256; block nesting to 128. Closures retain their captured environment. Function/environment ownership cycles are released on runtime shutdown; there is no tracing garbage collector for a long-running interactive session.
- Step budgets are implementation-specific. Some native built-ins also count iteration steps. Do not expect identical cut-off points in both runtimes.
- `numbers` prints as a Milo sequence description instead of Python's internal `range` representation.
- The C++ interactive prompt supports `exit`, `help`, and multiline blocks closed with `end`; end-of-input exits. Ctrl+C terminates the native process rather than cancelling only the current block as the Python REPL does.

These differences are documented so programs can target the native runtime deliberately. Syntax and the tested core behavior remain compatible.
