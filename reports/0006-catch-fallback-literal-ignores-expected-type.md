# 0006: a numeric literal in the `@catch` fallback position ignores the expected type

- Status: fixed (40bd837e)
- Resolution: the fallback is checked against the fallible expression's
  payload type instead of synthesized. Two further defects surfaced and were
  fixed with it: deferred literals did not walk type aliases, and pool codegen
  never promoted an integer literal into a real slot.
- Found: 2026-09-02, testing `features-integers.asc` conversions
- Component: compiler (typechecker / literal defaulting)
- morloc: 0.100.2     mim: 0.28.0

## Expected

A numeric literal takes its type from the context that needs it. This works
everywhere else I could find:

```morloc
a2 :: U8
a2 = 200                 -- ok: from the signature

f :: U8 -> U8
f y = y
a3 :: U8
a3 = f 200               -- ok: from the argument position

g1 :: I64 -> I64         -- ok: guard fallthrough
g1 x
  ? x > 0 = x
  : 0

g2 :: [I64]
g2 = [0, 1, 2]           -- ok: inside a list literal

g3 :: I64                -- ok: where-bound with annotation
g3 = y where
  y :: I64
  y = 0
```

So `@catch (someI64Action) 0` should type the `0` as `I64`.

## Observed

In the `@catch` fallback position the literal is defaulted (to `Int` for an
integer literal, `Real` for a float literal) and the expected type is never
pushed into it:

```
catchlit.loc:24:8-27: error:
Cannot compare types Int and I64
   |
24 | b3 s = @catch (readI64 s) 0
   |        ^~~~~~~~~~~~~~~~~~^
```

It "works" for `Int` and `Real` only because the default happens to coincide
with the expected type. Every fixed-width numeric type fails: `I8`, `I16`,
`I32`, `I64`, `U8`, `U16`, `U32`, `U64`, and presumably `F32`/`F64`.

## Reproduce

```morloc
module catchlit (b1, b3)

import root-py

readInt :: Str -> <Err> Int
readInt s = read s

readI64 :: Str -> <Err> I64
readI64 s = read s

-- passes, but only because Int is the default for an integer literal
b1 :: Str -> Int
b1 s = @catch (readInt s) 0

-- fails: the 0 is typed Int, not I64
b3 :: Str -> I64
b3 s = @catch (readI64 s) 0
```

```
$ morloc typecheck catchlit.loc
```

The workaround is to bind the fallback with its own signature:

```morloc
zeroI64 :: I64
zeroI64 = 0

b3 :: Str -> I64
b3 s = @catch (readI64 s) zeroI64
```

which typechecks, confirming the value itself is fine and only the literal's
type propagation into that position is missing.

## Impact

Every fixed-width numeric conversion via `tryInto` -- the idiomatic use of
`@catch` that `features-integers.asc` is documenting -- hits this on the most
natural spelling. The error ("Cannot compare types Int and I64") does not
suggest the fix, so a reader is likely to conclude that `@catch` cannot be used
with fixed-width types at all.

## Guess

Unverified: the fallback expression is probably inferred independently and then
unified against the try-branch's type, rather than being checked *against* the
expected type. If the fallback were checked in the same bidirectional
"checking" mode used for the guard fallthrough (which works), the literal would
pick up the expected type the same way.
