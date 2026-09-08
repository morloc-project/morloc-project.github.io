# 0044: `morloc init -f` can fail with ETXTBSY overwriting the nexus it just built

- Status: fixed
- Found: 2026-09-03, while rebuilding the runtime after a nexus change
- Component: runtime (init)
- morloc: 0.100.2     mim: 0.28.0

## Expected

`morloc init -f` rebuilds `libmorloc.so`, `morloc-nexus`, and the language
bindings, and installs them into `$MORLOC_HOME`. Running it twice in a row
should behave the same both times.

## Observed

It failed twice, on the same step, with no `morloc-nexus` process running:

```
[INFO] Compiling morloc-nexus (Rust)
cargo build --release ... -p morloc-nexus --target-dir /opt/morloc-state/cache/rust-build
cp /opt/morloc-state/cache/rust-build/release/morloc-nexus /opt/morloc/bin/morloc-nexus
cp: cannot create regular file '/opt/morloc/bin/morloc-nexus': Text file busy
[ERROR] Configuration failed: cp exited with code 1
```

`ETXTBSY` means the target is open for execution. Nothing held it that I could
find -- no process had it as `exe`, none mapped it, none had it open as an fd.
Running the identical `cp` by hand a few seconds later succeeded, and the next
`morloc init -f` then ran to completion.

## Reproduce

Not reliably. It happened on two consecutive `morloc init -f` runs and then
stopped, which is the signature of a race rather than a stuck holder.

## Impact

A rebuild fails part-way with an error that points at nothing the user can
act on -- there is no process to kill. The state left behind is a half-updated
runtime: `libmorloc.so` is new, `morloc-nexus` is old. Re-running usually
clears it, so the cost is confusion rather than damage, but a half-updated
runtime is a bad thing to leave on the floor.

## Guess

Unverified. Two candidates, both consistent with a window that closes on its
own:

- Something earlier in `init` executes the freshly built `morloc-nexus` (a
  version probe, or the completions step) and the child has not been reaped
  when the `cp` runs. A short-lived exec leaves the image busy until the last
  reference goes.
- The `cp` follows the `cargo build` closely enough that a build-script or
  linker child still holds the output.

Either way the fix shape is the same and standard: install by writing to a
temporary name in the destination directory and `rename(2)` over the target.
`rename` is atomic and is not refused for a busy image, so it also removes the
half-updated-runtime window. Worth applying to every artifact `init` installs,
not just the nexus.

## Resolution

Fixed in `morloc` commit `9ef36bca`.

`morloc init` now produces each runtime artifact under a temporary name in the
destination's own directory, strips it there, and `rename(2)`s it onto the
target. `rename` is atomic within a directory and is not refused for a busy
image, so the `ETXTBSY` window is gone and there is no interval in which a
reader sees a half-written or half-stripped binary. Both artifacts the report
names go through it, so the runtime is never left half updated.

Stripping in place was what made the original sequence unsafe: the gap between
the copy and the strip was long enough for a second builder to strip a file the
first was still writing.
