# 13.1. Runtime overview

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-overview.html | prev: https://morloc-project.github.io/docs/build-architecture/index.md | next: https://morloc-project.github.io/docs/build-architecture/build-artifacts.md

> A running Morloc program is a small set of cooperating processes: one **nexus** and one **pool** per language the program uses. The nexus is the program’s entry point and its only owner of shared resources. The pools execute the generated code. This section maps how they fit together; the sections that follow specify each piece.

**The nexus** is a single precompiled binary shared by every Morloc program. It reads the program’s manifest, interprets the request, starts the pools the request needs, sends the first call, and delivers the result. It runs in one of four modes:

| Mode | Behavior |
| --- | --- |
| CLI | One request from the command line, then exit. Starts only the pools the command can reach. |
| Daemon | Long-running server for many requests over a Unix socket, TCP or HTTP. Starts every pool at startup. |
| MCP | Long-running Model Context Protocol server for agents, on stdio or HTTP. Starts every pool at startup. |
| Call packet | Reads one prebuilt call from a file and writes the reply to a file. Used for jobs on cluster nodes. |

A command whose body calls no foreign function is **pure**. The nexus evaluates it itself and starts no pools.

**A pool** is one long-lived process per language. It holds every function the program uses from that language, compiled or loaded together, and serves calls on its own socket. Calls between functions in the same pool are ordinary native calls: no serialization and no IPC.

**A call that crosses languages** goes directly from the calling pool to the callee’s pool. The nexus is not on the path. Every cross-process call opens one connection, sends one call packet, and receives one reply packet.

![Diagram](https://morloc-project.github.io/docs/static/img/diag-59440dc2c47612dc9b26fc2809b04987f920cf98795a953da52b5aac4c735c67.svg)

**Data travels in one of three ways.** Every value that leaves a process is first serialized to the language-neutral binary form described in [Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md). Where that serialized form then goes depends on its size and on whether shared memory is available:

| Route | When |
| --- | --- |
| Inline | The serialized value is at most the inline threshold (64 KiB by default). It is copied into the packet. |
| Shared memory | The value is larger. It is written into shared memory and the packet carries a pointer to it ([Shared memory layout](https://morloc-project.github.io/docs/build-architecture/build-shm.md)). |
| File | The value is larger and shared memory is disabled. It is written to a temporary file and the packet carries the path. |

A shared-memory pointer is relative: it names a block by volume and offset, so it means the same block in every process of the program. This lets a pool read a large argument where its sender wrote it, without a copy across the socket.

**Ownership.** The nexus creates the program’s shared-memory namespace and temporary directory, and it alone removes them. Each pool watches a pipe whose write end only the nexus holds, and exits when the nexus does. Startup, shutdown and crash handling are specified in [Process lifecycle](https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md).
