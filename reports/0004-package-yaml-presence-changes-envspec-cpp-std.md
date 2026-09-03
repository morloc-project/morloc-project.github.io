# 0004: adding a `package.yaml` silently drops `std` from the emitted envspec

- Status: open
- Found: 2026-09-02, while writing the mim development tutorial (morloc-manager)
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`package.yaml` is optional metadata. Creating one with `morloc new` and leaving
`cpp-version` unset should not change what the compiler reports about the
program's C++ requirements.

## Observed

The same program emits a different `envspec.json` depending on whether a
`package.yaml` exists at all:

```
$ ls
dice.R  dice.hpp  dice.py  dnd.loc
$ morloc envspec dnd.loc
{... "languages":[{"lang":"r"},{"lang":"cpp","std":"c++20"},{"lang":"py"}] ...}

$ morloc new dnd
Created package.yaml for 'dnd'
$ morloc envspec dnd.loc
{... "languages":[{"lang":"r"},{"lang":"cpp"},{"lang":"py"}] ...}
```

The `"std":"c++20"` entry disappears. Adding `cpp-version: 20` to the
`package.yaml` brings it back.

## Reproduce

Any program with a `source Cpp` declaration:

```
$ printf 'module m (f)\nsource Cpp from "f.hpp" ("f")\nf :: Int -> Int\n' > m.loc
$ printf '#pragma once\nint f(int x){return x;}\n' > f.hpp
$ morloc envspec m.loc | grep -o '"lang":"cpp"[^}]*'
$ morloc new m && morloc envspec m.loc | grep -o '"lang":"cpp"[^}]*'
```

## Impact

Low today: `morloc-deps` parses `LangReq.std` (`morloc-deps/src/envspec.rs:57`)
but nothing consumes it, and the actual compile line is unaffected --
`gccVersionFlag` maps anything at or below 20 to `-std=c++20`. The bug matters
the moment the solver starts honoring `std` to choose a compiler, at which
point "did this project happen to have a package.yaml" would silently decide
the C++ standard.

## Guess

Unverified, but it looks like a straight divergence between two defaults for
the same field:

- `Defaultable PackageMeta` (used when no `package.yaml` is found) sets
  `packageCppVersion = 20` -- `library/Morloc/Namespace/State.hs:935`
- `FromJSON PackageMeta` uses `o .:? "cpp-version" .!= 0` -- same file, ~line 1000

and `EnvSpec.hs` then emits `std` only when `cppVer > 0`. The two defaults
should agree; 20 is presumably the intended one.
