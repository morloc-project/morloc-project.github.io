# 0046: a type alias nested inside a compound type is not resolved for the CLI

- Status: fixed
- Found: 2026-09-03, while demoing the fix for reports/0026
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

A CLI describes the boundary, so a transparent alias is resolved to the shape a
caller must supply or will receive: `type Path = Str` reports as `Str`, because
`Path` names a concept and `Str` names what to type. `morloc` commit `cea795b6`
made argument and return positions agree on this (`reports/SOLVED_0026`).

Resolution should not depend on how deeply the alias is nested. `[(Path, Path)]`
tells a caller no more than `Path` alone did.

## Observed

Only an alias at the head of the type is resolved. Nested ones survive, in both
argument and return position:

```
$ cat n.loc
module n (f)
import root-py

--' A filesystem path
type Path = Str

--' Take and return nested aliases
f :: [(Path, Path)] -> [(Path, Path)]
f x = x

$ morloc make -o n n.loc
$ ./n f -h
Take and return nested aliases

Usage: ./n <nexus_options> @ <command_options>
...
Positional arguments:
  1:  type: [(Path, Path)]

Return: [(Path, Path)]
```

A bare `Path` in either position resolves correctly, so the two behaviours sit
side by side in one signature:

```
f :: Path -> [(Path, Path)]     ->     1:  type: Str
                                       Return: [(Path, Path)]
```

## Reproduce

The file above, from an empty directory.

## Impact

Low but sharp-edged: the resolution rule looks arbitrary from outside, and the
deeper the type the more likely the alias is the only name a caller sees. It
also leaks into `--json-help`, where `type.morloc` for a nested alias is a name
no consumer can resolve.

## Guess

Unverified. `reduceArgDoc` (`library/Morloc/CodeGenerator/Docstrings.hs`) walks
an alias chain only at the head of the type -- it matches `VarT v` and `NamT`
and passes everything else through unchanged, so an alias under an `AppT` is
never visited. Docstring inheritance deliberately stops at a nominal boundary,
but type *resolution* has no reason to; the two may want separating.

## Resolution

Fixed in `morloc` commit `7accdbfe`, which reworked Packable resolution and
introduced the type glossary the CLI names. Resolution is no longer done by
walking an alias chain at the head of the type; a recursive pass rewrites
aliases wherever they appear, so nesting depth is irrelevant.

Verified on that build, from the report's own file and from a wider one:

```
f :: [(Path, Path)] -> [(Path, Path)]   ->  1: type: [(Str, Str)]   Return: [(Str, Str)]
a :: [[(Path, Count)]] -> [[(Path, Count)]] -> 1: type: [[(Str, Int)]]  Return: [[(Str, Int)]]
b :: [Pair] -> [Pair]                   ->  1: type: [(Str, Str)]   Return: [(Str, Str)]
```

where `type Pair = (Path, Path)` is an alias of aliases, so a chain nested
inside a compound resolves too. `--json-help` agrees: `type.morloc` reads
`[[(Str, Int)]]` and `[(Str, Str)]` for the same commands, so the leak into the
machine-readable surface is closed as well.

No separate change was needed and no test was added here; the fix arrived with
that commit's own coverage.
