# 0028: a `@stream` formatter is listed as returning `Unit` although it writes typed elements

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

On a `@collect` command, `--help` prints a `Return:` table naming what each
formatter flag puts on the wire. A per-batch `@with ... @stream` handler of
type `[a] -> [b]` streams `b` elements, which `-f` then encodes; the table
should say so.

## Observed

Per-batch handlers are listed as `Unit`, indistinguishable from a sink.

```
$ ./nexus -h
Stream integer batches to standard output.

Usage: ./nexus <nexus_options> @ <command_options>

General Options:
  -h, --help    Print help (see more with '--help')
  -s, --sorted  Sort the whole stream, descending
  -b, --bump    Add 100 to every element

Return:
  default:     Unit
  -s/--sorted: [Int]
  -b/--bump:   Unit
```

`--bump` is the `@stream` handler, `[Int] -> [Int]`. It does emit integers:

```
$ ./nexus -f jsonl @ --bump
100
101
102
103
```

The whole-stream handler `--sorted`, also `[Int] -> [Int]`, is reported
correctly as `[Int]`.

## Reproduce

`b.py`:

```
def make_batch(i):
    return [2*i, 2*i+1]
def sort_desc(xs):
    return sorted(xs, reverse=True)
def bump(xs):
    return [x+100 for x in xs]
```

`s.loc`:

```
module s (stream)

import root-py

source Py from "b.py"
  ( "make_batch" as makeBatch
  , "sort_desc"  as sortDesc
  , "bump"       as bump
  )

makeBatch :: Int -> [Int]

--' Sort the whole stream, descending
sortDesc :: [Int] -> [Int]

--' Add 100 to every element
bump :: [Int] -> [Int]

produce :: ([Int] -> <IO, Err> ()) -> <IO, Err> ()
produce sink = do
  _ <- sink (makeBatch 0)
  sink (makeBatch 1)

--' Stream integer batches to standard output.
--' @with -s/--sorted=sortDesc
--' @with -b/--bump=bump @stream
stream :: <IO, Err> ()
stream = @collect produce
```

Then `morloc make -o nexus s.loc && ./nexus -h`.

## Impact

The `Return:` table is the only place the help distinguishes a sink (writes its
own bytes, nothing on the wire) from a reformatter (typed value, honors `-f`).
Reporting every `@stream` reformatter as `Unit` erases that distinction exactly
where a reader goes to look it up.

## Guess

Unverified. The composed streaming entry point does return `()` at the morloc
level -- the elements leave through the sink, not the return slot -- so the
help is reading the synthesized signature rather than the handler's element
type. The whole-list case differs because there the handler result *is* the
return value.
