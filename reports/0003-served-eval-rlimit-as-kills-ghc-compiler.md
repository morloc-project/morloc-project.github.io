# 0003: served `/eval` sets RLIMIT_AS=2GiB, which the GHC-built `morloc` binary cannot start under

- Status: open
- Found: 2026-09-02, while writing the mim deployment tutorial (morloc-manager)
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`mim expose eval --allow <modules>` plus `mim start` is documented
(`src/content/utilities-mim.asc`, "eval") as enabling a sandboxed `/eval`
endpoint that evaluates a Morloc expression against the served environment.
Every expression should at least reach the typechecker.

## Observed

Every `/eval` request fails before the compiler does any work:

```
$ morloc-nexus router --fdb /opt/morloc-state/exe --http-port 8099 \
    --api dnd --eval --eval-allowed-modules dnd &
$ curl -s -X POST localhost:8099/eval -H 'Content-Type: application/json' \
    -d '{"expr":"1 + 2"}'
{"status":"error","error":"morloc: failed to create OS thread: Cannot allocate memory"}
```

The message is the GHC RTS failing to start, not a Morloc diagnostic. It is
reproducible for every expression, including ones that are syntactically
invalid, so nothing downstream of process startup is being reached.

## Reproduce

The rlimit alone is enough; no nexus needed:

```
$ bash -c 'ulimit -v 2097152; morloc --version'
morloc: failed to create OS thread: Cannot allocate memory
$ morloc --version
0.100.2
```

`2097152` KiB is 2 GiB, the exact `RLIMIT_AS` the eval fork installs
(`data/rust/morloc-nexus/src/mcp.rs`, around line 1879):

```rust
let as_lim = libc::rlimit {
    rlim_cur: 2 * 1024 * 1024 * 1024,
    rlim_max: 2 * 1024 * 1024 * 1024,
};
```

## Impact

The `/eval` endpoint and the `eval` MCP tool are unusable on any serving host
with eight or more cores (see **Cause**); `mim eval`, `POST /eval`, and the MCP
`eval` tool all route through this fork. The failure mode is also bad for a
first-time reader: the error names OS threads and memory, and gives no hint
that a resource limit set by the server is responsible.

Note the sibling limit is fine: `RLIMIT_CPU` (`--eval-timeout`, default 30s)
does what it says.

## Cause (measured 2026-09-02, no longer a guess)

`RLIMIT_AS` limits *virtual address space*, which is the one resource a GHC
program spends lavishly and the one that says nothing about its real memory
use. Measured on this host (12 cores, GHC 9.10.3, morloc 0.100.2):

| Condition | `VmPeak` |
|---|---|
| unconstrained | 1 075 799 668 KiB (~1 TiB) |
| under `ulimit -v 2097152` (2 GiB), `-N1` | 1 808 228 KiB (1765 MiB) |
| under `ulimit -v 2097152` (2 GiB), `-N4` | 2 060 444 KiB (2012 MiB) |

Two facts follow. The RTS's two-step allocator reserves about a terabyte of
address space by default -- untouched, `PROT_NONE`, costing no memory. And
under an `RLIMIT_AS` it *adapts*: it halves the reservation until the mapping
succeeds, which lands it right up against the cap (2012 of 2048 MiB above).

That is the trap. The heap reservation takes almost the whole allowance, and
then the RTS tries to start one OS thread per capability and finds no address
space left for their stacks. Hence "failed to create OS thread", from a process
whose resident set is a few tens of megabytes.

So the failure scales with the core count of the serving host. Under the 2 GiB
cap:

```
-N1   0.100.2
-N2   0.100.2
-N4   0.100.2
-N8   morloc: failed to create OS thread: Cannot allocate memory
-N12  morloc: failed to create OS thread: Cannot allocate memory
```

`morloc` is built `-threaded -rtsopts -with-rtsopts=-N` (`package.yaml:125`),
so capabilities equal cores. **Served eval works on a host with four cores or
fewer and fails on eight or more**, which is presumably why it shipped. Raising
the cap has the same shape: 2 GiB and 4 GiB fail on this host, 5 GiB and up
succeed.

## Scope

Three sites set the same 2 GiB `RLIMIT_AS` around a forked `morloc`, and all
three were affected:

- `data/rust/morloc-nexus/src/mcp.rs` -- the router's `/eval` and the MCP
  `eval` tool.
- `data/rust/morloc-runtime/src/daemon_ffi.rs` -- the binding store's
  `morloc eval --save` fork.
- `data/rust/morloc-runtime/src/daemon_ffi.rs` -- `fork_morloc_command`, behind
  the daemon's `/eval` and `/typecheck`.

## Workaround (superseded by the fix below)

At all three sites both rlimits were gated on the eval timeout being non-zero,
so `--eval-timeout 0` disabled the address-space cap along with the CPU cap:

```
$ morloc-nexus router --fdb <state>/exe --http-port 8097 --eval --eval-timeout 0
$ curl -s -X POST localhost:8097/eval -d '{"expr":"1"}'
{"status":"ok","result":"1"}
```

Not a fix: it removed the runaway-expression guard entirely, and `mim start`
does not pass `--eval-timeout` through, so it was reachable only by invoking the
router by hand.

## Candidate fixes

1. **Bound the heap with the RTS's own knob instead of `RLIMIT_AS`.** Keep
   `RLIMIT_CPU`; drop `RLIMIT_AS`; export `GHCRTS=-M<size>` (or append
   `+RTS -M<size> -RTS`) to the child. `-M` bounds the live heap, which is the
   quantity actually worth bounding, and it fails cleanly with a heap-overflow
   message rather than a startup crash. Verified that the child honours the
   variable: `GHCRTS=-N1` and `GHCRTS=-M256m -N1` both take effect. This is the
   recommended option.
2. **Keep `RLIMIT_AS` but raise it well above the RTS floor** (tens of GiB).
   Simple, but the floor is a function of core count and GHC version, so the
   number is a guess that will rot; and at that size it no longer bounds
   anything a `-M` would not bound better.
3. **Pin the child to `-N1`/`-N2`.** Verified to work under the current 2 GiB
   cap, but it treats the symptom, slows the compiler, and still leaves the
   limit sensitive to GHC internals.

Whichever is chosen, the error classifier needs a companion change. A `-M`
overflow exits non-zero without a signal, which
`daemon_ffi.rs` (~line 1079) currently maps to BAD_REQUEST 400 -- "your
expression did not compile". A server-side memory ceiling is not a user error;
it deserves its own status, the way `SIGXCPU` already maps to 408.

## Fix (2026-09-03, verified; not yet committed)

Option 1 above, applied at all three sites: `RLIMIT_AS` is gone, `RLIMIT_CPU`
stays, and the child's heap is bounded by its own runtime through an RTS block
prepended to argv (`morloc +RTS -M2G -RTS eval ...`). The runtime strips
`+RTS ... -RTS` before the program sees argv, and at the two raw `fork`/`execvp`
sites the block is built in the parent, so nothing allocates in the post-fork
child. The
ceiling is a named constant, `EVAL_HEAP_LIMIT`, duplicated in the two crates
with cross-references -- `morloc-nexus` deliberately does not depend on
`morloc-runtime` and already mirrors `DAEMON_ERROR_INTERNAL` the same way.

The heap cap is now unconditional rather than gated on the CPU budget. The two
limits bound independent axes, and the old gating meant `--eval-timeout 0`
silently removed the memory ceiling too.

The classifier changes with it. A `-M` overflow exits 251 (`EXIT_HEAPOVERFLOW`)
with no signal, which the old code mapped to BAD_REQUEST 400 -- telling the
caller their expression did not compile when the server had merely declined to
spend the memory. It now maps to INTERNAL 500 with a message naming the ceiling,
since the RTS's own advice ("use `+RTS -M<size>`") is not something an HTTP
caller can act on. A dedicated resource kind (507) would be better still, but
`DAEMON_ERROR_*` is a C ABI contract in `morloc.h` and widening it for this is
out of proportion.

### Verified

Rebuilt with `MORLOC_RUST_DIR=$PWD/data/rust morloc init -f`.

The reported failure is gone -- this is the default `--eval-timeout 30`, the
configuration that previously failed for every expression:

```
$ morloc-nexus router --fdb <state>/exe --http-port 8096 --eval
$ curl -s -X POST localhost:8096/eval -d '{"expr":"[1,2,3]"}'
{"status":"ok","result":"[1,2,3]"}
```

A real user error still reads as one:

```
$ curl -s -X POST localhost:8096/eval -d '{"expr":"nosuchterm"}'
{"status":"error","error":"<expr>:1:1: error:\nUndefined term: nosuchterm\nhint: ..."}
```

The daemon's own fork sites (`/eval` and `/typecheck`, the second and third
copies of the limit) likewise work:

```
$ morloc-nexus daemon ./nexus-build/manifest.json --http-port 8091
$ curl -s -X POST localhost:8091/eval -d '{"expr":"[1,2,3]"}'
{"status":"ok","result":[1,2,3]}
$ curl -s -X POST localhost:8091/typecheck -d '{"expr":"[1,2,3]"}'
{"status":"ok","result":""}
```

That the RTS block actually reaches the child was proved by temporarily
building the nexus with `EVAL_HEAP_LIMIT = "-M8m"`, which turns the same
request into the new classified error, then restoring `-M2G`:

```
{"status":"error","error":"eval exceeded the server's heap ceiling (8m)"}
```

`cargo test -p morloc-nexus -p morloc-runtime`: 197 + 121 pass, 0 fail.

The daemon test suite could not be used as the check, because
`morloc-nexus daemon <launcher>` is independently broken -- see report 0042.
That is why the daemon verification above passes `manifest.json` directly.
