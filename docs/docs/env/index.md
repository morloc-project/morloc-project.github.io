# 16. Environmental Variable List

Morloc Manual | https://morloc-project.github.io/docs/env/ | prev: https://morloc-project.github.io/docs/qa/more-questions.md | next: https://morloc-project.github.io/docs/ai-policy/index.md

Every environment variable that morloc reads or sets lives in the `MORLOC_` namespace. They fall into two roles:

-   **Tunables** — read at runtime to override a default. A user (or an orchestrator) sets these; morloc only reads them.
-   **Wiring** — set by the nexus, the compiler, or `mim` and read by the child processes they launch (pools, setup scripts, SLURM re-entry). Users normally do not set these by hand.

The tables below group the variables by topic. The **Introduced in** column links to the manual section that introduces the variable; a `(pending)` entry marks a variable that is described here but does not yet have a dedicated home elsewhere in the manual.

## 16.1. Installation and runtime setup

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_HOME` | Morloc install root; base for `bin/`, `include/`, `lib/`, and the module tree. | `~/.local/share/morloc` | [Exposing native resources](https://morloc-project.github.io/docs/apis/exposing-native-resources.md) |
| `MORLOC_RUST_DIR` | Path to the `data/rust/` Cargo workspace; `morloc init` compiles the runtime from source (requires `cargo`). Set by `mim` to the Rust source unpacked from the Morloc release. | *(search)* | [Build modes](https://morloc-project.github.io/docs/internals/runtime-and-dev-builds.md#build-modes) |
| `MORLOC_LANG_PARAMS` | `;`\-separated `LANG:KEY=VALUE` build parameters, layered between the per-machine build config and `-X` on the command line. | *(none)* | [Build parameters](https://morloc-project.github.io/docs/languages/build-parameters.md) |
| `MORLOC_BIN_LINK_DIR` | Directory where `morloc init` symlinks `morloc-nexus` and `mim`. An empty value suppresses symlinking; `mim` sets it inside containers so links land in a morloc-owned `bin/` instead of clobbering `~/.local/bin`. | `~/.local/bin` if present, else none | (pending) |
| `MORLOC_NEXUS` | Explicit path to the `morloc-nexus` binary. First entry in the resolution chain (then `$MORLOC_HOME/bin`, `$PATH`, `~/.local/bin`) used when a pool must re-invoke the nexus, e.g. for SLURM dispatch. | *(resolution chain)* | (pending) |

## 16.2. Module installation (setup-script environment)

Set by the compiler for a module’s `setup` script child process and read by that script.

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_MODULE_NAME` | Name of the module being installed. | *(per module)* | [Module setup scripts](https://morloc-project.github.io/docs/modules/installing-modules.md#configuring-cpp-build) |
| `MORLOC_MODULE_VERSION` | Version of the module being installed. | *(per module)* | [Module setup scripts](https://morloc-project.github.io/docs/modules/installing-modules.md#configuring-cpp-build) |
| `MORLOC_MODULE_DIR` | Absolute path to the installed module directory; also the script’s working directory. | *(per module)* | [Module setup scripts](https://morloc-project.github.io/docs/modules/installing-modules.md#configuring-cpp-build) |
| `MORLOC_PLANE` | Active plane name. | *(config)* | [Module setup scripts](https://morloc-project.github.io/docs/modules/installing-modules.md#configuring-cpp-build) |
| `MORLOC_PLANE_DIR` | Directory of the active plane’s library path. | *(config)* | [Module setup scripts](https://morloc-project.github.io/docs/modules/installing-modules.md#configuring-cpp-build) |
| `MORLOC_EXPOSE_CPP_DIR` | Destination directory a `setup` script should copy exposed C++ resources into. | *(derived from plane/module)* | (pending) |
| `MORLOC_EXPOSE_PY_DIR` | Destination directory a `setup` script should copy exposed Python resources into. | *(derived from plane/module)* | (pending) |
| `MORLOC_EXPOSE_R_DIR` | Destination directory a `setup` script should copy exposed R resources into. | *(derived from plane/module)* | (pending) |

## 16.3. Run directory, logging, and reporting

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_LOG_DIR` | Base directory that activates the per-run directory, stderr log tee, and `summary.json`. Equivalent to `--log-dir`. | *(none; opt-in)* | [Activation knobs](https://morloc-project.github.io/docs/runs/run-directory.md#rundir-activation) |
| `MORLOC_SUMMARY` | Path to write `summary.json`, independent of a rundir. Equivalent to `--summary`. | *(none)* | [Activation knobs](https://morloc-project.github.io/docs/runs/run-directory.md#rundir-activation) |
| `MORLOC_QUIET` | Suppress all morloc-emitted log lines at the source. Equivalent to `--quiet`. | off | [Activation knobs](https://morloc-project.github.io/docs/runs/run-directory.md#rundir-activation) |
| `MORLOC_RUN_DIR` | Current run’s directory. Set by the runtime and inherited by child morloc processes so their logs interleave. | *(only when active)* | [Where the directory lives](https://morloc-project.github.io/docs/runs/run-directory.md#rundir-location) |
| `MORLOC_RUN_PARENT_PID` | PID that created the rundir; guards against a stale inherited `MORLOC_RUN_DIR` (must match `getppid()`). | *(own PID)* | [Where the directory lives](https://morloc-project.github.io/docs/runs/run-directory.md#rundir-location) |
| `MORLOC_RUN_BASE` | Parent directory of the active run directory. Published by the runtime for child pools; informational only (a child reconstructs its run from `MORLOC_RUN_DIR`). | *(only when active)* | (pending) |
| `MORLOC_TRACE` | Any non-empty value enables per-stage timing trace lines on stderr (ingest, size-estimate, and emit hot paths) for diagnosing where wall time is spent. | off | (pending) |

## 16.4. Debugging

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_DEBUG_DIR` | Explicit output directory for `--debug` input dumps (`PATH/inputs/<hash>.pkt`). | *(rundir or `./.morloc-debug`)* | [Where dumps land](https://morloc-project.github.io/docs/runs/debugging.md#dump-location) |
| `MORLOC_DEBUG_CACHE_DEPTH` | Maximum disk writes per dispatch (`0` = unlimited). Equivalent to `--debug-cache-depth`. | `1` | [Runtime knobs](https://morloc-project.github.io/docs/runs/debugging.md#debug-knobs) |
| `MORLOC_DEBUG_CACHE_MAX` | Per-arg size cap on the dumped payload; larger args recorded by hash only. Equivalent to `--debug-cache-max`. | `0` (unlimited) | [Runtime knobs](https://morloc-project.github.io/docs/runs/debugging.md#debug-knobs) |
| `MORLOC_DEBUG_RECURSION_CAP` | Per-manifold frame limit in a recorded trace (`0` = unlimited). Equivalent to `--debug-recursion-cap`. | `3` | [Runtime knobs](https://morloc-project.github.io/docs/runs/debugging.md#debug-knobs) |

## 16.5. Caching

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_CACHE_BASE` | Override the cache base directory (useful for Docker mounts and shared filesystems). | `$XDG_CACHE_HOME/morloc/cache` | [Storage layout](https://morloc-project.github.io/docs/runs/caching.md#cache-layout) |
| `MORLOC_CACHE_COMPRESSION_LEVEL` | zstd level for persisted cache entries. `0` stores them uncompressed so `morloc dump` reads them without decompressing; raise it for large-payload workloads where disk footprint matters. | `0` (uncompressed) | (pending) |
| `MORLOC_POOL_HASH` | Hex source fingerprint mixed into every cache key so editing the morloc source (or a `@hash-include` file) invalidates the cache. `0` keeps caching working but drops source-edit invalidation. | `0` (no invalidation) | (pending) |

## 16.6. Data transfer (packets and shared memory)

Set by the nexus from the compiled manifest and read once by `libmorloc` on the first packet operation.

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_INLINE_SIZE` | Maximum flat byte size embedded inline in a packet; larger payloads spill to shared memory (or a temp file). | `65536` (64 KiB) | (pending) |
| `MORLOC_NO_SHM` | Set to `1`/`true`/`yes`/`on` to disable shared memory and route large payloads through temp files instead. | off | (pending) |
| `MORLOC_TMPDIR` | Temp directory for file-routed packets (used when a payload exceeds the inline threshold and SHM is disabled or unavailable). | system temp | (pending) |

## 16.7. Streaming and compression

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_REGISTRY_SLOT_COUNT` | Concurrent stream handles per nexus invocation (each slot uses 512 bytes of SHM). | `4096` | [Streaming environment variables](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md#stream-env-vars) |
| `MORLOC_WRITE_BUFFER_BYTES` | Per-`OStream` write-buffer cap; trades sub-packet granularity against per-flush overhead. | 16 MiB | [Streaming environment variables](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md#stream-env-vars) |
| `MORLOC_IFILE_CACHE_BYTES` | Per-handle SHM cache for decompressed IFile sub-packets (`0` disables). | 256 MiB | [Streaming environment variables](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md#stream-env-vars) |
| `MORLOC_FRAME_WORKERS` | Worker threads for parallel zstd frame compression/decompression (capped at 16). | `min(cores, 16)` | [Streaming environment variables](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md#stream-env-vars) |

## 16.8. Nexus and inter-process wiring

Set by the nexus and read by the pools it launches.

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_BRIDGE_SOCKET` | Unix-socket path for the SLURM submission bridge; exported by `mim` into the driver container. | *(unset = direct sbatch)* | [Running with the dispatch bridge](https://morloc-project.github.io/docs/install/execution-contexts.md#dispatch-bridge) |
| `MORLOC_NEXUS_PATH` | Absolute path of the running nexus, exported to every pool so remote/SLURM dispatch can wrap an `sbatch` call to the same binary. | *(from `current_exe`)* | (pending) |
| `MORLOC_MANIFEST_PATH` | Absolute (canonicalized) path of the program manifest, exported to pools for tooling that must re-enter the same program. | *(canonical manifest path)* | (pending) |
| `MORLOC_NEXUS_STDIO_SOCK` | Unix socket the nexus binds for its stdio server; a pool connects to it to route `@stdin` / `@stdout` / `@stderr` back to the nexus. Unset means the pool was not started by a nexus. | *(unset)* | (pending) |
| `MORLOC_STDOUT_COMPRESSION_LEVEL` | The nexus’s explicit `-z N`, when one was given. A pool writing a stream to `@stdout` compresses every sub-packet at this level instead of the `@write` level. Unset means the `@write` level stands. | *(unset)* | [Compression](https://morloc-project.github.io/docs/runs/compression.md) |

## 16.9. Nexus inspection tools (`view` / `file`)

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_VIEW_MAX_BUFFER_BYTES` | Override the buffered-path size threshold that the `view` / `file` guardrail refuses without `--force`. | 1 GiB | [Size guardrails and `--force`](https://morloc-project.github.io/docs/utilities/nexus-view.md#view-size-guardrails) |
| `MORLOC_FILE_MAX_SCAN_SUBPACKETS` | Cap on sub-packets scanned when classifying a footer-less stream file. | `10000` | [Stream packets](https://morloc-project.github.io/docs/utilities/nexus-file.md#stream-packets) |
| `MORLOC_CSV_SNIFF_ROWS` | Data rows Arrow scans to infer a CSV schema. `0` falls back to `String` columns; a non-numeric value falls back to the default. The whole file is never scanned. | `100` | (pending) |

## 16.10. String safety

| Variable | Description | Default | Introduced in |
| --- | --- | --- | --- |
| `MORLOC_SKIP_NULL_CHECK` | Skip the interior-NUL scan on strings crossing into a pool (unsafe). Set to `1`/`true`/`yes`. | off | [Null strings](https://morloc-project.github.io/docs/features/strings.md#nul-bytes) |
