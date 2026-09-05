# 0057: a diverging native form is checked at literal sites but not at the wire boundary

- Status: open
- Found: 2026-09-05, verifying the fixes for reports 0012 and 0045
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

When a `newtype` declares a per-language form that differs from its wire
parent's, something has to convert the wire value into that form. Either a
`Packable` instance does it, or the language binding builds the form from the
schema hint. If neither can, the program should be refused.

The compiler already knows how to say this. Constructing such a value from a
literal produces a diagnostic that names both forms and the missing instance:

```
$ morloc make -o lit_path lit_path.loc
lit_path.loc:8:12: error:
Cannot construct a value of 'Path' from a Str literal in py. The native
per-language form "pathlib.Path" differs from the wire form's "str"; declare
'instance Packable Str Path where source py ... (... as pack, ... as unpack)'.
```

(golden `newtype-dispatch-no-instance` covers that path.)

## Observed

The same type reaching the pool through the wire -- a CLI argument, or a value
from another pool -- gets no check. The declared form is dropped and the wire
form arrives instead, with no error and nothing on stderr:

```
$ ./arg_path f 'notes/report.txt'
"str"
```

`arg_path` is the identical newtype, and `f` is declared `Path -> Str`.

Report 0045 fixed the mechanism that carries the declared form to the pool: it
now travels as a schema hint (`<pathlib.Path>s`). But a hint only does
something if the binding implements it. `data/lang/py/pymorloc.c` recognises
exactly four:

| line | hint |
|---|---|
| 341 | `bytes` |
| 351, 489 | `bytearray` |
| 393 | `numpy.ndarray` |
| 467 | `list` |

A form on that list works with no instance, which is the point of 0045's fix:

```
$ ./arg_bytes f 'hi'          # type Py => Blob = "bytes", no Packable
"bytes"
```

Anything off it is silently ignored. Adding the instance fixes the value:

```
$ ./forms2 pathKind notes/report.txt   # the same, plus instance Packable Str Path
"PosixPath"
```

## Reproduce

`native.py`:

```python
def kind(x):
    return type(x).__name__
```

`arg_path.loc`:

```
module main (f)
import root-py
newtype Path = Str
type Py => Path = "pathlib.Path"
source Py from "native.py" ("kind" as f)
f :: Path -> Str
```

```
$ morloc make -o arg_path arg_path.loc
$ ./arg_path f 'notes/report.txt'
"str"
```

Change the literal into a construction site and it is caught:

```
kindOf :: Path -> Str
f :: Str
f = kindOf "notes/report.txt"
```

## Impact

Narrower than 0045 was -- it now takes a declared form outside the binding's
supported set -- but the failure mode is the worst kind: the module states a
contract, the compiler accepts it, and the user's foreign function is handed
something else. `pathlib.Path`, `decimal.Decimal`, `datetime`, and any
user-defined class are all outside the set.

## Guess

Unverified, but this needs no new analysis: the divergence test the literal
path already performs would give the right answer at the deserialization
boundary too. The supported-hint set is a fixed list in one file per language,
so the rule is "declared form differs from the wire parent's, and is neither
bridged by a `Packable` nor in this language's supported set -- refuse".
