#!/usr/bin/env python3
"""Milo 0.1 — a small, readable interpreted language. Python 3.10+, no dependencies."""
import argparse
import ast
import math
import operator
from pathlib import Path
import re
import sys
from dataclasses import dataclass

VERSION = '0.1.0'
KEYWORDS = set('say if else end repeat as for in while function return break continue and or not true false nothing is'.split())

class MiloError(Exception):
    def __init__(self, message, line=0):
        self.message, self.line = message, line
        super().__init__(message)
    def __str__(self):
        return f'Line {self.line}: {self.message}' if self.line else self.message

@dataclass
class Token:
    kind: str
    value: object
    column: int

TOKEN = re.compile(r'''(?P<space>[ \t]+)|(?P<comment>\#.*)|(?P<number>(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)|(?P<string>"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*')|(?P<name>[^\W\d]\w*)|(?P<op>==|!=|<=|>=|\*\*|//|[+*/%<>=()\[\]{},:\-])''')

def lex(text, line):
    tokens, pos = [], 0
    while pos < len(text):
        match = TOKEN.match(text, pos)
        if not match:
            raise MiloError(f'Unexpected character {text[pos]!r} at column {pos + 1}.', line)
        kind, value = match.lastgroup, match.group()
        if kind == 'number':
            value = float(value) if any(x in value for x in '.eE') else int(value)
        elif kind == 'string':
            try:
                value = ast.literal_eval(value)
            except (ValueError, SyntaxError):
                raise MiloError('Invalid quoted text. Use \\n for a new line.', line) from None
        if kind not in ('space', 'comment'):
            tokens.append(Token(kind, value, pos + 1))
        pos = match.end()
    tokens.append(Token('eof', '<end of line>', len(text) + 1))
    return tokens

# Expressions use a dedicated parser. Programs are never passed to Python eval/exec.
class ExpressionParser:
    def __init__(self, tokens, line):
        self.tokens, self.line, self.pos = tokens, line, 0
    def token(self):
        return self.tokens[self.pos]
    def at(self, value):
        return self.token().kind not in ('string', 'number') and self.token().value == value
    def take(self, value=None):
        token = self.token()
        if value is not None and not self.at(value):
            raise MiloError(f'Expected {value!r}; found {token.value!r}.', self.line)
        self.pos += 1
        return token
    def accept(self, value):
        if self.at(value):
            self.take()
            return True
        return False
    def name(self):
        token = self.token()
        if token.kind != 'name' or token.value in KEYWORDS:
            raise MiloError('Expected a variable or function name.', self.line)
        self.take()
        return token.value
    def finish(self):
        if self.token().kind != 'eof':
            raise MiloError(f'Unexpected {self.token().value!r}. Check this line.', self.line)
    def comma_list(self, close=None):
        items = []
        if close is not None and self.accept(close):
            return items
        if close is None and self.token().kind == 'eof':
            return items
        while True:
            items.append(self.expression())
            if not self.accept(','):
                break
            if close and self.at(close):
                break
        if close:
            self.take(close)
        return items
    def expression(self, minimum=0):
        token = self.token()
        if token.kind in ('number', 'string'):
            self.take()
            left = ('literal', token.value)
        elif self.at('true') or self.at('false') or self.at('nothing'):
            self.take()
            left = ('literal', {'true': True, 'false': False, 'nothing': None}[token.value])
        elif self.at('not') or self.at('-') or self.at('+'):
            self.take()
            left = ('unary', token.value, self.expression(25 if token.value == 'not' else 60))
        elif self.accept('('):
            left = self.expression()
            self.take(')')
        elif self.accept('['):
            left = ('list', self.comma_list(']'))
        elif self.accept('{'):
            pairs = []
            if not self.accept('}'):
                while True:
                    key = self.expression()
                    self.take(':')
                    pairs.append((key, self.expression()))
                    if not self.accept(',') or self.at('}'):
                        break
                self.take('}')
            left = ('dict', pairs)
        elif token.kind == 'name' and token.value not in KEYWORDS:
            left = ('name', self.name())
        else:
            raise MiloError(f'Expected a value; found {token.value!r}.', self.line)
        powers = {'or': 10, 'and': 20, '==': 30, '!=': 30, '<': 30, '<=': 30,
                  '>': 30, '>=': 30, 'is': 30, 'in': 30, '+': 40, '-': 40,
                  '*': 50, '/': 50, '//': 50, '%': 50, '**': 70}
        while True:
            if self.at('(') and 90 >= minimum:
                self.take()
                left = ('call', left, self.comma_list(')'))
                continue
            if self.at('[') and 90 >= minimum:
                self.take()
                index = self.expression()
                self.take(']')
                left = ('index', left, index)
                continue
            token = self.token()
            op = token.value if token.kind in ('op', 'name') else None
            power = powers.get(op, -1)
            if power < minimum:
                break
            if power == 30:
                parts = []
                while self.token().kind in ('op', 'name') and powers.get(self.token().value) == 30:
                    op = self.take().value
                    if op == 'is' and self.accept('not'):
                        op = '!='
                    parts.append((op, self.expression(31)))
                left = ('compare', left, parts)
            else:
                self.take()
                right = self.expression(power if op == '**' else power + 1)
                left = ('binary', op, left, right)
        return left

class Parser:
    def __init__(self, source):
        self.lines = []
        for number, text in enumerate(source.splitlines(), 1):
            if '\t' in text[:len(text) - len(text.lstrip())]:
                raise MiloError('Use spaces instead of tabs.', number)
            tokens = lex(text, number)
            if len(tokens) > 1:
                self.lines.append((number, tokens))
        self.pos = 0
    def block(self, in_function=False, in_loop=False):
        nodes = []
        while self.pos < len(self.lines):
            line, tokens = self.lines[self.pos]
            p = ExpressionParser(tokens, line)
            if p.at('end') or p.at('else'):
                break
            self.pos += 1
            first = p.token().value
            kind = first if p.token().kind == 'name' and first in KEYWORDS else None
            if kind:
                p.take()
            if kind == 'say':
                args = (p.comma_list(),)
            elif kind in ('if', 'while'):
                condition = p.expression()
                p.finish()
                body = self.block(in_function, in_loop or kind == 'while')
                branches = [(condition, body)]
                otherwise = []
                if kind == 'if':
                    while self.pos < len(self.lines):
                        eline, etokens = self.lines[self.pos]
                        ep = ExpressionParser(etokens, eline)
                        if not ep.accept('else'):
                            break
                        self.pos += 1
                        if ep.accept('if'):
                            cond = ep.expression()
                            ep.finish()
                            branches.append((cond, self.block(in_function, in_loop)))
                        else:
                            ep.finish()
                            otherwise = self.block(in_function, in_loop)
                            break
                self.end(line)
                args = (branches, otherwise) if kind == 'if' else (condition, body)
            elif kind in ('repeat', 'for'):
                if kind == 'repeat':
                    value = p.expression()
                    name = p.name() if p.accept('as') else None
                else:
                    name = p.name()
                    p.take('in')
                    value = p.expression()
                p.finish()
                body = self.block(in_function, True)
                self.end(line)
                args = (name, value, body)
            elif kind == 'function':
                name = p.name()
                p.take('(')
                params = []
                if not p.accept(')'):
                    while True:
                        params.append(p.name())
                        if not p.accept(','):
                            break
                    p.take(')')
                if len(params) != len(set(params)):
                    raise MiloError('Function parameter names must be different.', line)
                p.finish()
                body = self.block(True, False)
                self.end(line)
                args = (name, params, body)
            elif kind == 'return':
                if not in_function:
                    raise MiloError('Use return inside a function.', line)
                args = (p.expression() if p.token().kind != 'eof' else ('literal', None),)
            elif kind in ('break', 'continue'):
                if not in_loop:
                    raise MiloError(f'Use {kind} inside a loop.', line)
                args = ()
            elif kind:
                raise MiloError(f'{kind!r} cannot start a statement here.', line)
            else:
                value = p.expression()
                if p.accept('='):
                    if value[0] not in ('name', 'index'):
                        raise MiloError('Assign to a name or a list/dictionary item.', line)
                    kind, args = 'assign', (value, p.expression())
                else:
                    kind, args = 'expression', (value,)
            p.finish()
            nodes.append((kind, line, args))
        return nodes
    def end(self, opener):
        if self.pos >= len(self.lines):
            raise MiloError('This block needs an end on its own line.', opener)
        line, tokens = self.lines[self.pos]
        p = ExpressionParser(tokens, line)
        if not p.accept('end'):
            raise MiloError(f'Expected end for the block starting on line {opener}.', line)
        p.finish()
        self.pos += 1
    def parse(self):
        nodes = self.block()
        if self.pos < len(self.lines):
            raise MiloError('This end or else has no matching block.', self.lines[self.pos][0])
        return nodes

class Environment:
    def __init__(self, parent=None):
        self.values, self.parent = {}, parent
    def get(self, name):
        if name in self.values:
            return self.values[name]
        if self.parent:
            return self.parent.get(name)
        raise MiloError(f'I do not know {name!r}. Set it before using it.')

@dataclass
class Function:
    name: str
    params: list
    body: list
    closure: Environment

class Flow(Exception):
    def __init__(self, kind, value=None):
        self.kind, self.value = kind, value

def display(value, nested=False):
    if value is True: return 'true'
    if value is False: return 'false'
    if value is None: return 'nothing'
    if isinstance(value, str): return repr(value) if nested else value
    if isinstance(value, list): return '[' + ', '.join(display(v, True) for v in value) + ']'
    if isinstance(value, dict): return '{' + ', '.join(display(k, True) + ': ' + display(v, True) for k, v in value.items()) + '}'
    if isinstance(value, Function): return f'<function {value.name}>'
    if callable(value): return '<built-in function>'
    return str(value)

def numbers(start, stop):
    if type(start) is not int or type(stop) is not int:
        raise ValueError('numbers(start, stop) needs two whole numbers.')
    return range(start, stop + (1 if stop >= start else -1), 1 if stop >= start else -1)

def append(items, value):
    if not isinstance(items, list):
        raise ValueError('append needs a list as its first value.')
    if isinstance(value, (list, dict)) and Runtime.contains(value, items):
        raise MiloError('A list or dictionary cannot contain itself.')
    items.append(value)

def number(value):
    if isinstance(value, (int, float)):
        return value
    try:
        return int(value)
    except ValueError:
        return float(value)

class Runtime:
    def __init__(self, output=print, input_fn=input, max_steps=1000000):
        self.output, self.input_fn = output, input_fn
        self.max_steps, self.steps = max_steps, 0
        self.global_env = Environment()
        self.global_env.values.update({
            'ask': lambda prompt='': input_fn(display(prompt)), 'number': number,
            'text': display, 'length': len, 'numbers': numbers, 'append': append,
            'upper': lambda s: s.upper(), 'lower': lambda s: s.lower(),
            'split': lambda s, separator=None: s.split(separator),
            'join': lambda items, separator=' ': separator.join(items),
            'round': round, 'abs': abs, 'min': min, 'max': max, 'sum': sum,
            'sorted': sorted, 'sqrt': math.sqrt,
        })
    def tick(self):
        self.steps += 1
        if self.steps > self.max_steps:
            raise MiloError('Step limit reached. Check for a loop that never stops.')
    def expression(self, node, env):
        self.tick()
        kind, *a = node
        if kind == 'literal': return a[0]
        if kind == 'name': return env.get(a[0])
        if kind == 'list': return [self.expression(v, env) for v in a[0]]
        if kind == 'dict': return {self.expression(k, env): self.expression(v, env) for k, v in a[0]}
        if kind == 'index': return self.expression(a[0], env)[self.expression(a[1], env)]
        if kind == 'unary':
            value = self.expression(a[1], env)
            return {'not': operator.not_, '-': operator.neg, '+': operator.pos}[a[0]](value)
        if kind == 'binary':
            op, lhs, rhs = a
            left = self.expression(lhs, env)
            if op == 'and': return self.expression(rhs, env) if left else left
            if op == 'or': return left if left else self.expression(rhs, env)
            right = self.expression(rhs, env)
            return {'+': operator.add, '-': operator.sub, '*': operator.mul,
                    '/': operator.truediv, '//': operator.floordiv, '%': operator.mod,
                    '**': operator.pow}[op](left, right)
        if kind == 'compare':
            left = self.expression(a[0], env)
            for op, rhs in a[1]:
                right = self.expression(rhs, env)
                okay = {'==': operator.eq, 'is': operator.eq, '!=': operator.ne,
                        '<': operator.lt, '<=': operator.le, '>': operator.gt,
                        '>=': operator.ge, 'in': lambda x, y: x in y}[op](left, right)
                if not okay: return False
                left = right
            return True
        if kind == 'call':
            function = self.expression(a[0], env)
            values = [self.expression(v, env) for v in a[1]]
            if isinstance(function, Function):
                if len(values) != len(function.params):
                    raise MiloError(f'{function.name} needs {len(function.params)} values; got {len(values)}.')
                local = Environment(function.closure)
                local.values.update(zip(function.params, values))
                try:
                    self.block(function.body, local)
                except Flow as flow:
                    if flow.kind == 'return': return flow.value
                    raise
                return None
            if callable(function): return function(*values)
            raise MiloError('This value is not a function.')
        raise MiloError('Unknown expression.')
    def block(self, nodes, env):
        for kind, line, a in nodes:
            try:
                self.tick()
                self.statement(kind, a, env)
            except MiloError as error:
                if not error.line: error.line = line
                raise
            except ZeroDivisionError:
                raise MiloError('Cannot divide by zero.', line) from None
            except IndexError:
                raise MiloError('That list/text position does not exist. Positions start at 0.', line) from None
            except KeyError as error:
                raise MiloError(f'That dictionary key does not exist: {error.args[0]!r}.', line) from None
            except (TypeError, ValueError, AttributeError, OverflowError) as error:
                raise MiloError(f'These values cannot be used this way: {error}', line) from None
    def statement(self, kind, a, env):
        if kind == 'say':
            self.output(' '.join(display(self.expression(v, env)) for v in a[0]))
        elif kind == 'assign':
            target, expr = a
            value = self.expression(expr, env)
            if target[0] == 'name':
                env.values[target[1]] = value
            else:
                container = self.expression(target[1], env)
                key = self.expression(target[2], env)
                # Cyclic containers would make beginner-friendly printing ambiguous.
                if isinstance(value, (list, dict)) and self.contains(value, container):
                    raise MiloError('A list or dictionary cannot contain itself.')
                container[key] = value
        elif kind == 'expression': self.expression(a[0], env)
        elif kind == 'function': env.values[a[0]] = Function(*a, env)
        elif kind == 'if':
            branches, otherwise = a
            for condition, body in branches:
                if self.expression(condition, env):
                    self.block(body, env)
                    return
            self.block(otherwise, env)
        elif kind in ('while', 'for', 'repeat'):
            if kind == 'while':
                condition, body = a
                iterator = None
            else:
                name, expr, body = a
                value = self.expression(expr, env)
                if kind == 'repeat':
                    if type(value) is not int or value < 0:
                        raise MiloError('repeat needs a whole number of 0 or more.')
                    value = range(1, value + 1)
                iterator = iter(value)
            while True:
                self.tick()
                if kind == 'while':
                    if not self.expression(condition, env): break
                else:
                    try: item = next(iterator)
                    except StopIteration: break
                    if name is not None: env.values[name] = item
                try:
                    self.block(body, env)
                except Flow as flow:
                    if flow.kind == 'break': break
                    if flow.kind == 'continue': continue
                    raise
        elif kind == 'return': raise Flow('return', self.expression(a[0], env))
        elif kind in ('break', 'continue'): raise Flow(kind)
        else: raise MiloError('Unknown statement.')
    @staticmethod
    def contains(value, target, seen=None):
        if value is target: return True
        if not isinstance(value, (list, dict)): return False
        seen = set() if seen is None else seen
        if id(value) in seen: return False
        seen.add(id(value))
        children = value.values() if isinstance(value, dict) else value
        return any(Runtime.contains(child, target, seen) for child in children)
    def run(self, source):
        nodes = Parser(source).parse()
        self.steps = 0
        self.block(nodes, self.global_env)

def report(error, source, filename):
    print(f'{filename}: {error}', file=sys.stderr)
    lines = source.splitlines()
    if 0 < error.line <= len(lines):
        print('  ' + lines[error.line - 1].strip(), file=sys.stderr)

def repl(runtime):
    print(f'Milo {VERSION} | Type help, exit, or a program. Close blocks with end.')
    while True:
        lines = []
        depth = 0
        try:
            while True:
                line = input('... ' if lines else 'milo> ')
                if not lines and line.strip() == 'exit': return
                if not lines and line.strip() == 'help':
                    print('Try: say "Hello!"\nBlocks: if, while, repeat, for, function; close each with end.\nRead README.md for the complete guide.')
                    break
                lines.append(line)
                tokens = lex(line, len(lines))
                first = tokens[0]
                if first.kind == 'name':
                    if first.value in ('if', 'while', 'repeat', 'for', 'function'): depth += 1
                    if first.value == 'end': depth -= 1
                if depth <= 0:
                    runtime.run('\n'.join(lines))
                    break
        except MiloError as error: report(error, '\n'.join(lines), '<interactive>')
        except RecursionError: print('Too many nested calls or values.', file=sys.stderr)
        except KeyboardInterrupt: print('\nCancelled.')
        except EOFError: print(); return

def main():
    parser = argparse.ArgumentParser(description='Run a Milo program, or start the interactive prompt.')
    parser.add_argument('file', nargs='?', help='a .milo file')
    parser.add_argument('--version', action='version', version='Milo ' + VERSION)
    parser.add_argument('--check', action='store_true', help='check syntax without running')
    parser.add_argument('--max-steps', type=int, default=1000000, help='execution step budget (default: 1000000)')
    args = parser.parse_args()
    if args.max_steps < 1: parser.error('--max-steps must be positive')
    runtime = Runtime(max_steps=args.max_steps)
    if not args.file:
        if args.check: parser.error('--check needs a file')
        repl(runtime)
        return 0
    source = ''
    try:
        source = Path(args.file).read_text(encoding='utf-8-sig')
        if args.check:
            Parser(source).parse()
            print('Syntax looks good.')
        else:
            runtime.run(source)
        return 0
    except MiloError as error: report(error, source, args.file)
    except (OSError, UnicodeError) as error: print(f'Cannot read the program: {error}', file=sys.stderr)
    except RecursionError: print('Too many nested calls or values.', file=sys.stderr)
    except KeyboardInterrupt: print('\nProgram stopped.', file=sys.stderr)
    except EOFError: print('No input was available for ask().', file=sys.stderr)
    return 1

if __name__ == '__main__':
    raise SystemExit(main())
