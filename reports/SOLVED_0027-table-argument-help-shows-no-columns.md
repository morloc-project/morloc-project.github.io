# 0027: a `Table` argument renders as `Table _ (Rec)` in help, with no schema block

- Status: fixed
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

The nexus has a "Table Schemas:" help block, built by `render_command_schemas`
(`data/rust/morloc-nexus/src/schemas.rs:252`), that lists a table's columns the
way "Record Schemas:" lists a record's fields. A command taking a table should
tell the caller which columns it wants.

## Observed

Neither the alias nor the columns appear, and no schema block is emitted.

```
$ cat tb.loc
module tb (nrow)
import root-py
import table-py

--' A table of fruit counts
type Fruit = Table {name = Str, count = Int}

source Py from "tb.py" ("nrow" as nrowP)
nrowP :: Fruit -> U64

--' Count the rows of a fruit table
nrow :: Fruit -> U64
nrow = nrowP

$ morloc make -o tb tb.loc
$ ./tb nrow -h
Count the rows of a fruit table

Usage: ./tb <nexus_options> @ <command_options>

General Options:
  -h, --help  Print help (see more with '--help')

Positional arguments:
  1:  A table of fruit counts
      type: Table _ (Rec)

Return: U64
```

The command works -- `./tb nrow f.csv` on a two-column CSV with a header
returns the row count -- so the schema is known; it is only the help that
cannot say it. The manifest shows why:

```
$ python3 -c "import json;print(json.load(open('tb-build/manifest.json'))['commands'][0]['args'][0])"
{'kind': 'pos', 'schema': 'T:24names5countj', 'type': 'Table _ (Rec)', ..., 'constraints': [], ...}
```

The wire schema names both columns. The `type` field is the placeholder
`Table _ (Rec)`, and `constraints` is empty, so the renderer's
`kind == "table"` test never fires.

`tb.py`:

```
def nrow(t):
    return len(t["name"])
```

## Reproduce

The two files above, from an empty directory.

## Impact

A table-taking command is undiscoverable from its own help: nothing says which
columns the file must have, or even that the argument is a table rather than
whatever `_ (Rec)` might mean. Records do not have this problem.

## Guess

Unverified. Two missing pieces on the compiler side: the `kind` constraint that
`collect_command_layouts` needs is not emitted for table arguments, and the
`type` slot gets a placeholder instead of the alias (`Fruit`) or the applied
type.

## Resolution

Fixed in `morloc` commit `cea795b6`.

A `Table` argument now reports its columns inline:
`type: Table {name = Str, count = Int}`, where it previously reported the
placeholder `Table _ (Rec)`.

The anonymous row a table's column schema lowers to is spelled out rather than
printed as its bare constructor name, and phantom Nat/Str slots -- erased
measurements that printed as `_` -- are dropped from the argument list. A
literal dimension (`Vector 4 Int`) is real information and is kept. Because
the columns are now on the type line, no `Table Schemas:` block is needed for
this shape; the block machinery is untouched for nominal table types.
