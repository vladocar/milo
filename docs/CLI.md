# Command-line reference

Build first using [installation](INSTALLATION.md). Run these commands from the repository root. Windows uses `milo.exe` instead of `./milo`.

```sh
./milo examples/hello.milo
```

The default path parses, compiles, verifies, and executes. `ask()` reads terminal input. Successful file runs return 0; reported failures return 1.

## Interactive mode

Run `./milo` without a filename. Type statements at `milo>`. Blocks continue at `...` until closed with `end`. Variables and definitions remain between submissions. Type `help` or `exit` on an empty submission.

## Options

| Option | Action |
| --- | --- |
| `--help`, `-h` | Print usage |
| `--version` | Print runtime version |
| `--check` | Parse, compile, and verify without execution |
| `--dump-bytecode` | Print compiled instructions without execution |
| `--tree` | Select the retained C++ tree interpreter |
| `--max-steps N` | Set a positive execution budget |

```sh
./milo --check examples/greeting.milo
./milo --dump-bytecode examples/functions.milo
./milo --tree examples/functions.milo
./milo --max-steps 5000000 examples/fibonacci.milo
```

`--check` and `--dump-bytecode` require a file. Dumping cannot be combined with `--tree` or `--check`. With `--tree --check`, the retained path checks parsing rather than compiling bytecode.

## Limits

The default budget is 1,000,000 internal steps per run. Steps are not lines or seconds, and VM and tree step counts differ. User-call nesting is limited to 128, with parser/value nesting guards too.

`--check` cannot prove runtime success. Input, values, undefined names, and arithmetic can still fail. Errors identify a source line when available.

The step budget does not bound every costly built-in or memory allocation. This is an experimental interpreter for trusted learning programs, not a security sandbox.

Bytecode is in memory only, with no `.miloc` loader or stable external bytecode format.
