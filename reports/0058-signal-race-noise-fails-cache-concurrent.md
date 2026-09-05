# 0058: a teardown signal race prints a traceback to stderr, failing `cache-concurrent` intermittently

- Status: open
- Found: 2026-09-05, during pre-commit verification of an unrelated change
- Component: runtime
- morloc: 0.100.2     mim: 0.28.0

## Expected

`test-suite/golden-tests/cache-concurrent` asserts that a run leaves stderr
empty. Shutting a pool down is routine and should print nothing.

## Observed

One run in six failed on that assertion:

```
    cache-concurrent:  FAIL (12.76s)
      Files '.../cache-concurrent/exp.txt' and '.../cache-concurrent/obs.txt' differ
```

```
$ diff exp.txt obs.txt
2c2
< stderr_empty_P:    yes
---
> stderr_empty_P:    no
```

The stderr content is a CPython traceback out of the Python pool:

```
Traceback (most recent call last):
  File "/env/.pixi/envs/default/lib/python3.13/signal.py", line 58, in signal
    handler = _signal.signal(_enum_to_int(signalnum), _enum_to_int(handler))
OSError: Signal 15 ignored due to race condition
```

Five immediate re-runs of the same test all passed, so it is intermittent.

## Reproduce

```
$ cd test-suite/golden-tests/cache-concurrent
$ for i in $(seq 1 20); do make >/dev/null 2>&1; diff -q exp.txt obs.txt >/dev/null || echo "FAIL on $i"; done
```

Expect a failure every several runs; it did not reproduce within five here, and
appeared once in a full-suite run.

## Impact

A test that fails once in several runs is worse than one that fails always:
it trains readers to re-run rather than read, and it makes any suite result
ambiguous at exactly the moment a suite result is being used to gate something.
The underlying noise also reaches real users, since it is the pool writing a
traceback to stderr on an ordinary shutdown.

## Guess

Unverified. `data/lang/py/pool.py` guards the `signal.signal` calls in
`signal_handler` with `try/except Exception: pass`, and the comment there
records the re-entrancy hazard that motivated the guard. The calls in
`worker_process` (restoring `SIG_DFL` right after fork) and in
`client_listener` are not guarded, and either could be running while a SIGTERM
is being delivered to the group during teardown.

## Not caused by

The change under verification when this surfaced touched Python source-module
binding and import resolution only (report 0056); it does not go near signal
handling, and the immediately preceding full-suite run on the same code passed
this test.
