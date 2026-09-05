# 0009: the typechecker hangs forever when a definition takes more arguments than its signature

- Status: fixed (b28b7f84)
- Resolution: the lambda-versus-function check re-nests surplus parameters
  into the return type, the way subtyping already reconciles the two arrow
  spellings, and the eta-expander guards its whole non-positive range.
- Found: 2026-09-02, testing the effect-row example in `features-effects.asc`
- Component: compiler (typechecker)
- morloc: 0.100.2     mim: 0.28.0

## Expected

An arity mismatch between a type signature and its definition should be a type
error with a source location, the way every other mismatch is. Morloc already
does this correctly when the signature has arity 0:

```
$ morloc typecheck eh.loc      # foo :: Int  /  foo x = x
eh.loc:6:1: error:
Type mismatch:
...
```

## Observed

When the signature has arity >= 1 and the definition takes MORE arguments than
the signature allows, `morloc typecheck` never terminates. No output, no error,
no progress -- it has to be killed. `morloc make` behaves the same way.

Probed cases (each run under `timeout 25`):

| signature | definition | result |
|---|---|---|
| `foo :: Int` | `foo x = x` | clean type error |
| `foo :: Int -> Int` | `foo x = x` | ok (correct arity) |
| `foo :: Int -> Int` | `foo x y = x` | **HANG** |
| `foo :: Int -> Int -> Int` | `foo x y z = x` | **HANG** |
| `foo :: Int -> Int` | `foo = \x y -> x` | **HANG** |
| `foo :: Str -> Str` | `foo x y = x` | **HANG** |

So it is not specific to `Int`, not specific to the definition form (a lambda
does it too), and not specific to any particular arity -- only to "definition
arity exceeds signature arity, with signature arity at least 1".

Effects are not involved. I found it through an effect-row example, but the
minimal reproduction has no effects at all.

## Reproduce

```morloc
module eh (foo)

import root-py

foo :: Int -> Int
foo x y = x
```

```
$ morloc typecheck eh.loc
(hangs; kill it)
```

The original discovery case, from `features-effects.asc`, was this -- the
signature takes one argument and the definition takes two:

```morloc
effect Rand

foo :: (Int -> <Rand,e> Int) -> <Rand,e> Int
foo f x = do
  y <- f x
  y * 2
```

Adding the missing `Int ->` to the signature makes it typecheck instantly:

```
$ morloc typecheck eh.loc
foo :: (Int -> <Rand,e@e0> Int) -> Int -> <Rand,e@e0> Int
```

## Impact

High. Writing one argument too many is an everyday mistake, and the result is
not a diagnostic but a compiler that appears to have frozen. There is no
message to search for, nothing to time out against, and in CI it burns the job
until the runner's own limit fires. A user's most likely conclusion is that
their program is too big or the compiler is broken generally.

It also means the arity-mismatch case is untested: this exact shape was sitting
in the manual, so it has presumably never been run.

## Guess

Unverified: the subsumption/application loop probably keeps trying to peel
another argument off a result type that is not a function, instantiating a
fresh existential each time and never reaching a fixed point. The arity-0 case
takes a different path (there is no argument to peel) and reports correctly.

## Resolution

Fixed in `morloc` commit `b28b7f84`.

A definition with more parameters than its signature has arrows now re-nests the
surplus parameters against the result type instead of driving eta-expansion with
a non-positive count, which looped. The re-nesting takes no position on whether
the extra parameters are legal -- it preserves the declared shape and lets the
ordinary check decide -- so a genuine arity error is reported as one and a
curried result type still works.
