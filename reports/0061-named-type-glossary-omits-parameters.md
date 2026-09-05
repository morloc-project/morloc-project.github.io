# 0061: the `--json-help` type glossary reports no parameters for a parameterized type

- Status: open
- Found: 2026-09-05, while fixing reports/0047 (applied parameterized record renders wrongly)
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`--json-help` carries a `types` glossary defining each named type a signature
mentions. A definition is generic by design -- it is emitted once per name and
shows where each parameter goes -- which is exactly why report 0047 concluded
the generic field layout is correct. That reasoning only holds if the entry
says which names in the layout are parameters.

## Observed

`parameters` is always the empty array, including for a type whose fields
refer to a parameter:

```
$ ./box --json-help | python3 -c "import json,sys;print(json.load(sys.stdin)['types'])"
[{'name': 'Box', 'kind': 'record', 'parameters': [], 'fields': [{'key': 'it', 'type': 'a'}]}]
```

from

```morloc
--' A box around anything
record Box a where
  it :: a
```

A consumer reading this sees a field of type `a` and no way to tell that `a` is
`Box`'s parameter rather than a concrete type named `a`. The per-use-site type
does say `Box Int`, but nothing connects the `Int` to the `a`.

## Reproduce

The `box.loc` from `test-suite/golden-tests/parameterized-record-render`, then
the command above.

## Impact

Confined to the machine-readable surface and to parameterized named types,
which are rare in a CLI signature today. It matters for anything generating
bindings or documentation from `--json-help`, which is the reason the glossary
exists.

The human-readable `Record Schemas:` block has the same gap: it prints
`Box` and `it :: a` with no parameter list.

## Guess

Unverified. The glossary builder emits `("parameters", jsonArr [])` as a
literal in `namedTypesJson` (`library/Morloc/CodeGenerator/Nexus.hs`). The
parameter names are available -- they are the slots of the declaration's
`NamT`, which the same function already walks -- so this looks like a field
that was stubbed and never filled rather than one that is hard to compute.

Note the fix for 0047 binds a use site's arguments into that slot, so the
declaration's own parameter names must be read from the typedef rather than
from the applied type reaching the glossary.
