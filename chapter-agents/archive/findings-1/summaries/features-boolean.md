# Morloc knowledge added by chapter 4 (features-boolean)

## Booleans

- Type is `Bool`. Source-level literals are `True` and `False` (uppercase
  only — lowercase `true`/`false` is rejected as an undefined term at
  parse/type-check).
- Nexus prints booleans lowercase: `./m yes` → `true` (JSON form).
- `Bool` values marshal to nexus without a Str-wrapping (`./m yes` is
  the raw literal, no quotes).

## Comparison operators (Eq, Ord)

- `==  !=  <  <=  >  >=` from typeclasses `Eq` / `Ord`.
- Instances live in the language-specific root modules
  (`root-py`, `root-cpp`, `root-r`) — NOT in `root` alone.
  A bare `import root` fails with
  `General type error: No instance found for Ord::<=`.
- Comparisons defined only in terms of `<=`; e.g.
  `root/main.loc:30 (>) x y = y <= x && not (x <= y)`.

## Logical operators

- `&&`, `||`, `not`, `xor`, `nand` from `root`.
- `not` is a prefix function, not an operator.
- Fixities (from `root/main.loc:5-6`):
  - `infixr 2 ||`
  - `infixr 3 &&`
  - `&&` binds tighter than `||`; both right-associative.
- **Short-circuiting is language-dependent**:
  - **C++**: yes — codegen emits native `&&`/`||` (`bool n = (false && m1363(x))`), so the RHS is never evaluated.
  - **Python**: NO — codegen emits `morloc_and(x, y)` where both args
    are evaluated at call time. Verified with a Py `crash` function on
    the RHS: `False && crash x` still raises.
  - Both languages mark the ops `%inline` in their `main.loc`, but only
    the C++ backend achieves operator-level inlining. Do not rely on
    short-circuiting in polyglot / Python code.

## Boolean folds from `root`

- `any  :: Foldable f => (a -> Bool) -> f a -> Bool`
- `all  :: Foldable f => (a -> Bool) -> f a -> Bool`
- `elem :: (Foldable f, Eq a) => a -> f a -> Bool`
- Operator sections work here: `any (< 0)`, `all (> 0)`.

## Guard syntax

- Multi-branch guards:
  ```
  classify x
    ? x < 0     = "negative"
    ? x == 0    = "zero"
    : "positive"
  ```
- `?` = conditional branch, `:` = fallthrough / otherwise.
- Compiles and runs in this release (0.93.0). Full description promised
  in `features-guards.asc` (later chapter, no cross-reference in the
  text).

## Generic-export pattern (recurring)

- `sameLength :: [a] -> [b] -> Bool` — polymorphic export — is silently
  dropped by `morloc make`:
  `Warning: skipping generic export 'sameLength'`.
  Monomorphize to expose it via the nexus.
- Same behavior every earlier chapter has seen; expect to keep working
  around it.

## For downstream chapters

- When the docs promise "short-circuit" evaluation in prose, verify per
  backend. It only holds in the C++ pool.
- Comparison / arithmetic examples always need `import root-<lang>`
  (root-py or root-cpp), not just `import root`.
- Guard `?`/`:` sugar is real, works in 0.93.0.
