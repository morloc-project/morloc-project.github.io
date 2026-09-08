# 0074: no `root` list combinator applies to `Str`

- Status: open
- Found: 2026-09-08, while writing the same CLI seven ways
- Component: stdlib
- morloc: 0.102.1     mim: 0.29.0

## Expected

`root` exports around twenty combinators over sequences -- `length`, `map`,
`fold`, `filter`, `elem`, `concat`, `intercalate`, `replicate` and the rest. A
`Str` is a sequence of characters, and joining a `[Str]` with a separator is
among the most common things a program does when it renders anything.

## Observed

Not one of them accepts a `Str`. Joining:

```
jt.loc:4:17: error:
Type mismatch:
  expected: [a]
  inferred: Str
Cannot compare types Str and [*a@q0]
  |
4 | j = intercalate ", "
  |                 ^
```

Measuring:

```
st.loc:4:14: error:
Type mismatch:
  expected: a b
  inferred: Str
Cannot compare types Str and *f@q0 *a@q1
  |
4 | a s = length s
  |              ^
```

`size` works on a `Str` and `length` does not, which is a second split with no
stated rule behind it.

## Reproduce

```morloc
module jt (j)
import root-py
j :: [Str] -> Str
j = intercalate ", "
```

```
$ morloc typecheck jt.loc
```

## Impact

A morloc program can measure a string and concatenate two, and can do nothing
else to one without a foreign function or the `text-*` modules. Every renderer
written during the seven-implementation exercise hand-rolled a recursive
`joinWith`, and one hand-rolled a `pad`, because the stdlib combinator that does
the job cannot be applied. It is also the wall that ended a plain-text storage
design: parsing anything at all requires leaving pure morloc.

This is broader than "`Str` cannot be indexed or sliced". Indexing is one
missing operation; being outside the class hierarchy means the whole library
misses.

## Guess

Unverified, and the resolution is a design decision rather than a fix: either
`Str` becomes a `Foldable`/`Functor` of characters and the existing combinators
reach it, or it gets an explicit surface of its own in `root` (`join`, `length`,
`slice`) and the split is documented. Today it is neither, and which one is
intended is not written down anywhere.
