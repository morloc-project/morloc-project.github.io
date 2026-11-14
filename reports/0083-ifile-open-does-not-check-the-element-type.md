# 0083: An `IFile` open does not check the file's element type

- Status: open
- Found: 2026-10-23, while rewriting runs-streaming.asc
- Component: runtime
- morloc: 0.109.0

## Expected

A stream file records its element type. Opening it at a different type is an
`Err` at open time (spec STRM-1). `src/content/runs-streaming.asc` used to
say "a mismatch errors at open time".

## Observed

A file of `Int` opens as `IFile [Real]` (and, in the nexus, as
`IStream Real`) and reads garbage:

```
$ ./bad asReal ints.dat
5e-324
$ ./bad asRealS ints.dat
[5e-324,5e-324,5e-324,1e-323,5e-324,1.5e-323]
```

## Reproduce

```morloc
module bad (asReal, asRealS)

import root-py

asReal :: Str -> <IO> Real
asReal path = do
  Ok f <- @open path :: <IO> (Try Str (IFile [Real]))
  .[0] f

asRealS :: Str -> <IO> [Real]
asRealS path = do
  Ok s <- @open path :: <IO> (Try Str (IStream Real))
  Ok xs <- @next s
  xs
```

Write `ints.dat` with any `OStream Int` (e.g. a `@stdout` producer run with
`-f packet`), then run the two commands above.

## Impact

Unsound: wrong values with no error. The manual now carries a WARNING in
runs-streaming.asc; remove it when this is fixed.

## Guess

Already tracked in the compiler repo, model/runtime/issues/ifile-access.md
("UNSOUND: `@open` of an IFile never checks the element schema").
