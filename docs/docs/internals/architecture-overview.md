# 13.1. Architecture Overview

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/internals/architecture-overview.html | prev: https://morloc-project.github.io/docs/internals/index.md | next: https://morloc-project.github.io/docs/internals/cross-language-calls.md

A compiled Morloc program has two kinds of components: one **nexus** and one or more **pools**.

The **nexus** is a pre-compiled Rust binary that serves as the CLI entry point. It reads a JSON manifest describing the program’s structure, parses command-line arguments, and orchestrates execution. The nexus starts pool daemons, sends them call packets over Unix domain sockets, and prints the result. When done, it tears everything down.

**Pools** are language-specific daemons — one per language used in the program. A pool contains all functions from its language, compiled into a single unit. Pools listen on Unix sockets for call packets, dispatch to the appropriate function, and return results. All pools support **concurrency**, starting with one worker and growing dynamically as needed. C++ pools use OS threads for true parallelism; Python and R pools use worker processes to handle concurrent requests.

Data moves between pools via Unix domain sockets. For **small values** (up to 64 KB), the serialized data is embedded directly in the packet — no shared memory is needed. For **large values**, data is placed in a shared memory region and only an 8-byte pointer travels over the socket. Pools can also call each other directly for cross-language ("foreign") calls, without routing through the nexus.

![Diagram](https://morloc-project.github.io/docs/static/img/diag-334e01bb4d909869bdcac4a7598ffe360d9cb326f8bc9851cdfc985982e49b6d.svg)

Here are the runtime rules you should be able to count on. Any violations should be considered bugs.

1.  **STDOUT and STDERR pass through.** Any output written to stdout or stderr by user functions is never intercepted or buffered by the Morloc runtime. It passes directly to the terminal.
2.  **Errors become tracebacks.** All exceptions raised by user functions are caught by the pool and returned as error packets. As the error propagates back through foreign calls to the nexus, each layer appends context, building a full cross-language traceback that the user can read.
3.  **Intra-pool calls are near-native.** Calls between functions within the same pool go through a simple dispatch table — there is no serialization, no socket overhead, and no IPC. Performance should be nearly native.
4.  **Inter-pool calls cost socket time plus marshalling.** A call between pools (or between the nexus and a pool) pays only the few microseconds of Unix socket round-trip plus the cost of data marshalling. In the best case, the data in shared memory can be directly used between programs and marshalling cost is zero. In practice, copies are often needed — for example, Python demands ownership of its strings even when the data could in principle be shared directly.
