# 0045: a newtype's declared per-language form is silently ignored when its wire parent is a leaf

- Status: fixed
- Found: 2026-09-03, investigating report 0012
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`type Py => (Name a) = "bytes"` declares that `Name a` is a Python `bytes`.
A function sourced against that declaration should receive a `bytes`.

## Observed

It receives a `str`. The declaration is dropped with no error, no warning, and
no schema hint:

```
$ morloc make -o ovr2 ovr2.loc
$ ./ovr2 label 'hi'
Error: run failed
'str' object has no attribute 'decode'
  at label [py] (mid=1, ovr2.loc:1:14)
```

The generated schema shows the newtype identity gone entirely -- a bare
string, no `<bytes>` hint:

```
$ grep mlc_schema_table ovr2-build/pools/py/pool.py
mlc_schema_table = ["s"]
```

With no `Packable` instance, nothing converts the value, and with no hint the
runtime has no way to know it should have.

## Reproduce

`c.py`:

```python
def as_text(b):
    # only valid if the value really is `bytes`, as the module declares
    return b.decode("utf-8")
```

`ovr2.loc`:

```
module main (label)
import root-py
newtype Name a = Str
type Py => (Name a) = "bytes" a
source Py from "c.py" ("as_text" as label)
label :: Name Int -> Str
```

The parameter on the right of the per-language form is required: a type that
declares its own form must list every parameter (report 0052). Written without
it, as this report originally had it, the program is now rejected at the
declaration and the defect below is never reached.

```
$ morloc make -o ovr2 ovr2.loc
$ ./ovr2 label hi
Error: run failed
'str' object has no attribute 'decode'
```

Still reproduces as of 2026-09-05.

The type parameter is load-bearing for the repro only because it selects the
`AppF` code path; a zero-parameter `newtype Name = Str` takes the `VarF` path
and fails at build time instead (report 0012).

## Impact

This is the silent-wrong half of report 0012. 0012 refuses a program that
should work; this one accepts a program that is wrong, and the failure appears
inside the user's foreign function against a contract the module explicitly
declared. Any `newtype` over a primitive with a per-language override and no
`Packable` instance is affected.

It also constrains the fix for 0012: routing the leaf case through the wire
parent (as the `AppF` branch already does) must not be extended without also
deciding what to do when a per-language form is present.

## Guess

Unverified. `Serial.hs:721` classifies a leaf wire parent as `AliasIsOther`,
whose handler "deliberately drop[s] the outer fv: recurse on the expanded form
and let it find the Packable below". Dropping `fv` is right when the newtype
has no per-language form of its own -- it then *is* its parent -- but it also
discards a declared form when there is one. The list-shaped arm
(`AliasIsList`) keeps `fv` precisely so the hint survives, which is how
`numpy.ndarray` reaches the Python binder; the leaf arm has no equivalent, even
though `addHint` (`Serial.hs:294`) would emit `<bytes>s` happily.

## Partial fix, 2026-09-05

Half of this is fixed in the working tree alongside report 0012, and **not yet
committed** (`HEAD` is `7accdbfe`; the change is an uncommitted modification to
`library/Morloc/CodeGenerator/Serial.hs`).

`setSerialHead` now re-attaches the newtype's own name to the head of the
serializer built from its wire parent, so the declared form reaches the pool as
a schema hint. `addHint` already emitted hints for any non-builtin head,
including primitive leaves, so nothing else was needed:

```
mlc_schema_table = [ "s", "j", "<list>aj", "<list>a:3j"
, "<tuple>t2sj", "<tuple>t2js", "<pathlib.Path>s", "<bytes>s" ]
```

A declared form the binder knows now works with no `Packable`, in every nested
position -- `[Blob]`, `(Blob, Blob)`, `?Blob`, and record fields:

```
$ ./f_typeof blob hi
"bytes"
```

**What remains.** The hint only helps for forms the language binder was written
to construct. `data/lang/py/pymorloc.c` recognises exactly four:

| line | hint |
|---|---|
| 341 | `bytes` |
| 351, 489 | `bytearray` |
| 393 | `numpy.ndarray` |
| 467 | `list` |

Every other hint is ignored, and the value arrives in its wire form with no
error and nothing on stderr:

```
$ ./path_nopack f 'notes/report.txt'      # newtype Path = Str, type Py => Path = "pathlib.Path"
"str"
$ ./path_nopack f 'notes/report.txt' 2>&1 1>/dev/null
                                          # (nothing)
$ ./path_pack f 'notes/report.txt'        # the same, plus instance Packable Str Path
"PosixPath"
```

So the original complaint stands for any declared form outside that list: the
module says `pathlib.Path`, the pool gets a `str`, and the user's function
fails against a contract the compiler accepted. The set of silently-wrong
programs is much smaller than before -- it now requires a form the binder does
not support -- but it is not empty.

The compiler cannot know which hints a binder implements, so the fix is
probably to have each language declare its supported hints (the four above are
already a fixed list in one file) and reject a declared form outside that set
when no `Packable` bridges it.

## Resolution

Fixed in `morloc` commit `2fdbb3de`.

The guess above was right. Both alias-expansion arms recursed on the expanded
body and dropped the outer name, which is correct when a newtype simply is its
parent natively and wrong when it declares a native form of its own. The
serializer built from the parent now carries the newtype's name on its head, so
the concrete-type hint reaches the pool:

```
$ ./ovr2 label hi
"hi"
$ grep mlc_schema_table ovr2-build/pools/py/pool.py
mlc_schema_table = ["<bytes>s", "s"]
```

This also retired a guard added for report 0012. That fix routes a leaf wire
parent through the parent's serializer and was guarded to fire only for a type
declaring no form of its own, precisely to avoid widening this report into the
parameterless path. The guard existed only because expansion discarded the
declaration; removing it is what lets `newtype Bytes = Str` with a declared
`type Py => Bytes = "bytes"` build at all.

Covered by `bytesDecode` in `test-suite/golden-tests/newtype-wire-parent`.
