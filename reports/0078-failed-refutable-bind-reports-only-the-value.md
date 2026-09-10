# 0078: a failed refutable bind reports only the unmatched value

- Status: open
- Found: 2026-09-10, while documenting refutable `<-` binds
- Component: compiler
- morloc: 0.102.1

## Expected

A refutable bind (`Full v <- mkbox n`) throws when the pattern does not match.
The error a user sees should say that a pattern failed to match, and where.

## Observed

The thrown message is the unmatched value, rendered, and nothing else. Nothing
in the output says a pattern was involved.

```
$ ./match peek 0
Error: run failed
"Empty"
  at peek [py] (mid=12, match.loc:2:42)
```

from

```morloc
peek :: Int -> <IO> Int
peek n = do
  Full v <- mkbox n
  v
```

A reader who has not memorised this shape has to guess what `"Empty"` means.
The `|`-clause failure path does better -- it says `no clause matched the
argument` -- so the two refutable forms report differently.

## Reproduce

```morloc
module main (peek)
import root
import root-py
data Box = Full Int | Empty
source Py from "b.py" ("mkbox")
mkbox :: Int -> <IO> Box
peek :: Int -> <IO> Int
peek n = do
  Full v <- mkbox n
  v
```

```python
# b.py
def mkbox(n):
    return ("Full", (n,)) if n > 0 else ("Empty", ())
```

`morloc make -o match match.loc && ./match peek 0`

## Impact

Every failed refutable bind. The common case `Ok x <- @load p` happens to read
tolerably, because the rendered `Try` carries the load error inside it, but any
other pattern gives the user a bare value with no context.

## Guess

Unverified. `@throw` accepts only a `Str`, so the desugarer renders the subject
with `@show` and throws that. Prefixing the render with a fixed string would
fix the message without waiting for `@throw` to accept a structured payload.
