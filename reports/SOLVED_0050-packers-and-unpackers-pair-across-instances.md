# 0050: pack and unpack are paired across different Packable instances

- Status: fixed
- Found: 2026-09-04, wiring specificity-ordered packer selection (report 0048)
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`class Packable a b` declares `pack :: a -> b` and `unpack :: b -> a`, so an
instance's two methods are mirror images of one another. A serializer built
from an instance uses that instance's `pack` with that instance's `unpack`.

## Observed

The two are matched by the packed type's constructor name and the number of
quantified variables, not by the instance they were declared in. Two instances
of one constructor with the same number of parameters therefore produce four
pairings, two of which combine one instance's `pack` with the other's `unpack`.

Not yet observed at runtime: report 0049 aborts these programs before a
serializer is built. The defect is visible in the construction itself.

## Reproduce

Blocked behind report 0049. The shape that produces it is two instances of one
constructor with equal parameter counts:

```
instance Packable ([Str], [(Int, Int, e)], [l]) (RootedTree Str e l) where ...
instance Packable ([n], [(Int, Int, Real)], [l]) (RootedTree n Real l) where ...
```

Both heads quantify two variables, so all four pack/unpack combinations are
built.

## Impact

A value would be packed by one instance's function and unpacked by another's.
Where the two instances use different native representations -- which is the
only reason to declare both -- the round trip is silently wrong.

The mispairing also breaks instance selection, because the cross-pairs carry
the packed type of whichever instance supplied the `pack`. One instance head
then appears several times among the candidates, so a selection rule that
requires a unique most specific match sees duplicates and reports an ambiguity
that the source does not contain.

## Guess

Verified by reading, not by patching.

`makeSerialAST` (`Serial.hs:418`) builds the packer table from a cross product:

```haskell
[ (extractKey b1, [(length vs1, qualify vs1 a1, qualify vs1 b1, src1, src2)])
| ((vs1, FunU [a1] b1), src1) <- packs
, ((vs2, FunU [a2] _), src2) <- unpacks
, extractKey b1 == extractKey a2
, length vs1 == length vs2
]
```

The unpacker's result type is discarded (`FunU [a2] _`), so the only conditions
relating the two sides are that the packed type's head constructor agrees and
that the quantifier counts are equal. Every type in the resulting tuple is taken
from the `pack` side; only `src2` comes from the `unpack` side, which is why the
mispairing produces a well-typed but wrong serializer rather than a type error.

The pairing an instance actually determines is the mirror condition: the pack's
argument matches the unpack's result, and the pack's result matches the unpack's
argument. Testing that needs an alpha-equivalence that does not depend on the
order in which each signature happens to quantify its variables, since `a -> b`
and `b -> a` need not list them alike. Recovering the grouping upstream may be
sounder than reconstructing it here: `findPackers` flattens `instanceTerms`,
which is where the association between an instance's two methods still exists.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

Gone by construction. The packer table is no longer rebuilt per language from
flattened method signatures; a `PackerInstance` record carries an instance's
head, its wire form, and the pack/unpack pair for each language that implements
it, built once.

Pairing an instance's two methods still has to be recovered, since which
instance a method came from is not recorded, but it now happens once at table
construction and by the mirror condition -- a pack `a -> b` belongs with the
unpack whose argument and result are those same two types the other way round --
rather than implicitly in a cross product joined on constructor name and
quantifier count.

Covered by `pairing.loc` in `test-suite/golden-tests/packable-multiple-instances`,
where the export returns the packed type so the value leaves through the
selected instance's `unpack`, and the two unpacks differ observably.
