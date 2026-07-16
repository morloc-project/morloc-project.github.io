# Morloc knowledge added by chapter 10 (features-patterns)

## Pattern-accessor syntax (all confirmed working in 0.93.0)

- `.<n>` — tuple index. `.0`, `.1`, ... build a function of the tuple.
- `.<key>` — record-field accessor.
- `.<a>.<b>` — chained access (left-to-right).
- `.(p1, p2, ...)` — grouped selectors that produce a tuple of terminal values.
  Works for both tuple indices and record keys, mixed freely:
  `.0.(.x, .y.1) ({x=1, y=(1,2), z=3}, 6)` → `[1,2]`.
- Setter form: `.(pat = expr, ...)` returns a copy with the terminal(s) updated.
  `.(.0 = 99) (1,2)` → `[99,2]`.
  Nested keys and indices are allowed in the pattern LHS.
- Patterns are first-class values: `map .1 [(1,2),(2,3)]`, `apply .0 (7,8)`,
  and any higher-order function all accept them.

## Bracket patterns (Python-style, getter only)

- `.[i]` — element (scalar result).
- `.[i:j]` / `.[i:j:k]` — slice (list result), Python semantics: negative
  indices count from end, out-of-range clamped, step 0 = runtime error.
- Omitted bounds default correctly: `.[:3]`, `.[7:]`, `.[:]`, `.[::-1]`.
- Any `IndexLike` type can appear in a bound position; mixed widths work:
  `.[(2 :: Int8) : (5 :: UInt32)] xs` typechecks and runs.
- **Composition rule** (verified end-to-end):
  - `.[i].tail xs` — index gives scalar, tail composes normally
    (`.[0].x pts` ≡ `(.x . .[0]) pts`).
  - `.[i:j].tail xs` — slice gives list, tail is **map-lifted**
    (`.[0:3].x pts` ≡ `map .x (.[0:3] pts)`).
  Nested brackets and grouped tails follow the same rule.

## What bracket syntax does NOT support (compiler errors are explicit)

- Bracket setters (`.[i] = v $ xs` or `.(.[0] = 99) xs`):
  ```
  setters are not supported on accessor chains that contain a bracket
  ```
- Multi-axis brackets (`.[i,j]` for matrices/tensors):
  ```
  multi-axis bracket accessors are not supported in v1 (1D lists only)
  ```

## Dispatch (typeclasses in `internal/main.loc`)

Verified from `.../plane/default/internal/main.loc`:

```
class IndexLike i where
  __to_index__ :: i -> ?Int64

class Indexable f where
  __access_index__ :: ?Int64 -> f a -> a

class Sliceable f where
  __get_slice__ :: ?Int64 -> ?Int64 -> ?Int64 -> f a -> f a

class SliceableDim f where
  __get_slice_dim__ :: ?Int64 -> ?Int64 -> ?Int64 -> f n a -> f m a
```

- `Sliceable` covers shape-preserving containers (List, Str).
- `SliceableDim` covers `Nat`-parameterized ones (Vector n a).
- Bracket dispatch happens entirely in userland typeclasses — the docs
  claim "the compiler picks `SliceableDim` automatically when
  `Sliceable` is absent" but that specific claim was not empirically
  tested this chapter.

## Trap re-encountered (5th chapter in a row)

`map .1 [(1,2),(2,3)]` fed to `morloc eval` errors as
`skipping generic export '__expr__'`. The list literal has ambiguous
numeric type. Fix: annotate the whole expression, e.g.
`(map .1 [(1,2),(2,3)]) :: [Int]` — then it prints `[2,3]`. Same
polymorphic-export pattern earlier chapters keep hitting.

## Nexus/JSON reminder

Tuples produced by patterns marshal as JSON arrays. Docs write results
as `(1,3)` but the terminal shows `[1,3]` — no semantic mismatch, just
a notational one.

## For downstream chapters

- When later chapters use bracket syntax on `Vector n a`, expect
  `SliceableDim` dispatch. Instances live per-language (e.g.
  `vector-py`, `vector-cpp`), so `import vector-<lang>` will be needed.
- `PatternAccessible` and `PatternChain` (also in `internal`) are the
  runtime scaffolding for pattern extraction. Not needed by end users
  today but useful to know if a chapter's error mentions
  `__extract_pattern__`.
- Bracket patterns are getters only in 0.93.0; anything the docs
  describe as "setter on a slice" is aspirational.
