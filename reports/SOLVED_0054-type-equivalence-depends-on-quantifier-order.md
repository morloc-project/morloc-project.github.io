# 0054: type equivalence depends on the order quantifiers are written in

- Status: fixed
- Found: 2026-09-04, pairing Packable methods by type for report 0050
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`forall a . forall b . (a, b)` and `forall b . forall a . (a, b)` are the same
type. Adjacent universals commute, and `qualify` / `unqualify` carry the bound
variables as a list whose order is incidental. Two types that differ only in
that order must compare equal.

## Observed

They do not.

```
equivalent: renaming:                                   OK
equivalent: quantifier order swapped:                   FAIL
equivalent: mirrored function types:                    FAIL
equivalent: repeated variable is not the same as two:   OK
```

Renaming is handled; reordering is not. The two failing cases are in
`test-suite/UnitTypeTests.hs` under "Tests of type partial ordering (subtype)".

## Reproduce

```haskell
equivalent
  (forallu ["a", "b"] (tuple [var "a", var "b"]))
  (forallu ["b", "a"] (tuple [var "a", var "b"]))   -- False, should be True
```

## Impact

`equivalent` and `isSubtypeOf` are the program's notion of type equality, and
`mostSpecific` / `mostSpecificSubtypes` are built on them. Anything comparing
two independently-quantified types can get a false negative, and a false
negative here reads as "these are different types" -- so the failure mode is a
type that is silently treated as unrelated to itself.

This blocked using `equivalent` to pair an instance's `pack` with its `unpack`
for report 0050. `Packable a b` gives the two methods the signatures `a -> b`
and `b -> a`, which need not introduce their variables in the same order, so
the comparison had to be made structurally instead.

The exposure elsewhere is bounded by how types are usually built: two types
compared within one inference run tend to be quantified by the same code in the
same order, which is why this has not surfaced before.

## Guess

Unverified.

The `PartialOrd TypeU` instance (`Namespace/Type.hs:1024`) peels quantifiers
from the two sides in lockstep:

```haskell
(==) (ForallU v1 t1) (ForallU v2 t2) =
    if Set.member (VarU v1) (free t2)
      then let v = newVariable t1 t2
            in (P.==) (substituteTVar v1 (VarU v) t1) (substituteTVar v2 (VarU v) t2)
      else (P.==) t1 (substituteTVar v2 (VarU v1) t2)
```

This pairs the outermost quantifier on the left with the outermost on the right,
so it decides equality of the *sequences* rather than of the sets. Comparing
`unqualify`'d bodies under a bijection between the two bound-variable sets would
decide alpha-equivalence proper; the same traversal would give the canonical
renaming that anti-unification needs for report 0051.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

`alphaEq` decides equality by walking both types in lockstep under a bijection
between their bound variables, so two types binding the same variables in a
different order compare equal. `PartialOrd`'s `(==)` now uses it; the subtyping
rules already consulted `==` before their own quantifier handling, so ordering is
settled in one place.

On types with no bound variables this is exactly structural equality, so nothing
else changes. The same traversal is what the unifier for report 0051 is built
on.

Covered by the equivalence tests in `UnitTypeTests.hs`.
