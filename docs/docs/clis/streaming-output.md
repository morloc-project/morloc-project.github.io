# 5.11. Streaming output with `@collect`

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/streaming-output.html | prev: https://morloc-project.github.io/docs/clis/output-actions.md | next: https://morloc-project.github.io/docs/clis/composing-tools.md

Everything so far has treated a command’s output as one value: compute it, serialize it, write it. That breaks down when the result is larger than memory, or when the caller wants to see the first rows before the last ones exist.

A streaming command hands its data out in batches and returns `Collect a`, where `a` is the type of each element it writes. The `@collect` intrinsic drives it:

```morloc
@collect :: (([a] -> <IO, e> ()) -> <IO, e> ()) -> <IO, e> (Collect a)
```

`@collect` takes a **producer**: a function that is given a sink and calls it once per batch. `@collect` supplies the sink, manages the stream, and writes each batch out in whatever form `-f` selects.

`Collect a` is declared in the standard library as `newtype Collect a = Unit`: a unit value whose parameter `a` is a phantom, appearing only in the type. It holds no data. It stands for the list of every element written, `[a]`, before any output action, so the command’s signature says what it writes even though the elements never pass through its return value. Only `@collect` and `@stdout` produce one, and the typechecker gives it no special rule: the arms of a streaming command agree on `a` as any arms agree on a type. Outside morloc code the output is simply `[a]`, which is what help and the API show.

``sift’s `stream`` searches the same tree as `scan` but emits one batch per file:

```morloc
producePy  :: Str -> Str -> Options -> ([Hit] -> <IO> ()) -> <IO> ()

--' Stream hits to standard output, one file at a time
stream ::
  Str ->
  --' @check.path r
  Str ->
  Options ->
  <IO> (Collect Hit)
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

A Morloc callback crossing into a Python function is an ordinary foreign call; nothing about the streaming machinery is visible from either side.

With no action flag, every batch goes to standard output in the `-f` form:

```console
$ ./sift -f jsonl stream the notes
{"path":"notes\/todo.txt","line":2,"text":"fix the parser"}
{"path":"notes\/todo.txt","line":3,"text":"write the manual"}
{"path":"notes\/2026\/plan.txt","line":1,"text":"fix the build"}
{"path":"notes\/2026\/plan.txt","line":2,"text":"ship the manual"}
```

## 5.11.1. Actions on a stream

The output actions of [Output actions](https://morloc-project.github.io/docs/clis/output-actions.md) work here too, with one extra dimension. On an ordinary command a formatter sees the return value; on a streaming command it can see either the whole gathered stream or each batch as it arrives. The `@stream` modifier chooses:

| Directive | Handler type | Behavior |
| --- | --- | --- |
| `@with` | `[a] -> b` (or `IFile [a] -> b`) | Gather the whole stream, apply once; `b` is serialized by `-f`. |
| `@with ... @stream` | `[a] -> [b]` | Apply to each batch as it arrives, at constant memory; the `b` elements are serialized by `-f`. |
| `@render` | `[a] -> Str` / `[a] -> [Str]` / `[a] -> [U8]` / `[a] -> [[U8]]` (or `IFile [a] -> ...`) | Gather the whole stream, apply once, write the bytes verbatim. |
| `@render ... @stream` | `[a] -> Str` / `[a] -> [Str]` / `[a] -> [U8]` / `[a] -> [[U8]]` | Apply to each batch, write each result’s bytes verbatim. |
| `@with`/`@render ... @fold=` | as above, with `b` in place of `[a]` | Fold the stream into one accumulator, apply once to it. See [`@fold`: one accumulator instead of a list](#stream-fold). |

``sift’s `stream`` declares four actions, drawing on three of those rows:

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

## 5.11.2. `@offset`: where a batch sits in the stream

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

## 5.11.3. `IFile`: the gathered stream as a file

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

`IFile` and the other stream handles were introduced in [Random access and streaming](https://morloc-project.github.io/docs/features/random-access-and-streaming.md).

## 5.11.4. `@fold`: one accumulator instead of a list

A gather holds the whole stream before the handler sees any of it. `@fold` keeps one accumulator instead, so peak memory does not grow with the stream. It takes three terms beside the handler:

| Modifier | Type | Role |
| --- | --- | --- |
| `@init` | `b` | Starts every accumulator, and is the answer for an empty stream. |
| `@fold` | `b -> [a] -> b` | Folds one batch in. It takes the batch, not the element. |
| `@combine` | `b -> b -> b` | Merges two accumulators. |

The handler receives `b` instead of `[a]`. Nothing else about the command changes: a folding action and a gathering one sit on the same `@collect`, and the flag the caller gives decides which runs.

`sift` streams one batch per file, so an accumulator can count both:

```morloc
type Tally = (Int, Int)

noHits     :: Tally
addFile    :: Tally -> [Hit] -> Tally
mergeTally :: Tally -> Tally -> Tally
showTally  :: Tally -> Str

--' @render -t/--tally=showTally @fold=addFile @init=noHits @combine=mergeTally
```

```console
$ ./sift stream the notes -t
4 hits in 2 files
```

`@combine` is there because a producer may call its sink from several threads. Each thread folds into an accumulator of its own, and `@combine` merges them at the end. Every accumulator starts from `@init`, so `@init` has to be an identity for `@combine`. Otherwise the answer changes with the number of threads the producer used, and a single-threaded producer will not show it. Nothing checks this — checking it would mean running your code.

**What a fold costs**

Peak memory is the streaming working set plus one accumulator per worker thread. Two things give that up.

Each fold copies the accumulator, so `b` should be of bounded size. One that grows with the stream — collecting every element into a list — makes the fold quadratic, a worse way to pay what the gather was already paying.

The producer must drive its sink from a worker pool rather than a thread per batch, since one accumulator exists per thread that folds. A fold that reaches a few thousand accumulators is refused rather than allowed to grow.

`@combine` must also be associative, and commutative if the producer is threaded: accumulators are merged in the order the threads reached the sink, which is not reproducible between runs.

## 5.11.5. Streaming rules

The rules in [Rules and rejections](https://morloc-project.github.io/docs/clis/output-actions.md#action-rules) all apply. More are specific to streaming:

-   Every path through a streaming command ends in exactly one `@collect` or `@stdout`, in tail position: the last statement of a `do` block, an arm of a guard or `match`, or the body of a `let`. A path may end in `@throw` instead. Anything else, such as two ``@collect`s in a row or a `@collect`` in a where-binding, is a build error. To stream from several producers, call them on one sink inside a single `@collect`:
    
    ```morloc
    both :: <IO> (Collect Int)
    both = @collect (\sink -> do
      _ <- first sink
      second sink)
    ```
    
-   `@collect` and `@stdout` appear only in a command whose signature returns `Collect`, and morloc code never calls such a command. Share its producer instead.
-   A command’s actions run on a fresh run of the command, composed into its sink. Any action combined with others runs on its saved output (see [Several outputs in one run](https://morloc-project.github.io/docs/clis/output-actions.md#action-files)), as do the actions of a `@stdout` command.
-   A `@stream` handler must return a list; its elements are what reach the wire.
-   `@render` under `@stream` writes each batch’s bytes as they are produced, with nothing added between batches — no separator, no trailing newline beyond what the handler itself emits. A handler that returns a list (`[Str]` or ) has each element written in order, also with nothing between them, so it can build a large batch’s output as many pieces rather than one string.
-   `@fold` and `@stream` are mutually exclusive: `@stream` emits one result per batch, `@fold` one for the whole stream.
-   `@fold` requires a reachable `@collect`, and all three of `@fold`, `@init` and `@combine`.

## 5.11.6. What the help says a stream produces

A streaming command’s `Return:` block describes **standard output**. The command returns `Collect Hit`, and help shows it as what reaches standard output, the list `[Hit]`:

```console
$ ./sift stream -h
...
Return:
  type: [Hit]
  actions:
    -p/--plain:    Str    (raw bytes)
    -c/--count:    U64
    -n/--staged:   Int
    -N/--numbered: [Str]
...
```

Five rows, five different things on stdout. `type` is the batch element the sink writes; `-c` and `-n` gather and return a single value; `-N` transforms each batch and streams the result; and `(raw bytes)` marks the one row where `-f` no longer applies, because a `@render` action writes its handler’s bytes verbatim.

The element type comes from the command’s signature, and the typechecker checks it against the producer’s sink: a producer that writes `[Str]` batches cannot stand in a `Collect Hit` command. `Collect` means nothing outside morloc code, so `--json-help` and the API also show the output as `[Hit]`.
