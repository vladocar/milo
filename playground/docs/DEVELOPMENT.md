# Development

## Requirements

Serve the checked-in `dist/` over HTTP to use the playground. Python 3 provides a local server; no Python packages or npm install are needed to run it.

For automated checks, use Node.js 24, the version used for the documented starter checks. The generated engine loader is CommonJS in Node tests; do not set `"type": "module"` merely to suppress the ES-module detection warning.

Engine rebuilding requires Emscripten and a shell. Preview generation also requires Python with Pillow.

## Files

| Path | Purpose |
| --- | --- |
| `dist/index.html` | Page structure and dialogs |
| `dist/styles.css` | Responsive styles |
| `dist/app.js` | Editor, lessons, persistence, and worker integration |
| `dist/worker.js` | VM loading and asynchronous input |
| `dist/input-runtime.js` | Pausable timing and keyboard input |
| `dist/drawing.js` | Drawing and sprite renderer |
| `dist/sound.js` | Browser audio |
| `dist/project-store.js` | Project records and bin |
| `dist/lessons.js` | Lessons, commands, and field-guide examples |
| `dist/starter-projects.js` | Starter collection and copy behavior |
| `dist/extra-starters.js` | Additional starter programs |
| `dist/starter-previews.js` | Bundled preview images |
| `dist/engine/` | Generated JavaScript loader and Wasm binary |
| `native/` | C++ language implementation and browser bridge |
| `tests/` | Node checks |
| `scripts/` | Preview generation |
| `../.github/workflows/pages.yml` | Static demo deployment |

A fresh worker runs each program. The C++ VM parses Milo and executes bytecode. The interface handles events for drawing, messages, variables, sound, and input. Stop terminates the worker.

## Run checks

From the `playground/` folder:

```sh
node --check dist/app.js
node --check dist/worker.js
node --check dist/lessons.js
node --test tests/project-store.cjs tests/drawing.cjs tests/input-runtime.cjs tests/sound.cjs
node tests/starter-projects.cjs
node tests/game-features.cjs
node tests/sprites.cjs
node tests/engine-smoke.cjs
node tests/lessons.cjs
```

Browser checks cover layout, focus, audio permissions, downloads, and input. Verify the interactions affected by each change.

## Rebuild the engine

```sh
EMXX=/path/to/em++ sh build-engine.sh
```

The current binary was built with Emscripten 3.1.6. The script supports its stack-size flag and the newer flag used by other versions. Acceptance by the script does not prove compatibility with an untested toolchain.

Keep `dist/engine/milo-engine.js` and `dist/engine/milo-engine.wasm` together. Commit both after an intentional rebuild and run relevant checks.

## Add a starter

Give it a unique ID, name, category, description, and Milo source, following `dist/extra-starters.js`. Use commands the shipped engine supports and one concrete change for the learner to try.

Update the expected count in `tests/starter-projects.cjs`, the count in `dist/index.html`, and documentation. Add deterministic test input for projects that ask questions or wait for controls.

Generate previews from actual runs. Preview mode permits a new starter to run before its thumbnail exists:

```sh
node tests/starter-projects.cjs --previews /tmp/milo-starter-scenes.json
python3 scripts/build-starter-previews.py /tmp/milo-starter-scenes.json
node tests/starter-projects.cjs
```

On Windows, use a writable local JSON path instead of `/tmp/...`, and `py -3` for Python. The renderer requires Pillow. Check the gallery and confirm **Make a copy** creates an independent project.

The browser commands extend the separate desktop language. See the [reference](REFERENCE.md) for behavior and limits.
