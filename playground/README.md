# Milo Playground

**Small steps. Big ideas.**

A creative coding playground for kids and beginners. Write simple Milo programs, draw pictures, make music, and build little games directly in your browser.

Experimental learning software, released under the [MIT license](LICENSE).

## What you can make

- Pictures with a drawing turtle, filled shapes, colors, and text.
- Animations with timed frames.
- Games with sprites, keyboard controls, random numbers, sound, and scores.
- Quizzes and stories that ask questions and respond to answers.

The playground includes **14 guided lessons** and **24 starter projects**. Each starter has a preview and an idea to try. Choose **My projects → Starter projects → Make a copy** to begin.

## A first Milo program

```milo
say "Hello, Milo!"
color("teal")
width(3)

repeat 4
    move(100)
    turn(90)
end
```

One instruction goes on each line. Blocks finish with `end`. Read the [quick start](docs/GETTING_STARTED.md) for more examples.

## Run locally

The complete website and compiled WebAssembly engine are already in `dist/`. You do not need npm packages or a C++ compiler to run it.

**Windows**, from the project folder:

```powershell
py -3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

**macOS / Linux**:

```sh
python3 -m http.server 8080 --bind 127.0.0.1 --directory dist
```

Open **http://127.0.0.1:8080/**. Keep the terminal open; press **Ctrl+C** to stop the server.

Python 3 is required for these local commands. Opening `dist/index.html` directly with a `file://` address will not work.

## Publish a browser demo

Follow [Deploy to GitHub Pages](../docs/GITHUB_PAGES.md). The included workflow publishes `dist/` and uses the compiled engine already in the repository.

After deployment, add your actual demo URL to the main repository README and Website field.

## Playground controls

- **Run code** starts a new run.
- **Step**, **Pause**, **Continue**, and **Stop** help you follow execution.
- **Quick** drawing pace works best for animation and games.
- **Swap panels** switches Your canvas and Messages; the browser remembers the order.
- **Save project** stores a named project on this device.
- **Download your Milo program** saves source as a `.milo` file.
- **Save picture** exports the canvas as a PNG.

## How it works

The editor and interface use HTML, CSS, and JavaScript. Milo programs run in a C++17 bytecode virtual machine compiled to WebAssembly, inside a Web Worker. JavaScript renders drawing events, handles input, and plays sound.

The normal playground has no application backend, account system, analytics, or third-party runtime assets. It is a static website. See [architecture and development](docs/DEVELOPMENT.md).

## Your saved work

Projects, lesson progress, drafts, and preferences stay in the current browser profile and website origin. Up to 30 active projects can be saved. Projects do not sync between devices, and clearing site data can remove them.

Download important `.milo` programs as backups. A local copy and a hosted demo have separate storage. See [privacy and storage](docs/PRIVACY.md).

## Documentation

| Guide | Contents |
| --- | --- |
| [Getting started](docs/GETTING_STARTED.md) | First drawing, input, sprites, music, and saving |
| [GitHub Pages](../docs/GITHUB_PAGES.md) | Repository setup and demo deployment |
| [Development](docs/DEVELOPMENT.md) | Files, checks, engine rebuilding, and starter previews |
| [Reference](docs/REFERENCE.md) | Commands, runtime behavior, and limits |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Loading, sound, saving, and deployment problems |
| [Privacy](docs/PRIVACY.md) | Local storage and hosting boundaries |
| [Contributing](../CONTRIBUTING.md) | Improvements, bug reports, and pull requests |

## Status and credits

Milo Playground is for learning and experimenting. It is not a Python implementation and does not run Python packages. The browser drawing and game commands extend the separate desktop Milo language.

Modern browser support for WebAssembly, Web Workers, ES modules, and BigInt is required. Not every browser/device combination has been tested.

Project code: [MIT](LICENSE). Bundled Manrope and Geist Mono fonts have their own [Manrope](dist/assets/manrope-OFL.txt) and [Geist Mono](dist/assets/geistmono-OFL.txt) license notices. Keep these notices when redistributing.
