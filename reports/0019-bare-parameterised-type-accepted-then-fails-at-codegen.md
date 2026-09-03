# 0019: a parameterised type used with no arguments typechecks, then fails at codegen

- Status: open
- Found: 2026-09-02, checking the gradual-dimension claims in the tensor section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`Vector` takes a Nat and an element type. The Nat is gradual (it may be
omitted), but the element type is not, so `Vector` written with no arguments
at all should be rejected where the omission happens.

## Observed

`morloc typecheck` accepts it:

```
$ morloc typecheck bare.loc
a :: Vector -> Str
```

`morloc make` rejects it, at the module export list rather than at the
signature:

```
$ morloc make -o bare bare.loc
bare.loc:1:14: error:
cannot serialize parameterised pure morloc type: Vector
  |
1 | module main (a)
  |              ^
```

## Reproduce

```
module main (a)

import root-py
import vector-py

a :: Vector -> Str
a t = "x"
```

```
$ morloc typecheck bare.loc
a :: Vector -> Str
$ morloc make -o bare bare.loc
bare.loc:1:14: error:
cannot serialize parameterised pure morloc type: Vector
```

## Impact

Low frequency, but it is the same shape as reports 0012 and 0014: a type-level
mistake survives `morloc typecheck`, then surfaces at codegen with a location
that points at the export list instead of the offending signature. A reader
following the manual's advice to use `morloc typecheck` as a fast check gets a
clean bill of health on a program that cannot be built.
