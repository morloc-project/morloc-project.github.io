# Morloc knowledge added by chapter 2 (features-functions)

## Function syntax

- Definitions: `foo x y z = g x (f y z)`. Arguments separated by
  whitespace, no parens.
- Composition: `foo = g . f` (right-associative, `infixr 9`).
- Application: `foo x = h $ g $ f x` (right-associative, `infixr 0`).
- Both `.` and `$` live in the `internal` module and are picked up
  transitively via `root`:

  ```
  /opt/morloc/src/morloc/plane/default/internal/main.loc
  53: (.) :: (b -> c) -> (a -> b) -> a -> c
  57: ($) :: (a -> b) -> a -> b
  ```

  Only `root/main.loc` and `stdlib/main.loc` do an explicit
  `import internal` — everyone else gets them re-exported.

## Partial application / operator sections

- Standard curry: `map (f 0)` works.
- Operator sections work in both directions: `(/ 2.0)` and `(2.0 /)`.
  Confirmed via `map (/ 2.0)` and `map (2.0 /)` — both build and run.
- The compiler's spec (`spec/language/operators.md`) says nothing about
  sections; they're not documented as a language feature but are
  clearly implemented in the parser.

## Numerics

- `Integral` class: `+ - * // % **`. Instances: `Real`, `Int`.
- `Numeric` (superclass `Integral`): `inv, /, ln`. Only instance is
  `Real`. So `/` is Real-only in the shipped stdlib.
- Numeric literals are **not** polymorphic across `Int` and `Real`.
  `2` is `Int`; `2.0` is `Real`. Attempting to use `map (/ 2)` where a
  `[Real] -> [Real]` is expected fails with
  `Cannot compare types Real and Int`.
- Bindings that depend on class resolution (`map`'s `Functor`) need a
  top-level signature; otherwise:
  `General type error: No instance found for Functor::map`.

## Lambdas

- Syntax: `\x -> x + bias`. One or more parameters required.
- Zero-argument lambda `\ -> 5` is a parse error (confirmed):
  `unexpected '->' … expected one of: '(', '[', ...`.
- Lambdas close over free variables in the enclosing scope
  (`addBias bias = map (\x -> x + bias)` compiles and runs).

## stdlib gotchas (observed, not doc-claimed)

- **No `slice`, `head`, `take`, `first`, `last` functions** in the
  shipped `stdlib` v0.93.0. What exists is `__get_slice__` in
  `internal` plus bracket-accessor sugar (`.[0:5] xs`).
  `zipWith`, `zip`, `unzip`, `range`, `rangeStep`, `takeWhile`,
  `dropWhile` are present.
- `import stdlib` crashes the parser in this container image because
  `plane/default/random/main.loc` uses `effect escapable Random` which
  the current parser doesn't accept:
  `unexpected 'escapable'`. Workaround: import the modules you actually
  need (`root`, `root-cpp`, `math`, etc.), not the umbrella `stdlib`.

## Docs cross-refs to watch

- `features-functions.asc` refers to "the section on effects and
  delayed evaluation" as prose only. Actual anchor is
  `features-effects.asc :: Effects and delayed evaluation`, linked
  elsewhere as `<<Effects and delayed evaluation>>`.

## For downstream chapters

- Prefer `import root` (+ `import root-cpp` when you need a build) over
  `import stdlib` until the `random`/`effect escapable` issue is fixed.
- Whenever you use a class method (`map`, `fold`, arithmetic) at the
  top level, add an explicit signature or expect
  "missing top-level type signature" errors.
- Numeric literal type is committed at parse: use `2.0` for `Real`,
  `2` for `Int`. No coercion.
