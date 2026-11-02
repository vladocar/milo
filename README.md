# Milo Programming Language

**A small, friendly programming language for kids and beginners.**

Milo combines readable, Python-inspired syntax with a **C++17 bytecode virtual machine**. Write one instruction per line, close blocks with `end`, and learn with variables, decisions, loops, lists, dictionaries, and functions.

Standalone version **0.3.0**. [MIT licensed](LICENSE).

```milo
name = ask("What is your name? ")
say "Hello", name

repeat 3 as count
    say "I am learning Milo!", count
end
```

## Start with the language

The main runtime runs `.milo` files and an interactive prompt. It needs no Python, Node.js, or browser.

On Linux/macOS, with a C++17 compiler:

```sh
sh build.sh
./milo examples/hello.milo
```

On Windows, run `BUILD-WINDOWS.bat` with a C++17 compiler available, then:

```bat
milo.exe examples\hello.milo
```

For Visual Studio, use **x64 Native Tools Command Prompt**. See [installation](docs/INSTALLATION.md). This source package contains no prebuilt executable.

Run `./milo` or `milo.exe` without a filename for interactive mode. Type `help` or `exit`.

## Readable syntax

```milo
function square(n)
    return n * n
end

for n in numbers(1, 5)
    say n, "squared is", square(n)
end
```

`numbers(1, 5)` includes both endpoints. Indentation improves readability; `end` defines blocks.

Core features:

- Dynamic numbers, text, booleans, `nothing`, lists, dictionaries, and functions.
- `say` output and `ask()` input.
- `if`, `else if`, and `else`.
- `repeat`, `for`, and `while`, with `break` and `continue`.
- Functions, recursion, and lexical closures.
- Checked 64-bit integers and UTF-8 text indexing.
- Source-line errors, syntax checks, and bytecode inspection.

Read the [language guide](docs/LANGUAGE_GUIDE.md).

## Milo Playground: the browser demo

The companion Playground is under `playground/`. It adds an editor, **14 guided lessons**, **24 starter projects**, drawing, animation, sprites, sound, and games.

Its adapted C++ engine runs through WebAssembly. Browser drawing and game commands are extensions, not standalone CLI built-ins.

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory playground/dist
```

Windows can use `py -3` instead of `python3`. Open **http://127.0.0.1:8080/**.

Python serves the local website here; the standalone Milo runtime does not use it. See [Playground](docs/PLAYGROUND.md) for controls and saved projects.

Follow [GitHub Pages setup](docs/GITHUB_PAGES.md) to publish the demo, then add the actual URL here.

## Implementation

Milo parses source, compiles to in-memory bytecode, verifies instructions, and executes a stack VM.

```sh
./milo --check examples/functions.milo
./milo --dump-bytecode examples/functions.milo
```

The older C++ tree interpreter is available with `--tree`. `milo.py` is the original Python reference used by development tests; it is not the native runtime.

Read [architecture](docs/ARCHITECTURE.md) and [bytecode design](BYTECODE.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Installation](docs/INSTALLATION.md) | Build and run |
| [Language guide](docs/LANGUAGE_GUIDE.md) | Syntax, values, functions, collections, built-ins |
| [CLI reference](docs/CLI.md) | Interactive mode, checks, bytecode, limits |
| [Architecture](docs/ARCHITECTURE.md) | Compiler, verifier, VM, browser adaptation |
| [Development](docs/DEVELOPMENT.md) | Files, tests, examples, benchmarks |
| [Playground](docs/PLAYGROUND.md) | Browser demo and extension boundary |
| [GitHub Pages](docs/GITHUB_PAGES.md) | Publish the demo |
| [Roadmap](docs/ROADMAP.md) | Available features and proposals |
| [Contributing](CONTRIBUTING.md) | Issues and pull requests |

## Status and performance

Milo is experimental learning software. It cannot import Python packages. It has no modules, classes, user-program exception handling, file/network APIs, JIT, or ahead-of-time machine-code compiler.

C++ does not guarantee faster execution than Python or other languages. [Historical benchmarks](benchmarks/README.md) describe specific workloads and reproduction steps, not universal speed claims.

Execution limits do not make Milo a security sandbox. See [CLI limits](docs/CLI.md).

## License

Milo uses [MIT](LICENSE). The Playground's fonts retain their separate [Manrope](playground/dist/assets/manrope-OFL.txt) and [Geist Mono](playground/dist/assets/geistmono-OFL.txt) notices.
