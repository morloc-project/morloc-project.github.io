# 0036: `selectColsDyn` lets a caller assert a schema the table does not have

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" table section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`selectColsDyn :: [Str] -> Table n r1 -> Table n r2` exists because the column
list is a runtime value and the result schema cannot be computed. The comment
in `table/main.loc` says the output row type "is a free Rec variable that the
caller is responsible for binding". Whatever the caller binds it to should
then either hold, or be checked when the table is used.

## Observed

Neither. The caller's annotation is accepted as fact and never confronted with
the actual columns, so a program can carry a table typed `{state = Str}` that
in fact holds only `pop`:

```
$ ./dyn pick '["state"]'
[{"state":"WA"},{"state":"OR"},{"state":"CA"},{"state":"NV"}]
$ ./dyn pick '["pop"]'
[{"pop":7705281},{"pop":4237256},{"pop":39538223},{"pop":3104614}]
```

Both came from a function declared `[Str] -> Table 4 {state = Str}`.

Downstream the lie surfaces as a runtime error, at a location that names the
consumer rather than the `selectColsDyn` call that produced the bad table:

```
$ ./dyn2 grab '["pop"]'
Error: run failed
'Field "state" does not exist in schema'
  at grab [py] (mid=1, dyn2.loc:1:14)
```

## Reproduce

`dyn2.loc`:

```
module main (grab)

import root-py
import table-py

census :: Table 4 {state = Str, pop = Int}
census =
  let states = (["WA", "OR", "CA", "NV"] :: Vector 4 Str)
      pops   = ([7705281, 4237256, 39538223, 3104614] :: Vector 4 Int)
  in setCol "pop" pops (asCol "state" states)

narrowed :: [Str] -> Table 4 {state = Str}
narrowed cols = selectColsDyn cols census

grab :: [Str] -> Vector 4 Str
grab cols = getCol "state" (narrowed cols)
```

```
$ morloc make -o dyn2 dyn2.loc
$ ./dyn2 grab '["state"]'
["WA","OR","CA","NV"]
$ ./dyn2 grab '["pop"]'
Error: run failed
'Field "state" does not exist in schema'
```

## Impact

`selectColsDyn` is the one table operation whose type is an unchecked
assertion. It is deliberately an escape hatch, so the existence of a gap is by
design, but nothing validates the asserted schema at the point where the
dynamic list is applied -- which is where the check could be cheap and exact
(the runtime knows both the requested names and the source schema). Until then
the manual has to tell readers to prefer `selectCols`.

## Guess

Unverified: a runtime check inside the `selectColsDyn` kernel comparing the
produced schema against the declared one would close this without needing
anything from the typechecker, if the declared schema were passed down.
