"""Regressions specific to the compiler, VM stack, slots, and call frames."""
from pathlib import Path
import random
import subprocess
import tempfile
import unittest

from test_native import BINARY

@unittest.skipUnless(BINARY.is_file(), 'Build the C++ runtime first')
class BytecodeTests(unittest.TestCase):
    def execute(self, source, *options, input_text='', tree=False):
        with tempfile.TemporaryDirectory() as tmp:
            file=Path(tmp) / 'test.milo'
            file.write_text(source, encoding='utf-8')
            return subprocess.run([str(BINARY), *(['--tree'] if tree else []), *options, str(file)], input=input_text, capture_output=True, text=True, encoding='utf-8', timeout=10)

    def assert_program(self, source, expected):
        for tree in (False, True):
            with self.subTest(tree=tree):
                result=self.execute(source, tree=tree)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout.removesuffix('\n'), expected)

    def test_short_circuits_and_stack_joins(self):
        self.assert_program('''
function touch(value)
    say value
    return value
end
say 3 < touch(2) < missing
say 1 < touch(2) < touch(3)
say 0 and missing, "yes" or missing
say 2 + (false or 3), 4 * (true and 5)
say [1 < 2 < 3, false or 7]
''', '2\nfalse\n2\n3\ntrue\n0 yes\n5 20\n[true, 7]')

    def test_unbound_local_reads_outer(self):
        self.assert_program('''
x = 9
function f(flag)
    say x
    if flag
        x = 2
    end
    return x
end
say f(false), f(true), x
''', '9\n9\n9 2 9')

    def test_closure_observes_later_assignment(self):
        self.assert_program('''
function maker()
    function read()
        return value
    end
    value = 42
    return read
end
read = maker()
say read()
''', '42')

    def test_closures_from_distinct_calls(self):
        self.assert_program('''
function maker(n)
    function add(x)
        return n + x
    end
    return add
end
a = maker(2)
b = maker(10)
say a(3), b(3), a(4)
''', '5 13 6')

    def test_calls_preserve_surrounding_operands(self):
        self.assert_program('''
function add(a, b)
    return a + b
end
say 10 + add(add(1, 2), add(3, 4)) * 2
say [add(1, 2), add(3, 4)], {"x": add(8, 9)}
''', "30\n[3, 7] {'x': 17}")

    def test_nested_loop_control_and_return(self):
        self.assert_program('''
function find()
    repeat 3 as outer
        for inner in numbers(1, 5)
            if inner == 2
                continue
            end
            if outer == 2 and inner == 3
                return outer * 10 + inner
            end
            if inner == 4
                break
            end
        end
    end
end
say find()
repeat 3 as a
    repeat 3 as b
        break
    end
    if a == 2
        continue
    end
    say a, b
end
''', '23\n1 1\n3 1')

    def test_empty_loops_and_bound_values(self):
        self.assert_program('''
n = 7
repeat 0 as n
    say missing
end
for item in []
    say missing
end
say n
function f()
    repeat 0
    end
end
say f()
''', '7\nnothing')

    def test_literals_are_fresh_and_aliases_are_shared(self):
        self.assert_program('''
function fresh()
    return [1]
end
a = fresh()
b = fresh()
append(a, 2)
c = a
append(c, 3)
say a, b
''', '[1, 2, 3] [1]')

    def test_dictionary_pair_failure_order(self):
        source='''function side()
    say "should not run"
    return 1
end
x = {[]: 1, "later": side()}
'''
        for tree in (False, True):
            result=self.execute(source,tree=tree)
            self.assertNotEqual(result.returncode,0)
            self.assertEqual(result.stdout,'')
            self.assertIn('Line 5:',result.stderr)
            self.assertIn('Dictionary keys',result.stderr)

    def test_assignment_evaluation_order(self):
        self.assert_program('''
items = [0]
function rhs()
    say "rhs"
    return 9
end
function container()
    say "container"
    return items
end
function key()
    say "key"
    return 0
end
container()[key()] = rhs()
say items
''', 'rhs\ncontainer\nkey\n[9]')

    def test_error_location_inside_function(self):
        source='function fail()\n    return 1 / 0\nend\nsay 7 + fail()'
        for tree in (False,True):
            result=self.execute(source,tree=tree)
            self.assertNotEqual(result.returncode,0)
            self.assertIn('Line 2:',result.stderr)
            self.assertIn('divide by zero',result.stderr)

    def test_disassembly_does_not_execute(self):
        result=self.execute('function twice(n)\nreturn n * 2\nend\nrepeat 2\nsay twice(ask("Never prompt"))\nend', '--dump-bytecode')
        self.assertEqual(result.returncode,0,result.stderr)
        for opcode in ('Call', 'LoadLocal', 'Multiply', 'IterNext', 'Return', 'Halt'):
            self.assertIn(opcode,result.stdout)
        self.assertNotIn('No input was available',result.stderr)
        # The prompt occurs only as a quoted constant in the listing.
        self.assertNotIn('Never promptNever prompt',result.stdout)

    def test_check_compiles_without_executing(self):
        result=self.execute('say missing\nwhile true\nend', '--check')
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(result.stdout,'Syntax looks good.\n')

    def test_repl_keeps_compiled_functions_and_globals(self):
        source='x = 2\nfunction read()\nreturn x\nend\nsay read()\nx = 7\nsay read()\nexit\n'
        result=subprocess.run([str(BINARY)],input=source,capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertIn('milo> 2\n',result.stdout)
        self.assertIn('milo> 7\n',result.stdout)

    def test_repl_recovers_after_error(self):
        source='function fail()\nreturn 1 / 0\nend\nfail()\nsay 42\nexit\n'
        result=subprocess.run([str(BINARY)],input=source,capture_output=True,text=True,timeout=10)
        self.assertEqual(result.returncode,0)
        self.assertIn('divide by zero',result.stderr)
        self.assertIn('milo> 42\n',result.stdout)

    def test_differential_generated_expressions(self):
        rng=random.Random(703)
        def expression(depth):
            if depth<=0 or rng.random()<0.25:
                return str(rng.randrange(-8,9))
            op=rng.choice(['+', '-', '*', '<', '==', 'and', 'or'])
            return f'({expression(depth-1)} {op} {expression(depth-1)})'
        source='\n'.join('say '+expression(4) for _ in range(150))
        vm,tree=self.execute(source),self.execute(source,tree=True)
        self.assertEqual(vm.returncode,0,vm.stderr)
        self.assertEqual(tree.returncode,0,tree.stderr)
        self.assertEqual(vm.stdout,tree.stdout)

if __name__=='__main__':
    unittest.main()
