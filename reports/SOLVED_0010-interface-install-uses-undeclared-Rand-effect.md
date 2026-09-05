# 0010: the `interface-install.asc` examples use an effect `Rand` that does not exist

- Status: fixed
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

## Resolution

Fixed in `morloc-project.github.io`, `src/content/interface-install.asc`.

All ten signatures now annotate `<Random>`, the effect the stdlib's `random`
module declares, and `fate.loc` imports `random`. Verified on morloc 0.100.2 by
building all three modules: `fate` installs with `morloc install ./fate` and
`fate roll 3 8` rolls; `tavern` builds against the installed module and
`randomClass` / `randomRace` return values; `combat` builds across Python and R
and `rollAdv`, `fighterDamage 15` and `intro "goblin"` all run.

One detail differs from this report's guess about the size of the fix: only
`fate.loc` needs `import random`. An effect name reaches `tavern` and `combat`
transitively through `import fate (...)`, so those two modules needed the
rename alone.

Unrelated and left alone: `morloc make` warns "skipping generic export
'choose'" because `choose :: [a] -> <Random> a` is polymorphic and so has no
CLI form. The module still installs and `tavern` imports `choose` normally,
which is all this section asks of it.
