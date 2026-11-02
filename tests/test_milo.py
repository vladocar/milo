from pathlib import Path
import subprocess
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from milo import MiloError, Parser, Runtime

class LanguageTests(unittest.TestCase):
    def run_code(self, source, answers=(), **kwargs):
        output = []
        inputs = iter(answers)
        runtime = Runtime(output=output.append, input_fn=lambda p: next(inputs), **kwargs)
        runtime.run(source)
        return '\n'.join(output)

    def test_programs(self):
        cases = [
            ('say "Hello, world!"', 'Hello, world!'),
            ('name = "Alex"\nsay "Hello", name', 'Hello Alex'),
            ('say 2 + 3 * 4, (2 + 3) * 4', '14 20'),
            ('say -2 ** 2, 2 ** 3 ** 2, 2 ** -2', '-4 512 0.25'),
            ('say 7 // 2, 7 % 2, 7 / 2', '3 1 3.5'),
            ('say true, false, nothing', 'true false nothing'),
            ('say 1 < 2 < 3, 1 < 2 > 3', 'true false'),
            ('say not 1 == 2, false and missing, true or missing', 'true false true'),
            ('say 2 is 2, 2 is not 3, "a" in "cat"', 'true true true'),
            ('if false\nsay "no"\nelse if 2 > 1\nsay "yes"\nelse\nsay "no"\nend', 'yes'),
            ('repeat 3 as n\nsay n\nend', '1\n2\n3'),
            ('repeat 0\nsay "no"\nend\nsay "done"', 'done'),
            ('for n in numbers(3, 1)\nsay n\nend', '3\n2\n1'),
            ('for letter in "abc"\nsay upper(letter)\nend', 'A\nB\nC'),
            ('n = 0\nwhile n < 3\nn = n + 1\nif n == 2\ncontinue\nend\nsay n\nend', '1\n3'),
            ('repeat 100\nsay "once"\nbreak\nend', 'once'),
            ('repeat 2\nrepeat 3\nbreak\nend\nsay "outer"\nend', 'outer\nouter'),
            ('function square(n)\nreturn n*n\nend\nsay square(5)', '25'),
            ('function factorial(n)\nif n <= 1\nreturn 1\nend\nreturn n * factorial(n-1)\nend\nsay factorial(6)', '720'),
            ('x = 10\nfunction f()\nx = 20\nreturn x\nend\nsay f(), x', '20 10'),
            ('function maker(x)\nfunction inner(y)\nreturn x+y\nend\nreturn inner\nend\nadd = maker(3)\nsay add(4)', '7'),
            ('function f()\nreturn\nend\nsay f()', 'nothing'),
            ('a = [1, 2, 3]\na[1] = 9\nappend(a, 4)\nsay a, a[-1]', '[1, 9, 3, 4] 4'),
            ('a = {"name": "Milo", "age": 1}\na["age"] = 2\nsay a["name"], a["age"]', 'Milo 2'),
            ('say "# end", "say", "=", "a\\nb" # comment', '# end say = a\nb'),
            ('say length([1, 2]), sum([1, 2]), sqrt(9), number("2.5")', '2 3 3.0 2.5'),
            ('say join(split("one,two", ","), " & ")', 'one & two'),
            ('име = "Мило"\nsay име', 'Мило'),
            ('say [true, nothing, "hello"]', "[true, nothing, 'hello']"),
            ('say 1e2, .5, 2.', '100.0 0.5 2.0'),
            ('a = [[1]]\na[0][0] = 7\nsay a', '[[7]]'),
        ]
        for source, expected in cases:
            with self.subTest(source=source):
                self.assertEqual(self.run_code(source), expected)

    def test_input(self):
        self.assertEqual(self.run_code('name = ask("Name? ")\nage = number(ask("Age? "))\nsay name, age + 1', ['Alex', '40']), 'Alex 41')

    def test_errors(self):
        cases = [
            ('say missing', 1, 'do not know'),
            ('say 1 / 0', 1, 'divide by zero'),
            ('if true\nsay 1', 1, 'needs an end'),
            ('end', 1, 'no matching'),
            ('else', 1, 'no matching'),
            ('repeat -1\nend', 1, 'whole number'),
            ('repeat 2.5\nend', 1, 'whole number'),
            ('say [1][2]', 1, 'position'),
            ('say {}["a"]', 1, 'key'),
            ('return 1', 1, 'inside a function'),
            ('break', 1, 'inside a loop'),
            ('continue', 1, 'inside a loop'),
            ('function f(a, a)\nend', 1, 'different'),
            ('function f(x)\nend\nf()', 3, 'needs 1 values'),
            ('repeat 1\nfunction f()\nbreak\nend\nend', 3, 'inside a loop'),
            ('say "unclosed', 1, 'Unexpected character'),
            ('say 1; say 2', 1, 'Unexpected character'),
            ('say 1 +', 1, 'Expected a value'),
            ('a = []\na[0] = a', 2, 'contain itself'),
            ('a = []\nappend(a, a)', 2, 'contain itself'),
            ('a = []\nb = [a]\nappend(a, b)', 3, 'contain itself'),
            ('say __import__("os")', 1, 'do not know'),
            ('say "hello".upper()', 1, 'Unexpected character'),
            ('if true:\nend', 1, 'Unexpected'),
            ('if false\nsay 1 +\nend', 2, 'Expected a value'),
        ]
        for source, line, message in cases:
            with self.subTest(source=source):
                with self.assertRaises(MiloError) as ctx:
                    self.run_code(source)
                self.assertEqual(ctx.exception.line, line)
                self.assertIn(message, str(ctx.exception))

    def test_budget_in_empty_loop(self):
        with self.assertRaisesRegex(MiloError, 'Step limit'):
            self.run_code('while true\nend', max_steps=50)

    def test_mutual_recursion(self):
        source = 'function even(n)\nif n == 0\nreturn true\nend\nreturn odd(n-1)\nend\nfunction odd(n)\nif n == 0\nreturn false\nend\nreturn even(n-1)\nend\nsay even(10)'
        self.assertEqual(self.run_code(source), 'true')

    def test_examples_parse(self):
        for file in (Path(__file__).resolve().parents[1] / 'examples').glob('*.milo'):
            with self.subTest(file=file.name):
                Parser(file.read_text()).parse()

    def test_cli(self):
        base = Path(__file__).resolve().parents[1]
        result = subprocess.run([sys.executable, str(base / 'milo.py'), str(base / 'examples' / 'hello.milo')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Hello', result.stdout)
        result = subprocess.run([sys.executable, str(base / 'milo.py'), '--check', str(base / 'examples' / 'greeting.milo')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Syntax looks good', result.stdout)

if __name__ == '__main__':
    unittest.main()
