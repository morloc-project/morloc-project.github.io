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

The `/eval` endpoint and the `eval` MCP tool appear to be unusable on any host
where the served compiler is the ordinary GHC-built `morloc` -- which is every
host. `mim eval`, `POST /eval`, and the MCP `eval` tool all route through this
fork. The failure mode is bad for a first-time reader: the error names OS
threads and memory, and gives no hint that a resource limit set by the server
is responsible.

Note the sibling limit is fine: `RLIMIT_CPU` (`--eval-timeout`, default 30s)
does what it says.

## Guess

Unverified. The GHC RTS reserves a very large contiguous address space at
startup (a terabyte by default) and creates its RTS threads immediately; a hard
`RLIMIT_AS` collides with that even though *resident* memory stays tiny.
`RLIMIT_AS` is the wrong knob for bounding a GHC child. Candidates: drop
`RLIMIT_AS` and bound memory with `RLIMIT_DATA` or a cgroup instead, raise the
cap far past the RTS reservation, or pass `+RTS --disable-large-address-space`
to the child and keep a (much larger) `RLIMIT_AS`.

Worth checking whether the daemon's own eval fork -- which the comment at
`mcp.rs:1866` says this mirrors -- has the same problem.
