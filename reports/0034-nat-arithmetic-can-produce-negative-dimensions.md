# 0034: Nat arithmetic evaluates to negative values

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" kind-system section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

A Nat-kinded slot holds a natural number -- a length, a row count, a
dimension. `src/content/types-kinds.asc` documents `-` as
"subtraction (clamped at zero)". Either the clamp, or a rejection, would keep
the kind's meaning intact.

## Observed

Neither happens. The expression is evaluated as ordinary integer arithmetic
and the negative result is carried into the type and printed:

```
$ morloc typecheck natsub.loc
natsub.loc:6:9: error:
Type mismatch:
  expected: Vector -7 Int
  inferred: Vector 0 Int
Subtype error: Nat constraint mismatch
  0 <: -7
```

A signature containing a negative Nat is accepted on its own; it just can
never be satisfied, so the function is silently unreachable.

## Reproduce

```
module main (g)
import root-py
import vector-py
f :: Vector (3 - 10) Int -> Int
g :: Vector 0 Int -> Int
g v = f v
```

```
$ morloc typecheck natsub.loc
...
  expected: Vector -7 Int
```

Dropping `g` leaves `f :: Vector (3 - 10) Int -> Int` accepted with no
complaint at all.

## Impact

Low. Nothing unsound gets built -- a negative dimension matches no real value
-- but a signature that cannot be satisfied is accepted without a word, and a
type named `Nat` prints a negative number. The plausible way to hit it is a
shape formula like `Tensor3 k (h - fh + 1) ...` where the kernel is larger
than the input.

## Guess

Unverified: `NatSolver.normalize` turns `NatSub a b` into
`a + negate b` over a sum-of-products representation, which has no notion of
a floor.
