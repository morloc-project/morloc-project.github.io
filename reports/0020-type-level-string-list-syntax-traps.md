# 0020: a double-quoted list in type position silently means something else

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" kind-system section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

Str-kinded literals are written with double quotes everywhere else in a type:
`Singleton "x" Int` and `ProjectField {x=Int, y=Str} "x"` both work and both
reduce. A list of them should therefore be `["x", "y"]`, which is what
`src/content/types-kinds.asc` and `src/content/features-tables.asc` show:

    selectCols :: l:[Str] -> Table n r -> Table n (Restrict r l)
    -- "Restrict {x=Int, y=Str, z=Real} ["x","z"]  ->  {x=Int, z=Real}"

## Observed

Two elements is a parse error, and the caret sits on the comma:

```
$ morloc typecheck ops1.loc
ops1.loc:6:51: unexpected ','
    |
  6 | b :: Table n (Restrict {x=Int, y=Str, z=Real} ["x","z"]) -> Int
    |                                                   ^
  expected ']'
```

One element parses -- but as a *list type whose element is the string literal
type*, not as a type-level list. It never reduces, and the mismatch is only
visible much later:

```
$ morloc typecheck q1.loc
q1.loc:6:9: error:
Type mismatch:
  expected: Table a ({x=Int, y=Str} # ["x"])
  inferred: Table 3 {x=Int}
Subtype error: Cannot compare Rec expressions
  {x=Int} <: ({x=Int, y=Str} # ["x"])
```

The accepted syntax is a tick-prefixed name, `['x, 'z]`, and it reduces:

```
$ morloc typecheck q2.loc
g :: (Table 3 {x=Int}) -> Int
```

The grammar comment in `library/Morloc/Frontend/Parser.y` explains the
ambiguity that motivates the tick, so the tick itself is deliberate. What is
not deliberate is that `["x"]` is accepted with a different meaning instead of
being rejected.

Separately, the same comment says bare ticks "are admitted only at the
constraint-argument level (see `constraint_arg` below)", but there is no
`constraint_arg` rule -- `single_constraint` is `UPPER types1` -- and a tick in
a constraint is rejected:

```
$ morloc typecheck con3.loc
con3.loc:4:14: unexpected type-level string "'x"
    |
  4 | f :: (Member 'x (Keys r)) => Table n r -> Int
    |              ^
  expected one of: ')', ','
```

## Reproduce

Parse error:

```
module main (b)
import root-py
import table-py
b :: Table n (Restrict {x=Int, y=Str, z=Real} ["x","z"]) -> Int
b t = 1
```

Silent wrong meaning:

```
module main (g)
import root-py
import table-py
f :: Table n (Restrict {x=Int, y=Str} ["x"]) -> Int
g :: Table 3 {x=Int} -> Int
g t = f t
```

Tick in a constraint:

```
module main (f)
import root-py
import table-py
f :: (Member 'x (Keys r)) => Table n r -> Int
f t = nrow t
```

## Impact

The single-element case is the dangerous one: it is accepted, means something
different from what it looks like, and only fails at a use site with a message
about Rec expressions. Anyone transcribing a column list from the manual hits
one of the two forms.
