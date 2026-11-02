# Milo Playground

The companion browser demo is under `playground/`. It includes an editor, 14 lessons, 24 starters, drawing, animation, keyboard/touch input, sprites, music, scores, and a project gallery. **Swap panels** switches the canvas and Messages order.

## Run it

From the repository root:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory playground/dist
```

Windows can use `py -3`. Open **http://127.0.0.1:8080/**. Do not use `file://`.

The prebuilt C++ Wasm engine executes in a worker. JavaScript handles UI events, rendering, and sound. No compiler is needed to serve it.

## Language and extension boundary

| Feature | Standalone CLI | Playground |
| --- | --- | --- |
| Variables, decisions, loops, collections, functions | Yes | Adapted browser VM |
| `say`, `ask`, text/numeric built-ins | Terminal | Messages and answer forms |
| Drawing and sprites | No | Browser extensions |
| `wait`, `key`, `random`, `play_note`, `show_score` | Not in standalone 0.3 | Browser extensions |
| Gallery, lessons, saved progress | No | Browser-local storage |

Shared syntax does not mean exhaustive cross-runtime equivalence: the packaged runtimes are separate snapshots.

Read the [browser quick start](../playground/docs/GETTING_STARTED.md) and [reference](../playground/docs/REFERENCE.md).

## Saved work

Projects and preferences stay in the browser profile and origin. They do not sync between devices or transfer from the private site to Pages. The app does not upload programs/answers to an application backend, but the host still receives ordinary website requests. See [privacy](../playground/docs/PRIVACY.md).

[GitHub Pages setup](GITHUB_PAGES.md) publishes `playground/dist/`; the repository remains focused on the language.
