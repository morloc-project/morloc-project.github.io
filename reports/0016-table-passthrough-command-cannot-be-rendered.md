# 0016: a command that returns its `Table` argument unchanged fails to render

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" table section
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

A `Table -> Table` command should print its result like any other. Every other
table-returning command does:

```
$ ./io2 firstRow d.arrow
[{"x":0,"y":"c"}]
$ ./io2 addCol d.arrow
[{"x":0,"y":"c","w":1},{"x":1,"y":"a","w":2},{"x":2,"y":"b","w":3}]
```

## Observed

When the morloc body is the identity, the run fails:

```
$ ./io identity d.arrow
Error: serialization error: Cannot render a Table to generic JSON; use the Arrow-to-JSON path
$ echo $?
1
```

The same happens with a JSON literal argument, so it is not about the input
format:

```
$ ./io identity '[{"x":1,"y":"a"}]'
Error: serialization error: Cannot render a Table to generic JSON; use the Arrow-to-JSON path
```

## Reproduce

`io.loc`:

```
module main (identity)

import root-py
import table-py

identity :: Table n {x = Int, y = Str} -> Table n {x = Int, y = Str}
identity t = t
```

```
$ morloc make -o io io.loc
$ ./io identity '[{"x":1,"y":"a"}]'
Error: serialization error: Cannot render a Table to generic JSON; use the Arrow-to-JSON path
```

Replace the body with `sliceRows 0 1` and it works.

## Impact

Small on its own -- an identity command is not useful -- but the same shape
appears whenever a command's whole body is resolved away, and the error names
an internal code path rather than telling the user anything actionable.

## Guess

Unverified: with no pool call in the body the nexus returns the argument packet
directly and takes the generic JSON writer instead of the Arrow-aware one.
