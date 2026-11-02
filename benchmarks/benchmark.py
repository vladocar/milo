#!/usr/bin/env python3
"""Compare equivalent Python programs, the retained C++ tree engine, and Milo VM."""
import argparse
import json
import os
from pathlib import Path
import platform
import statistics
import subprocess
import sys
import time

BASE = Path(__file__).resolve().parents[1]

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--native', type=Path, default=BASE / ('milo.exe' if os.name == 'nt' else 'milo'))
    parser.add_argument('--runs', type=int, default=9)
    parser.add_argument('--include-python-interpreter', action='store_true', help='also benchmark the old Python-written Milo interpreter; this is not ordinary Python')
    args = parser.parse_args()
    if args.runs < 1:
        parser.error('--runs must be positive')
    result = {
        'system': platform.platform(), 'python': platform.python_version(), 'runs': args.runs,
        'method': 'median end-to-end subprocess wall time, including startup, parsing, bytecode compilation if applicable, and execution; one untimed warmup per backend/program; timing order rotates/reverses; exact stdout match required',
        'backends': {'cpython': 'equivalent Python source executed by CPython',
                     'cpp_tree': 'retained C++ syntax-tree interpreter (--tree)',
                     'bytecode_vm': 'default C++ bytecode compiler and VM'},
        'results': [],
    }
    for program in sorted(Path(__file__).resolve().parent.glob('*.milo')):
        python_program = program.parent / 'python' / (program.stem + '.py')
        if not python_program.is_file():
            raise RuntimeError(f'No equivalent Python source for {program.name}')
        limit = ['--max-steps', '100000000']
        commands = {
            'cpython': [sys.executable, str(python_program)],
            'cpp_tree': [str(args.native.resolve()), '--tree', *limit, str(program)],
            'bytecode_vm': [str(args.native.resolve()), *limit, str(program)],
        }
        if args.include_python_interpreter:
            commands['python_milo_reference'] = [sys.executable, str(BASE / 'milo.py'), *limit, str(program)]
            result['backends']['python_milo_reference'] = 'old Python-written Milo interpreter, not ordinary Python source'
        times = {key: [] for key in commands}
        outputs = {key: subprocess.run(cmd, check=True, capture_output=True, text=True).stdout for key, cmd in commands.items()}
        if len(set(outputs.values())) != 1:
            raise RuntimeError(f'{program.name}: output mismatch: {outputs!r}')
        keys = list(commands)
        for repeat in range(args.runs):
            shift = repeat % len(keys)
            order = keys[shift:] + keys[:shift]
            if repeat % 2:
                order.reverse()
            for key in order:
                start = time.perf_counter()
                run = subprocess.run(commands[key], check=True, capture_output=True, text=True)
                times[key].append(time.perf_counter() - start)
                if run.stdout != outputs[key]:
                    raise RuntimeError(f'{key} returned a different output on a timed run')
        medians = {key: statistics.median(samples) for key, samples in times.items()}
        row = {'program': program.name, 'seconds': medians, 'samples': times, 'output': outputs['cpython'].strip(),
               'vm_speedup_over_tree': medians['cpp_tree'] / medians['bytecode_vm'],
               'vm_speedup_over_cpython': medians['cpython'] / medians['bytecode_vm']}
        result['results'].append(row)
        print(f"{program.name}: " + ' | '.join(f'{key} {value*1000:.2f} ms' for key, value in medians.items()) + f" | VM/tree {row['vm_speedup_over_tree']:.2f}x | VM/CPython {row['vm_speedup_over_cpython']:.2f}x", flush=True)
    (BASE / 'benchmarks' / 'results.json').write_text(json.dumps(result, indent=2) + '\n')

if __name__ == '__main__':
    main()
