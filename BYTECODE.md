# Milo bytecode VM

Milo 0.3 keeps the existing syntax. A program goes through four stages:

1. Tokenize and parse the source into temporary syntax trees.
2. Compile those trees into fixed-width instruction records, constants, and nested function code.
3. Verify reachable instructions for operand-stack underflow, consistent stack depths at joins, valid indices, and valid jump destinations.
4. Execute instructions in the C++ stack virtual machine.

The opcode is an eight-bit enum; records also hold integer operands and a source-line number. This is an internal representation, not a stable binary format. No external bytecode file is loaded. The VM does not use `eval`, translate programs into Python, or walk the AST while executing.

## Example

```milo
function square(n)
    return n * n
end
say square(5)
```

The core of `square` compiles to:

```text
LoadLocal 0
LoadLocal 0
Multiply
Return
```

The enclosing program creates the function, stores it in a global slot, loads it, pushes `5`, calls it, and prints the result. `--dump-bytecode` shows the full listing, including source lines and jump targets, without executing a program or asking for input.

## Variables and closures

Names are interned to integer symbol IDs. Global operations address slots directly. Parameters and names assigned within a function have local slots determined by a prepass over that function's body. Nested function bodies have their own layouts.

A separate bound flag distinguishes an unassigned slot from a variable containing `nothing`. A read of an unbound local falls back to the captured outer environment, matching Milo 0.2 rather than Python's `UnboundLocalError` behavior. Reads of captured names consult the lexical environment chain. Assignments create/update the current scope's slot; list/dictionary mutation still edits the shared object.

Functions keep references to their compiled code and captured environment. This preserves nested closures, recursion, mutual recursion, and functions saved between interactive submissions. Each submission can extend the global symbol table without discarding existing values.

## Stack and call frames

Instructions operate on a value stack. Each user call has a frame with code, instruction pointer, lexical environment, operand-stack base, and iterator slots. Arguments are moved into parameter slots. Returning restores the caller's stack base and pushes one result. Falling off the end returns `nothing`.

VM calls do not recursively invoke the C++ expression evaluator. There is still a deliberate limit of 128 nested user calls. Parsed block/value limits remain as documented. Ordinary runtime errors use C++ exceptions to leave the VM; normal `return`, `break`, and `continue` use instructions and jumps.

## Control flow and evaluation order

- `if`/`else if`/`else` compile to conditional and unconditional jumps.
- `and`/`or` keep the selected operand and skip unevaluated expressions.
- A chained comparison carries its middle value forward once and skips the rest on failure.
- `for`/`repeat` use frame-owned lazy iterators; `continue` jumps to the next-item instruction, and `break` releases that loop's iterator before leaving it.
- Function returns release all iterator state owned by that frame.
- Collection literals are freshly allocated each time they execute.
- Dictionary pairs are inserted individually so an invalid early key fails before later pairs execute.
- Indexed assignments evaluate the right-hand value, then the target collection, then its index, as in the prior Milo runtime.

Checked arithmetic and existing built-ins share the same value helpers with the old C++ engine. Integer addition, subtraction, and multiplication have direct VM paths with overflow checks. Runtime exceptions retain the instruction's original Milo source line.

## Scope

This is a portable switch-dispatch VM. It has no JIT, machine-code generator, tracing garbage collector, Python package interoperability, or stable bytecode distribution format. Environment/function ownership cycles are cleared at VM shutdown, as in the older runtime. It is not intended as a security sandbox. Speed depends on program structure; see the reproducible benchmarks instead of assuming that a C++ implementation always beats CPython.
