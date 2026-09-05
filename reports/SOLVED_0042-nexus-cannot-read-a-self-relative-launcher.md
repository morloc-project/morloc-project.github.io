# 0042: `morloc-nexus daemon`/`mcp` cannot read the launcher `morloc make` writes

- Status: fixed
- Found: 2026-09-03, while verifying the fix for report 0003
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`morloc-nexus daemon ./mycli` is a supported entry point -- the resolver's own
docstring says so ("the manifest path is extracted from its exec line, so
`morloc-nexus daemon ./mycli` keeps working"), and the daemon test suite drives
the daemon exactly that way (`test-suite/daemon-tests/run-tests.sh:289`).

## Observed

Every daemon test aborts at startup:

```
$ ./run-tests.sh http-eval-timeout http-typecheck-eval
=== Morloc Daemon Test Suite ===
Compiling test programs...
Done.

[http-eval-timeout] /eval CPU budget -> 408
HTTP port 46329 did not respond within 10s
```

By hand:

```
$ morloc make -o nexus arithmetic.loc
$ morloc-nexus daemon ./nexus --http-port 8092
Error: './nexus' looks like a morloc wrapper but no manifest path was found on its exec line
```

Passing the manifest directly works, so only the wrapper shape is at fault:

```
$ morloc-nexus daemon ./nexus-build/manifest.json --http-port 8091
morloc-daemon: listening on http://0.0.0.0:8091
$ curl -s localhost:8091/health
{"status":"ok","result":[true]}
```

## Reproduce

Any compiled program, from an empty directory:

```
$ printf 'module m (f)\nf :: Int -> Int\nf x = x\n' > m.loc
$ morloc make m.loc
$ morloc-nexus daemon ./m
```

## Impact

`morloc-nexus daemon <launcher>` and `morloc-nexus mcp <launcher>` are broken
for every program built with the default launcher, which is every program.
The whole daemon test suite is dark: it fails at the first group and never
reaches the assertions, so nothing in `daemon-tests` has been exercising the
daemon since this landed.

The `--daemon-out` wrapper goes through the same emitter, so a wrapper the
compiler writes specifically to be run as a daemon cannot be run as a daemon.

## Cause

The Haskell emitter and the Rust parser describe two different file formats.

`Morloc.CodeGenerator.Nexus.makeWrapperScript` has two branches. The
`selfRel` branch -- the default, added in `0c7554df` "Make pool builds
relocatable" (2026-08-25, released in v0.99.1) -- resolves the launcher's own
directory at run time and emits a **double-quoted, `$d`-relative** exec line:

```sh
d=$(CDPATH= cd -- "$(dirname -- "$self")" && pwd)
exec morloc-nexus run "$d/nexus-build/manifest.json" "$@"
```

`extract_manifest_from_wrapper` (`data/rust/morloc-nexus/src/cli.rs:940`) still
implements only the older non-`selfRel` branch: it looks for the first `'` on
the exec line and gives up when there is none. There is no single quote on the
line above, so it returns `None` and the resolver errors.

`cli.rs` has had no commit touching this since `0c7554df`, so the two halves
have been out of step for the whole v0.99.1..v0.100.2 range.

## Guess

Unverified at filing: the parser needs the `$d`-relative branch. See the
resolution -- the deeper problem turned out to be that the reader was
interpreting shell at all.

Nothing else parses these launchers: `mim`'s freeze and doctor paths scan
`exe/*/manifest.json` directly.

## Resolution

Fixed in `morloc` commit (pending -- see the session summary; not yet
committed at the time this section was written).

The launcher now *declares* its manifest on a line of its own, and the reader
reads that declaration instead of reverse-engineering the `exec` line:

```sh
#!/bin/sh
# morloc-manifest: nexus-build/manifest.json
export MORLOC_PROG_NAME="$0"
...
```

The path is relative to the launcher's own directory when the launcher travels
with its build tree, absolute otherwise; the reader resolves a relative path
against the directory holding the launcher. This removes shell semantics --
quoting, escaping, variable expansion -- from the reader entirely, which is the
class of defect this report is an instance of, not just the instance.

Both pre-declaration shapes are still read, because a build tree outlives the
compiler that wrote it, and a launcher that declares nothing readable now says
so and tells you to rebuild.

The reason this survived a release is worth recording: the reader *had* unit
tests, but its test helper synthesized launchers in its own idea of the format
rather than the compiler's, so the tests validated the reader against a
fiction. The helper now reproduces the real emitted shapes verbatim, with both
pre-declaration forms alongside, and the comment on it says why that matters.
The integration suite (Daemon, 11 tests; MCP, 6) is the real cross-check and is
green again.
