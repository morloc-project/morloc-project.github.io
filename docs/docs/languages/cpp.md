# 11.2. C++

Morloc Manual > Language Support | https://morloc-project.github.io/docs/languages/cpp.html | prev: https://morloc-project.github.io/docs/languages/build-parameters.md | next: https://morloc-project.github.io/docs/languages/python.md

C++ has no language-level package manager, so a C++ pool’s dependencies are external **system libraries**: the environment provisions the library (its headers and shared objects) and the pool links against it.

## 11.2.1. Library dependencies (`cpp-deps`)

Declare the libraries a module needs in its `package.yaml` under `cpp-deps`, using `package: version-constraint`:

```yaml
cpp-deps:
  boost: ">=1.80"
```

`cpp-deps` are provisioned from the [conda-forge](https://conda-forge.org/) package database — installing the library’s headers and shared objects into the environment. `conda` is the default (and only) source, so the bare form above is equivalent to `boost: {version: ">=1.80", source: conda}`. The compiler takes the union across every imported module and the solver intersects conflicting constraints.

A `cpp-deps` entry may also name a conda `channel` other than conda-forge (see the Python chapter for the full rules), for a library that lives on a subordinate channel.

## 11.2.2. Link flags (`dependencies`)

Provisioning a library makes its headers available, but linking against a compiled component also needs a linker flag. List the link names under `dependencies` (a bare list); each entry `foo` becomes `-lfoo` on the pool’s compile line:

```yaml
cpp-deps:
  boost: ">=1.80"
dependencies:
  - boost_filesystem
  - boost_system
```

A header-only library (or a header-only part of a larger one) needs only `cpp-deps` and no `-l` flag. For any other compiler flags — extra include paths, `-DFOO`, `-O3`, `-march=native` — use `cxx-flags`, a bare list appended verbatim to the compile line. All three fields propagate transitively through a module’s dependencies.

The `local-deps` section that Python and Rust use for in-project packages ([Local packages (`local-deps`)](https://morloc-project.github.io/docs/languages/python.md#local-deps)) is not available for C++, which has no package manager to track such an install; a library you build yourself is linked through `dependencies` and `cxx-flags` like any other.
