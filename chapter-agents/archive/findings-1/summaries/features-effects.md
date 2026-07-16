# Morloc knowledge added by chapter 14 (features-effects)

## Effect declarations

- Two forms (grammar `library/Morloc/Frontend/Parser.y:444-446`):
  - `effect UPPER` — inescapable
  - `escapable effect UPPER` — escapable
- WORD ORDER MATTERS. `effect escapable Foo` is a parse error.
  Stdlib `plane/default/random/main.loc:3` has the wrong order
  (`effect escapable Random`), so `import stdlib` still breaks
  in v0.93.0. Import needed submodules by name.
- Effect names must be `UPPER`.
- `IO` is PRE-DECLARED inescapable in
  `plane/default/internal/main.loc` (transitively imported via
  `root`). User-side `effect IO` is a silent no-op; `escapable
  effect IO` errors with `Conflicting effect declarations for 'IO'`.
- Undeclared effect: friendly error with fix hint.

## Effect-annotated types

- Syntax: `<L1, L2, e> T`. Comma-separated `UPPER` labels and at
  most ONE `LOWER` variable PER ROW (per `Parser.y:1107-1123` —
  the doc's "per term" phrasing is loose).
- `<>` empty row cannot be written in source (lexes as monoid op).
- Row order does not matter.
- Exported `<E> T` is auto-forced at the nexus boundary; outer
  user sees plain `T`. Verified with `forceOnce :: <IO> Int` →
  `10`.

## `do` blocks

- Layout form and brace form (`do { s ; s ; ... }`) both accepted.
- Statement forms:
  - `x <- e` — run, bind
  - `e` — run, discard
  - `let x = e` — bind without running
- Do-block type is `<union-of-stmt-effects> T` with `T` = type of
  the last statement.
- `let`-bound suspensions don't fire until a later `<-`.

## Escapable effects

- Only escapable effects may be discharged by a handler.
- Handler shape example: `handleError :: <Error, e> a -> <e> a`.
- On the Python side the discharger receives the suspended
  computation as a CALLABLE and must invoke it. Minimal working
  stub:
  ```
  def handle_error(computation):
      return computation() if callable(computation) else computation
  ```
- Four equivalent invocation forms (all verified with the same
  result):
  - `handleError (foo x)`
  - `do { handleError (foo x) }`
  - `handleError (do { v <- foo x ; v })`
  - `handleError (do { foo x })`

## Inescapable effects

- An inescapable effect in an argument row MUST appear in the
  result row. Otherwise compiler error:
  "Inescapable effect 'X' appear(s) in an argument but not in the
  result row. An inescapable effect performed via an argument must
  propagate to the result (only a sourced handler may discharge an
  escapable effect)."

## Rule 3 error message quality (worth remembering)

- Passing `<E> T` into pure `T` slot yields:
  "an effectful value cannot be used where a non-effectful type is
  expected; bind it in a do-block first (x <- e) and pass the bound
  value, e.g. 'do { x <- e ; f x }' instead of 'f e'".

## Doc gotchas that cost time

- Multi-name signature `f, g, h :: T` (used at line 292) does NOT
  parse. Split into separate declarations.
- Arity mismatch in a signature that contains an effect variable
  makes the typechecker OOM (exit 137) when the term is exported.
  Verified with the doc's own
  `foo :: (Int -> <Rand,e> Int) -> <Rand,e> Int` + `foo f x = ...`.

## For downstream chapters

- Do NOT `import stdlib`. Use `import root`/`import root-py` plus
  specific submodules.
- `IO` needs no user declaration; other IO-like effects that need
  discharge must be declared `escapable`.
- Effect used in an arg row must also appear in the result row
  unless escapable.
- `handle`, `Path`, `readFile`, `rollDie` in the chapter are prose
  illustrations, not stdlib functions/types.
- `<Foo, e>` means "must contain Foo plus possibly other effects
  (bound to `e`)".
