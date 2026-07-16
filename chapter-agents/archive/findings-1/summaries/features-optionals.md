# Morloc knowledge added by chapter 15 (features-optionals)

## `?T` optional type

- Prefix `?` on any type: `?Int`, `?[Int]`, `?Person`, `?(?T)` all
  legal in signatures and parse fine.
- Sole optional literal is `Null` (uppercase; reserved keyword per
  `library/Morloc/Frontend/Lexer.hs:533` `classifyWord "Null" = TokNull`).
  Not a term-level constructor — you cannot rebind or shadow it.
- JSON wire form is lowercase `null`.

## Coercion `T -> ?T`

- Automatic wherever a `?T` is expected: function arguments, return
  values, record-field literals, list elements. No `Just`/`Some`
  wrapper. Same behaviour features-recursion already saw for `?T`
  slots in tuples.
- Works ACROSS languages: a C++ `Int` return will be serialized as a
  Python `Optional[Int]` slot without extra machinery.

## `?(?T)` idempotence

- Parser + typechecker accept nested `?`; at runtime it collapses to a
  single level. Compiler docstring at
  `library/Morloc/Frontend/Desugar.hs:1970`:
  "collapses to nothing under the `?(?T) == ?T` idempotence".
- Verified: `collapsed1 :: ?(?Int) = Null` → `null`;
  `collapsed2 :: ?(?Int) = 7` → `7`.
- Not enforced statically: e.g. `type X = ?X` IS rejected as vacuous
  (only becomes `Null`), but `?(?Int)` in an annotation is silently
  fine.

## Top-level `null` suppression

- When the nexus renders the top-level result of an exported command
  that returned `Null`, it prints an empty line (no `null`, no `()`).
- `--keep-null` on the nexus emits the literal `null` instead. This
  ONLY affects the top-level result. `null` inside a JSON object or
  array is always kept, regardless of the flag.
- **Placement of `--keep-null`**:
  - Multi-export: `./m --keep-null <subcommand>` — this is what the
    chapter shows.
  - Single-export: `./m --keep-null @` — the `@` is REQUIRED. Nexus
    help calls the single-export shape `./m <nexus_options> @
    <command_options>`. `./m --keep-null` alone errors out.

## Optional record fields

- `record Person where { name :: Str, age :: ?Int }` — the `where` form
  is real (equivalent to brace form; noted since features-records
  chapter didn't cover it).
- Absent optional field marshals as JSON `"field":null` — always
  visible, no dependence on `--keep-null`.

## Language-side representations

- Python: `None`.
- R: `NULL`.
- C++: `std::optional<T>`; `std::nullopt` == JSON `null`.

## Stdlib functions worth knowing (via `maybe-py`)

- `require :: ?a -> a` — this is `morloc_fromMaybe`; NOT the chapter's
  `require :: a -> ?a -> a`. Same short name, different arities. If
  a downstream chapter imports `maybe-py` and calls `require`, expect
  the stdlib version.
- `isNull :: ?a -> Bool`.
- Chapter defines its OWN `require :: a -> ?a -> a` (default + optional
  → non-optional) as a Python source. Do not conflate the two.

## Missing / not-in-stdlib

- **`at :: Int -> [a] -> ?a`** referenced by the chapter's `safeHead`
  example does NOT exist in the shipped stdlib. Neither `at`, `head`,
  `take`, `first`, `last` are present. For indexed access use the
  bracket accessor `.[i] xs` (scalar) from features-patterns — combined
  with the `T -> ?T` coercion, `.[0] xs` fills the same role.

## For downstream chapters

- Any function called `at` in later prose is aspirational.
- When testing an example that uses a `?T` field, do NOT rely on
  `--keep-null` for INNER nulls — they're always present.
- If a chapter uses a bare `require` and the module doesn't import
  `maybe`/`maybe-py`, the chapter is defining its own; treat the
  signature as source-of-truth for that snippet.
- Nexus command-line: single-export modules require the `@` separator
  before nexus options like `--keep-null` — feature not yet noted in
  the getting-started summary.
