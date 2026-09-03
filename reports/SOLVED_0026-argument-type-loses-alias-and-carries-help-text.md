# 0026: argument types drop their alias and carry help prose into the machine-readable type field

- Status: fixed
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

Two things, one per half of this report.

1. A type alias used in an argument position should be reported by the name the
   author wrote, the way the return position already does.
2. `--json-help` is documented as "a machine-readable JSON description of every
   command (arguments, types, CLI shape, return)". Its `type.morloc` field
   should hold a type, and the CLI shape belongs in the `input` block that sits
   right beside it.

## Observed

```
$ cat a.loc
module a (f)
import root-py

--' A filesystem path
type Path = Str

--' A count of things
type Count = Int

--' Take a path and a count
f :: Path -> Count -> Count
f _ c = c

$ morloc make -o a a.loc
$ ./a f -h
...
Positional arguments:
  1:  A filesystem path
      type: Str    (literal string)
  2:  A count of things
      type: Int

Return: Count
  A count of things
```

`Path` and `Count` survive in the return line and vanish in the argument
lines. The docstrings attached to the aliases are inherited correctly, so the
help says "A filesystem path" about something it calls `Str`.

The same string reaches the machine surface verbatim, four spaces and all:

```
$ ./a --json-help | python3 -c "import json,sys;d=json.load(sys.stdin);print([(a['name'],a['type']['morloc']) for c in d['commands'] for a in c['arguments']])"
[('arg0', 'Str    (literal string)'), ('arg1', 'Int')]
```

and the manifest carries it too (`a-build/manifest.json`, `args[0].type`). A
consumer that wants the type has to strip a parenthetical whose vocabulary is
undocumented (`(literal string)`, `(a filename)`).

## Reproduce

The file above, from an empty directory.

## Impact

The first half makes the help contradict itself on any program that names its
types, which is the style the manual teaches. The second half means the one
surface advertised as machine-readable cannot be parsed as types without a
special case; the information it encodes is already present, structurally, in
the sibling `input.source` / `input.checks` fields.

## Guess

Unverified. `typeDescStr` (`library/Morloc/CodeGenerator/Nexus.hs:1821`) builds
`"Str    (literal string)"` / `"Str    (a filename)"` for every non-literal
`Str` argument, and its caller feeds the result to the manifest `type` slot
that both `--help` and `--json-help` read. The alias loss looks separate: the
argument type appears to be evaluated before rendering while the return type is
not.

## Resolution

Fixed in `morloc` commit `cea795b6`.

Half of this report was wrong and is withdrawn: resolving a transparent alias
in argument position is correct, because an alias names a concept and the CLI
must name a shape. `type PersonName = (Str, Str)` and `type PersonName = Str`
are indistinguishable by name and completely different to type.

What was real, and is fixed:

* The `type` slot no longer carries help prose. `Str    (literal string)` is
  now `Str`, in `--help`, in `--json-help`, and in the manifest.
* The reading it used to encode moved to the `format` slot, which is now
  emitted for every `Str` argument rather than only for ones with a modifier
  -- so the absence of a format line no longer has to be interpreted. On a
  path argument the parenthetical had been duplicating the format line
  outright.
* Return types now resolve aliases the way argument types already did, so the
  two positions agree.

Still open, deliberately: the aliased source-level type is now absent from
every surface. Publishing it beside the resolved type under its own key is a
manifest schema addition rather than a correction, and is tracked with
`reports/0038`.
