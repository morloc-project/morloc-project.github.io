# 12.6. Serving

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-serving.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-freezing.md

> A compiled program is a command-line tool, but the nexus can also keep it running as a server, answering many requests without restarting its pools. This section specifies the server modes, how one command of a manifest becomes an HTTP endpoint and an MCP tool, how a server recovers from a crashed pool, how callers may evaluate new expressions, and the security model that decides who may call what. How `mim` chooses what to serve is specified last.

## 12.6.1. Server modes

| Mode | Serves |
| --- | --- |
| Daemon | One program, to local clients over a Unix socket or loopback TCP (length-prefixed JSON), and optionally over HTTP. Starts every pool at startup. |
| MCP | One program to one agent, over standard input and output, or over HTTP. |
| Front end | Several installed programs over one HTTP port, as MCP tools and a JSON API, with optional eval. Each program runs in its own daemon, which the front end starts on first use. |

`mim` always serves through the front end. It names the programs to serve explicitly; nothing is served because it happens to be installed. The front end finds each program’s manifest in the installed-programs directory of the state ([Overview](https://morloc-project.github.io/docs/ecosystem-architecture/eco-overview.md)), checks every one at startup, and starts each program’s daemon on its first request. A daemon that has exited is started again on the next request for it.

## 12.6.2. Endpoints

The front end answers:

| Request | Meaning |
| --- | --- |
| `GET /health` | Liveness. Open to every caller, so a monitor needs no secret. |
| `POST /mcp` | The MCP endpoint. |
| `POST /call/<module>/<command>` | Call one command. The body is the argument list as a JSON array, or an object with an `args` array. |
| `GET /discover`, `GET /discover/<module>` | The served modules, then one module’s commands with their arguments, types and documentation. |
| `POST /eval` | Evaluate an expression, when eval is enabled (below). |

A successful call returns `{"status":"ok","result":…​}`. A command whose result carries a media type returns the raw bytes with that type instead. A failure returns `{"status":"error","error":"…​"}`.

## 12.6.3. Commands as MCP tools

Each exported command of each program on the MCP view becomes one tool, named `<module>__<command>`. A name that collides is refused at startup. The tool’s description is the command’s documentation, and its input schema is an object with one property per argument, keyed by the argument’s published name (its declared long name, or `_1`, `_2`, …​ for positional arguments). Morloc types map to JSON Schema:

| Morloc type | JSON Schema |
| --- | --- |
| `Bool` | `boolean` |
| integer types | `integer` |
| real types | `number` |
| `Str` | `string` |
| enumerations | `string` with `enum` |
| sum types | `oneOf` a constructor-name string or a one-key object |
| lists, tables | `array` |
| tuples | `array` with fixed `prefixItems` |
| records | `object`, required fields being those not optional |
| optional `?T` | `T` or `null`, never required |

A record argument may instead be spread into one property per field. A command that renders its result several ways gets an extra `_render` property naming the rendering. When a command returns a record, the tool also declares an output schema and returns structured content; otherwise the result is one text block of JSON.

A command is not offered as a tool if an argument or its result is a file handle or a stream, or if it reads standard input. These mean nothing to a remote caller, and a stream would write to the standard output that the MCP transport owns.

**Protocol.** The server speaks MCP protocol version `2025-06-18`. A client sends `initialize`, then the `notifications/initialized` notification; `tools/list` and `tools/call` before that are rejected. Over HTTP, `initialize` returns an `Mcp-Session-Id` header that every later request must carry; an unknown session is told to initialize again, and an idle session expires. A call that fails while running returns a normal result marked `isError`, with the message as text. A malformed request, an unknown tool or a bad argument is a JSON-RPC error.

## 12.6.4. Pool crash recovery

A daemon outlives any one call, so it must survive a pool that crashes. When it finds a pool dead, it closes admission (new requests are answered as unavailable, HTTP 503), stops every pool, and waits for the requests already running to finish. Only then does it discard the program’s shared memory, create it afresh, restart and ping every pool, and reopen admission. No request spans a recovery, so no shared-memory reference from before the crash is ever read after it. If running requests do not finish within a minute, or recovery keeps failing, the daemon exits instead of serving from an inconsistent state.

## 12.6.5. Eval

When enabled, eval lets a caller send a whole Morloc expression that composes installed functions. It is offered as `POST /eval` with `{"expr": "…​"}` and as an MCP tool named `eval` whose description lists the importable modules.

Each request is typechecked, compiled and run in a fresh process group, under these restrictions:

-   Every `import` must name a module on the **allow-list**, checked against the module’s real name, so renaming on import does not help.
-   Only installed modules resolve; local imports are refused.
-   The expression may not source foreign code or declare types, typeclasses or instances.
-   Input and output intrinsics may not appear directly; a function from an allowed module may still perform them, so the reachable I/O is exactly what those modules export.
-   The compiler’s memory is capped at 2 GB; CPU time at a configurable limit (30 seconds by default) and wall time at four times that. A request over its limit has its whole process group stopped.

Nothing about one request is kept for the next.

## 12.6.6. Security model

A server binds the loopback address unless told otherwise, so only the local machine can reach it. A server bound to any other address must have a **token**, a shared secret every request presents as `Authorization: Bearer <token>`; without it a request is refused with 401. The token is compared in constant time, and only `/health` is exempt. Starting an exposed server without a token requires an explicit waiver, meant for a gateway that already checks callers.

Eval is code execution, so it is held to a stricter rule: with no token it is **locked** — not listed, reported as locked by `/discover`, and refused — unless waived separately from the server-wide waiver. `mim` grants that waiver to a loopback server, where every caller is already local.

Remote clients are untrusted in other ways too: a request must arrive within a deadline, its headers and body are bounded, and the number of simultaneous connections is capped, so one client cannot exhaust the server.

The plain-HTTP server does not encrypt. A token stops strangers who find the port, not anyone who can watch the network; `mim` therefore requires the operator to acknowledge plaintext before exposing a server, and an untrusted network needs a tunnel or a TLS proxy in front.

## 12.6.7. Serving an environment

`mim` keeps, per environment, a **view** for each adapter — the modules answering over MCP and over the JSON API — and an optional eval allow-list. Installing a module never serves it. `mim start` reads the views, starts one front end for the environment, and records its process or container. A second `start` is refused while the recorded server is alive (judged by the recorded process being the one `mim` started, not merely a live process id), unless told to replace it. `stop` ends the server and removes the record.

The token is chosen by the operator and passed to the server in its environment. `mim` never generates one, writes one to disk, or puts one on a command line. A container server runs with a read-only root file system, and the environment is marked immutable while it serves ([Environment solving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md)), so a caller cannot change the installed software.
