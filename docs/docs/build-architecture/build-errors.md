# 13.10. Error propagation

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-errors.html | prev: https://morloc-project.github.io/docs/build-architecture/build-streaming.md | next: https://morloc-project.github.io/docs/build-architecture/build-collect.md

> A failure can start in any language, several calls deep, in a different process from the code that should handle it. This section specifies the two kinds of failure the runtime distinguishes, how a recoverable failure travels back through pools as an error packet gathering a traceback, how `@try` turns it into a value, and how a failure of the runtime itself ends a run.

**Two kinds of failure.**

| Kind | Examples | Caught by `@try` |
| --- | --- | --- |
| Recoverable | An exception raised by user code in any language; `@throw` in Morloc; a Rust panic in user code. | Yes |
| Infrastructure | A pool that crashed or was killed; a broken connection; an internal error (panic) in the runtime. | No |

A recoverable failure means the computation went wrong; the program can decide what to do. An infrastructure failure means the system that runs the program went wrong, so no Morloc code can be trusted to handle it.

**Recoverable failures.** Each generated function catches a failure that escapes it, appends one traceback line, and raises it again:

```
  at <function> [<language>] (mid=<index>, <file>:<line>:<column>)
```

Anonymous functions are named `_`. At the edge of a pool, the failure becomes an error packet (status 1, text payload; [Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)) carrying the message and the lines so far. The calling pool’s stub reads the error packet and raises it as a native failure in its own language, whose functions then add their lines. So the traceback grows across every pool the failure crosses, innermost call first:

```
nope
  at _ [py] (mid=2366, t.loc:12:23)
  at _ [cpp] (mid=2364, t.loc:12:17)
  at chain [cpp] (mid=4, t.loc:1:34)
```

A program built with `morloc make --debug` also records each active frame’s arguments when a failure passes through it, and adds them to the message.

**`@try`.** `@try e` evaluates `e`. If it completes, the result is `Ok v`; if a recoverable failure escapes it, the result is `Err msg`, where `msg` is the message with the traceback gathered so far. A failure is caught the same way whichever language raised it.

**At the nexus.** A failure that reaches the nexus ends a one-shot run with `Error: run failed`, the message and its traceback on standard error, and exit status 1. A command whose result is a variant whose arm is named `Err` is treated the same way: the value is printed on standard error and the run exits 1, so a failing command fails in a shell pipeline even though it returned a value. A daemon answers the request as failed and keeps serving.

**Infrastructure failures.** A pool that loses a pool it called, or whose runtime breaks one of its own invariants, does not answer with an error packet: it ends its own worker. Its caller then sees a closed connection, which is itself an infrastructure failure, so the failure travels to the nexus whatever code lies between, and no `@try` along the way can catch it. The nexus reports which pool died and how, ends the run with status 1 (70 if the nexus itself panicked; [Process lifecycle](https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md)), and removes the run’s processes and shared memory. A daemon fails the request and restarts its pools. A process that dies prints its own diagnostics to the standard error it shares with the nexus, so they reach the user directly.

**Closed output.** Writing to a standard output that the reader has closed (as with `| head`) is neither: the pool answers with status 2, and the nexus ends the run with status 141, as a native program would.
