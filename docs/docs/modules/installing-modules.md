# 7.1. Installing modules

Morloc Manual > Modules and Libraries | https://morloc-project.github.io/docs/modules/installing-modules.html | prev: https://morloc-project.github.io/docs/modules/index.md | next: https://morloc-project.github.io/docs/modules/universal-library.md

Every installed module belongs to a **library**. The standard library, `std`, is hosted on GitHub under the [morloclib](https://github.com/morloclib) organization, and the bioinformatics library, `bio`, under [morloc-bio](https://github.com/morloc-bio). A module you publish yourself belongs to a library you name, usually your GitHub user name. Modules are installed with the `morloc install` command:

```console
$ morloc install internal
$ morloc install root
$ morloc install root-cpp
$ morloc install root-py
$ morloc install root-r
```

The positional arguments to `morloc install` are **install strings**. Each describes one module to install and optionally pins it to a specific commit, branch, or release tag. More than one install string may be passed in a single invocation, in which case each is installed in turn (any transitive dependencies are also installed automatically).

```text
INSTALL  := TARGET [ "@" [FORM ":"] REF ]
TARGET   := <name>                    # a standard library module
          | <library>/<name>          # a module of a known library
          | REMOTE ":" <owner>/<repo> # a repository on a host
          | <local-path>              # must start with '.', '/', or '~'
REMOTE   := "github" | "gitlab" | "bitbucket" | "codeberg" | "azure"
FORM     := "hash" | "branch" | "version" | "tag"   # 'tag' is an alias of 'version'
REF      := <hexhash>        # seven or more hex digits
          | <semver>         # [v]M.m[.p][-prerelease][+build]
          | <branch>         # a valid git branch name
```

Without an explicit `FORM:` prefix the `REF` is auto-detected by trying hash first, then version, then branch. If no `@REF` is given the default branch is used. Clones use HTTPS unless `--ssh` is passed.

The module’s `package.yaml` must give its `name` and its `library`, and the repository must be named after the module. Where the module comes from depends on the form:

-   A bare name like `root` is the standard library’s `root`, from `github.com/morloclib/root`.
-   `library/name` fetches from the library’s **origin**, the host and owner its modules live under: `bio/convert` is `github.com/morloc-bio/convert`.
-   `github:weena/calendar` fetches that repository. If its `package.yaml` says `library: weena` and no library `weena` is known yet, Morloc records `weena` as coming from `github:weena`, so `weena/<name>` works from then on. `gitlab:` is gitlab.com, `codeberg:` is codeberg.org, `bitbucket:` is bitbucket.org.
-   A local path must begin with `.`, `/`, or `~`. Everything from the path start to the first `@` is the path, and any `@REF` that follows is honored only when the local directory is itself a git repository — otherwise the working tree is copied verbatim (filtering `.git` and gitignored files) and the ref is silently dropped. A local install records no origin.

The origins of `std` and `bio` are built in and cannot be changed. A library named something other than its owner is recorded with `morloc library add <library> <host>:<owner>`, and `morloc library list` shows every known library. A package fetched from anywhere but its library’s origin is refused.

**Table 11. Install string examples**

| Install string | Effect |
| --- | --- |
| `root` | `root` from `morloclib/root` on GitHub (default branch) |
| `root root-py math` | install three modules in one invocation |
| `bio/convert` | `convert` from the `bio` library’s origin, `morloc-bio/convert` |
| `github:weena/calendar` | `weena/calendar` on GitHub (default branch) |
| `weena/calendar` | the same, once the library `weena` is known |
| `gitlab:weena/calendar` | `weena/calendar` on gitlab.com |
| `codeberg:weena/foo` | `weena/foo` on codeberg.org |
| `weena/calendar@1.0` | release tag `1.0` (semver auto-detected) |
| `weena/calendar@v1.0.0` | release tag `v1.0.0` |
| `weena/calendar@version:1.0.0` | explicit release-tag form |
| `weena/calendar@tag:1.0.0` | same as `@version:1.0.0` (`tag` is an alias) |
| `weena/calendar@a1b2c3d` | commit `a1b2c3d` (hash auto-detected at >= 7 hex chars) |
| `weena/calendar@hash:abc1234` | explicit commit-hash form |
| `weena/calendar@dev` | branch `dev` (auto-detected after hash/version fail) |
| `weena/calendar@branch:feature/x` | explicit branch form (allows `/` in the branch name) |
| `gitlab:weena/foo@version:1.0` | remote prefix combined with an explicit release tag |
| `.` | install from the current working directory |
| `./mymod` | install from a relative path |
| `~/code/mymod` | install from a tilde-expanded path |
| `/abs/path/to/mod` | install from an absolute path |
| `./mymod@branch:dev` | install branch `dev` of a local git repo |
| `./mymod@v0.2.0` | install tag `v0.2.0` of a local git repo |

The `morloc install -h` help screen carries a shorter example block for quick reference.

Installed modules are stored in `~/.local/share/morloc/src/morloc/plane/<library>/<module>/` (under `$MORLOC_STATE` instead of `~/.local/share/morloc` when that is set) and can be imported in any Morloc program, as [Importing modules](https://morloc-project.github.io/docs/features/importing-modules.md) describes.

To view the modules that are currently installed, you can run `morloc list`. This will list all installed modules, their version, and their short descriptions. Adding the `-v` option additionally prints the types of all exported terms.

To view the exports of one module, add a pattern. It matches any module whose name contains the pattern’s characters in order, so `il` would match `internal` too:

```console
$ morloc list -v internal
Modules:
  internal 0.6.0  The universal and required implicit Morloc module
    $ :: (b -> a) -> b -> a
    . :: (b -> a) -> (c -> b) -> c -> a
...
```

## 7.1.1. Configuring the C++ build

When a Morloc program contains C++ sources, the compiler invokes `g++` (or whatever `$CXX` resolves to) to build the C++ side of the program. Three optional `package.yaml` fields tune that build: two structured fields (`cpp-version` and `cpp-deps`) that translate into specific flag patterns, and one verbatim field (`cxx-flags`) that passes arbitrary flags through unchanged. For build steps that go beyond flag-tweaking, a fourth field — `setup` — runs a shell script at install time.

**`cpp-version: 20`**

Selects the C++ standard. Translates directly into a `-std=c++NN` flag (default `20`).

```yaml
cpp-version: 20
```

**`cpp-deps`**

Names the libraries the C++ code uses. The environment provisions each one, and an entry may list the headers your code includes (`import`) and the names the pool links (`libs`, each `hts` becoming `-lhts`). Morloc refuses to build when a listed header cannot be found, and in a managed environment it puts the environment’s headers and libraries on the compile line itself. [C++](https://morloc-project.github.io/docs/languages/cpp.md) covers the details.

```yaml
cpp-deps:
  htslib: {version: ">=1.20", import: htslib/sam.h, libs: [hts]}
```

**`cxx-flags: [-O3, -DENABLE_FAST_PATH]`**

A free-form list of flags appended verbatim to the compile command. Use this for anything the structured fields above don’t cover — optimization levels, architecture targeting, preprocessor defines, warning controls, and so on. Each list element is one argument, so no quoting or word-splitting is needed. Repeated elements are merged, so write a flag that takes a value as one element (`-Wl,-rpath,DIR`, not `-Xlinker` twice). A library the environment does not provide, such as the system’s zlib or one a `setup` script builds, is linked here (`-lz`).

```yaml
cxx-flags:
  - -O3
  - -march=native
  - -DENABLE_FAST_PATH
```

The three fields combine:

```yaml
name: vector-ops
version: 0.1.0
cpp-version: 20
cpp-deps:
  eigen: {version: "*", import: Eigen/Dense}
cxx-flags:
  - -O3
  - -march=native
  - -DEIGEN_NO_DEBUG
```

When one module depends on another, the downstream module inherits all three fields from its dependencies: a consumer of `vector-ops` above gets Eigen provisioned and its header checked, and the listed `cxx-flags` on its own C++ compile line.

For build steps that go beyond what these flags can express — running `cmake`, building a vendored library from source, fetching pre-built artifacts, or installing a Python or R package — use the more general `setup` field, which names a shell script that runs once at install time:

```yaml
name: my-package
setup: scripts/install.sh
```

The script runs after the module’s source has been laid down on disk and after morloc-level dependencies have been installed, with these environment variables set:

**`MORLOC_HOME`**

Morloc’s install root (default `~/.local/share/morloc`).

**`MORLOC_MODULE_NAME`, `MORLOC_MODULE_LIBRARY`, `MORLOC_MODULE_VERSION`**

name, library and version from this `package.yaml`.

**`MORLOC_MODULE_DIR`**

absolute path to the installed module’s directory; also the script’s working directory.

**`MORLOC_PLANE_DIR`**

the directory of installed modules, one subdirectory per library.

A non-zero exit fails the install. The path must be relative to the module root and must not contain `..` segments. Prefer the three structured fields above when they suffice — a setup script is more powerful but also more code to maintain.
