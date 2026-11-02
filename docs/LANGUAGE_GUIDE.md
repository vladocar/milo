# Milo language guide

This describes standalone Milo 0.3. Run shell commands from the repository root. Drawing and game commands are [Playground extensions](PLAYGROUND.md).

## The basic rules

- Write one statement on each line. Expressions also stay on one line.
- Use `end` on its own line to close a block.
- No colon is needed after `if`, loops, or function headers.
- Indentation with spaces makes programs readable but does not define blocks. Leading tabs are rejected.
- Use `#` for comments outside quoted text.
- Names are case sensitive. Unicode names such as `име` work.
- Choose names such as `score`, `first_name`, or `total2`. Names cannot start with a digit or be a language keyword.
- Put text in single or double quotes. Use `\n` for a newline, `\t` for a tab, and `\"` for a quote inside double-quoted text.
- Variables need no type declarations. There is no `let`, `var`, or semicolon.

## Variables and values

```milo
name = "Alex"
age = 40
price = 12.50
ready = true
result = nothing

age = age + 1
say name, age, price, ready, result
```

Values include integers, decimal numbers, text, `true`, `false`, `nothing`, lists, dictionaries, and functions. Decimal numbers use binary floating point, so ordinary floating-point rounding applies. `nothing` represents an absent value.

## Input and conversion

`ask()` always returns text. Convert text before doing arithmetic:

```milo
age = number(ask("How old are you? "))
say "Next year you will be", age + 1
```

Convert any value to printable text with `text(value)`. Combine text using `+`, or print several values with commas:

```milo
say "Age: " + text(age)
say "Age:", age
```

## Decisions

```milo
score = 82

if score >= 90
    say "Excellent!"
else if score >= 60
    say "You passed."
else
    say "Try again."
end
```

`else if` and `else` are optional. One `end` closes the entire decision.

## Loops

Repeat a fixed number of times:

```milo
repeat 3
    say "Hello!"
end
```

Add an optional counter with `as`. Repeat counters start at **1**:

```milo
repeat 3 as count
    say count
end
```

Go through a list:

```milo
for fruit in ["Apple", "Pear", "Peach"]
    say fruit
end
```

Use an inclusive number sequence. Both endpoints are included:

```milo
for n in numbers(1, 5)
    say n
end
```

`numbers(5, 1)` counts down. Both arguments must be whole numbers. The sequence is generated lazily rather than stored as a list. You can also loop through text characters or dictionary keys.

Repeat while a condition is true:

```milo
count = 1
while count <= 3
    say count
    count = count + 1
end
```

`break` leaves the nearest loop; `continue` skips to its next iteration. A repeat count must be a nonnegative whole number. Loop variables remain available after the loop, if an iteration assigned them. Avoid changing a collection's size while looping through it.

## Functions

```milo
function greet(name)
    say "Welcome", name
end

function square(n)
    return n * n
end

greet("Alex")
say square(5)
```

A function without a returned value returns `nothing`. Functions support recursion and nested definitions. Arguments are positional; their count must match the parameters. Define a function before calling it.

Assignments inside a function create or update **local variables**. A function can read variables in the environment where it was defined. Assigning a name inside it does not reassign an outer variable. Lists and dictionaries are shared objects, so editing their contents inside a function affects the same object outside it. There are no `global` or `nonlocal` declarations.

## Lists

```milo
fruits = ["Apple", "Pear"]
append(fruits, "Peach")
say length(fruits)
say fruits[0]
fruits[1] = "Plum"
say fruits
```

List and text positions start at **0**, like Python. Negative positions count from the end: `fruits[-1]` is the last item. Reading beyond the ends is an error. Lists can be edited; text cannot. Nested indexing works. Slices are not implemented. Lists and dictionaries cannot contain themselves, directly or indirectly.

## Dictionaries

```milo
person = {"name": "Alex", "city": "Skopje"}
say person["name"]
person["city"] = "Prilep"

for key in person
    say key, person[key]
end
```

Keys must be hashable values such as text or numbers. Reading a missing key is an error. Dictionary entries preserve insertion order.

## Operators

| Purpose | Syntax |
| --- | --- |
| Arithmetic | `+`, `-`, `*`, `/`, `//`, `%`, `**` |
| Comparisons | `==`, `!=`, `<`, `<=`, `>`, `>=` |
| Readable equality | `is`, `is not` |
| Logic | `and`, `or`, `not` |
| Membership | `in` |
| Grouping | `(expression)` |
| Assignment | `name = value` |

`is` means value equality in Milo. Python uses it differently. Use `not (item in items)` for a negative membership test; the combined spelling `not in` is not implemented.

Precedence, from highest to lowest: calls/indexing, exponentiation, unary `+`/`-`, multiplication/division/remainder, addition/subtraction, comparisons, `not`, `and`, `or`. Exponentiation groups right to left: `2 ** 3 ** 2` is 512. As in Python, `-2 ** 2` is -4, and `2 ** -2` is 0.25.

Chained comparisons work: `0 <= score <= 100`. `and` and `or` short-circuit and return the selected operand. Zero, empty text/collections, `false`, and `nothing` are false in conditions. Other ordinary values are true. Booleans participate in numeric operations as 1 and 0. Integers use checked signed 64-bit arithmetic. See [CHANGELOG.md](../CHANGELOG.md) for native-runtime differences.

## Built-in functions

| Function | Result or action |
| --- | --- |
| `ask(prompt)` | Read a line of text; prompt is optional |
| `number(value)` | Convert numeric text to a number |
| `text(value)` | Convert a value to readable text |
| `length(value)` | Length of text, a list, a dictionary, or a number sequence |
| `numbers(start, stop)` | Inclusive ascending or descending integer sequence |
| `append(items, value)` | Add one item to a list; returns `nothing` |
| `upper(text)`, `lower(text)` | Change ASCII text case (other Unicode characters are preserved) |
| `split(text, separator)` | Split text into a list; omit separator for ASCII whitespace |
| `join(items, separator)` | Join a list of texts; omit separator for one space |
| `round(number, places)` | Round with ties to even; places defaults to zero; decimal edge cases can differ from Python |
| `abs(number)` | Absolute value |
| `min(items)`, `max(items)` | Smallest/largest item; also accept multiple arguments |
| `sum(items)` | Sum numeric items |
| `sorted(items)` | Make a sorted list |
| `sqrt(number)` | Square root of a nonnegative number |

Names of built-in functions can be reassigned, so avoid using them as variable names unless intended. No dot-method syntax is needed: use `upper(name)` rather than `name.upper()`.

## Errors and checks

Errors identify the source line and show the relevant statement. For example:

```text
my-program.milo: Line 2: Cannot divide by zero.
  say 10 / 0
```

Check syntax without running a program or asking for input:

```sh
./milo --check examples/greeting.milo
```

The default execution budget is one million interpreter steps. It catches loops that never stop, including empty loops. Increase it for a deliberately longer program:

```sh
./milo --max-steps 5000000 my-program.milo
```

An interpreter step is an internal operation, not a line or a second. This budget does not bound a single expensive arithmetic or collection operation. This prototype is **not a security sandbox**: run trusted programs locally. There are no system-access built-ins, but resource exhaustion is still possible.

## Included examples

- `hello.milo`: output and a repeat counter.
- `greeting.milo`: interactive input and a decision.
- `functions.milo`: functions and an inclusive numeric loop.
- `shopping.milo`: lists, dictionaries, and a running total in denars.
- `fibonacci.milo`: a number sequence.

## How Milo differs from Python

| Python | Milo |
| --- | --- |
| `print("Hello", name)` | `say "Hello", name` |
| `input("Name? ")` | `ask("Name? ")` |
| `def square(n):` | `function square(n)` |
| Indentation closes blocks | Explicit `end` closes blocks |
| `for n in range(1, 4):` | `repeat 3 as n` |
| `True`, `False`, `None` | `true`, `false`, `nothing` |
| `name.upper()` | `upper(name)` |

Milo 0.3 does not yet have modules, classes, package installation, exceptions in user programs, file/network APIs, multiline expressions, string interpolation, keyword/default function arguments, an ahead-of-time compiler, or a JIT. It cannot import Python packages. The compiled C++ runtime is independent of Python. The Windows launcher is a convenience script, not an installer.

## Inspect the bytecode

Compilation happens automatically when you run a program. Your existing command still works:

```sh
./milo examples/functions.milo
```

Print the compiled instructions **without running** the program:

```sh
./milo --dump-bytecode examples/functions.milo
```

On Windows, replace `./milo` with `milo.exe`. `--check` now parses, compiles, and verifies the program without executing it. The older C++ tree engine remains available for regression checks and fair benchmarks:

```sh
./milo --tree examples/functions.milo
```

Bytecode is currently in memory only; there is no `.miloc` file format or bytecode loader in this release. Step limits count VM instructions and selected built-in iteration steps; they are not directly comparable to the older engine's step count.
