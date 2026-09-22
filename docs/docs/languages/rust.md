# 11.5. Rust

Morloc Manual > Language Support | https://morloc-project.github.io/docs/languages/rust.html | prev: https://morloc-project.github.io/docs/languages/r.md | next: https://morloc-project.github.io/docs/languages/futhark.md

## 11.5.1. Cargo pools

Each Rust pool is a generated Cargo project, built with `cargo build --release`:

```
<name>-build/pools/rust/
├── Cargo.toml     # generated manifest
├── build.rs       # links libmorloc and sets the rpath
└── src/main.rs    # generated pool code
```

`cargo` must be on your `PATH`; install it via [rustup](https://rustup.rs).

`morloc init` copies the Rust runtime workspace to `$MORLOC_HOME/rust` (a Cargo path dependency of every pool) and warms a shared build cache at `$MORLOC_STATE/cache/rust-build`. Re-run `morloc init -f` after changing compiler versions.

## 11.5.2. Dependencies (`rust-deps`)

Declare crates.io dependencies in a module’s `package.yaml` under `rust-deps`, using `crate: version` as in a `Cargo.toml`:

```yaml
rust-deps:
  ndarray: "0.16"
```

Each entry is written into the pool `Cargo.toml` `[dependencies]`. The compiler takes the union of `rust-deps` across all imported modules; conflicting versions of the same crate are a build error.

Crates come from [crates.io](https://crates.io), the only source Rust supports, so the bare form above is equivalent to `ndarray: {version: "0.16", source: crates}`; declaring any other source is a build error. The conda `channel` field is likewise conda-only and has no meaning for crates.

## 11.5.3. Local crates (`local-deps`)

A crate that lives in your project tree rather than on crates.io — the shared library you are writing alongside the Morloc program — is declared under `local-deps`, keyed by language, with a path relative to the module’s directory:

```yaml
local-deps:
  rust:
    statcrate:
      path: ./statcrate
```

This is the Cargo path dependency you would write by hand: the compiler adds `statcrate = { path = "<absolute path>/statcrate" }` to the pool’s `Cargo.toml`, and cargo builds the crate and links it statically into the pool binary. There is no install step and nothing to load at run time.

`source Rust from` names a file, and the compiler includes that file’s text in the pool crate, so reach the crate through a one-line re-export:

**glue.rs**

```rust
pub use statcrate::{mean, stdev};
```

```morloc
source Rust from "glue.rs" ("mean" as colMean, "stdev" as colStdev)
```

The rules are the ones given for Python in [Local packages (`local-deps`)](https://morloc-project.github.io/docs/languages/python.md#local-deps): only the top-level module may declare `local-deps`, and the path must be relative and stay inside the project (an in-project symlink reaches a crate kept elsewhere). The `editable` flag has no meaning for a crate, which is recompiled on every build anyway.

One limit is specific to Rust. A Morloc `record` cannot be bound to a struct defined in the crate, because the marshalling code Morloc generates for a record must be an `impl` in the pool crate, and Rust’s orphan rule forbids implementing a foreign trait for a foreign type. Share functions across the crate boundary, pass primitives, lists, tuples and strings, and assemble records on the Morloc side; a crate struct that must cross the boundary goes through a tuple in the bridge file.

## 11.5.4. One resolution per environment

Every pool starts from one `Cargo.lock`: the lock persisted with the runtime at `$MORLOC_HOME/rust/Cargo.lock`, extended by every crate a pool in this environment has resolved before (kept at `$MORLOC_STATE/cache/rust-env.lock`). A pool whose crates are all pinned there is built `--offline`; cargo never consults the registry and every pool links the same compiled dependencies. A pool that declares a crate not yet in the lock resolves it once, over the network, and its pins are merged back, so the next pool needing that crate — in any program — builds offline too. Deleting `rust-env.lock` costs one online resolution per external crate and nothing else.

The pool’s release profile is set by the `rust:lto` and `rust:opt-level` build parameters ([Build parameters](https://morloc-project.github.io/docs/languages/build-parameters.md)); `rust:lto` is the one setting that trades link time against cross-crate optimization.
