# 13.12. Logs and result caching

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-runs.html | prev: https://morloc-project.github.io/docs/build-architecture/build-collect.md | next: https://morloc-project.github.io/docs/compiler-architecture/index.md

> A run can leave two kinds of state behind it, both opt-in: a **log directory** recording what the run did, and a **result cache** that lets a later run skip a call it has already made. Both outlive the run, unlike the private run directory of [Process lifecycle](https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md), which is always removed. This section specifies how each is activated, its layout and formats, and what holds when several runs share them.

## 13.12.1. Log directory

`--log-dir DIR` (or `MORLOC_LOG_DIR`) gives each run its own directory, `DIR/<run id>/`, where the run id is the start time in UTC plus eight random hex digits (`20261009T143000Z-1a2b3c4d`). A Morloc program started by another program’s pool inherits the outer run’s directory, so a nested pipeline logs into one place. The directory is created on first write and never removed.

| File | Contents |
| --- | --- |
| `log` | Run-scope lines: the prologue, the epilogue, and the benchmark summary. |
| `<label>/log` | Start, pass and fail lines for calls in a labeled group. |
| `summary.json` | Written once, at exit, by atomic rename (below). |
| `debug/inputs/<hash>.pkt` | Programs built with `--debug` only: the arguments of each frame a failure passed through, as self-contained voidstar packets. |

`summary.json` holds `status` (`ok` or `fail`), `exit_code`, `command`, `run_id`, `started_at` and `finished_at` (RFC 3339), `wall_ms`, `morloc_version` and `error` (null on success). Because it appears only by rename, a script may wait for the file to exist and then read it whole. `--summary FILE` writes the same object to a chosen path instead.

**Log lines** come from templates in the program’s configuration, with placeholders such as `{name}`, `{run_id}`, `{runtime}`, `{exit_code}` and `{error}`. Placeholders known at build time are filled in by the compiler; the rest by the nexus as the line is written. Every line goes to standard error (colored only on a terminal) and to the matching log file. There are no levels; `--quiet` suppresses all of them. At exit the nexus writes the benchmark summary (count, mean, min, max, total and standard deviation per labeled function, from one timing record per successful call), then the epilogue, then `summary.json`.

## 13.12.2. Result cache

A labeled group configured with `cache: true` has its calls cached. The compiler wraps each such call: compute a key, return the stored result on a hit, otherwise run the call and store its result. Only successful results are stored.

**The key** is a 64-bit xxHash of:

-   the **pool fingerprint**: a hash of the generated source of the calling pool, the build parameters, and any files the program lists under `hash-include`. A sourced foreign file is covered only through the generated code that names it; list it under `hash-include` to make its contents part of the key;
-   the function’s index in that pool;
-   each argument, hashed by walking its voidstar value under its schema and following its pointers, so the key does not depend on where the value’s parts lie in shared memory.

**Entries** live under `MORLOC_CACHE_BASE`, else `$XDG_CACHE_HOME/morloc/cache`, else `~/.cache/morloc/cache`, else `cache` in the per-user runtime directory. An entry is two files, both packets ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)):

| File | Contents |
| --- | --- |
| `<label>/<key>.dat` | A data packet whose payload is the path of the result file. |
| `data/<value hash>.dat` | The result as a voidstar packet with its schema, optionally Zstandard-compressed. |

Results are stored by the hash of their value, so many calls that return the same value share one result file. An entry that is truncated or whose result file is missing is deleted and treated as a miss. Nothing is evicted, and an entry is invalidated only by a change of key.

**Sharing.** The cache takes no locks. Every file is written to a unique temporary name beside its target, synced, and renamed into place, and the result file is written before the key file that names it. So a reader sees a complete entry or none, and two runs storing the same entry at once both succeed with the same content.
