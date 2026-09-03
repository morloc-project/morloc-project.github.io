# 0010: the `interface-install.asc` examples use an effect `Rand` that does not exist

- Status: open
- Found: 2026-09-02, while writing the mim tutorials (morloc-manager)
- Component: docs
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/interface-install.asc` presents `fate.loc`, `tavern.loc`, and
`combat.loc` as complete, installable modules -- the reader is told to run
`morloc install --build ./fate`. They should compile.

## Observed

Ten signatures across that file annotate the effect `<Rand>`
(`interface-install.asc:31,34,37,86,90,106,116,120,122,138`). No module
declares an effect by that name. The stdlib declares three: `IO` and
`escapable Err` in `internal`, and `escapable Random` in `random`.

Building any of them fails at the first annotated signature:

```
dnd.loc:7:1: error:
Undeclared effect 'Rand'. Declare it with `effect Rand` (or `escapable effect Rand`) and import it.
  |
7 | roll :: Int -> Int -> <Rand> [Int]
  | ^
```

## Reproduce

From an empty directory, with the same imports `fate.loc` uses:

```
$ printf 'import random\ndef roll(n, d):\n    return [random.randint(1, d) for _ in range(n)]\n' > fate.py
$ printf 'module fate (roll)\n\nimport root-py\n\nsource Py from "fate.py" ("roll")\n\nroll :: Int -> Int -> <Rand> [Int]\n' > fate.loc
$ morloc make fate.loc
```

## Impact

Every example in the "Search and install" section is uncompilable as written,
and the section's whole point is that the reader install and run them. The fix
is mechanical -- `import random` and `<Random>` -- but it must be applied to
all ten signatures plus the imports of the three modules.

`features-effects.asc` also writes `<Rand>` (four times), but there the
snippets are illustrative fragments in a section that explicitly teaches
`effect <name>` declarations, so they read correctly. Only
`interface-install.asc` claims to be runnable.

## Guess

Unverified: `Rand` looks like the effect's older name. Worth grepping the
compiler history for the rename to `Random` and checking whether anything else
in the corpus still says `Rand`.
