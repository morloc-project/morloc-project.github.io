# Morloc knowledge added by chapter 13 (features-recursion)

## Recursive functions

- Direct self-recursion works in every backend tested. `fact n ? n == 0
  = 1 : n * fact (n - 1)` runs correctly via a Python pool
  (`fact 20 → 2432902008176640000`).
- Mutual recursion between value-level functions works. `isEven` /
  `isOdd` referencing each other builds and runs. Frontend accepts
  mutually-recursive value bindings (contrast with type aliases).

## Recursive types

- Bare self-recursive `type` aliases are rejected up-front:
  ```
  type X = X
  → "Type alias 'X' has a vacuous body: it reduces to a self-reference
     with no payload"
  ```
  Source: `library/Morloc/Frontend/Desugar.hs:1982,1997`.
- Cross-alias bare cycles (`type A = B; type B = A`) rejected:
  ```
  "Mutual recursion between type definitions is not supported.
   Cycle: A, B"
  ```
  Source: `library/Morloc/Frontend/Restructure.hs:237`,
  `classifyRecursion` at line 94.
- **Allowed forms of self-recursion** (every cycle must pass under one):
  - `?T`  (optional; base case is `Null`)
  - `[T]` (list;    base case is `[]`)
  - Also list-guarded inside a `record` via `[T]` fields
    (per features-records summary).

## Concrete forms verified

- `type LL a = (a, ?(LL a))` — tuple alias.
- `type Rose a = (a, [Rose a])` — list-guarded rose tree.
- `type BTree a = (a, ?(BTree a), ?(BTree a))` — two independent
  optional slots.
- `record LL where { head :: Int, tail :: ?LL }` — no concrete
  `record Py => LL = "dict"` line needed when the pool is Python-only;
  codegen infers a dict mapping. For cross-language use see
  features-records summary.
- `record Container a where { val :: a, sub :: ?(Container a) }` —
  parameterised recursive record builds fine.

## Coercion / laxity

- Compiler auto-coerces a `T` value into a `?T` slot in tuple/record
  literals and returns. Verified by `llRange n ? n > 0 = (n, llRange
  (n - 1))` (recursive call returns `LL Int`; slot expects
  `?(LL Int)`). No `Just`/wrap constructor needed. No named coercion
  routine located in the compiler; empirical only.

## `maybe-py` module (used by every ?T example)

- `require :: ?a -> a` — implemented as `id` on Python side
  (`morloc_fromMaybe(x) = x`). Does **not** assert; safe only under a
  null guard.
- `isNull :: ?a -> Bool` — implemented as `x is None`.
- Full `maybe` module also has: `default`, `tryMaybe`, `mapMaybe`,
  `bindMaybe`, `catMaybes`, `maybeToList`, `listToMaybe`, `liftMaybe2`.
- Nulls travel as `null` in JSON. Optional tuple slots serialize with
  a trailing `null` where absent.

## `fold` availability

- `fold :: (b -> a -> b) -> b -> f a -> b` in
  `/opt/morloc/src/morloc/plane/default/root/main.loc:81`. Used by
  the rose-tree example as `fold (\acc child -> acc + f child) 0 xs`.

## Polymorphic-export trap (still there)

- `containerLength :: Container a -> Int` silently dropped from the
  nexus (`Warning: skipping generic export 'containerLength'`);
  executable has no such command. Same trap ~6+ chapters have hit.
  Monomorphise (`Container Int -> Int`) or wrap the export.

## Nexus schema rendering quirk

- `./m --help` shows `sub :: ?Container` for a `Container Int` value
  — the type parameter is dropped in the schema. Cosmetic; wire
  format is correct.

## For downstream chapters

- Any recursive-type example must have `?T` or `[T]` at every cycle
  point — anything else is a compile-time reject.
- Record-form recursive types work identically to tuple-form.
- Do NOT expect a `Just`/wrap constructor on `?T`; the compiler
  coerces `T` into `?T` automatically. `Null` is the only optional
  literal.
- `require` is a null-guard-strip, not a runtime assertion.
