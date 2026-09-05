# 0037: a docstring on `record X = X {...}` is dropped; the same docstring on `record X where` is inherited

- Status: fixed
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/features-records.asc` presents `record Person = Person { ... }` as
the way to declare a record. A docstring above a type definition is inherited
by every argument of that type -- that is how `type Key = Str` supplies "A
secret key" to both `encode` and `decode` in the docstring section. A record
should behave the same way, in either spelling.

## Observed

The `where` form inherits; the constructor form does not.

```
$ cat r.loc
module r (f)
import root-py

--' Some settings
--' @metavar SETTINGS
record Config = Config
  { a :: Int
  , b :: Str
  }

record Py => Config = "dict"

--' Take a config
f :: Config -> Int
f _ = 1

$ morloc make -o r r.loc
$ ./r f -h
Take a config
...
Positional arguments:
  1:  type: Config
...

$ ./r --json-help | python3 -c "
import json,sys
d=json.load(sys.stdin)
for c in d['commands']:
  print(c['name'], [(a['name'], a['metavar']) for a in c['arguments']])"
f [('arg0', None)]
```

Change only the record declaration to the `where` form:

```
--' Some settings
--' @metavar SETTINGS
record Config where
  a :: Int
  b :: Str
```

and both the description and the metavar arrive:

```
$ ./r2 f -h
Take a config
...
Positional arguments:
  1:  Some settings
      type: Config
...

$ ./r2 --json-help | python3 -c "..."
f [('settings', 'SETTINGS')]
```

## Reproduce

The two files above, from an empty directory. They are identical apart from the
record declaration syntax.

## Impact

The form the manual teaches is the form that silently loses the documentation.
An author who writes a record in the constructor form and documents it gets no
error, no warning, and no description in any generated interface -- CLI help,
JSON Schema, or MCP tool definition.

## Guess

Unverified. The two record syntaxes appear to take different paths through the
parser, and only the `where` path attaches the preceding docstring block to the
type definition.

## Resolution

Fixed in `morloc` commit `fdb80c88`.

The guess in this report was right that the two spellings take different paths,
and the reason the constructor path could not simply be pointed at the same
lookup is that its grammar rule discarded the source position of every field.
Its desugar built documentation from defaults, so both the declaration-level
docstring and any field-level ones were dropped.

Both spellings now parse fields with positions attached and share one routine
for collecting the declaration-level and field-level docstrings. `record X = X
{...}` and `record X where` produce identical documentation.

Carrying positions also fixes a second, unreported defect in the constructor
spelling: a duplicate field name put its caret on the `record` keyword, because
the offending field's position had been thrown away. It now points at the field.

Covered by `test-suite/golden-tests/record-docstring-forms`, which builds the
same record both ways and compares the generated interface field by field.

## Note

Field-level docstrings are now collected for both spellings, but they are
rendered nowhere in either -- not in `--help`, `--json-help`, or the MCP tool
definition. That gap predates this report and is unchanged by it; only the
divergence between the two spellings was in scope here.
