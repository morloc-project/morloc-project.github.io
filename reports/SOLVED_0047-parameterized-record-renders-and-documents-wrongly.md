# 0047: an applied parameterized record renders as `(Box a) Int`

- Status: fixed
- Found: 2026-09-03, speccing the named-type glossary for `--json-help`
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`record Box a where { it :: a }` applied to `Int` should render as `Box Int`.

## Observed

The applied type renders with a parenthesised head and a leaked parameter:

```
$ ./box takeInt -h
Positional arguments:
  1:  type: (Box a) Int

$ ./box --json-help | python3 -c "
import json,sys
for c in json.load(sys.stdin)['commands']:
    t=c['arguments'][0]['type']
    print('%-9s morloc=%-14r wire=%r' % (c['name'], t['morloc'], t['wire']))"
takeInt   morloc='(Box a) Int'  wire='m12itj'
takeStr   morloc='(Box a) Str'  wire='m12its'
```

The wire schemas are correct and distinct; only the rendered morloc type is
malformed.

## Reproduce

`box.py`:

```
def f(x):
    return 1
def g(x):
    return 1
```

`box.loc`:

```
module box (takeInt, takeStr)
import root-py

--' A box around anything
record Box a where
  it :: a

record Py => Box = "dict"

source Py from "box.py" ("f", "g")
f :: Box Int -> Int
g :: Box Str -> Int

--' Take a box of Int
takeInt :: Box Int -> Int
takeInt = f

--' Take a box of Str
takeStr :: Box Str -> Int
takeStr = g
```

Then `morloc make -o box box.loc` and the commands above.

## Impact

A parameterized type is unreadable wherever the CLI names it -- the help, the
machine-readable help, and the manifest all carry `(Box a) Int`. The wire form
is right, so this is presentation only, but it is the string a caller reads to
decide what to send.

## Guess

Unverified. The `NamT` reaching the manifest appears to carry its parameters
and its declared (unsubstituted) field types side by side, with nothing having
applied the former to the latter. The `(Box a) Int` rendering suggests the
applied type is `AppT (NamT ..) [Int]` -- the record head still generic and the
argument sitting outside it -- rather than a `NamT` whose parameters are bound.


## Note

An earlier revision of this report also called two other things defects: that
the field layout in the `Record Schemas:` block is unsubstituted (`it :: a`),
and that two commands taking `Box Int` and `Box Str` print the same block.
Both are correct behaviour. A named type's definition is generic -- one entry
per name, showing where each parameter goes -- because an applied definition
cannot be inverted: `Person Str = {name :: Str, job :: Str, city :: Str}` does
not say which field the parameter filled. The instance is recorded per use
site by that type object's own `wire` and `morloc` fields; the definition is
recorded once, generically. Only the applied rendering above is wrong.

## Resolution

Fixed in `morloc` commit `fc526c19`.

The guess in this report was right: the type reaching the manifest was an
application of the record's generic declaration to the argument,
`AppT (NamT Box [a] ...) [Int]`, with nothing having bound the one to the
other. Resolving the head of an application yields the declaration, and its
slots still held the parameters it was declared with.

The arguments are now bound into those slots, so an applied record renders as
it was written:

```
$ ./box takeInt -h
Positional arguments:
  1:  type: Box Int
```

and `--json-help` agrees, with the wire schemas still distinct per instance:

```
takeInt morloc=Box Int wire=m12itj
takeStr morloc=Box Str wire=m12its
```

The field layout is deliberately left generic, which is what this report's own
Note concluded is correct: the definition is emitted once per name and shows
where each parameter goes, and an applied definition cannot be inverted. The
`Record Schemas:` block therefore still reads `it :: a`.

Covered by `test-suite/golden-tests/parameterized-record-render`, which pins
the rendered type, the per-instance wire schemas, the generic definition block,
and that both commands still run.

## Still open, split out

The glossary entry for a parameterized type reports `"parameters": []`, so
nothing says that the `a` in the field layout is a parameter rather than a
concrete type. That undercuts the reasoning for keeping the definition generic
and is filed as report 0061.
