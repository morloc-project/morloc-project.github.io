# 11.6. Model Context Protocol (MCP)

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/internals/mcp.html | prev: https://morloc-project.github.io/docs/internals/api-interfaces.md | next: https://morloc-project.github.io/docs/internals/morloc-eval.md

This section describes how a Morloc program speaks [MCP](https://modelcontextprotocol.io), for readers writing a client, debugging one, or serving a program without `mim`. For serving with `mim`, see [Serving](https://morloc-project.github.io/docs/apis/deploy-serving.md). The examples use the `smiles` program from [Dependency management](https://morloc-project.github.io/docs/apis/deploy-dependencies.md).

MCP support is part of the shared runtime; there is no separate build. Any compiled program is served over MCP by running the runtime in `mcp` mode against it:

```console
$ morloc-nexus mcp ./smiles            # or: morloc-nexus mcp smiles-build/manifest.json
```

MCP is a JSON-RPC 2.0 protocol. In this form it is spoken over the program’s standard input and output: the server reads requests on stdin and writes responses on stdout, and every other byte — pool output, log lines, diagnostics — goes to stderr so the protocol stream stays clean. This is the **local** transport: the client launches the server as a child process on the same machine.

The same command serves MCP over HTTP instead when given a port, which is the way to reach one program from another machine without `mim`:

```console
$ morloc-nexus mcp ./smiles --http-port 9000
```

It takes `--http-host`, `--auth-token`, and `--allow-no-auth` with the same meaning as for the router ([Daemons and the serving router](https://morloc-project.github.io/docs/internals/api-interfaces.md)). The router behind `mim start` serves MCP over HTTP for several programs at once.

The stdio server launches the language pools and then waits for messages. It is normally started **by** an MCP client, but the transport is line-delimited JSON, so you can drive it by hand.

> **Note**
> Each message is one complete JSON object on a single line. A pretty-printed object split across lines is parsed as broken fragments, each answered with a `-32700` error. The transcripts below are indented only for readability.

## 11.6.1. The handshake

A session opens with three messages: the client sends `initialize`, the server replies with its capabilities, and the client confirms with an `initialized` notification. Only then may tools be listed or called.

**client → server, then server → client**

```
--> {"jsonrpc":"2.0","id":1,"method":"initialize",
     "params":{"protocolVersion":"2025-06-18","capabilities":{},
               "clientInfo":{"name":"demo","version":"0"}}}
<-- {"jsonrpc":"2.0","id":1,"result":{
      "protocolVersion":"2025-06-18",
      "capabilities":{"tools":{"listChanged":false}},
      "serverInfo":{"name":"smiles","version":"<morloc version>"}}}

--> {"jsonrpc":"2.0","method":"notifications/initialized"}
```

The server answers with the protocol version the client asked for, and names itself after the program with the Morloc version that compiled it. The `initialized` notification carries no `id` and gets no reply. `ping` is answered at any point; `tools/list` and `tools/call` are rejected with `-32600` until the handshake completes.

## 11.6.2. Inspecting the tool surface

Every exported function becomes one tool. The `--mcp-tools` flag prints the payload `tools/list` returns, without starting a session:

```console
$ ./smiles --mcp-tools | jq '.tools[] | {name, inputSchema}'
```

Each tool’s `description` comes from the function’s docstring, and each argument’s Morloc type is rendered as a JSON Schema type (`Int` → `integer`, `Str` → `string`, `[a]` → `array`, a record → `object`, `?a` → a nullable union). An argument’s own `--'` docstring becomes its property’s `description`.

## 11.6.3. How arguments map to properties

MCP delivers arguments as a **named** object, so every argument needs a key. The key depends on the kind of argument:

| Morloc argument | MCP property name |
| --- | --- |
| A positional argument | The name given by `@name` in the argument’s docstring; otherwise its 1-based position, `_1`, `_2`, and so on. `smiles__mw` takes `_1`. |
| An option (`--' arg: -f/--factor`) | The long name (`factor`), or the short character if there is no long form. |
| A flag (`--' true: --clean` / `--' false: --no-clean`) | The flag’s name, typed as a `boolean`. |
| An unrolled record (`--' unroll: true`) | One property per field, keyed by the field name. |
| A record passed whole (`--' arg: --config`) | One `object` property named for the record type, lowercased. |
| An unrolled `data` value | Its `@name`, or else its type’s name, lowercased. |

A command with `@render` or `@with` output actions ([Output actions](https://morloc-project.github.io/docs/clis/output-actions.md)) also takes an optional `_render` property naming one of them; `"raw"`, the default, returns the command’s own value. A name given with `@name` may not start with an underscore, so these generated keys never collide with an author’s.

## 11.6.4. Calling a tool

`tools/call` names the tool and supplies its arguments by key. The server turns the named arguments back into a positional call, dispatches it through the same machinery the CLI and daemon use, and returns the result.

```
--> {"jsonrpc":"2.0","id":2,"method":"tools/call",
     "params":{"name":"mw","arguments":{"_1":"CCO"}}}
```

A scalar or list return is placed in a single `text` content block. A record return also fills `structuredContent` and the tool’s `outputSchema`, so a client that understands structured output gets the typed object as well as the text.

Omitted optional arguments take their declared defaults, and an omitted record field is filled from its default; the client supplies only what it overrides.

## 11.6.5. What is not exposed

Some functions cannot be served over a JSON channel, so they are left out of the tool list, with a note on stderr saying why. The other tools are unaffected.

| Excluded when the function…​ | …​because |
| --- | --- |
| reads from `@stdin` (`--' stdin: true`) | on the stdio transport, stdin is the JSON-RPC input stream. |
| has an Arrow `Table` argument or return | a `Table` has no JSON representation in either direction. |
| has a stream argument or return (`IFile`, `IStream`, `OStream`), including a stream written to `@stdout` | a live handle cannot be sent as a JSON value. |
| would publish two properties with the same key | the arguments could not be told apart. |

> **Note**
> Ordinary printing from a function — a `print` in a Python pool, a `std::cout` in C++ — does not corrupt the protocol. The server moves its own standard output aside before any pool starts, so stray writes land on stderr.

## 11.6.6. Errors

A malformed **request** is a JSON-RPC error. A function that runs and fails is a normal result flagged with `isError`, so the agent can read the message and react.

| Condition | Response |
| --- | --- |
| Unparseable message | JSON-RPC error `-32700` |
| A tool method before the handshake | JSON-RPC error `-32600` |
| Unknown method | JSON-RPC error `-32601` (method not found) |
| Unknown tool, or missing, unexpected, or wrong-typed arguments | JSON-RPC error `-32602` (invalid params) |
| The function raises (`@throw`), a pool errors, or a call fails | A result with `"isError": true` and the message in a `text` block |

```
--> {"jsonrpc":"2.0","id":4,"method":"tools/call",
     "params":{"name":"fireball","arguments":{}}}
<-- {"jsonrpc":"2.0","id":4,
     "error":{"code":-32602,"message":"unknown tool 'fireball'"}}
```

## 11.6.7. Connecting a local client

A client that launches the server needs a command and its arguments: the runtime in `mcp` mode against the program’s absolute manifest path. The launcher prints that entry for you, as JSON on stdout:

```console
$ ./smiles --mcp-config > smiles.mcp.json
```

It has this shape:

```json
{
  "mcpServers": {
    "smiles": {
      "command": "/absolute/path/to/morloc-nexus",
      "args": ["mcp", "/absolute/path/to/smiles-build/manifest.json"]
    }
  }
}
```

The `command` is an absolute path because MCP clients launch servers with a minimal `PATH`. For Claude Code, `claude mcp add smiles — /absolute/path/to/morloc-nexus mcp /absolute/path/to/smiles-build/manifest.json` registers the same entry. The client launches the server, runs the handshake, and lists the tools. When the client disconnects, closing stdin, the server stops its pools and exits.

A client can launch the program only where Morloc is installed: on the same host for a native environment, or inside the same container. An agent anywhere else reaches the program over HTTP.

## 11.6.8. MCP over HTTP

Over HTTP, from `mim start`, the router, or `mcp --http-port`, the same messages travel in the bodies of `POST /mcp` requests, using MCP’s Streamable HTTP transport. Two things change:

-   **Sessions.** The reply to `initialize` carries an `Mcp-Session-Id` header, and every later request must send it back. A request without it is `400`; an unknown or expired one is `404`, and the client re-initializes. A session expires after an hour. `DELETE /mcp` ends one.
-   **Tool names.** Because one endpoint can serve several programs, each tool is named `<module>*<command>*`*: `smiles`*`mw` rather than `mw`.

## 11.6.9. Summary

| Aspect | Detail |
| --- | --- |
| Local server | `morloc-nexus mcp <program>`; client entry from `./prog --mcp-config` |
| Networked server | `mim start`, the router, or `morloc-nexus mcp <program> --http-port <n>` |
| Transport | JSON-RPC 2.0 over stdio, or Streamable HTTP with `Mcp-Session-Id`; protocol version `2025-06-18` |
| Tools | One per exported function, named `<command>` on stdio and `<module>__<command>` over HTTP |
| Positional keys | the `@name`, else `_1`, `_2`, …​ |
| Option and flag keys | the long (or short) option name |
| Return | `text` block; records also get `structuredContent` and `outputSchema` |
| Static preview | `./prog --mcp-tools` prints the `tools/list` payload |
