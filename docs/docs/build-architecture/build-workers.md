# 13.4. Worker model

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-workers.html | prev: https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md | next: https://morloc-project.github.io/docs/build-architecture/build-packets.md

> A pool serves many calls at once: concurrent requests to a daemon, parallel maps, and calls that come back into a pool while it is already waiting on another. This section specifies how the nexus and the pools divide that work among threads and processes, how pools grow and shrink, and the one rule that keeps calls between pools from deadlocking.

**The nexus.** A one-shot nexus makes one call and waits for it. A daemon or MCP server runs an accept thread and a fixed set of request workers (four more than the number of pools, between 4 and 32); a request waits in a queue until a worker is free. In every mode, a `SIGCHLD` handler reaps child processes as they exit, so a pool’s death is noticed at once.

**Pools.** Each pool has one process that owns its socket, and a set of **workers** that run user code. How a worker is made depends on the language:

| Language | Workers |
| --- | --- |
| C++, Rust | Threads. An accept thread queues each connection; a worker thread takes it. |
| Python, Linux default | Forked processes. A coordinator process, which loads no user code and runs no threads, forks the workers; each worker loads the user’s sources after the fork. |
| Python, macOS default | Threads, since forking a running Python interpreter is unsafe there. Selected anywhere with `MORLOC_PY_POOL=thread` (or `fork`). |
| R | Forked processes. Idle workers accept on the pool’s socket directly. |

Forked workers are created only from a process with a single thread, because a forked child inherits only the thread that forked it, and any lock another thread held at that moment would stay locked forever. Loading user code after the fork keeps libraries that start their own threads out of the coordinator.

**The no-deadlock rule.** A pool never leaves an incoming call waiting while every one of its workers is blocked on another pool. Cross-language calls can nest in any pattern: a Python function calls C++, which calls back into Python. If the only Python worker were waiting on C++, the callback would wait forever. So:

-   A thread pool starts a new worker whenever a call arrives and no worker is free.
-   A forked pool counts a worker as blocked while it waits on another pool (a foreign call, or a read or write on a channel), and forks a new worker when every worker is blocked. A call that arrives while some worker is merely computing waits for it.

Calls that arrive one after another reuse a single worker; only real concurrency adds workers. There is no upper bound, because any bound would reintroduce the deadlock.

**Shrinking.** Each pool starts with one worker. A worker beyond the first that stays idle for 5 seconds exits (`MORLOC_POOL_IDLE_TIMEOUT_MS` changes this for C++ and Rust). R workers never exit before the pool does.

**Ordering.** Every call travels on its own connection with exactly one request and one reply, so a reply always reaches the caller that asked. Concurrent calls have no ordering guarantee relative to one another. A pool’s own sequential code (a `map` in one worker, say) runs in order.

**Locks.** State shared between processes is guarded by locks that survive the death of their holder: if a process dies holding one, the next process to take it is told, and treats what it protects as damaged rather than waiting forever ([Shared memory layout](https://morloc-project.github.io/docs/build-architecture/build-shm.md)). Within a process, locks are always taken in one global order, so two threads can never each hold a lock the other wants.
