# 11.6. Module resolution

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-modules.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-remote.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md

> A Morloc program is assembled from modules: its own source files and modules installed into the Morloc state. This section specifies how the compiler finds the file an `import` names, how a module is identified and installed, how versions are pinned, and how a module declares the foreign packages it needs. The install-string syntax is given in [Installing modules](https://morloc-project.github.io/docs/modules/installing-modules.md).

## 11.6.1. Finding a module

An import names a module by dotted path. A leading dot makes it **local**: `import .foo.bar` is looked up only under the **project root**, the directory of the file being compiled, as `foo/bar.loc` and then `foo/bar/main.loc`. A program read from standard input has no project root and may not use local imports, and neither may an eval expression ([Serving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-serving.md)).

Without the leading dot the import is **bare**, and it names an installed module only. The search covers the installed modules of the active **plane** (a named namespace of installed modules; `default` unless configured), its core subdirectory (`morloclib`) first:

1.  `<plane>/morloclib/foo/bar/main.loc`
2.  `<plane>/morloclib/foo/bar.loc`
3.  `<plane>/foo/bar.loc`
4.  `<plane>/foo/bar/main.loc`
5.  the same two forms directly under the module tree, outside any plane

The first candidate that exists is taken; a local file of the same name is never used. A bare import that matches nothing is an error. When a local file of that name exists, the error names it and says to write `import .foo.bar`, and `morloc make` does not download a registry package of that name in its place. Otherwise the error lists every path tried and suggests `morloc install`.

A module named `owner/name` searches only the plane: `owner/name/main.loc`, `owner/name.loc`, then `name/main.loc` and `name.loc`.

The last three components of a matched path must have the exact spelling of the import, so a module resolves the same way on case-insensitive and case-sensitive file systems.

## 11.6.2. Identity

A module is a directory. Its entry file is `main.loc`, or its only `.loc` file. The entry file declares exactly one named module, and that name must equal the directory’s name (for an installed module, the repository’s name). A name is ASCII letters, digits and `-`, beginning with a letter or digit.

A module’s metadata is the `package.yaml` beside its entry file. The fields the ecosystem reads:

| Field | Meaning |
| --- | --- |
| `version` | The module’s own version. |
| `morloc-version` | The range of compiler versions the module accepts. A compiler outside it refuses to load the module. |
| `morloc-deps` | Pins for imported modules, each a name and a git hash. |
| `py-deps`, `r-deps`, `cpp-deps`, `rust-deps` | Foreign packages, each with a version constraint and a source ([Dependencies (`py-deps`)](https://morloc-project.github.io/docs/languages/python.md#py-deps)). |
| `tool-deps` | conda packages whose executables the module runs as programs, whatever its languages ([Command-line tools (`tool-deps`)](https://morloc-project.github.io/docs/apis/deploy-dependencies.md#tool-deps)). |
| `local-deps` | Packages kept inside the project tree ([Local packages (`local-deps`)](https://morloc-project.github.io/docs/languages/python.md#local-deps)). Allowed only in the program being built, not in an imported module. |
| `lang-versions` | Constraints on the language runtimes themselves. |
| `dependencies` | System libraries. |
| `expose` | Files copied where foreign code can include or import them ([Exposing native resources](https://morloc-project.github.io/docs/modules/exposing-native-resources.md)). |
| `setup` | A script run after the module is installed. |

## 11.6.3. Installing

`morloc install` fetches a module into `<plane>/<name>` in the Morloc state. Each install:

1.  takes a lock for that module name, so two installs of one module never interleave;
2.  fetches into a temporary directory beside the destination;
3.  checks that the module’s declared name matches and that its `morloc-version` admits this compiler;
4.  replaces the previous copy in one rename, so a failed install leaves the old one intact;
5.  installs every module it imports that is not already present, the same way;
6.  copies its `expose` files and runs its `setup` script, with the module’s name, version and directory in the environment;
7.  typechecks it, unless told not to;
8.  writes a record of the install: name, version, source and pinned hash.

A module that is already installed is left alone unless the install is forced. `morloc make` installs missing imports the same way before it compiles.

**Pins.** A pin fixes an imported module to a git hash. Pins come from the `morloc-deps` of the modules being installed (a pin closer to the program wins; two different pins at the same depth are an error) and from snapshot files in the state, which list `name hash` pairs for a whole installation. An installed module whose recorded hash differs from its pin is an error until it is reinstalled.

## 11.6.4. Foreign dependencies

The compiler gathers the foreign requirements of a program from every module it imports, transitively, and writes them beside the manifest as `envspec.json`. Constraints on one package from several modules are combined (all must hold), the C++ standard is the highest any module asks for, and two modules naming different conda channels for one package is an error, whether they request it as a language package or as a tool. The file also lists the program’s languages, the tools it runs (conda packages whose executables it calls, whatever its languages) and its system libraries. `morloc envspec` writes the same document without building. How the document is solved is specified in [Environment solving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md).
