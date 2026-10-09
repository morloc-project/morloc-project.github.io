# 13.11. Collect, fold, parse and render

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-collect.html | prev: https://morloc-project.github.io/docs/build-architecture/build-errors.md | next: https://morloc-project.github.io/docs/build-architecture/build-runs.md

> A command’s docstring can attach data-flow directives to it: `@parse` reads an argument from a file in a foreign format, `@collect` streams a command’s output instead of returning it whole, and output actions (`@render`, `@with`, with `@fold`) turn that output into other results, each written to its own destination. The chapters on [Arguments](https://morloc-project.github.io/docs/clis/arguments.md), [Streaming output with `@collect`](https://morloc-project.github.io/docs/clis/streaming-output.md) and [Output actions](https://morloc-project.github.io/docs/clis/output-actions.md) show how to use them; this section specifies where each step runs, what is held in memory, and how several outputs are produced from one run.

**Everything is compiled into ordinary commands.** The compiler lowers each directive into Morloc code and, where needed, into extra commands in the manifest that the user never names: a **parse entry** per command with parsed arguments, an **action entry** per output action, and a **replay entry** per action for multi-output runs. The nexus only chooses which entries to run and where their output goes; all user-level work (parsing, folding, formatting) runs in pools.

**`@parse`.** An argument declares named formats, each with file extensions. The nexus picks a format by looking only at the argument’s text, never the file’s contents:

1.  A `name:` prefix selects that format (`morloc:` reads an ordinary Morloc value).
2.  Otherwise the longest matching extension wins, ignoring case.
3.  Otherwise the argument is read as an ordinary value. `-` is standard input, which at most one argument may claim.

The parse entry then calls the format’s handler in a pool with the path. A plain argument’s handler returns the value, and every such argument is parsed before the command body starts. An `IStream` argument’s handler feeds batches to the command as it runs. An `IFile` argument is first written to a stream file in a temporary **stage** directory and opened from there. A handler’s failure names the argument, format and path, and ends the run with status 1.

**`@collect`.** `@collect producer` gives the producer a sink and streams whatever it passes to the sink to the command’s output, batch by batch. The batches travel through shared memory to the nexus, which writes each in the requested format as it arrives. Nothing is gathered: memory use does not grow with the output.

**Output actions** consume what the command collects. Each runs as its own entry, a copy of the command whose sink is replaced:

| Kind | Sink, and what the handler receives |
| --- | --- |
| gather | Writes every batch to a temporary stream file. The handler receives the whole list, or an `IFile` handle to read it at random without loading it. |
| `@stream` | Calls the handler on each batch inside the sink. Memory stays constant. |
| `@fold` | Folds each batch into an accumulator with `@fold`, starting from `@init`. Each thread keeps its own accumulator; at the end they are merged with `@combine` in the order the threads first folded, and the handler receives the result. |

A `@render` handler returns bytes (`Str`, `[Str]`, `Vector U8` or a list of `Vector U8`), which are written verbatim, ignoring `-f`. A `@with` handler returns a typed value, which is written in the `-f` format.

**One output.** When only standard output is wanted, the nexus runs the action’s entry directly (or the command itself) and writes its result.

**Several outputs.** When an action writes to a file, or a command has more than one action, the run is **staged**:

![Diagram](https://morloc-project.github.io/docs/static/img/diag-99fe3d09edc27db5c3fd0d2a44a3594ce1b9ab118e4f6ff39e9739c550e4c01a.svg)

1.  A stage process runs the command once and saves its value, its collected stream and its arguments as packet files. If standard output wants the command’s own output, the stage also writes it there as it runs.
2.  Each action is replayed in its own process on the saved output, writing to a temporary file beside its target.
3.  Only when every process has succeeded are the temporary files renamed into place. A failure removes them and ends the run with the failing process’s status, so a named output is either complete or untouched.

The command body runs once however many outputs are requested, so a slow or effectful command is never repeated per output. Output formats are checked against every destination before anything runs, and conflicting destinations (two claims on standard output, two outputs to one file) are a usage error with status 2.
