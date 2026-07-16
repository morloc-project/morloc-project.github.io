# Morloc knowledge added by chapter 6 (features-floats)

## Float types (verified against stdlib mappings)

- `Real` — default. Language-specific width (typically 64-bit).
- `Float32` — IEEE 754 binary32.
- `Float64` — IEEE 754 binary64.
- Stdlib type mappings (from `root-*/main.loc`):
  - C++: `Real`, `Float64` → `double`; `Float32` → `float`.
  - Python: all three → `float`.
  - R: all three → `numeric`.

## Float literal forms

- `3.14`, `6.022e23`, `1.380649e-23` — decimal or scientific work.
  Scientific `e` is case-insensitive per grammar.
- `1e0` counts as a real literal (has exponent).
- `1` alone is `Int`. **KNOWN BUG: `Int` in a `Real` context is not
  rejected**. `one :: Real; one = 1` compiles, runs, prints
  `4.94065645841247e-324` (255 bytes reinterpreted as double). Same trap
  called out in features-integers § 1. Always write float literals with
  a decimal or exponent.
- Nexus prints `6.022e23` as `6.022e+23` (explicit `+` on exponent).

## Non-finite Reals

- Source literals: `Inf`, `-Inf`, `NaN`, `-NaN` — all atomic tokens.
  `-Inf` and `-NaN` do NOT go through the `negate` typeclass, so they
  work without importing `root-*`. Inserting a space (`- Inf`) breaks
  this; parser then looks for `negate` and fails without a root import.
- Not defined anywhere in the stdlib `.loc` files — these are compiler
  built-ins (lexer-level).
- Wire (JSON) form: `"inf"`, `"-inf"`, `"nan"` (lowercase, quoted).
- `NaN` and `-NaN` both round-trip as `"nan"` at the JSON boundary
  (sign collapsed). Binary cross-language format preserves bits.
- IEEE 754 arithmetic on non-finites is spec-conformant and identical
  across languages. Verified table:
    Inf + Inf = Inf; Inf + (-Inf) = NaN; Inf - Inf = NaN;
    Inf * 0.0 = NaN; Inf * 2.0 = Inf; Inf * (-1.0) = -Inf;
    Inf * Inf = Inf; Inf * (-Inf) = -Inf;
    NaN + finite = NaN; NaN * 0.0 = NaN; NaN * Inf = NaN;
    negate Inf = -Inf; negate NaN = NaN.

## Compile-time float overflow

- `morloc make` bounds-checks float literals against the target
  precision. Error message form:
  `Float literal 1.0e500 overflows Float64 (|x| > 1.8e308)` with a
  source caret. `Float32` uses `|x| > 3.4e38`. Symmetric for negative
  magnitude.
- Overflow check fires on `morloc make` ONLY. `morloc typecheck`
  accepts overflowing literals silently. Same pattern as Int overflow
  in the previous chapter (except Int overflow fires at typecheck).
- Non-finite literals (`Inf`, `-Inf`, `NaN`) bypass the bounds check.

## `1.0 / 0.0` divergence (host-language design, not IEEE)

- Python pool: raises `float division by zero` (nexus shows
  `Error: run failed / float division by zero / at m1 (py)`).
- C++ pool: `"inf"`.
- R pool: `"inf"`.
- Workaround: use the `Inf` literal instead of dividing by zero, or
  route the arithmetic through a non-Python pool.

## Negation edge cases

- `negate 0.0` prints as `-0` in JSON (sign visible textually).
- Source literal `-0.0` prints as `0` (sign collapsed). Distinction is
  numerical noise per JSON spec but observably inconsistent.
- Whitespace rules for `-` from features-integers § "Negation" still
  apply.

## Missing stdlib types referenced in prose

- `Tensor1` — does NOT exist. `tensor/main.loc` defines only `Matrix`
  (2D), `Tensor3`, `Tensor4`, `Tensor5`. Signatures naming `Tensor1`
  pass `morloc typecheck` (typecheck doesn't resolve type constructors
  in bare sigs) but cannot be constructed. Reach for `Vector n a` for
  1-D dense arrays.

## For downstream chapters

- `Tensor3`/`Tensor4`/`Tensor5` are `newtype` wrappers around
  `((Int, ...), Vector (product * dims) a)` — expect to marshal them
  as tuples-of-shape + flat data.
- Any `Tensor1`/`Tensor2` reference in later prose is aspirational
  (does not exist in v0.93.0 stdlib).
- `morloc typecheck` is not a substitute for `morloc make` when you
  care about literal-bounds or type-constructor errors.
- `morloc eval -e '...'` requires an explicit `import root-py;` (or
  another language's root module) as a prefix before arithmetic     .
