# 0051: a type's wire form is not required to agree across languages

- Status: fixed
- Found: 2026-09-04, surveying the Packable surface for reports 0048-0050
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

The wire form is what two pools agree on when they share a value. When a
constructor carries a `Packable` instance in more than one language, those
instances must give it the same wire form, and a program whose instances
disagree must be rejected at build time.

## Observed

The program builds. The disagreement surfaces at runtime as a misread packet:

```
$ ./disagree roundTrip '[3,4]'
Error: run failed
Integer overflow: 2-limb integer (128 bits) does not fit in 32-bit type
  (range -2147483648 to 2147483647)
  at _ [cpp] (mid=2064, disagree.loc:16:24)
```

Python serialized the value under a list wire form and C++ read it back as a
pair. The error names an integer range because the C++ pool interpreted the
list's header bytes as tuple elements; it says nothing about the two instances
that actually disagree.

The identical program with both instances giving the constructor a list wire
form returns the right answer:

```
$ ./agree roundTrip '[3,4]'
7
```

## Reproduce

`test-suite/golden-tests/packable-wire-form-agreement`, which builds both
programs and compares. It carries a `SKIP` naming this report.

The shape, reduced to the two instance declarations:

```
newtype Box a
type Py  => (Box a) = "dict" a
type Cpp => (Box a) = "BoxT<$1>" a

instance Packable [a] (Box a) where          -- wire form: a list
  source Py from "helpers.py" ("pack_list" as pack, "unpack_list" as unpack)

instance Packable (a, a) (Box a) where       -- wire form: a pair
  source Cpp from "box.hpp" ("pack_tuple" as pack, "unpack_tuple" as unpack)

roundTrip xs = boxSum (mkBox xs)             -- built in Python, consumed in C++
```

## Impact

Silent at build time, wrong at runtime, and the runtime error points at the
wrong thing. Where the two wire forms happen to have compatible layouts the
value is not rejected at all and the corruption is total: a program can read a
different value than the one that was written, with no diagnostic anywhere.

The failure needs two languages and a value that crosses between them, which is
the case morloc exists to serve. A single-language program cannot hit it, and
neither can a multi-language program that keeps the type inside one pool, so it
is invisible until a composition crosses the boundary.

## Guess

Unverified.

Instances are gathered per language (`Serial.hs:382`, `findPackers` filters on
`srcLang src == lang`) and lowered to a `SerialAST` per language. Nothing
afterwards compares the results across languages, so each pool is internally
consistent and the pair is never checked against each other.

The check has a natural home wherever the wire schema for a crossing is already
computed: two pools that exchange a value must agree on the schema string, and
that string is derivable from each side's `SerialAST` before any code is
emitted. Comparing the general (hint-free) schema of the two instances for one
constructor would catch this at declaration time and would not need a use site
to trigger it.

## An attempt that failed, and why

The condition to check is: for two instances of one constructor, unify their
heads; if they unify with substitution `s`, require `s(wire1)` and `s(wire2)` to
be alpha-equal. Heads with no common instance constrain each other not at all,
which is what keeps disjoint instances such as `Box Int` and `Box Str` legal.

Implementing that on top of `subtype` does not work. `resolveP` unifies by
calling `subtype` on an existentialised type and applying the resulting gamma,
so `subtype` looks like a unifier from that call site. It is not: it is
asymmetric. It solves existentials on one side against a *ground* type on the
other, and when both sides carry quantifiers the right side is skolemised rather
than solved.

Built that way, the check rejected pairs that plainly agree:

```
Packable instances disagree on the wire form of 'Vec':
  Vec 3 Int -> [Int]
  forall a . forall n . Vec n a -> [a]
```

`n := 3, a := Int` makes both wire forms `[Int]`. The suite went from 3 failures
to 14, taking every green Packable golden with it, plus `records-complex-1`,
`records-complex-2` and six R serial-form tests. The attempt was reverted.

A real unifier is needed: symmetric, with substitution composition and an occurs
check. `alphaEq` (`Namespace/Type.hs`) is a working template for the traversal --
it already walks every `TypeU` constructor in lockstep under a variable mapping,
and a unifier differs mainly in binding a variable to a term rather than to
another variable.

One further note for whoever writes it: the two instances' bound variables must
be renamed apart first. Two instances that both quantify `a` do not thereby
constrain their `a`s to be equal.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

For each pair of instances of a constructor, unify their heads; if they unify,
require the wire forms to be alpha-equal under the resulting substitution. Heads
with no common instance constrain each other not at all, which is what keeps
disjoint instances legal.

This needed a real unifier: symmetric, with substitution composition and an
occurs check, and renaming the two instances' bound variables apart first. The
attempt described above, built on `subtype`, is not a unifier and its failure is
recorded there.

Covered by `test-suite/golden-tests/packable-wire-form-agreement` and by unit
tests in `UnitTypeTests.hs` including the `[a]` versus `[[a]]` case that the
failed approach accepted.
