# Install and run Milo

The standalone runtime uses C++17 and its standard library. Build once, then run `.milo` programs without Python. This source package has no prebuilt `milo` or `milo.exe`.

## Windows

Use GCC (`g++`) on PATH or Visual Studio C++ tools.

For Visual Studio, open Start and search for **x64 Native Tools Command Prompt**. Open it and enter the extracted project folder:

```bat
cd /d "C:\path\to\milo"
BUILD-WINDOWS.bat
```

The C++ tools must already be installed. The script tries `g++` first, then `cl`.

After a successful build:

```bat
milo.exe --version
milo.exe examples\hello.milo
```

Run `milo.exe` without a file, or double-click `START-WINDOWS.bat`, for interactive mode.

The supplied MSVC command uses `/std:c++17`, `/EHsc`, and `/utf-8`. Windows execution was not verified in this update.

## Linux/macOS

From the repository root:

```sh
sh build.sh
./milo --version
./milo examples/hello.milo
```

The script uses `c++`. Choose GCC explicitly with `CXX=g++ sh build.sh`, or compile directly:

```sh
c++ -std=c++17 -O3 -DNDEBUG native/milo.cpp -o milo
```

Linux building and tests were checked for this package. macOS execution was not verified.

## Optional CMake

Requires CMake 3.16 or newer:

```sh
cmake -S . -B build
cmake --build build --config Release
```

Run `build/milo` with a single-configuration generator, or the appropriate configuration subfolder with a multi-configuration generator. Direct compiler builds are the path checked here; CMake/MSVC builds were not newly tested.

## Your own program

Save plain UTF-8 text as `my-program.milo`:

```milo
say "My first Milo program!"
```

Run `./milo my-program.milo`, or `milo.exe my-program.milo` on Windows.

If a compiler is missing, install a C++17 compiler or select its developer terminal. If a file cannot be read, check the working folder and path. Drawing commands require the [Playground](PLAYGROUND.md), not the CLI.
