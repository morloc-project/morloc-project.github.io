# 0058: a teardown signal race prints a traceback to stderr, failing `cache-concurrent` intermittently

- Status: fixed
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

## Resolution

Fixed in `morloc` commit `df24e8bc`.

The guess above was wrong in an instructive way. The unguarded `signal.signal`
calls in `worker_process` and `client_listener` are not implicated: they run
once, at startup, outside any teardown. The racing call was the *guarded* one,
and the guard could never have worked -- the `try/except` wraps the call that
sets `SIG_IGN`, but the interpreter reports this failure at the point where the
next signal is delivered, between bytecodes, which is why the traceback names
no frame in the pool. Nothing in the pool could have caught it.

The flip existed to stop a re-entrant handler from double-freeing the daemon
pointer. It was protecting less than it looked: the normal exit path read the
same global directly and could free it in parallel with the handler, which no
signal masking inside the handler would prevent.

Both paths now take the pointer out of a one-element list. `list.pop` is a
single call into the interpreter's C layer, so a pending signal cannot be
processed partway through it and exactly one caller comes away holding the
pointer. Re-entrancy is then harmless on its own terms, and nothing touches
signal dispositions during teardown.

Verified by hammering the same shape as the failing test -- 40 concurrent
`nexus` invocations per round, 40 rounds:

```
runs=1600 nonempty_stderr=0
```

Against the measured baseline of 1 in 320, about five failures were expected in
that many runs, so zero is roughly a 0.7% outcome by chance. Full suite: 1817
pass, 0 fail.
