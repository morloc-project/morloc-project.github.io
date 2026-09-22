# 6.11. Streaming output with `@collect`

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/streaming-output.html | prev: https://morloc-project.github.io/docs/clis/output-actions.md | next: https://morloc-project.github.io/docs/clis/composing-tools.md

Everything so far has treated a command’s output as one value: compute it, serialize it, write it. That breaks down when the result is larger than memory, or when the caller wants to see the first rows before the last ones exist.

A streaming command returns `()` and hands its data out in batches. The `@collect` intrinsic drives it:

```morloc
@collect :: (([a] -> <IO, e> ()) -> <IO, e> ()) -> <IO, e> ()
```

`@collect` takes a **producer**: a function that is given a sink and calls it once per batch. `@collect` supplies the sink, manages the stream, and writes each batch out in whatever form `-f` selects. The element type rides on the sink, so the compiler knows the stream’s type with no extra annotation.

``sift’s `stream`` searches the same tree as `scan` but emits one batch per file:

```morloc
producePy  :: Str -> Str -> Options -> ([Hit] -> <IO> ()) -> <IO> ()

--' Stream hits to standard output, one file at a time
stream ::
  Str ->
  --' @check.path r
  Str ->
  Options ->
  <IO> ()
stream pat root opts = @collect (producePy pat root opts)
```

The producer here is Python, and its last parameter is the sink:

```python
def produce(pattern, root, opts, sink):
    fold = opts["ignoreCase"]
    needles = [pattern.lower() if fold else pattern]
    for path in walk_files(root):
        sink(hits_in(path, needles, fold))
```

A morloc callback crossing into a Python function is an ordinary foreign call; nothing about the streaming machinery is visible from either side.

With no action flag, every batch goes to standard output in the `-f` form:

```console
$ ./sift -f jsonl stream the notes
{"path":"notes\/todo.txt","line":2,"text":"fix the parser"}
{"path":"notes\/todo.txt","line":3,"text":"write the manual"}
{"path":"notes\/2026\/plan.txt","line":1,"text":"fix the build"}
{"path":"notes\/2026\/plan.txt","line":2,"text":"ship the manual"}
```

## 6.11.1. Actions on a stream

The output actions of [Output actions](https://morloc-project.github.io/docs/clis/output-actions.md) work here too, with one extra dimension. On an ordinary command a formatter sees the return value; on a streaming command it can see either the whole gathered stream or each batch as it arrives. The `@stream` modifier chooses:

| Directive | Handler type | Behavior |
| --- | --- | --- |
| `@with` | `[a] → b` (or `IFile [a] → b`) | Gather the whole stream, apply once; `b` is serialized by `-f`. |
| `@with …​ @stream` | `[a] → [b]` | Apply to each batch as it arrives, at constant memory; the `b` elements are serialized by `-f`. |
| `@render` | `[a] → Str` / `[a] → [U8]` (or `IFile [a] → …​`) | Gather the whole stream, apply once, write the bytes verbatim. |
| `@render …​ @stream` | `[a] → Str` / `[a] → [U8]` | Apply to each batch, write each result’s bytes verbatim. |

``sift’s `stream`` declares one action from three of those cells:

```morloc
--' Stream hits to standard output, one file at a time
--' @render -p/--plain=asLines @stream
--' @with   -c/--count=countHits
--' @with   -n/--staged=countStaged
--' @with   -N/--numbered=numberHits(@offset) @stream
stream :: ...
```

`-p` renders each batch to text as it goes, which is the constant-memory version of what `scan -p` does:

```console
$ ./sift stream the notes -p
notes/todo.txt:2:fix the parser
notes/todo.txt:3:write the manual
notes/2026/plan.txt:1:fix the build
notes/2026/plan.txt:2:ship the manual
```

`-c` is the other extreme: gather everything and apply `countHits` once.

```console
$ ./sift stream the notes -c
4
```

## 6.11.2. `@offset`: where a batch sits in the stream

A `@stream` handler is called once per batch and has no memory between calls, so anything that depends on position has to be told. `@offset` supplies the number of elements already written:

```morloc
--' Number the hits as they stream past
numberHits :: U64 -> [Hit] -> [Str]
```

```morloc
--' @with   -N/--numbered=numberHits(@offset) @stream
```

`numberHits(@offset)` passes the offset as the handler’s first argument. Each file is a separate batch, and the numbering runs across them:

```console
$ ./sift -f jsonl stream the notes -N
"1 notes\/todo.txt:2"
"2 notes\/todo.txt:3"
"3 notes\/2026\/plan.txt:1"
"4 notes\/2026\/plan.txt:2"
```

`@offset` is only meaningful under `@stream`; using it elsewhere is an error.

## 6.11.3. `IFile`: the gathered stream as a file

A whole-stream handler may take its receiver as `IFile [a]` instead of `[a]`. The stream is staged to a temporary file and the handler gets a random-access handle rather than a materialized list — the way to write a whole-stream handler that does not need the whole stream in memory. The temporary file is removed when the handler returns.

`countStaged` reads the element count out of the staged file’s footer without touching the data:

```morloc
--' Count the hits without loading them into memory
countStaged :: IFile [Hit] -> <IO> Int
countStaged f = do
  Ok n <- @flen f
  n
```

```console
$ ./sift stream the notes -n
4
```

`IFile` and the rest of the random-access handles are covered in [Random access and streaming](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md).

## 6.11.4. Streaming rules

The rules in [Rules and rejections](https://morloc-project.github.io/docs/clis/output-actions.md#action-rules) all apply. Two more are specific to streaming:

-   A `@stream` handler must return a list; its elements are what reach the wire.
-   `@render` under `@stream` writes each batch’s bytes as they are produced, with nothing added between batches — no separator, no trailing newline beyond what the handler itself emits.

## 6.11.5. What the help says a stream produces

A streaming command’s `Return:` block describes **standard output**, not the `()` the function returns. The two coincide for every other command and come apart here, so the block is worth reading closely:

```console
$ ./sift stream -h
...
Return:
  default:       [Hit]
  -p/--plain:    Str    (raw bytes)
  -c/--count:    U64
  -n/--staged:   Int
  -N/--numbered: [Str]
...
```

Five rows, five different things on stdout. `default` is the batch element the sink writes; `-c` and `-n` gather and return a single value; `-N` transforms each batch and streams the result; and `(raw bytes)` marks the one row where `-f` no longer applies, because a `@render` action writes its handler’s bytes verbatim.

The compiler works the element type out from the producer’s signature: a `@collect` argument takes exactly one parameter, the sink, so the sink is the last parameter of the producer’s declared type and the sink’s own parameter is what reaches standard output. A producer with no reachable signature — an inline lambda — leaves the row falling back to the return type; the help never claims `()` for a command that streams.
