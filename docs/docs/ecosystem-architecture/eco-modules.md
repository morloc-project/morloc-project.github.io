# 11.6. Module resolution

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-modules.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-remote.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md

> A Morloc program is assembled from modules: its own source files and modules installed into the Morloc state. This section specifies how the compiler finds the file an `import` names, how a module is identified and installed, how versions are pinned, and how a module declares the foreign packages it needs. The install-string syntax is given in [Installing modules](https://morloc-project.github.io/docs/modules/installing-modules.md).

## 11.6.1. Finding a module

An import names a module by dotted path. A leading dot makes it **local**: `import .foo.bar` is looked up only under the **project root**, the directory of the file being compiled, as `foo/bar.loc` and then `foo/bar/main.loc`. A program read from standard input has no project root and may not use local imports, and neither may an eval expression ([Serving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-serving.md)).

Without the leading dot the import names an installed module. Installed modules belong to **libraries**: `import bits` is the standard library’s `bits`, and `import weena/bits` is module `bits` of library `weena`. Each names exactly one place in the environment’s module plane:

1.  `import bits` is `<plane>/std/bits/main.loc`
2.  `import weena/bits` is `<plane>/weena/bits/main.loc`
3.  `import weena/bits.extra` is `<plane>/weena/bits/extra.loc` or `<plane>/weena/bits/extra/main.loc`

There is no other search path. `import std/bits` is an error: a standard-library module has one spelling. A local file of the same name is never used. A bare import that matches nothing is an error. When a local file of that name exists, the error names it and says to write `import .foo.bar`, and `morloc make` does not download a package of that name in its place. Otherwise the error names the path and suggests `morloc install`.

The last three components of a matched path must have the exact spelling of the import, so a module resolves the same way on case-insensitive and case-sensitive file systems.

A file may declare several modules. An import reaches the one named by its last component (or the file’s only module when it has no header); the others are local modules of the same package, imported as `.name`.

## 11.6.2. Identity

A module is a directory. Its entry file is `main.loc`, or its only `.loc` file. The entry file declares exactly one named module, and that name must equal the module’s `name`. An installed module is identified by its `library` and `name`, both given in its `package.yaml` and never taken from a directory or repository name; its repository must be named after it. Library and module names are lower-case ASCII letters, digits and `-`, beginning with a letter. `std` is reserved for the standard library.

A module’s metadata is the `package.yaml` beside its entry file. The fields the ecosystem reads:

| Field | Meaning |
| --- | --- |
| `name` | The module’s name. Required to install. |
| `library` | The library the module belongs to, e.g. `std`, `bio` or a GitHub user name. Required to install. |
| `version` | The module’s own version. |
| `morloc-version` | The range of compiler versions the module accepts. A compiler outside it refuses to load the module. |
| `morloc-deps` | Pins for imported modules: each a `name`, a `library` (default `std`), a git hash and optionally a `source` such as `github:weena/bits`. |
| `py-deps`, `r-deps`, `cpp-deps`, `rust-deps` | Foreign packages, each with a version constraint and a source ([Dependencies (`py-deps`)](https://morloc-project.github.io/docs/languages/python.md#py-deps)). A `cpp-deps` entry may also name its headers and link names ([C++](https://morloc-project.github.io/docs/languages/cpp.md)). |
| `tool-deps` | conda packages whose executables the module runs as programs, whatever its languages, optionally naming those executables ([Command-line tools (`tool-deps`)](https://morloc-project.github.io/docs/apis/deploy-dependencies.md#tool-deps)). |
| `local-deps` | Packages kept inside the project tree ([Local packages (`local-deps`)](https://morloc-project.github.io/docs/languages/python.md#local-deps)). Allowed only in the program being built, not in an imported module. |
| `lang-versions` | Constraints on the language runtimes themselves. |
| `expose` | Files copied where foreign code can include or import them ([Exposing native resources](https://morloc-project.github.io/docs/modules/exposing-native-resources.md)). |
| `setup` | A script run after the module is installed. |

## 11.6.3. Installing

`morloc install` fetches a module into `<plane>/<library>/<name>` in the Morloc state. The module is named in one of three ways:

-   `bits` or `weena/bits`: fetched from the library’s **origin**;
-   `github:weena/bits`: fetched from that repository;
-   a path starting with `.`, `/` or `~`: copied from a local directory.

Every library has one origin, a host and an owner such as `github:weena`; module `bits` of the library lives at `github:weena/bits`. The origins of `std` (`github:morloclib`) and `bio` (`github:morloc-bio`) ship with morloc and cannot be changed. Installing `github:weena/bits` whose `package.yaml` says `library: weena` records `weena` as coming from `github:weena`, first come, first served; a library named other than its owner is recorded with `morloc library add <library> <host:owner>`, and `morloc library list` shows them all. A package fetched from anywhere but its library’s origin is refused. A local install records nothing.

Each install:

1.  takes a lock for that module, so two installs of one module never interleave;
2.  fetches into a temporary directory beside the destination;
3.  checks that the fetched `package.yaml` gives the expected library and name, that the entry file declares that name, and that its `morloc-version` admits this compiler;
4.  replaces the previous copy in one rename, so a failed install leaves the old one intact;
5.  installs every module that the entry file and the local modules it reaches import, when not already present, the same way;
6.  copies its `expose` files and runs its `setup` script, with the module’s library, name, version and directory in the environment;
7.  typechecks it, unless told not to;
8.  writes a record of the install: library, name, version, source and pinned hash.

A module that is already installed is left alone unless the install is forced. `morloc make` installs missing imports the same way before it compiles.

**Pins.** A pin fixes an imported module to a git hash. Pins come from the `morloc-deps` of the modules being installed (a pin closer to the program wins; two different pins at the same depth are an error) and from snapshot files in the state, whose lines are `name hash` for the standard library and `library/name hash [host:owner/name]` otherwise; the source is required for a library that does not ship with morloc. A pin’s `source` names where to fetch one module without recording an origin, so a module of a single repository can be a dependency with no setup; a source that disagrees with a recorded origin is an error. An installed module whose recorded hash differs from its pin is an error until it is reinstalled.

## 11.6.4. Foreign dependencies

The compiler gathers the foreign requirements of a program from every module it imports, transitively, and writes them beside the manifest as `envspec.json`. Constraints on one package from several modules are combined (all must hold), the C++ standard is the highest any module asks for, and two modules naming different conda channels for one package is an error, whether they request it as a language package or as a tool. The file also lists the program’s languages, the tools it runs (conda packages whose executables it calls, whatever its languages) and its system libraries. `morloc envspec` writes the same document without building. How the document is solved is specified in [Environment solving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md).
