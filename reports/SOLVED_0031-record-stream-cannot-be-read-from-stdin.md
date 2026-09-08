# 0031: a packet stream whose schema carries a name round-trips through a file but not through stdin

- Status: fixed
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: runtime
- morloc: 0.100.2     mim: 0.28.0

## Expected

A `-f packet` result written by one morloc command should be readable by
another as an `IStream`, whether it arrives as a file argument or on standard
input. The golden test `test-suite/golden-tests/stdin-input` establishes the
file / omitted-stdin / `-` equivalence for `[Int]`.

## Observed

The same bytes are accepted from a file and rejected from stdin as soon as the
element type has a *name* -- a type alias or a record constructor.

```
$ ./m -f packet produce 3 > p.pkt
$ ./m consume p.pkt
3

$ ./m -f packet produce 3 | ./m consume
Error: run failed
Error (pymorloc.c:3022 in pybinding__mlc_next):
@next: stdin data packet-schema mismatch: opener declared `a<str>s`, incoming carries `as`
  at consume [py] (mid=2, m.loc:1:20)

$ ./m consume < p.pkt
Error: run failed
Error (pymorloc.c:3022 in pybinding__mlc_next):
@next: stdin data packet-schema mismatch: opener declared `a<str>s`, incoming carries `as`
```

The opener's schema carries the concrete name (`<str>` for the alias `Name`;
`<Point>` when the element is a record) and the packet on the wire does not.
Only the stdin path compares them.

Dropping the alias fixes it: with the same program changed to
`@open f :: <IO, Err> (IStream Str)`, the pipe returns `3`. Records behave the
same way -- `IStream Point` over a `record Point = Point { x :: Int, y :: Int }`
gives `opener declared a<Point>m21xj1yj, incoming carries am21xj1yj`, from a
file it works, and no `record Py => Point` declaration is needed to trigger it.

## Reproduce

`m.py`:

```
def mk(n):
    return ["n%d" % i for i in range(n)]
def count(ns):
    return len(ns)
```

`m.loc`:

```
module m (produce, consume)

import root-py

--' A person's name
type Name = Str

source Py from "m.py" ("mk" as mkPy, "count" as countPy)

mkPy :: Int -> [Name]
countPy :: [Name] -> Int

--' Make n names
produce :: Int -> [Name]
produce = mkPy

--' Count the names in a stream
consume ::
  --' A file of names; standard input when omitted
  --' @stdin
  Str ->
  <IO, Err> Int
consume f = do
  s <- @open f :: <IO, Err> (IStream Name)
  ns <- @next s
  countPy ns
```

Then `morloc make -o m m.loc` and the commands above.

## Impact

Named types and records are the natural payload for a morloc pipeline, and
piping one command into the next is the reason to emit `-f packet` at all. The
workaround -- write a temporary file and pass the path, or strip the name from
the `@open` annotation -- gives up either the pipe or the type. The
inconsistency also makes the failure hard to reason about: the same bytes are
valid or invalid depending on which fd they arrived on, and the error names a
schema the author never wrote.

## Guess

Unverified. The stdin reader appears to compare the opener's resolved concrete
schema (constructor name included) against the packet's general schema, while
the file path either skips the comparison or normalizes the name away first.

## Resolution

Fixed 2026-09-07, together with the `@append` instance of the same defect
(`plans/todo-implementations/FINDINGS.md` bug 1). Analysis in
`plans/schema-comparison-analysis.md`.

The diagnosis in this report was right about the symptom and understated the
cause. It is not that "only the stdin path compares them" -- it is that the
comparison was a byte equality against a string the caller was trusted to have
normalized, and the callers disagreed. The nexus's own evaluator normalized
before calling into the runtime; the pools passed the compiler's dispatch-table
string, hints and all. Every packet writer stores the hint-free form
(`schema_to_string` drops hints by design), so the pool's string could never
equal the wire's.

Three changes:

* `morloc-runtime-types/src/schema.rs` gains `canonicalize_schema_str` --
  parse, then re-render. It names the normal form so an entry point can ask
  for it rather than trust its caller.
* `open_stdio` canonicalizes before publishing the declared schema to the
  nexus, so the string the nexus holds is already normal.
* `check_incoming_schema` (`morloc-nexus/src/stdio_server.rs`) compares
  structurally via `schema_strings_compatible` rather than by bytes, so a
  caller that skips normalization is still served.

The same treatment was applied to `shared_append_to_path`, which had the other
raw `!=`, and `open_dispatch_istream` now uses the ascribed schema it had been
discarding: a stream file is self-describing so the *reader* needs no schema,
but the pool then walks the resulting voidstar with its compile-time schema,
and a mismatch there was silently producing garbage rather than an error.

Covered by `test-suite/golden-tests/stream-schema-hint-boundary`, whose
`readEv via stdin` case is this report: a record-element stream piped between
two morloc commands. Note the report's observation that a plain `type Name =
Str` alias triggers it too -- the golden pins that as `appendAlias`, because
hints are not a record-only concern.
