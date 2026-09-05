# 0002: the getting-started "language-agnostic units" example imports the wrong file

- Status: fixed (documentation defect)
- Found: 2026-09-02, while testing the getting-started examples verbatim
- Component: docs
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/getting-started.asc` walks the reader through:

1. `units.loc` -- a module named `units` that sources C++ from `units.hpp`
2. `units2.loc` -- also declaring `module units`, but language-agnostic
   (`import root`, no `source`)
3. `main.loc` -- `import .units` plus `import root-cpp`

The narrative says the agnostic module "cannot directly be compiled", and that
`main.loc` supplies implementations by importing `root-cpp`.

## Observed

`import .units` is a relative *path* import, so it resolves to `units.loc` --
the C++ version from step 1, which was already complete. `units2.loc` is never
read. The build succeeds, but for the wrong reason, and the lesson the section
exists to teach is not demonstrated.

Confirmed by the C++ include path in the build command: it points at the
project directory holding `units.hpp`, i.e. the sourced C++ module was used.

```
$ morloc make main.loc
...
$ ${CXX:-g++} -O2 -o pools/cpp/pool-cpp.out ... -I<projectdir>
```

Two files also declare `module units` in the same directory, which is confusing
in its own right.

## Reproduce

Follow "Unit conversion example" -> "Defining language-agnostic functions" in
`getting-started.asc` exactly as written.

## Impact

The reader's takeaway is that `import root-cpp` is what made an abstract module
concrete. It was not. Anyone who later removes `units.loc` and expects
`units2.loc` to take over will get a different result and no idea why.

## Resolution

Fixed in `morloc-project.github.io`, `src/content/getting-started.asc`.

The agnostic module now has a distinct name and file -- `units-abstract.loc`
declaring `module unitsAbstract` -- and the consumer is `convert.loc` doing
`import .units-abstract` plus `import root-cpp`. Verified on morloc 0.100.2 that
`morloc typecheck units-abstract.loc` reports both signatures, `morloc make
units-abstract.loc` fails with "No implementation found for '+'", and
`morloc make convert.loc && ./convert cels2fahr 100` prints `212` with a compile
line that includes `root-cpp` rather than the project directory. Swapping
`root-cpp` for `root-py` builds a `py` pool from the same abstract module.

The same pass corrected a second error in the section: the console block after
the Python swap listed `convert-py-build/pools/`. The build directory is keyed
on the source basename, so it is `convert-build/` in both cases.
