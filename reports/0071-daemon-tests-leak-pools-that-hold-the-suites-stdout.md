# 0071: the daemon test suite leaves orphaned pools holding its stdout, so a piped run never returns

- Status: open
- Found: 2026-09-07, running the daemon suite while working on FINDINGS 8/9
- Component: runtime
- morloc: 0.102.1     mim: 0.28.0

## Expected

`./run-tests.sh` prints its results and exits. Piping it -- `./run-tests.sh |
tail -20`, which is what any log-capturing wrapper or CI step does -- returns as
soon as the suite is done.

## Observed

The suite finishes and prints its summary, and the pipeline does not return.
Observed on two consecutive full runs; the second was still hanging 20 minutes
after the suite had written `=== Results ===`.

The cause is a pool process that outlives its daemon and keeps the suite's
stdout open, so the reader downstream never sees EOF:

```
$ ps -eo pid,ppid,etime,cmd | grep pool.py
 253714  1  20:34  python3 /tmp/tmp.aGLQG2xgoe/nexus-build/pools/py/pool.py ...
 253715  1  20:34  python3 /tmp/tmp.aGLQG2xgoe/nexus-build/pools/py/pool.py ...

$ ls -l /proc/253714/fd/1
l-wx------ ... /proc/253714/fd/1 -> pipe:[56106140]

$ ls -l /proc/252032/fd/0          # the `tail` at the end of the pipeline
lr-x------ ... /proc/252032/fd/0 -> pipe:[56106140]
```

Same pipe. The pools are reparented to init (`ppid 1`) and their stderr points
at a `daemon.log` in an already-deleted temp directory, so the daemon that
started them is gone while they are not.

`kill 253714 253715` releases the pipeline immediately, and the suite's output
is complete and correct -- nothing was lost, it simply could not be read.

## Reproduce

```
$ cd test-suite/daemon-tests
$ ./run-tests.sh | tail -20
```

The suite prints nothing (the pipe buffers) and does not return. In another
shell, `ps -eo pid,ppid,cmd | grep pool.py` shows the orphans.

Running it without a pipe (`./run-tests.sh`) hides the symptom: output appears
and the shell prompt returns, because nothing downstream is waiting on EOF.

## Impact

Any CI step or wrapper that captures the suite's output hangs after the suite
has already passed, until something kills the orphan or a job-level timeout
fires. It also leaves shared-memory volumes and pool processes behind on a
developer machine, which the next run then contends with.

`stop_daemon` (`run-tests.sh:297`) sends a plain `SIGTERM` to the nexus and
waits for it, so this is not a `SIGKILL` denying the daemon its cleanup.

## Guess

Unverified. Either a daemon exits without reaping its pool children, or one of
the crash-recovery / contention groups (which deliberately kill pools and
restart them) leaves a replacement pool parented outside the daemon. The
orphans appeared on a run whose only two failures were the two concurrency
soak groups, so those are the first place to look.

Whatever the cause, a pool should not hold a file descriptor it inherited from
the test harness: closing or re-opening fd 1/2 in the pool at startup would
make the hang impossible independently of the reaping fix.

## Note

Distinct from the two failures on that run (`large payloads survive concurrent
churn`, `correct under two-core contention`), which are the known shared-memory
races.
