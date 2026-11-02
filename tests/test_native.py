"""Run the original behavioral tests against the real C++ executable."""
from pathlib import Path
import os
import shlex
import re
import subprocess
import tempfile
import unittest

import test_milo
from milo import MiloError

BASE = Path(__file__).resolve().parents[1]
BINARY = Path(os.environ.get('MILO_BINARY', str(BASE / ('milo.exe' if os.name == 'nt' else 'milo'))))
ENGINE_ARGS = shlex.split(os.environ.get('MILO_ENGINE_ARGS', ''))

@unittest.skipUnless(BINARY.is_file(), 'Build the C++ runtime first')
class NativeLanguageTests(test_milo.LanguageTests):
    def run_code(self, source, answers=(), **kwargs):
        with tempfile.TemporaryDirectory() as temp:
            program = Path(temp) / 'test.milo'
            program.write_text(source, encoding='utf-8')
            args = [str(BINARY), *ENGINE_ARGS, '--max-steps', str(kwargs.get('max_steps', 1000000)), str(program)]
            result = subprocess.run(args, input='\n'.join(answers) + ('\n' if answers else ''), capture_output=True, text=True, encoding='utf-8', timeout=10)
            if result.returncode:
                match = re.search(r'Line (\d+): ([^\n]+)', result.stderr)
                if not match:
                    self.fail(f'Unexpected interpreter failure ({result.returncode}): {result.stderr}')
                raise MiloError(match[2], int(match[1]))
            output = result.stdout
            # The Python test harness does not echo prompts; real ask() prints them.
            for prompt in re.findall(r'ask\("([^"\n]*)"\)', source):
                if output.startswith(prompt):
                    output = output[len(prompt):]
            return output.removesuffix('\n')

    def test_cli(self):
        result = subprocess.run([str(BINARY), *ENGINE_ARGS, str(BASE / 'examples' / 'hello.milo')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertIn('Hello', result.stdout)
        result = subprocess.run([str(BINARY), *ENGINE_ARGS, '--check', str(BASE / 'examples' / 'greeting.milo')], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(result.stdout.strip(), 'Syntax looks good.')

    def test_examples_parse(self):
        for file in (BASE / 'examples').glob('*.milo'):
            with self.subTest(file=file.name):
                result = subprocess.run([str(BINARY), *ENGINE_ARGS, '--check', str(file)], capture_output=True, text=True)
                self.assertEqual(result.returncode, 0, result.stderr)

    def test_native_edges(self):
        cases = [
            ('function f()\nrepeat 10\nif true\nreturn 7\nend\nend\nend\nsay f()', '7'),
            ('say -7 // 2, -7 % 2, 7 // -2, 7 % -2', '-4 1 -4 -1'),
            ('say 9007199254740993 == 9007199254740992.0', 'false'),
            ('say 9223372036854775807 < 9223372036854775808.0', 'true'),
            ('say length("Мило"), "Мило"[1], "🙂x"[0]', '4 и 🙂'),
            ('say {"a": 1, "a": 2}', "{'a': 2}"),
            ('say [1, 2] == [1, 2], {"a": 1} == {"a": 1}', 'true true'),
            ('say 2 in numbers(3, 1), 2.5 in numbers(1, 3)', 'true false'),
            ('say sorted([3, 1, 2]), min(4, 2), max([1, 3]), sum(numbers(1, 4))', '[1, 2, 3] 2 3 10'),
            ('say round(2.5), round(3.5), abs(-5)', '2 4 5'),
            ('say "x" * 3, 2 * "a", [1] + [2]', 'xxx aa [1, 2]'),
            ('a = []\nb = {"a": a}\na = [b]\nsay length(a)', '1'),
        ]
        for source, expected in cases:
            with self.subTest(source=source):
                self.assertEqual(self.run_code(source), expected)

    def test_native_guards(self):
        cases = [
            ('say 9223372036854775807 + 1', 'overflow'),
            ('say 3037000500 * 3037000500', 'overflow'),
            ('say (-9223372036854775807 - 1) // -1', 'overflow'),
            ('say (-9223372036854775807 - 1) * -1', 'overflow'),
            ('a = []\nb = {"x": a}\nappend(a, b)', 'contain itself'),
            ('function f()\nreturn f()\nend\nf()', 'nested'),
            ('say sqrt(-1)', 'nonnegative'),
            ('say numbers(true, 2)', 'whole numbers'),
            ('say split("a", "")', 'empty'),
        ]
        for source, message in cases:
            with self.subTest(source=source):
                with self.assertRaisesRegex(MiloError, message):
                    self.run_code(source)

if __name__ == '__main__':
    unittest.main()
