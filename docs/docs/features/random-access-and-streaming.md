# 3.18. Random access and streaming

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/random-access-and-streaming.html | prev: https://morloc-project.github.io/docs/features/effects.md | next: https://morloc-project.github.io/docs/features/intrinsics.md

A stream is a list kept in a file instead of in memory. Use one when the data is too large to hold at once, or when it is produced or consumed a batch at a time. Three types give you a handle on such a file:

| Type | Use |
| --- | --- |
| `IFile [a]` | Read a finished file at random, by index or pattern. |
| `IStream a` | Read a file forward, one batch of `a` at a time. |
| `OStream a` | Write a file, one batch of `a` at a time. |

A handle is an ordinary Morloc value. You can pass it to another function, put it in a list, or hand it to code that runs in another language; the receiver reads the same file. All three are opened with `@open`, which returns a `Try` (`Err` if the file is missing or unreadable), and released with `@close`. The `::` annotation on `@open` says which kind of handle you want and what the elements are.

The examples below are one file:

**people.loc**

```morloc
module people (writePeople, lookup, slice, count, batches, walk)

import root-py

record Person = Person { name :: Str, age :: Int }

writePeople :: Str -> <IO> ()
writePeople path = do
  Ok o <- @open path :: <IO> (Try Str (OStream Person))
  @write 3 o [{name = "Alice", age = 30}, {name = "Bob", age = 25}]
  @flush o
  @write 3 o [{name = "Carol", age = 41}]
  @close o

lookup :: Str -> Int -> <IO> Person
lookup path i = do
  Ok f <- @open path :: <IO> (Try Str (IFile [Person]))
  let p = .[i] f
  @close f
  p

slice :: Str -> <IO> [Str]
slice path = do
  Ok f <- @open path :: <IO> (Try Str (IFile [Person]))
  .[1:3].name f

count :: Str -> <IO> Int
count path = do
  Ok f <- @open path :: <IO> (Try Str (IFile [Person]))
  Ok n <- @flen f
  n

batches :: Str -> <IO> [[Person]]
batches path = do
  Ok s <- @open path :: <IO> (Try Str (IStream Person))
  Ok a <- @next s
  Ok b <- @next s
  Ok c <- @next s
  @close s
  [a, b, c]

walk :: Str -> <IO> ([Person], Person)
walk path = do
  Ok f <- @open path :: <IO> (Try Str (IFile [Person]))
  s <- @stream f
  Ok a <- @next s
  (a, .[2] f)
```

> **Warning: Element types are not checked yet**
> A stream file records the type of its elements, and opening it at a different type should be an `Err`. Today only some opens check it; an `IFile` open never does, so reading a file of `Int` as `IFile [Real]` returns garbage instead of failing. Open a file at the type it was written with.

## 3.18.1. Writing with OStream

`@open` on an `OStream` creates the file, replacing any file already there. `@write level o xs` appends the list `xs`. `level` is a compression level from 0 (none) to 9 (see [Compression](https://morloc-project.github.io/docs/runs/compression.md)); every write to one stream must use the same level. `@close` finishes the file, after which it can be read.

```console
$ ./people writePeople people.dat
```

Writes are buffered, and each full buffer becomes one batch in the file. `@flush o` ends the current batch early. Without the `@flush` above, all three people would land in one batch.

`@append path` opens a stream file for further writes, creating it if it is not there. `@concat paths dest` joins compatible stream files into `dest`; `dest` may be one of `paths`, so adding a batch file to a log is `@concat [log, batch] log`. A failed `@concat` leaves `dest` as it was.

## 3.18.2. Random access with IFile

An `IFile [a]` reads elements without loading the file. It takes the same patterns as an in-memory list ([Patterns](https://morloc-project.github.io/docs/features/patterns.md)), and `@flen` returns the element count from the file’s footer without reading the data:

```console
$ ./people lookup people.dat 1
{"name":"Bob","age":25}
$ ./people slice people.dat
["Bob","Carol"]
$ ./people count people.dat
3
```

## 3.18.3. Sequential reading with IStream

`@next s` returns the next batch as a list, and `Ok []` once the file is exhausted. Batches come back as they were written:

```console
$ ./people batches people.dat
[[{"name":"Alice","age":30},{"name":"Bob","age":25}],[{"name":"Carol","age":41}],[]]
```

`@stream f` turns an open `IFile [a]` into an `IStream a` with its own cursor, so walking it does not disturb indexed reads of `f`. (The CLI chapter also has an `@stream`, a modifier on output actions ([Streaming output with `@collect`](https://morloc-project.github.io/docs/clis/streaming-output.md)); it is unrelated.)

```console
$ ./people walk people.dat
[[{"name":"Alice","age":30},{"name":"Bob","age":25}],{"name":"Carol","age":41}]
```

## 3.18.4. Standard input and output

`@stdin` opens standard input as an `IStream`; `@stdout` and `@stderr` open the other two standard streams as `OStream` handles. They take their element type from an annotation, like `@open`, and use the same `@next`, `@write` and `@close`. This lets one Morloc program pipe typed data into another:

**pipe.loc**

```morloc
module pipe (produce, double)

import root-py

produce :: <IO> ()
produce = do
  o <- @stdout :: <IO> (OStream Int)
  @write 0 o [1, 2, 3]
  @write 0 o [4, 5, 6]
  @close o

double :: <IO> ()
double = do
  Ok s <- @stdin :: <IO> (Try Str (IStream Int))
  o <- @stdout :: <IO> (OStream Int)
  Ok xs <- @next s
  @write 0 o (map (\x -> x * 2) xs)
  Ok ys <- @next s
  @write 0 o (map (\x -> x * 2) ys)
  @close o
  @close s
```

```console
$ ./pipe -f packet produce | ./pipe double
[2,4,6,8,10,12]
```

By default a program prints its output as JSON for people to read. `-f packet` asks the writing end for Morloc’s binary format instead, which carries the element type so the reader can check it. The last program in the pipeline prints JSON as usual. [Reading a stream from standard input](https://morloc-project.github.io/docs/clis/reading-stdin.md) covers the command-line side: reading a file argument or standard input with the same code, and what standard input may carry.

> **Warning: Foreign code must not write to an open standard stream**
> If a sourced function prints to standard output (`print` in Python, `std::cout` in C++, `cat` in R) while Morloc has it open as an `OStream`, the text lands among the binary batches and the reader fails with `invalid magic`. Send diagnostics to standard error, or write the stream to a file instead.

**How stream files are stored**

This is for readers who want the mechanism; the full specification, including the file layout and how several processes share one open stream, is [Streaming and memory mapping](https://morloc-project.github.io/docs/build-architecture/build-streaming.md).

Each batch is compressed on its own, so any batch can be read without the others. An `IFile` keeps recently decompressed batches in a per-handle cache, so nearby reads do not decompress again; a slice that spans several batches decompresses them in parallel. An element larger than the write buffer is written as a batch of its own rather than split.

`@concat` copies the batches byte for byte, with no decoding. It builds the result beside `dest` and renames it into place, which is why `dest` may also be a source and why a failure leaves the old `dest` intact.

## 3.18.5. Environment variables

| Variable | Effect |
| --- | --- |
| `MORLOC_REGISTRY_SLOT_COUNT` | How many stream handles one run may hold open at once. Default `4096`. |
| `MORLOC_WRITE_BUFFER_BYTES` | Size of an `OStream` write buffer, and so of a batch. Default 16 MiB. Smaller gives finer-grained batches at more overhead per batch. |
| `MORLOC_IFILE_CACHE_BYTES` | Size of each `IFile` handle’s cache of decompressed batches. Default 256 MiB; `0` disables it. |

`MORLOC_FRAME_WORKERS`, the number of threads that compress and decompress large batches, applies here too (see [Compression](https://morloc-project.github.io/docs/runs/compression.md)).
