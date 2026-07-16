# features-effects.asc — findings

Compiler: **morloc 0.93.0** (container `ghcr.io/morloc-project/morloc/morloc-full:edge`).

Chapter is 300 lines. Every runnable example was completed with the smallest
reasonable wrapper (`module m (...)`, `import root`, `import root-py`, and,
where a Python side was needed, a matching `side.py` / `ops.py`) and run
end-to-end. The chapter's tone-setting worked example (line 128-141) returns
`17` as promised; the four "equivalent" handlers at line 292-297 all return
the same value once the arity mismatch and multi-name signature are fixed.
The mental model, rule 1-4 semantics, effect row variables, and the
`escapable` / inescapable distinction all match compiler behaviour.

Blockers below are the two examples that don't compile as written.

---

## 1. Multi-name signature `f, g, h :: T` doesn't parse `[blocker]`

`features-effects.asc :: Escapable and inescapable effects` (line 292).

The chapter writes the four-handler example as

```
gDirect, gDoWrap, gDoForce, gDoBind :: Int -> Int
```

Fed to the compiler verbatim:

```
$ morloc-manager run -- morloc typecheck test13_handlers.loc
test13_handlers.loc:13:8: unexpected ','
     |
  13 | gDirect, gDoWrap, gDoForce, gDoBind :: Int -> Int
     |        ^
  expected one of: '(', '[', '{', '_', '?', ...
```

Parser only accepts one name per `::` declaration
(`library/Morloc/Frontend/Parser.y:186`):

```
sig_or_ass :: { [Loc CstExpr] }
  : evar_or_op '::' sig_type
```

A reader copying the four-handler example gets a parse error on line 292
before ever getting to the semantically-interesting content that follows.

Fix: write four separate signatures, or add multi-name signatures to the
grammar. Once split, the example builds and all four handlers return the
same value (`105` for `x = 5` with `foo x = x + 100`).

---

## 2. `foo` in the effect-row-variable section has an arity mismatch `[blocker]`

`features-effects.asc :: Effect row variables` (lines 252-256).

Doc code:

```
foo :: (Int -> <Rand,e> Int) -> <Rand,e> Int
foo f x = do
  y <- f x
  y * 2
```

The signature takes **one** argument and returns `<Rand,e> Int`. The
definition takes **two** arguments (`f` and `x`). If the export list is
empty, `morloc typecheck` accepts it silently (exit 0):

```
$ morloc-manager run -- morloc typecheck test10_effectvar.loc  # module m ()
$ echo $?
0
```

The moment `foo` is exported, the typechecker runs the container out of
memory:

```
$ head -1 test10_effectvar.loc
module m (foo)
$ morloc-manager run -- morloc typecheck test10_effectvar.loc
Container engine (Docker) failed with exit code 137:
Container engine error
$ echo $?
137
```

Reproducible on repeated runs. This is a second-order compiler bug (arity
mismatch should surface as a clean type error, not OOM), but the immediate
problem is doc-level: the signature is wrong. Correct form:

```
foo :: (Int -> <Rand,e> Int) -> Int -> <Rand,e> Int
```

With the corrected signature `morloc typecheck` prints
`foo :: (Int -> <Rand,e@e0> Int) -> Int -> <Rand,e@e0> Int` and the example
otherwise behaves as claimed.

---

## 3. Undocumented pre-declared `IO` in `internal` `[confusing]`

`features-effects.asc :: Declaring an effect` (lines 77-88).

Doc says: "Every effect label a program uses must be declared" and gives
`effect IO` as its first example. But `IO` is already declared
inescapably in `internal/main.loc`, which is transitively imported by
every module that does `import root`:

```
$ morloc-manager run -- head -4 /opt/morloc/src/morloc/plane/default/internal/main.loc
module internal (*)

-- the intrinsics use IO, so this effect must be universal
effect IO
```

Two consequences the docs do not mention:

1. `effect IO` in user code is redundant when `import root` is present
   (the two declarations don't conflict because both are inescapable,
   so the user's `effect IO` is silently a no-op).
2. `escapable effect IO` is a hard error — it disagrees with the
   universal declaration:

   ```
   $ morloc-manager run -- morloc typecheck test15_handledo.loc
   Conflicting effect declarations for 'IO': declared both as escapable
   and inescapable
   ```

Reader who follows the docs' "use `IO` for I/O" advice and later tries to
build an escapable IO-like effect hits this without any warning that
`IO` was pre-claimed.

---

## 4. `escapable` misplaced in stdlib `random` — `import stdlib` still broken `[blocker for the chapter's promised examples]`

`features-effects.asc :: Declaring an effect` (line 80) states
`escapable effect Error` as the escapable syntax. Grammar
(`library/Morloc/Frontend/Parser.y:445-446`) agrees:

```
effect_decl : 'effect' UPPER              -- inescapable
            | 'escapable' 'effect' UPPER  -- escapable
```

The stdlib `random` module uses the wrong order:

```
$ morloc-manager run -- head -3 /opt/morloc/src/morloc/plane/default/random/main.loc
module random (*)

effect escapable Random
```

Result: `import stdlib` (the umbrella module) parse-errors:

```
$ morloc-manager run -- morloc typecheck stdimport.loc
.../random/main.loc:3:8: unexpected 'escapable'
    |
  3 | effect escapable Random
    |        ^
  expected one of: identifier, type name
```

This is not this chapter's typo — it's a stdlib defect — but the effects
chapter is the natural place to add a "known broken: `import stdlib`
until random is fixed" callout, because it's the first place readers
learn what the syntax should be. Prior chapter walks (features-functions
in particular) hit the same issue. Filing here for visibility.

---

## 5. "no more than one effect variable associated with a given term" is imprecise `[confusing]`

`features-effects.asc :: Effect row variables` (lines 245-246):

> Effect variables and constants may be mixed, but there may be no more
> than one effect variable associated with a given term.

The compiler actually enforces "no more than one per row", not "per term".
A term is free to have several effect variables across different rows:

```
foo :: (Int -> <e> Int) -> (Int -> <f> Int) -> Int -> Int   -- OK
foo :: (Int -> <e, f> Int) -> Int -> Int                     -- ERROR
```

```
$ morloc-manager run -- morloc typecheck test20_twosigrows.loc
test20_twosigrows.loc:6:55: an effect row may contain at most one effect variable
    |
  6 | foo :: (Int -> <e> Int) -> (Int -> <f> Int) -> Int -> <e, f> Int
    |                                                       ^
```

Compiler source: `library/Morloc/Frontend/Parser.y:1122` and
`mkEffectRow` at line 1107 — the check is on `EffectSet` construction,
which is a per-row operation, not a per-signature one.

Suggested edit: "…but each effect row may contain at most one effect
variable."

---

## 6. `Path` used in signature examples is not part of `root`/`internal` `[minor]`

`features-effects.asc :: Annotating signatures` (line 96-98):

```
readFile  :: Path -> <IO> Str
riskyRead :: Path -> <IO, Error> Str
```

`Path` is only defined in the stdlib `shell` module:

```
$ morloc-manager run -- grep -Rn 'type Path' /opt/morloc/src/morloc/plane/default/
/opt/morloc/src/morloc/plane/default/shell/main.loc:11:type Path = Str
```

These are illustrative signatures, not runnable examples, so no reader
will actually compile them. But if any downstream chapter reuses `Path`
as if it were built-in, expect `Undeclared type` errors without an
`import shell`.

---

## 7. `handle (do v <- foo x; v)` is an unmarked fragment `[minor]`

`features-effects.asc :: When `do` is needed and when it isn't` (lines 161-166):

```
handle (do
    v <- foo x
    v)
```

`handle` is not defined or otherwise introduced. A reader will assume it
is a stdlib function; it isn't. Wrapping it into a real module works if
`handle` is sourced as a discharger for an escapable effect (see the
handlers example at line 285-297 for the pattern that fits). Consider
either introducing `handle` up-front or wrapping this in a real module
skeleton.

---

## 8. "carries the all the effects" — typo `[minor]`

`features-effects.asc :: Effect row variables` (line 236):

> The function `mapE`, below, carries the all the effects of the mapping
> function to the final value:

Read as "carries all the effects".

---

## Positive results (every example that runs)

| Example | Command / status |
| --- | --- |
| `effect IO` / `escapable effect Error` (line 79-80) | typechecks |
| `example :: <IO> Int` do-block (line 129-141) | `./m example → 17` ✓ |
| `example` in brace form `do { ... ; ... }` (line 143-144) | `./m example → 17` ✓ |
| `forceOnce :: <IO> Int` (line 153-154) | `./m forceOnce → 10` ✓ |
| Rule 1: `pureFortyTwo = 42` (line 192-194) | `./m pureFortyTwo → 42` ✓ |
| Rule 2: widen `<IO> <: <IO, Error>` (line 196-201) | `./m testSubtype → 14` ✓ |
| Rule 2: narrow rejected (line 203-206) | clean type-mismatch error ✓ |
| Rule 3: `<IO> Int` into `Int` (line 208-211) | clean type-mismatch error with fix suggestion ✓ |
| Rule 4: union of effects (line 213-222) | `./m combined → 12` ✓ |
| `mapE` signature (line 240) | typechecks |
| `foo` effect-var (fixed arity — see finding 2) | typechecks |
| Inescapable `passt` (line 274) | typechecks |
| Inescapable `bad` (line 275) | clean "inescapable effect ... appear(s) in an argument but not in the result row" error ✓ |
| `gDirect`/`gDoWrap`/`gDoForce`/`gDoBind` (fixed sigs — see finding 1) | all four → `105` for input `5` ✓ |
| Undeclared effect (spot-check) | "Undeclared effect 'Frobnicate'..." with fix suggestion ✓ |
| Multiple vars in one row (spot-check) | "an effect row may contain at most one effect variable" ✓ |
| `<>` empty row in a signature (spot-check) | rejected as parse error (lexed as monoid op); consistent with doc's "You do not write it" |

## Cross-check citations

- Parser: `library/Morloc/Frontend/Parser.y`
  - line 186 — single-name signature grammar (blocker 1)
  - line 402/809/896 — effect-annotation grammar
  - lines 444-448 — `effect_decl` alternatives (`effect UPPER` / `escapable effect UPPER`); lowercase name error path
  - lines 1107-1123 — `mkEffectRow`, per-row single-variable enforcement (finding 5)
- Stdlib: `plane/default/internal/main.loc:4` — `effect IO`
- Stdlib: `plane/default/random/main.loc:3` — wrong-order `effect escapable Random`
- Stdlib: `plane/default/shell/main.loc:11` — `type Path = Str`
