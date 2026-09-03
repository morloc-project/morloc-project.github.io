# 0015: Rec-level type expressions do not unify with themselves, so table operations cannot be wrapped

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" kind-system section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

A function whose signature is exactly the signature of a stdlib function
should be definable by delegating to it. This works for the Nat-level
operators:

```
f :: Table n1 r -> Table n2 r -> Table (n1 + n2) r
f a b = rbind a b            -- accepted
```

The Rec-level operators (`+` on schemas, `Restrict`, `ProjectField`) are
documented the same way in `src/content/types-kinds.asc`, so the same shape
should work for `cbind`, `selectCols`, and `getCol`.

## Observed

Every Rec-level wrapper fails, and the reported types are identical on both
sides of the comparison.

`cbind`:

```
$ morloc typecheck w3.loc
unsolvable deferred kind constraints (solver could not decide):
  (a + b) ~ (a + b)
  Annotate the site with a concrete kind value, or extend the
  relevant solver (NatSolver / StrSolver / RecSolver / ListSolver
  / SetSolver) to handle this equation shape.
```

`selectCols`:

```
$ morloc typecheck w2.loc
w2.loc:5:9: error:
Type mismatch:
  expected: Table a (b # l)
  inferred: Table a (b # l)
Subtype error: Cannot compare Rec expressions
  (a # l) <: (a # l)
```

`getCol`:

```
$ morloc typecheck w5.loc
w5.loc:5:9: error:
Type mismatch:
  expected: Vector a c.b
  inferred: Vector a c.b
Subtype error: Type mismatch fall through
  b.a <: b.a
```

Row-only operations, whose signatures carry no Rec expression, are fine:

```
f :: Table n r -> Table n r
f t = sliceRows 0 1 t        -- accepted
```

## Reproduce

Each of the three below is a complete file; run `morloc typecheck` on it.

```
module main (f)
import root-py
import table-py
f :: Table n r1 -> Table n r2 -> Table n (r1 + r2)
f a b = cbind a b
```

```
module main (f)
import root-py
import table-py
f :: l@[Str] -> Table n r -> Table n (Restrict r l)
f l t = selectCols l t
```

```
module main (f)
import root-py
import table-py
f :: f@Str -> Table n r -> Vector n (ProjectField r f)
f k t = getCol k t
```

## Impact

No user-written module can abstract over the schema-changing table operations
-- no wrappers, no defaulted-argument variants, no composed helpers, no
alternative backends. Everything that touches a column schema has to be a
primitive sourced from a foreign language. This is the main thing that stops
`table` from being extended by ordinary morloc code.

## Guess

Unverified: the Rec/Str solvers only decide equations where at least one side
is ground, and there is no syntactic-identity shortcut applied first.
