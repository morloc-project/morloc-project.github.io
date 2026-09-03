# 0038: `--json-help` advertises a wire schema that changes with the pool language

- Status: open
- Found: 2026-09-03, reanalysing reports/0026 and 0028
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`--json-help` is the machine-readable description of a program's command line
interface. Its `type.wire` field is the only place that describes the
serialization form of an argument or result, so a consumer reads it as the data
contract. That contract is a property of the interface, and should not move
when an implementation detail moves.

## Observed

Adding a language binding that does not change what the CLI accepts or emits
changes the advertised schema.

```
$ cat with_py.loc
module w (points)
import root-py
record Point where
  x :: Int
  y :: Int
record Py => Point = "dict"
source Py from "w.py" ("mk")
mk :: Int -> [Point]
--' Make n points
points :: Int -> [Point]
points = mk

$ sed '/record Py => Point/d' with_py.loc > without_py.loc
$ morloc make -o wp with_py.loc && morloc make -o wo without_py.loc

$ ./wp --json-help | python3 -c "import json,sys;print(json.load(sys.stdin)['commands'][0]['return']['type']['wire'])"
a<dict>m21xj1yj
$ ./wo --json-help | python3 -c "import json,sys;print(json.load(sys.stdin)['commands'][0]['return']['type']['wire'])"
a<Point>m21xj1yj
```

`<dict>` is the Python container named by `record Py => Point = "dict"`;
`<Point>` is the morloc constructor used when no binding is declared. The two
programs have identical command lines and produce identical JSON.

`w.py`:

```
def mk(n):
    return [{"x": i, "y": i * i} for i in range(n)]
```

## Impact

A tool that keys off `type.wire` -- to decide whether two commands can be piped
together, or to cache a schema -- gets an answer that depends on which language
the module happened to be implemented in. Recompiling the same interface
against a different `root-*` would change the published contract without
changing the interface.

This is the same confusion as `reports/0031`, seen from the other side: there,
a stdin reader compares concrete schemas and rejects bytes a file reader
accepts. Here, the concrete schema is published as though it were the general
one.

## Guess

Unverified. `--json-help` appears to emit the concrete (pool-resolved) schema
because that is what the manifest already carries for dispatch. The general
schema is the one that belongs in an interface description; both may be worth
carrying, under distinct names.
