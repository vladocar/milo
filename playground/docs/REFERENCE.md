# Milo Playground

A browser coding workspace for kids around age ten and up, and for beginners of any age. Programs run locally in a Web Worker through a C++17 WebAssembly build of the Milo 0.3 bytecode VM.

## Included

- A code editor with syntax coloring, line numbers, indentation, and keyboard run shortcut.
- Fourteen lessons with editable starters, hints, and challenge checks.
- Drawing turtle commands, a canvas grid, a pace control, and PNG export.
- Run, Step, Pause, Continue, and Stop. Step executes one source teaching step, then pauses before the next line. Loop headers can appear again as iterations progress.
- Timed animation with `wait(seconds)`, plus `key()` for arrows and Space, with accessible on-screen direction buttons. Both work with Pause, Step, Continue, and Stop.
- Independent sprites (turtle, star, circle, square), movement, circular touching checks, show/hide, and per-sprite color.
- Random whole numbers, timed musical notes with a sound toggle, and a visible score panel.
- Live variables, inline messages, and input forms for `ask`.
- Friendly errors including suggestions for transposed or misspelled variable names.
- Free play, nine examples, a command guide, source import, and `.milo` export.
- Twenty-four starter projects with sample previews, descriptions, and Make a copy, available inside My projects.
- A named project gallery with drawing thumbnails, rename, copy, separate drafts, and a recoverable project bin.
- Drafts and completed lesson flags saved in browser local storage. Programs and answers are not uploaded. There are no analytics or third-party runtime requests.
- Responsive layouts, semantic controls, modal keyboard navigation, and reduced-motion support.

## Run locally

The checked-in `dist/` contains the compiled engine, fonts, and all static assets. Serve it over HTTP; opening `index.html` as a file is not supported because browsers restrict worker/wasm loading from file URLs.

```sh
python3 -m http.server 8080 --directory dist
```

Open `http://localhost:8080/`.

## Rebuild the engine

Requires Emscripten with C++17, exceptions, and Asyncify support. The current release was built with Emscripten 3.1.6 (the earlier releases used 6.0.13). The build script supports both stack-size flag names:

```sh
EMXX=/path/to/em++ sh build-engine.sh
```

The native source is under `native/`. `playground.cpp` supplies the asynchronous browser bridge, output capture, drawing built-ins, and variable snapshots. `bytecode.hpp` adds teaching trace instructions and invokes the bridge without changing Milo source syntax. The desktop reference language remains separate.

JavaScript handles the editor and renders drawing events. It does not parse or evaluate Milo programs. Source is parsed, compiled to bytecode, verified, and executed by the C++ VM.

## Drawing commands

`go_to(x, y)`, `dot(diameter)`, `fill(color)`, `no_fill()`, `rectangle(width, height)`, `polygon(sides, radius)`, `move(number)`, `turn(degrees)`, `color(text)`, `width(number)`, `circle(radius)`, `write(value)`, `background(text)`, `pen_up()`, `pen_down()`, `home()`, `clear()`.

The turtle starts in the middle of a 500-unit square facing up. Positive turns rotate clockwise. `circle` draws around its current position without moving it. `home` moves to the start without drawing. `clear` erases shapes and returns home. Named colors include blue, teal, green, red, purple, pink, orange, yellow, black, white, navy, brown, coral, gold, turquoise, lime, indigo, violet, cyan, magenta, gray, grey, darkgreen, skyblue, tomato, lavender, and salmon; three- and six-digit hex colors are supported.

`go_to` jumps without drawing using center-relative coordinates (right and up are positive). `dot` uses the pen color. `fill` colors the inside of subsequent circles, rectangles, and polygons; `no_fill` returns to outlines. Rectangles are centered and axis aligned. Regular polygons have 3–36 integer sides, with their first corner pointing in the turtle’s heading. Shapes do not move the turtle.

Projects stay in this browser profile. Up to 30 active projects can be saved; the bin keeps projects recoverable. Gallery storage failures leave existing records intact, and stale saves from another tab are rejected. Download important source files as a separate backup.

## Starter projects

Open **My projects → Starter projects** to browse twenty-four bundled examples. Draw robots, cats, rockets, fish, city skylines, quilts, and ice cream; explore animations, quizzes, dice, stories, and music. Each card has a preview and a suggestion for making it your own.

**Make a copy** creates a separate saved project, then opens it in Free play. Existing names receive a numbered suffix, and saved projects/drafts are never overwritten. Starter templates remain available for another copy and do not count toward the 30-project limit until copied. Storage/capacity errors are shown without changing existing work. Previews are generated from actual C++ VM runs: games use their first-input scene, animations use a sample final frame, and text/music programs show sample messages/notes. Random programs can look different on each run.

To regenerate thumbnails (developer tools, Pillow required):

```sh
node tests/starter-projects.cjs --previews /tmp/milo-starter-scenes.json
python3 scripts/build-starter-previews.py /tmp/milo-starter-scenes.json
```

## Animation and keyboard input

`wait(seconds)` suspends the VM for 0–60 seconds without blocking the page. Fractional seconds work. Pause freezes the remaining wait; Continue resumes it. Stop terminates the worker and its timers immediately. Drawing pace adds per-instruction delays, so choose Quick for animation timing. `wait(0)` still yields asynchronously.

`key()` suspends until one new arrow or Space press and returns `"up"`, `"down"`, `"left"`, `"right"`, or `"space"`. Keyboard focus moves to the visible direction panel. Its buttons also work with mouse, touch, and normal keyboard activation. Held-key repeats, unsupported keys, and presses outside the panel are ignored. Inputs are not queued between calls. Paused input ignores presses until resumed. A stepped key/wait instruction finishes before pausing at the next source line.

```milo
repeat 5
    direction = key()
    if direction == "right"
        turn(90)
    end
    move(30)
    wait(0.2)
end
```

Lessons 11 and 12 teach frame animation and keyboard control. Earlier saved progress remains associated with its lesson ID; the total now reflects all fourteen lessons. These are browser-playground built-ins, not additions to the separate desktop release.

## Sprites

```milo
player = sprite("turtle", "teal")
star = sprite("star")
place(player, -100, 0)
place(star, 100, 0)
shift(player, 160, 0)
if touching(player, star)
    hide(star)
    say "You found the star!"
end
show(star)
color(player, "purple")
```

`sprite(shape, optional_color)` creates a visible object at (0, 0), independent of the drawing turtle. Shapes are `turtle`, `star`, `circle`, and `square`; default colors are teal, gold, coral, and purple. Sprites are real C++ values with reference identity: copying a variable, passing it to a function, or putting it in a list keeps the same object. The variable panel displays readable sprite names.

`place(sprite, x, y)` sets its center; `shift(sprite, dx, dy)` moves it. Positions use positive x to the right and positive y up. Coordinates clamp to -230..230 so sprites remain visible. Position arguments must be finite numbers within -10000..10000. Each sprite has a circular touch area with radius 20; `touching(a, b)` returns true for two visible sprites whose centers are at most 40 units apart. This is a friendly circular approximation, not pixel-perfect silhouette collision. `hide` makes a sprite invisible and unable to touch; `show` restores it in the same position. `color(sprite, text)` changes its color without affecting the drawing pen.

Sprites render above drawings, in creation order. `clear()` erases the drawing and resets its turtle, while sprites remain. A new run resets everything. The drawing turtle marker hides while sprites exist to keep player characters clear. Up to 64 sprites can be created per run. PNG export and project thumbnails use the same sprite renderer. A thumbnail captures the final saved scene; reopening and running recreates the game from its source.

Lesson 13, “Collect your first star,” introduces a player, a collectible, and a win condition. The “Collect the star” example adds a two-dimensional target and supports the existing keyboard/touch controls.

## Sound, chance, and scores

`random(min, max)` returns a whole number including both endpoints. Both bounds must be integers in -1000000..1000000, with min <= max. It uses fresh browser randomness; it is for games and learning, not security or cryptography.

`play_note(note, seconds)` emits a soft sine-wave tone and waits for its duration through the existing pausable timing bridge. MIDI-style note numbers 48..84 are supported (60 is middle C); durations are 0.05..2 seconds. Audio unlocks after Run/Step or the Sound toggle is clicked. Sound off silences active notes and keeps program timing unchanged. Pause and Stop silence the current note immediately; Continue resumes the remaining wait without replaying that note. Missing or blocked audio shows a notice while the program continues silently. The sound preference stays in this browser profile.

`show_score(number)` displays a whole-number score from 0..1000000 above the canvas. Call it again when the score changes. The panel resets on a new run or workspace, and stays visible after completion or Stop. It is a UI display; PNG downloads and project thumbnails capture the drawing and sprites, not the score panel.

Lesson 14 and the “Collect five stars” example combine random star positions, scoring, musical feedback, and a five-point win condition. The “A little melody” example demonstrates sequential notes. Use Quick drawing pace for snappy gameplay.

## Limits

Each run uses a new worker. Stop terminates that worker immediately. The engine has a 100,000-instruction budget and 256 MB maximum Wasm memory. The browser bridge limits programs to 4,000 teaching steps/drawing commands; output is limited to 250 lines and 2,000 bytes per line. Source imports are limited to 20 KB. These are usability limits for learning, not a claim of a general-purpose security sandbox. Browsers must support WebAssembly, workers, ES modules, and BigInt.

The source editor and PNG download work on current desktop browsers. For a copy of your work, download the source or drawing; browser storage is specific to this origin/profile and can be cleared by browser settings.

## Tests

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

The Node tests instantiate the same shipped Wasm module. They check asynchronous input, drawing, variable snapshots, parser/runtime errors, function calls, trace hooks, all lesson starters and challenge solutions, and all nine examples. UI behavior also needs browser testing.

## Hosting and licenses

The public demo can be hosted as static files on GitHub Pages. See [GitHub Pages deployment](../../docs/GITHUB_PAGES.md).

Milo source and this implementation use the included MIT license. Manrope and Geist Mono font license notices are in `dist/assets/`.

Use **Swap panels** above the results to switch the order of Your canvas and Messages. The choice is remembered in this browser. Swapping keeps drawings, messages, and pending input intact; direction controls stay beside the canvas.
