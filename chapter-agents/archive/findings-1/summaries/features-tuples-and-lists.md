# Morloc knowledge added by chapter 8 (features-tuples-and-lists)

## Tuples

- Tuple type sugar: `(T1, T2, ..., Tn)` desugars to `Tuple<n>`. Confirmed
  in `library/Morloc/BaseTypes.hs:135,303`:
  ```
  tuple k = TV $ "Tuple" <> pretty k
  tupleU ts = AppU (VarU $ tuple (length ts)) ts
  ```
- Explicit `TupleN A B ...` form is accepted anywhere the paren form is.
  `t3 :: Tuple3 Int Int Int` and `t3 :: (Int, Int, Int)` are the same
  type; the pretty printer canonicalizes both to the paren form on output.
- No fixed upper bound on arity. Verified `Tuple10` and `Tuple50` all the
  way through `morloc make` + nexus run: both emit correct JSON arrays.
- **Pretty-printer only sugars back to paren form for arity ≤ 8.**
  Arity 9+ prints as `Tuple<N> ...` (space-separated arg types). Source:
  `library/Morloc/Namespace/Type.hs:1326-1332` — the `Type` Pretty
  instance has explicit cases for `Tuple2`..`Tuple8` and no fallback
  sugar. `morloc typecheck` output for a `(Int, ..., Int)` (10 Ints)
  signature is `Tuple10 Int Int Int Int Int Int Int Int Int Int`.
  Not a bug (still valid morloc syntax on input), but visually asymmetric.

## Lists

- `[T]` is sugar for `List T`. Both spellings accepted in signatures.
  `morloc typecheck` canonicalizes `List Real` → `[Real]` in output.
- `List` maps to `list` (Python), `std::vector` (C++), `list`/`vector` (R).
- On the wire, tuples and lists are indistinguishable JSON arrays. Types
  disambiguate them.

## Related types (from cross-references)

- `Deque a` exists in `root` (`/opt/morloc/src/morloc/plane/default/root/main.loc`):
  `newtype Deque a = List a`, with instances for `Foldable`, `Functor`,
  `Stack`, `Queue`, `Semigroup`, `Monoid`, `Eq`, `Ord`, and
  `Packable (List a) (Deque a)`. Construct with a list literal annotated
  `:: Deque a`.
- `Vector (n :: Nat) a` exists in the `vector` stdlib module:
  `newtype Vector (n :: Nat) a = List a`. Instances include `Functor`,
  `Foldable`, `Eq`, `Ord`, `SemigroupDim`, `MonoidDim`, `Indexable`,
  `SliceableDim`, and `Packable (List a) (Vector n a)`. This is the
  chapter's "1D dense" alternative to `List`.

## Nexus arg conventions (reconfirmed)

- `Unit` (`()`) arguments require literal `null` on the CLI, not `{}`
  and not omitted:
  ```
  $ ./m getT10 null
  [1,2,3,4,5,6,7,8,9,10]
  ```
  `{}` errors with `serialization error: expected null, got {}`.
- Multi-command executables need the command name; single-command may omit
  (from getting-started chapter, still true).

## Docs cross-refs (verified for this chapter)

- `xref:types-newtype[...]` → `content/types-newtype.asc` (has explicit
  `[#types-newtype]` anchor). Resolves.
- `<<Tensors>>` → `content/features-tensors.asc` (starts with
  `=== Tensors`, auto-anchor). Resolves.

## For downstream chapters

- When you need a 1-D dense numeric container (previous chapter's
  aspirational `Tensor1`), use `Vector n a` — that is the real type.
- Deque and List are wire-compatible; you can literal-construct a
  Deque with `[a, b, c] :: Deque _`.
- Pure-data declarations (no exports of functions) build a `typecheck`
  target but produce no nexus commands — same pattern the previous
  chapters have hit.
