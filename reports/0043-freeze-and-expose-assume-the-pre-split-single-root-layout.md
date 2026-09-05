# 0043: `mim freeze` and `mim expose` still assume morloc's pre-split single-root layout

- Status: open
- Found: 2026-09-03, while restoring the Install integration tests
- Component: mim
- morloc: 0.100.2     mim: 0.28.0

## Expected

Morloc splits its installation in two (`Morloc.Config.resolveStateRoots`):
`$MORLOC_HOME` is the runtime prefix (`bin/`, `lib/`, `include/`, `opt/`) and
`$MORLOC_STATE` is the mutable state root (`exe/`, `fdb/`, `modules/`,
`snapshots/`, `src/morloc/plane`). They coincide when `$MORLOC_STATE` is unset.

`mim` creates that split itself. A container environment mounts three host
directories (`mim/src/main.rs`, `run_with_config`):

```
<env>          -> /opt/morloc-state   (MORLOC_STATE)
<env>/pixi     -> /env
<env>/runtime  -> /opt/morloc         (MORLOC_HOME)
```

So a program installed through `mim run` lands at `/opt/morloc/bin/<name>`,
which is host-backed at `<env>/runtime/bin/<name>`, while its build tree lands
at `<env>/exe/<name>`. Both persist. Anything reading them back has to know
which root each lives under.

## Observed

Two `mim` paths read them back from a single root, as though the split did not
exist. Not confirmed against a live container environment -- this host has no
container engine -- so these are read from the code.

**`mim expose add`** checks for the launcher under the state root
(`main.rs`, `ExposeAction::Add`):

```rust
let launcher = cfg::env_data_dir(scope, &env_name).join("bin").join(&module);
```

That is `<env>/bin/<module>`; the launcher is at `<env>/runtime/bin/<module>`.
A module that was just installed should therefore be rejected with "is not
installed in environment ... (no bin/<module>)", which blocks the documented
install -> expose -> start flow at its second step.

**`mim freeze`** collects six directories from the state root
(`freeze.rs`), and silently skips any that are absent:

```rust
for dir in &["lib", "fdb", "bin", "exe", "opt", "src"] {
    if Path::new(&format!("{v_data_dir}/{dir}")).is_dir() { tar_dirs.push(dir); }
}
```

Under the split, `fdb`, `exe` and `src` are there and `lib`, `bin` and `opt`
are under `<env>/runtime`. The tarball should come out missing half its
content, with no warning. `unfreeze` then generates a Dockerfile that copies
three of them unconditionally (`serve.rs`):

```
COPY lib/ {mh}/lib/
COPY fdb/ {mh}/fdb/
COPY bin/ {mh}/bin/
```

so the image build should fail on the missing `lib/` or `bin/` in the context.

Note `mim freeze` refuses a native environment outright, and a native
environment is exactly the case where the two roots coincide and the six-name
list is correct. Freeze therefore only ever runs against the layout it does not
handle.

## Impact

The install -> expose -> serve -> freeze path on container environments. Two
things are *not* affected, and are worth stating because they narrow this:

- **Serving is fine.** `serve_environment` mounts only the state root, and the
  router reads `exe/*/manifest.json` directly; it never looks in `bin/`.
- **Installs persist.** `<env>/runtime` is a host mount, so a launcher written
  to `/opt/morloc/bin` survives the container.

## Cause

`mim`'s deploy image is built for the *unified* layout, and correctly so: it
copies everything under `/opt/morloc` and sets `MORLOC_HOME` but no
`MORLOC_STATE`, so `configState` falls back to `configHome` and a deployed
image is a single-directory install. `freeze` reads the environment as though
it had that same shape. It does not; `mim` itself gave it two roots.

## Fix

`mim` only. The compiler needs no change: its two roots are deliberate, and
`bin/` belongs with `lib/` and `include/` in the runtime prefix -- it is the
`PATH` directory, and `morloc init` puts `morloc-nexus` there too.

- `expose add` should look under `<env>/runtime/bin` for a container
  environment, and `<env>/bin` for a native one -- the same rule `mim run`
  already applies when it decides what to mount where.
- `freeze` should collect `fdb`, `exe` and `src` from the state root and
  `lib`, `bin` and `opt` from the runtime root, flattening them into the single
  root the deploy image expects. The silent skip should also go: a frozen
  artifact missing `bin/` is not a warning-free outcome.

Both are the same one-line concept -- ask which root a directory lives under
instead of assuming -- and a helper that answers it would keep the next reader
from having to rediscover the split.

## Verification this needs

A container environment, which this host cannot provide. Create one, install a
program, then check in order: that `<env>/runtime/bin/<name>` exists and
`<env>/bin/<name>` does not; that `mim expose add <name> --as api` reports the
module as not installed; and that `mim freeze` produces a tarball whose
`state.tar.gz` lists no `bin/`.
