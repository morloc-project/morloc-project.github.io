# 0011: `pack` cannot build a wire form that itself contains a packable type

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" tensor section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`pack` is documented as the way to construct a value of a non-primitive type
from its wire form (`src/content/features-tensors.asc`, "Tensor wire forms"):

    m :: Matrix 2 3 Real
    m = pack ((2, 3), [1.0, 2.0, 3.0, 4.0, 5.0, 6.0])

The wire form of `Matrix d1 d2 a` is `((Int, Int), Vector (d1 * d2) a)`. A
list literal already becomes a `Vector` anywhere a `Vector` is expected, so
the argument above should be accepted.

## Observed

```
$ morloc typecheck main.loc
main.loc:7:5: error:
General type error: No instance found for Packable::pack
  Are you missing a top-level type signature?
  |
7 | m = pack ((2, 3), [1.0, 2.0, 3.0, 4.0, 5.0, 6.0])
  |     ^
```

Annotating the inner list makes it work:

```
m = pack ((2, 3), ([1.0, 2.0, 3.0, 4.0, 5.0, 6.0] :: Vector 6 Real))
```

The failure is not about the outer instance being missing. A wire form with a
plain `[a]` in the same position works, and the same tuple literal is accepted
without `pack` when the expected type is written out:

```
w :: ((Int, Int), Vector 6 Real)
w = ((2, 3), [1.0, 2.0, 3.0, 4.0, 5.0, 6.0])   -- accepted
```

So the trigger is specifically that the wire form contains a *second* packable
type (`Vector`), i.e. the argument would need a nested `pack`.

## Reproduce

`box.py`:

```python
def pack_box(x):
    return {"n": x[0], "v": list(x[1])}
def unpack_box(b):
    return (b["n"], b["v"])
```

`main.loc`:

```
module main (b)

import root-py
import vector-py

newtype Box a
type Py => (Box a) = "dict" a

instance Packable (Int, Vector n a) (Box a) where
  source Py from "box.py" ("pack_box" as pack, "unpack_box" as unpack)

b :: Box Real
b = pack (3, [1.0, 2.0, 3.0])
```

```
$ morloc typecheck main.loc
main.loc:13:5: error:
General type error: No instance found for Packable::pack
```

Change the instance head to `Packable (Int, [a]) (Box a)` and it typechecks.

## Impact

Anyone writing a tensor literal in pure morloc, or any `Packable` type whose
wire form contains another `Packable` type. The workaround (annotate the inner
expression) is easy once you know it, but the error message points at the outer
`pack` and blames a missing instance, which sends you looking in the wrong
place.

## Guess

Unverified: instance selection for `pack` resolves the argument type
bottom-up and only then matches it against instance heads, so the
`List -> Vector` coercion that the expected type would license is never
considered.
