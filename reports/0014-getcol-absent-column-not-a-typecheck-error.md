# 0014: `getCol` on a column that is not in the schema is not a typecheck error

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" table section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`table/main.loc` documents `getCol`:

> Extract a named column as a Vector. The result element type is determined by
> `ProjectField r f` -- a type-level lookup that reduces to the column's type
> when r is ground. Compile-time error if `f` is absent in `r`.

`src/content/features-tables.asc` repeats the claim.

## Observed

`morloc typecheck` accepts the call and reports an unreduced `ProjectField`
as the element type:

```
$ morloc typecheck e3.loc
bad :: Vector 3 {x=Int}."q"
```

`morloc make` then fails at codegen with an internal message located at the
module export list:

```
$ morloc make -o e3 e3.loc
e3.loc:1:14: error:
Cannot find constructor in VarF "list"  finalType=Vector
  |
1 | module main (bad)
  |              ^
```

`selectCols` with a missing column, by contrast, does produce a real
constraint error (`Constraint violation: Subset: literal set missing 'q'`),
so the machinery to report this exists.

## Reproduce

`e3.loc`:

```
module main (bad)
import root-py
import table-py
t3 :: Table 3 {x = Int}
t3 = asCol "x" ([0,1,2] :: Vector 3 Int)
bad = getCol "q" t3
```

```
$ morloc typecheck e3.loc
bad :: Vector 3 {x=Int}."q"
$ morloc make -o e3 e3.loc
e3.loc:1:14: error:
Cannot find constructor in VarF "list"  finalType=Vector
```

## Impact

The mistake a table user makes most often -- a typo in a column name -- is
reported as an internal codegen error at the wrong line instead of "column q is
not in the schema".

## Guess

Unverified: `ProjectFieldU` has no "field absent" case; when the lookup fails
it leaves the expression unreduced instead of raising, and the failure only
becomes visible when the serializer cannot find a form for it.
