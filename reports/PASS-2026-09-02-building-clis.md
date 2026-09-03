# Doc pass: "Building CLIs" -- 2026-09-02

Environment: morloc 0.100.2, mim 0.28.0, inside a managed dev container.

## Scope

The whole `== Building CLIs` part of `src/index.adoc`, rewritten from 8 files
to 13. Every example was built and run; every console transcript in the
chapter is real output captured from a program of the name shown.

Verification, re-runnable: 93 command/output pairs were extracted from the
console blocks and compared byte-for-byte against a fresh run in a clean build
directory, plus 11 elided (`...`) transcripts checked line-by-line, plus a
check that every line of every `[source, morloc|python|r]` block appears
verbatim in a source file that builds.

## Structure

Old: intro, docstrings, composition, arguments, shape, parameterization,
output, streaming.

New, in reading order: intro (with the running example), the two argument
zones, docstrings, arguments, record arguments, input shape, reading a stream
from standard input, output formats, output actions, streaming output with
`@collect`, composing tools, the interface as data, directive reference.

One running example carries the chapter: `sift`, a recursive line search whose
five commands cover positional arguments, flags, an unrolled record, file and
stdin inputs, output actions, and a `@collect` stream. Seven small side programs
(`greet`, `calc`, `cipher`, `nulls`, `rep`, `ramp`, `tally`) each appear in
full, so every code block in the chapter is pasteable.

## Compiler / runtime bugs found (filed)

| # | Severity | Summary |
|---|----------|---------|
| 0022 | HIGH | Docstring warnings are computed and never printed: `writeMorlocReturn` emits the writer log only when the build FAILS. A misspelled directive (`@metvar`) is silently demoted to prose. Directives are the entire CLI-authoring surface, so every one of them fails silently when mistyped. |
| 0031 | HIGH | A `-f packet` stream whose element type has a name (a `type` alias or a record) round-trips through a file and is rejected on stdin -- only the stdin path compares the concrete schema name. Piping one morloc command into the next is the reason `-f packet` exists. |
| 0037 | HIGH | A docstring above `record X = X { ... }` -- the form the manual teaches -- is dropped without warning. The same docstring above `record X where` is inherited. Silently loses documentation from CLI help, JSON Schema, and MCP. |
| 0024 | med | `@false -q/--quiet` drops the short option entirely and hides the long one from `--help`. |
| 0026 | med | Argument types lose their alias (`Path` renders as `Str    (literal string)`) while return types keep it; and that help-only parenthetical is baked into the machine-readable `type` field of `--json-help` and the manifest. |
| 0023 | med | A module docstring is truncated to its first line, and `@epilogue` reaches the manifest and is never rendered. |
| 0027 | med | A `Table` argument renders as `Table _ (Rec)` with no columns and no `Table Schemas:` block, though the wire schema names them. |
| 0032 | med | The internal entry points synthesized by `@with` / `@render` leak into `morloc list` counts and into generated shell completion. |
| 0025 | med | `-` is rejected on a `@source file` argument although `/dev/stdin` works; the manual claimed the two were interchangeable. |
| 0028 | low | A `@stream` reformatter is reported as returning `Unit` in the `Return:` table although it puts typed elements on the wire. |
| 0033 | low | Docstring diagnostics quote the retired `key:` spelling and two of them drop the term name. |
| 0029 | feature | `@mime` has no effect on what the CLI writes; a no-op `@render` handler is the current workaround and there is no `-f raw`. |
| 0030 | feature | `@stdin` is `Str`-only, so a line-oriented filter (`[Str]` + `@form list`) cannot default to stdin. |

## Undocumented features now documented

* **Command groups.** `--* group: <name>` annotations in an export list build
  `git`-style nested subcommands, with per-group descriptions. Nothing in the
  manual mentioned them.
* **`--json-help`.** A complete machine-readable description of every command:
  types in three forms (morloc, wire schema, JSON Schema), input shape, output
  actions. It has its own section now.
* **Shell completion.** `morloc make --install` regenerates bash and zsh
  completions for every installed program, group-aware, into
  `$MORLOC_HOME/completions/`.
* **`@render` on ordinary commands.** The manual explained the `@with` /
  `@render` framing distinction only for `@collect` streams. It applies to
  every command: `@render` writes the handler's bytes verbatim, `@with` keeps
  the result typed. This is the difference between readable output and a JSON
  string, and it was undocumented.
* **`@source file` strips one trailing newline**, so it behaves like
  `$(cat file)`.
* **`-p` on a `Str` result** prints the text rather than a quoted JSON string.

## Stale documentation corrected

* The chapter title was "Buildings CLIs" (and "Buildings APIs"). Both fixed,
  with explicit `[[building-clis]]` / `[[building-apis]]` anchors, and the six
  xrefs that pointed at the misspelled auto-anchors updated.
* Two xrefs pointed at a section that did not exist
  (`_reading_a_stream_from_standard_input`, from `cli-arguments.asc` and
  `runs-streaming.asc`) and one at a renamed section
  (`_streaming_output_with_collect`). The missing section -- the whole `@stdin`
  story -- is written now.
* `tally m = size m` was documented as `Map Str Int -> Int`. `size` returns
  `U64`; the example did not compile.
* The `grepR` example's `--count` was documented as returning `Int`. It is
  `U64`.
* Every transcript in the "Composing with `-f`" section was impossible: the
  example module had a single export, so `./nexus -f json grepR ...` is
  `error: unexpected argument '-f' found`. Single-export programs need `@`.
* `cal :: () -> ()` in the composition example produced a command with a
  required `Unit` positional that no invocation could satisfy: passing `null`
  reached a zero-argument Python function and crashed. A nullary command is
  `cal :: <IO> ()`.
* The docstring section claimed a prose line may freely contain a colon. It may
  not -- the legacy `key: value` directive form catches `Example: ...`.
* `cli-streaming.asc` said `@render` "forces `-f raw`". There is no `raw`
  output form.
* The `dnd` module in the composition example imported `root-py` while sourcing
  R.

## Verified accurate (no change needed beyond rewording)

Record parameterization in full -- group flag, field flags, mixing, object and
array forms, unknown-key rejection, the five-level merge precedence, and the
three error messages. Every `@form list` case (TSV, CSV, JSON-per-line, inline
array, the headerless hint). `@form bytes` / `bytes-only` / `packet` and the
`@source inline` + `@form bytes` shortcut on `[U8]`. `@unroll false`. `@value`
and `$N` in formatter calls. `@default` on an action, and `-f` suppressing it.
`@offset` numbering across batches. `IFile` staging with `@flen`. Top-level
null suppression and `--keep-null`, including the binary-format exception and
nested nulls. `--` ending option parsing. Negative numbers as positionals.
Format detection by content across JSON, MessagePack, and voidstar.

## Not done

The site was not built. This container has no podman or docker and no local
asciidoctor, so `make` could not run. Validation was static: block-delimiter
balance (`----`, `====`, `|===`), non-ASCII, trailing newline, 80-column prose,
and a cross-reference resolver that checks every `<<...>>` and `xref:` against
every explicit anchor and generated section id in the manual. All CLI-chapter
references resolve. Someone with a container engine should run `make` before
publishing.

Pre-existing dangling xrefs elsewhere, left alone because other passes are
editing those files: `types-newtype` (from features-tables, features-tuples-
and-lists, types-custom-types x2), `caching` (from runs-compression),
`_null_strings` (from environmental-variables).
