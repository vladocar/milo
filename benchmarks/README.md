# Milo 0.3 performance measurements

Measured on Linux x86-64 using GCC 13.3.0 (`-std=c++17 -O3 -DNDEBUG`) and CPython 3.12.14.

| Workload | CPython | C++ tree engine | Bytecode VM | VM speedup over tree |
| --- | ---: | ---: | ---: | ---: |
| arithmetic.milo | 26.91 ms | 48.79 ms | 21.80 ms | 2.24× |
| arithmetic_long.milo | 143.91 ms | 462.17 ms | 206.67 ms | 2.24× |
| collections.milo | 21.43 ms | 25.11 ms | 17.35 ms | 1.45× |
| collections_long.milo | 104.15 ms | 238.82 ms | 150.08 ms | 1.59× |
| functions.milo | 19.74 ms | 22.69 ms | 15.63 ms | 1.45× |
| functions_long.milo | 71.04 ms | 243.95 ms | 139.16 ms | 1.75× |

The VM beat the retained C++ tree engine on all six included workloads. CPython was faster on the longer workloads, while the VM completed the short ones sooner. Process startup is a larger fraction of the short results; do not interpret those short-program wins as faster execution for all Python-style code.

## Method

Nine timed executions per backend/workload after one untimed warm-up each. Values are median end-to-end subprocess wall-clock times, including startup, parsing, bytecode compilation/verification where applicable, and execution. Execution order rotates and reverses across runs. Exact stdout agreement is required on warm-ups and timed runs. All Milo engines receive a 100,000,000-step budget. A VM instruction is not the same unit as a tree-engine step.

Each `.milo` file has an equivalent Python implementation in `python/`. The `_long` programs perform ten times as many iterations. The C++ tree engine is the retained implementation selected by `--tree` in this same optimized build. The default engine compiles source to bytecode and executes it. CPython runs the actual equivalent Python program; it is not running the Python-written Milo interpreter.

Raw samples, environment information, checked outputs, and ratios are stored in `results.json`. These six synthetic workloads are not a general performance guarantee. Dictionary-heavy, text-heavy, I/O-heavy, or other programs may behave differently. All outputs use exact integers within both runtimes' supported range.

## Reproduce

Build the native runtime, then run from the package root:

```sh
python3 benchmarks/benchmark.py --runs 9
```

On Windows, use `python benchmarks/benchmark.py --native milo.exe --runs 9` after building. Python is needed for the comparison script and the CPython backend, but not for running the C++ VM.

To also compare the old Python-written Milo interpreter, explicitly add `--include-python-interpreter`. This is a fourth, separately labelled backend and must not be confused with equivalent source executed directly by CPython.

The script overwrites `benchmarks/results.json` with your local results. Timings depend on processor, compiler, build options, operating system, system load, and program behavior. The Markdown table above records this release's measurements and is not automatically rewritten by the script.
