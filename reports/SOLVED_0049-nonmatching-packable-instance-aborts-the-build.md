# 0049: a Packable instance that does not apply aborts the build instead of being skipped

- Status: fixed
- Found: 2026-09-04, wiring specificity-ordered packer selection (report 0048)
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

A type constructor may carry several `Packable` instances. When a use site is
resolved, an instance whose head does not cover that use site is not a
candidate: it is skipped, and selection proceeds among the instances that do
match. Only when *none* matches is there an error.

## Observed

The first instance that fails to match aborts the whole build, even when
another instance matches perfectly.

```
$ morloc make -o xp xp.loc
  c: forall n . forall l . tuple (list n) (list (tuple int int float)) (list l)

However, the b <: a step failed:
Cannot compare types float and str

The packer function may not be generic enough to pack the type you specify, if
this is the case, you may need to simplify the datatype
```

The export is `rootLabel :: RootedTree Str Str Str -> Str`. One of the two
declared instances covers it exactly. The error is raised while testing the
*other* instance, which covers trees whose edge labels are `Real`.

## Reproduce

`xp.loc`, with the `tree.py` from
`test-suite/golden-tests/packable-instance-overlap`:

```
module xp (rootLabel)
import root-py
newtype RootedTree n e l
type Py => (RootedTree n e l) = "dict" n e l

instance Packable ([Str], [(Int, Int, e)], [l]) (RootedTree Str e l) where
  source Py from "tree.py" ("pack_generic" as pack, "unpack_generic" as unpack)

instance Packable ([n], [(Int, Int, Real)], [l]) (RootedTree n Real l) where
  source Py from "tree.py" ("pack_specific" as pack, "unpack_specific" as unpack)

source Py from "tree.py" ("root_node" as rootNode)
rootNode :: RootedTree n e l -> n
rootLabel :: RootedTree Str Str Str -> Str
rootLabel = rootNode
```

## Impact

Multiple `Packable` instances for one constructor are unusable in general. A
constructor may carry more than one instance only when every declared instance
happens to match every use site in the program, which defeats the purpose of
declaring more than one.

This blocks specialization: the pattern of a generic instance plus a
representation tuned for a common ground instantiation cannot be expressed
unless the specialized instance covers every use.

## Guess

Verified by reading, not by patching.

`resolveP` (`Serial.hs:965`) performs two subtype tests and gives them opposite
failure semantics. The general-form test treats a mismatch as "not a candidate":

```haskell
case subtype Map.empty u ga ... of
  (Left _) -> return Nothing
```

The concrete-form test treats the same condition as fatal:

```haskell
case subtype Map.empty b ca ... of
  (Left typeErr) -> MM.throwSourcedError m0 $ "There was an error raised in subtyping ..."
```

Both are match tests over the same instance; only the caller knows whether any
other instance matched, so neither belongs in a `throw`. The diagnostic the
concrete branch produces is worth keeping, but it belongs at the point where
selection finds no candidates at all, reported against every instance that was
tried rather than against whichever one happened to be examined first.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

`resolveP` performed two subtype tests and gave them opposite failure semantics:
a general-form mismatch meant "not a candidate", a concrete-form mismatch was
fatal. Both are match tests over the same instance, and only the caller knows
whether some other instance matched, so neither belongs in a throw.

It is now total, returning the reason an instance did not apply. The caller
reports only when nothing matched, naming every instance it tried and why each
was rejected -- which also subsumes the diagnostic the fatal branch used to
produce, and fixes report 0021 as a side effect.

Covered by `test-suite/golden-tests/packable-multiple-instances`: disjoint
instances each serving their own export, a generic instance and a specialization
used from two sites, and a Nat-indexed use site that matches only the generic.
