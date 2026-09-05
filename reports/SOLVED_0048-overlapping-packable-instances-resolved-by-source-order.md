# 0048: overlapping Packable instances are resolved by source order

- Status: fixed
- Found: 2026-09-03, specifying the named-type glossary for `--json-help`
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

When two `Packable` instances in the same language claim the same type
constructor -- one generic over its parameters, one specialized to ground types
-- the compiler either rejects the overlap or resolves it by specificity. Which
packer runs must not depend on the order the instances appear in the source.

## Observed

The last-declared matching instance wins, silently. Two programs identical
except for the order of two `instance` blocks compute different answers:

```
$ ./genfirst rootLabel '[["a","b"],[[0,1,1.5]],["x"]]'    # generic declared first
"A"
$ ./specfirst rootLabel '[["a","b"],[[0,1,1.5]],["x"]]'   # specialized declared first
"a"
```

No error, no warning. `morloc make` exits 0 for both.

The two packers differ observably: the specialized one upcases node labels. `"A"`
means the specialized instance was selected, `"a"` the generic one. Moving a
declaration past its neighbour changes which foreign function runs.

## Reproduce

`test-suite/golden-tests/packable-instance-overlap` in the compiler repo, which
builds both orderings and diffs their output. It carries a `SKIP` naming this
report; delete that file when the bug is fixed.

The shape, reduced:

```
newtype RootedTree n e l
type Py => (RootedTree n e l) = "dict" n e l

instance Packable ([n], [(Int, Int, e)], [l]) (RootedTree n e l) where
  source Py from "tree.py" ("pack_generic" as pack, "unpack_generic" as unpack)

instance Packable ([Str], [(Int, Int, Real)], [Str]) (RootedTree Str Real Str) where
  source Py from "tree.py" ("pack_specific" as pack, "unpack_specific" as unpack)

rootLabel :: RootedTree Str Real Str -> Str
```

Swap the two `instance` blocks and rebuild.

## Impact

A silently wrong foreign function is selected for serialization, so the defect
surfaces as wrong data rather than as a build failure. Reordering declarations
is normally a no-op refactor; here it changes program semantics.

It also blocks the named-type glossary work: the glossary publishes one generic
entry per type constructor, derived from the constructor's `Packable` instance.
When two instances claim one constructor there is no defensible entry to
publish, and a glossary that picks by source order would document a wire form
the program does not use.

The exposure is narrow today -- `findPackers` filters instances by language
first, so the common pattern of one instance per language does not overlap --
but the generic-plus-specialization pattern within a single language is the
natural way to give one type an optimized representation for its common ground
instantiation.

## Guess

Verified in the source, not by patching.

`Serial.hs` defines `selectPacker` twice, with different tolerance for
ambiguity. The atomic path refuses it:

```haskell
selectPacker _ = MM.throwSourcedError m "Two you say, oh, get out of here"    -- :600
```

The parameterized path takes the head of the list:

```haskell
selectPacker (x : _) = return x                                              -- :854
```

Every parameterized `Packable` -- `Map`, `Deque`, `RootedTree` -- reaches the
second. The guard is on the path where overlap is least likely and absent from
the one where it is most likely.

The list order comes from `Map.fromListWith (<>)` over a comprehension in
`makeSerialAST` (`Serial.hs:418`), so it follows declaration order rather than
any judgment about specificity. A comment above the atomic `selectPacker` already
records the gap: "Select the first packer we happen across. This is a very key
step and eventually this function should be replaced with one more carefully
considered. But for now, I don't have any great criterion for choosing."

Note that `length vs1 == length vs2` in that comprehension pairs packers with
unpackers of equal arity, which is what keeps the generic and specialized
instances from cross-pairing. It does not deduplicate them.

## Precedent

The compiler already rejects the sibling ambiguity. Two `source` declarations
binding one name in one language give a clear error naming both candidates:

```
main.loc:3:14: error:
Ambiguous source declarations for 'rms':
  source py from "./rms.py" "rms2" as rms
  source py from "./rms.py" "rms1" as rms
```

(`test-suite/golden-tests/multiple-instances-1-py`, skipped pending a decision on
distinguishing the two functions.)

So the shape of a fix is already established: detect the collision, name both
candidates, refuse. Whether `Packable` should instead resolve by specificity is
a separate design question, but source order is not a defensible answer under
either.

## The parameterless path

A constructor with no parameters used to reach a second `selectPacker` whose
entire diagnostic was `Two you say, oh, get out of here` -- a rejection that
named neither the type nor the instances.

Two instances of a parameterless constructor have identical heads, so they
trivially cover a common type and the wire-form coherence check (report 0051)
now catches them first:

```
Packable instances disagree on the wire form of 'Blob':
  Blob -> [Str]
  Blob -> [Int]
Both cover a common type, so a value of it would be
written under one form and read under the other.
Give the type one wire form.
```

Covered by `atomic-ambiguous.loc` in the golden, which asserts only that the
program is rejected, so it holds whichever check reports it.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

`selectPacker` now selects the unique most specific matching instance, using the
subsumption ordering that already existed in `Morloc.Namespace.Type` --
`mostSpecific` is `P.maxima` over the heads that match the use site. Several
incomparable maxima mean the heads overlap without either specializing the
other, and that is reported rather than resolved.

The ordering was already load-bearing for term instance selection
(`Typecheck.hs:326`), which is why two `source` declarations for one name are
properly rejected. Only the packer path had skipped it.

Covered by `test-suite/golden-tests/packable-instance-overlap`: a specialization
chain resolves the same in either declaration order, incomparable overlap is
rejected, and adding the unifier of two overlapping heads restores a unique
winner.
