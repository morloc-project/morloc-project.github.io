# 0053: a Packable whose wire form is a record crashes the compiler

- Status: fixed
- Found: 2026-09-04, surveying the Packable surface for reports 0048-0050
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`instance Packable Pair (Box a)`, where `Pair` is a record, gives `Box a` the
wire form of that record. Records are a wire form like any other, so this either
compiles or is refused with a diagnostic.

## Observed

The compiler aborts with an uncaught Haskell `error` and a call stack:

```
$ morloc make -o q2 q2.loc
morloc: (VarU (TV {unTVar = "Pair"}),NamU NamRecord (TV {unTVar = "Pair"}) [] [(Key {unKey = "left"},VarU (TV {unTVar = "int"})),(Key {unKey = "right"},VarU (TV {unTVar = "str"}))])
CallStack (from HasCallStack):
  error, called at library/Morloc/CodeGenerator/Serial.hs:1085:20 in morloc-0.100.2:Morloc.CodeGenerator.Serial
```

There is no source location, no message, and no indication of what in the
program caused it. Deterministic across runs.

## Reproduce

```
module q2 (howRec)
import root-py
record Pair = Pair {left :: Int, right :: Str}
newtype Box a
type Py => (Box a) = "dict" a
instance Packable Pair (Box a) where
  source Py from "b.py" ("pack_rec" as pack, "unpack_rec" as unpack)
source Py from "b.py" ("how" as how)
how :: Box a -> Str
howRec :: Box Int -> Str
howRec = how
```

`b.py`:

```python
def pack_rec(r):   return {"v": [r["left"]], "how": "rec"}
def unpack_rec(d): return {"left": d["v"][0], "right": d["how"]}
def how(d):        return d["how"]
```

A single instance is enough; this does not involve instance selection.

## Impact

An uncaught `error` is the worst available failure mode: no source location, no
recoverable message, and a Haskell call stack presented to a morloc user. The
program that triggers it is ordinary -- a record is a supported wire form, and
a Packable is the mechanism for giving a type one.

Record wire forms appear reachable only through `Packable`; a list, tuple, or
primitive wire form on the same declaration compiles and runs. So the crash is
not a corner of records, it is the whole intersection of records and Packable.

## Guess

Unverified.

`weaveTypeF` (`Serial.hs:1085`) ends in a catch-all that is an `error`, not a
`MorlocError`:

```haskell
weaveTypeF gt ct = error . show $ (gt, ct)
```

The pair it is handed is a general type that is still the record's *name*
(`VarU "Pair"`) and a concrete type that has already been expanded to the record
body (`NamU NamRecord "Pair" [...]`). The two sides are at different stages of
alias expansion, and `weaveTypeF` has no case pairing a name with its expansion.

Two things to fix, and they are independent. The missing case is one. The other
is that this catch-all should raise a `MorlocError` carrying the manifold index,
so that whatever else reaches it in future arrives as a located compiler error
rather than as a crash -- `makeSerialAST'` already has an index in scope and
ends its own dispatch with `MM.throwSourcedError`.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

The crash was not in `weaveTypeF`. The two sides arrived at different stages of
expansion: the general type was still the record's name while the concrete type
had already been expanded to the record body, and no case pairs a name with its
own expansion.

A Packable's wire form is written as whatever the instance wrote, so a record
wire form arrives as the record's name, while `inferConcreteTypeU` resolves the
concrete side to the body. Evaluating the general wire form through the general
scope before weaving puts both sides at the same stage, and the existing
`NamU`/`NamU` case then applies.

Covered by `test-suite/golden-tests/packable-record-wire-form`.
