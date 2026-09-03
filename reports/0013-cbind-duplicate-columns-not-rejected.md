# 0013: `cbind` on tables with overlapping column names builds a corrupt table

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" table section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/features-tables.asc` says:

> The compiler enforces that overlapping column names are an error: extending
> `{x=Int}` with `{x=Real}` does not silently coerce.

`table/main.loc` says the same: "Tables must have the same row count n and
disjoint column schemas".

## Observed

With no annotation on the result, the program compiles and runs, producing a
table with a duplicated key:

```
$ morloc make -o e2 e2.loc
$ ./e2 bad
[{"x":0,"x":0},{"x":1,"x":1},{"x":2,"x":2}]
```

`morloc typecheck` reports the result type as `Table 3 ({x=Int} + {x=Real})`,
i.e. the `+` is left unreduced and the disjointness check never runs.

The check does fire when the caller writes the result type out, but the
message prints identical expected and inferred types:

```
e2b.loc:9:7: error:
Type mismatch:
  expected: Table 3 ({x=Int} + {x=Real})
  inferred: Table 3 ({x=Int} + {x=Real})
Subtype error: Rec constraint mismatch: Rec union has overlapping keys: x
  ({x=Int} + {x=Real}) <: ({x=Int} + {x=Real})
```

## Reproduce

From an empty directory:

`e2.loc`:

```
module main (bad)
import root-py
import table-py
t3 :: Table 3 {x = Int}
t3 = asCol "x" ([0,1,2] :: Vector 3 Int)
u3 :: Table 3 {x = Real}
u3 = asCol "x" ([0.0,1.0,2.0] :: Vector 3 Real)
bad = cbind t3 u3
```

```
$ morloc make -o e2 e2.loc
$ ./e2 bad
[{"x":0,"x":0},{"x":1,"x":1},{"x":2,"x":2}]
```

Add `bad :: Table 3 ({x = Int} + {x = Real})` and the build fails with the
self-comparing message above.

## Impact

The primary safety claim of the typed-table design -- that column-name
collisions are caught at compile time -- does not hold on the path a user is
most likely to take, which is to let the result type be inferred. The output is
JSON with duplicate object keys, which most downstream parsers silently
collapse.
