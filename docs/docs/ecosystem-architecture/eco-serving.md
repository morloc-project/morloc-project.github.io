# 11.8. Serving

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-serving.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-freezing.md

> A compiled program is a command-line tool, but the nexus can also keep it running as a server, answering many requests without restarting its pools. This section specifies the server modes, how one command of a manifest becomes an HTTP endpoint and an MCP tool, how a server recovers from a crashed pool, how callers may evaluate new expressions, and the security model that decides who may call what. How `mim` chooses what to serve is specified last.

## 11.8.1. Server modes

| Mode | Serves |
| --- | --- |
| Daemon | One program, to local clients over a Unix socket or loopback TCP (length-prefixed JSON), and optionally over HTTP. Starts every pool at startup. |
| MCP | One program to one agent, over standard input and output, or over HTTP. |
| Front end | Several installed programs over one HTTP port, as MCP tools and a JSON API, with optional eval. Each program runs in its own daemon, which the front end starts on first use. |

`mim` always serves through the front end. It names the programs to serve explicitly; nothing is served because it happens to be installed. The front end finds each program’s manifest in the installed-programs directory of the state ([Overview](https://morloc-project.github.io/docs/ecosystem-architecture/eco-overview.md)), checks every one at startup, and starts each program’s daemon on its first request. A daemon that has exited is started again on the next request for it, and so is a live one whose socket has gone; a daemon that only refuses a connection is left running, since a full connection backlog refuses too. Requests to one program run concurrently: the front end serializes only the reaping and starting of a program’s daemon, never the exchange of a request with it. An MCP server over HTTP likewise runs its calls concurrently, up to the daemon’s own number of workers, and its other methods never wait behind a call.

## 11.8.2. Endpoints

The front end answers:

| Request | Meaning |
| --- | --- |
| `GET /health` | Liveness. Open to every caller, so a monitor needs no secret. |
| `POST /mcp` | The MCP endpoint. |
| `POST /call/<module>/<command>` | Call one command. The body is the arguments as a JSON array in order, or an object whose `args` is that array or an object keyed by argument name. `?render=<action>` selects an output action. |
| `GET /discover`, `GET /discover/<module>` | The served modules, then one module’s commands with their arguments, types and documentation. |
| `POST /eval` | Evaluate an expression, when eval is enabled (below). |

A call by name may leave out any argument the command line lets you leave out, and the server fills it as the command line would: an option takes its default, a flag its declared default, a record its fields' defaults, an optional positional `null`. Names are the arguments' published names (below). An unknown name, a name given twice and a flag that is not a boolean are refused. An argument the command line may read from standard input is required, since a remote caller has none to give; a path names a file on the server. With no `render`, the command’s default output action runs, as on the command line; `raw` selects the function’s own value.

A successful call returns `{"status":"ok","result":...}`. A command whose result carries a media type returns the raw bytes with that type instead. A failure returns `{"status":"error","class":"...","error":"..."}`, and the class sets the HTTP status: `bad-request` 400, `not-found` 404, `limit` 413, `failure` 500, `reply-limit` 500, `recovering` 503 with `Retry-After`, and `unauthorized` 401 or `forbidden` 403 for the token rules below. A forwarded failure keeps the class its daemon gave it.

A request larger than the server takes is answered with `limit`, never dropped: a daemon takes 64 MiB on its socket and 4 MiB over HTTP, the front end and the MCP server 64 MiB, and the front end refuses, without forwarding it, a request its daemon would not take. A reply too large for the socket protocol’s 4 GiB frame is a `reply-limit` failure.

## 11.8.3. Commands as MCP tools

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

A record argument is offered by its fields, one property each, and also whole, under its own name, where the command line takes it whole; a field given by name overrides the same field of the whole record. The arguments are read by the same rules as a call by name on the JSON API, defaults included. A command with output actions gets an extra `_render` property whose values are `raw` and each action’s name, defaulting to the command’s default action, and its description lists the actions. When a command without actions returns a record, the tool also declares an output schema and returns structured content; otherwise a JSON result is one text block, an image is an image block and other media is a resource.

A command is not offered as a tool if its result is a file handle or a stream handle, which means nothing to a remote caller. A command that streams its output is offered, but a call to it is refused as invalid params: its output would go to the standard output that the transport owns, not to the caller.

**Protocol.** The server speaks MCP protocol version `2025-06-18`. A client sends `initialize`, then the `notifications/initialized` notification; `tools/list` and `tools/call` before that are rejected. Over HTTP, `initialize` returns an `Mcp-Session-Id` header that every later request must carry; an unknown session is told to initialize again, and an idle session expires. A call that fails while running returns a normal result marked `isError`, with the message as text. A message that is not JSON is a JSON-RPC parse error; an unknown tool or a bad argument is an invalid-params error; a request past a size limit is an invalid-request error (over HTTP, a body past the cap is answered 413 before it is read as JSON-RPC).

## 11.8.4. Pool crash recovery

A daemon outlives any one call, so it must survive a pool that crashes. When it finds a pool dead, it closes admission (new requests are answered as unavailable, HTTP 503), stops every pool, and waits for the requests already running to finish. It then stops the writer of every open output stream, which ends each file with a `failed` status ([Streaming and memory mapping](https://morloc-project.github.io/docs/build-architecture/build-streaming.md)). Only then does it discard the program’s shared memory, create it afresh, restart and ping every pool, and reopen admission. No request spans a recovery, so no shared-memory reference from before the crash is ever read after it. If running requests do not finish within a minute, or recovery keeps failing, the daemon exits instead of serving from an inconsistent state.

## 11.8.5. Eval

When enabled, eval lets a caller send a whole Morloc expression that composes installed functions. It is offered as `POST /eval` with `{"expr": "..."}` and as an MCP tool named `eval` whose description lists the importable modules.

Each request is typechecked, compiled and run in a fresh process group, under these restrictions:

-   Every `import` must name a module on the **allow-list**, checked against the module’s real name, so renaming on import does not help.
-   Only installed modules resolve; local imports are refused.
-   The expression may not source foreign code or declare types, typeclasses or instances.
-   Input and output intrinsics may not appear directly; a function from an allowed module may still perform them, so the reachable I/O is exactly what those modules export.
-   The compiler’s memory is capped at 2 GB; CPU time at a configurable limit (30 seconds by default) and wall time at four times that. A request over its limit has its whole process group stopped.

Nothing about one request is kept for the next.

## 11.8.6. Security model

A server binds the loopback address unless told otherwise, so only the local machine can reach it. A server bound to any other address must have a **token**, a shared secret every request presents as `Authorization: Bearer <token>`; without it a request is refused with 401. The token is compared in constant time, and only `/health` is exempt. Starting an exposed server without a token requires an explicit waiver, meant for a gateway that already checks callers.

Eval is code execution, so it is held to a stricter rule: with no token it is **locked** — not listed, reported as locked by `/discover`, and refused — unless waived separately from the server-wide waiver. `mim` grants that waiver to a loopback server, where every caller is already local.

Remote clients are untrusted in other ways too: a request must arrive within a deadline, its headers and body are bounded, and the number of simultaneous connections is capped, so one client cannot exhaust the server.

The plain-HTTP server does not encrypt. A token stops strangers who find the port, not anyone who can watch the network; `mim` therefore requires the operator to acknowledge plaintext before exposing a server, and an untrusted network needs a tunnel or a TLS proxy in front.

## 11.8.7. Serving an environment

`mim` keeps, per environment, a **view** for each adapter — the modules answering over MCP and over the JSON API — and an optional eval allow-list. Installing a module never serves it. `mim start` reads the views, starts one front end for the environment, and records its process or container. A second `start` is refused while the recorded server is alive (judged by the recorded process being the one `mim` started, not merely a live process id), unless told to replace it. `stop` ends the server and removes the record.

The token is chosen by the operator and passed to the server in its environment. `mim` never generates one, writes one to disk, or puts one on a command line. A container server runs with a read-only root file system, and the environment is marked immutable while it serves ([Environment solving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md)), so a caller cannot change the installed software.
