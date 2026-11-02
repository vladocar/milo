# Development

## Repository files

| Path | Purpose |
| --- | --- |
| `native/` | Main C++ runtime and bytecode VM |
| `examples/` | Standalone programs |
| `tests/` | Python-driven language/native regressions |
| `milo.py` | Original reference used by tests |
| `benchmarks/` | Workloads and historical measurements |
| `docs/` | Main language documentation |
| `playground/` | Browser demo, adapted engine, and browser tests |

## Build and test

```sh
sh build.sh
python3 -m unittest discover -s tests -v
```

Tests need Python 3.10+. Running the native interpreter does not. On Windows build with `BUILD-WINDOWS.bat`, then use `py -3 -m unittest discover -s tests -v`.

Native test classes skip if a binary is absent: build first and inspect the summary. The suite checks the Python reference and C++ VM, with extra bytecode/tree regressions.

Core documentation examples should run in the standalone binary. Give input examples deterministic answers for automated checks. Browser-only commands belong in Playground examples.

## Browser development

Change into `playground/` and follow its [development guide](../playground/docs/DEVELOPMENT.md). The prebuilt engine is sufficient to serve the website.

To rebuild the browser engine with Emscripten:

```sh
cd playground
EMXX=/path/to/em++ sh build-engine.sh
```

Keep the generated loader and Wasm from the same build.

## Benchmarks and validation

Run `python3 benchmarks/benchmark.py --runs 9` after building the native runtime. It overwrites `benchmarks/results.json`; the packaged measurements are historical.

Run the relevant checks for each change and record the results in your pull request. Verify deployment in GitHub Actions after configuring Pages.
