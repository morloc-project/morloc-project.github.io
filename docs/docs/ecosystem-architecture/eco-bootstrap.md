# 12.3. Runtime bootstrap

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-bootstrap.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-environments.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-modules.md

> Before any program can be compiled, an installation needs a compiler and a runtime built for the machine it runs on. The compiler is distributed as a prebuilt binary in a release; the runtime is built from source on the target by `morloc init`, against the toolchain the environment provides. This section specifies what a release contains, how `mim` verifies and installs it, what `morloc init` produces, and when it rebuilds.

## 12.3.1. Releases

A release is named by a tag. `latest` means the newest release, and a bare version such as `0.105.2` means tag `v0.105.2`. Each release publishes a **release manifest**, a JSON object:

| Field | Meaning |
| --- | --- |
| `schema` | The manifest’s own format version. A reader refuses a schema newer than it knows. |
| `version` | The Morloc version the release contains. |
| `triples` | Per platform (`linux-x86_64`, `linux-arm64`, `macos-arm64`), the name of the compiler binary. |
| `rust_src` | The name of the archive holding the runtime’s source. |
| `sha256` | The SHA-256 digest of every asset. |
| `versions` | The contract versions of this release: `morloc_version`, `abi_version`, `envspec_version`, `lang_support_schema`. |

`mim` reads the manifest before downloading anything else and refuses a release whose contract versions it cannot read, telling the user to upgrade `mim`. A platform the manifest does not list is refused with a pointer to a container backend, since a container runs the Linux build on any host.

Every asset is downloaded to a temporary name, checked against its digest, and only then renamed into place. A missing digest is a refusal, not a warning. A downloaded release is stored once per scope, keyed by version and platform, and marked complete only after all of its assets are in place; an incomplete one is never used.

## 12.3.2. Building an environment

For a container backend, `mim` first builds an image for the environment from a base Linux image, the system packages the user asked for, any extra certificate authorities, the compiler, the runtime source, and its own binary. It is rebuilt only when one of these inputs changes. The solved toolchain and the built runtime are not in the image: they live in the environment’s data and are mounted in, so a package change does not rebuild the image.

Then, for every backend, `mim` solves the toolchain the compiler requires ([Environment solving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md)) and runs `morloc init` inside the environment, in a strict mode in which every compiler and interpreter must come from the solved toolchain rather than the host.

An environment can carry a bundle of extra certificate authorities, for networks that inspect TLS. The bundle is checked to contain certificates only (a private key is refused), installed as a trusted root in the image, and passed to the solver and every package manager in the environment.

## 12.3.3. What `morloc init` produces

`morloc init` builds the runtime into the Morloc home:

| Output | Purpose |
| --- | --- |
| `include/morloc.h` | The runtime’s C API ([Runtime library API](https://morloc-project.github.io/docs/compiler-architecture/compiler-libmorloc.md)). |
| `lib/` runtime library | The shared library every pool links against. |
| `bin/morloc-nexus` | The nexus. |
| Per-language bindings | One for each supported language whose tools are present: a Python extension module, an R library, a C++ library and precompiled header, a prebuilt Rust crate. |
| `rust/` | A copy of the runtime source, used when compiling Rust pools. |

The runtime source is found, in order, at a path named by `MORLOC_RUST_DIR`, in the home’s `rust/` directory, or beside the compiler binary. Building it requires a Rust toolchain. The runtime is always built optimized; a sanitizer variant exists for debugging the runtime itself.

A language whose tools are missing is skipped with a warning, and its programs cannot be built until a later `init` succeeds. In strict mode a missing or foreign tool is an error instead, so an environment never silently falls back to the host’s compiler.

Only one `init` runs per home at a time; a second waits for the first. `init` rebuilds the runtime and every language binding unless it is run in incremental mode, which keeps each part that is already present. `-f` also removes the files `init` owns before rebuilding, so a binding left by an older version cannot survive.

`init` links `morloc-nexus` into a directory on the user’s `PATH` (by default `~/.local/bin` when it exists; `MORLOC_BIN_LINK_DIR` names another, and an empty value turns linking off). `mim` turns it off inside environments so that no environment changes the user’s global commands.

**Interpreter pinning.** The Python and R bindings are compiled against one minor version of their interpreter. Once an environment has built them, the interpreter’s minor version is pinned in every later solve of that environment ([Environment solving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.md)), and a binding that no longer matches its interpreter is rebuilt before the next build uses it.
