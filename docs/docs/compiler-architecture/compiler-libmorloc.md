# 13.13. Runtime library API

Morloc Manual > Compiler Architecture | https://morloc-project.github.io/docs/compiler-architecture/compiler-libmorloc.html | prev: https://morloc-project.github.io/docs/compiler-architecture/compiler-onboarding.md | next: https://morloc-project.github.io/docs/future/index.md

> `libmorloc` is the shared library every pool links. It owns what must be the same in every language: shared memory, schemas, packets, sockets, Arrow blocks, the result cache, stream files and the intrinsics. A language binding wraps it for its language and adds one thing of its own, a walker that writes native values into the voidstar layout and reads them back ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md)). This section specifies the C ABI declared in `morloc.h` that bindings are written against. Functions only the nexus or the daemon uses are out of scope.

**Division of labour.** The library never touches a language’s objects. It parses a schema string into a `Schema` tree whose nodes carry each slot’s width, alignment and field offsets, so no binding recomputes the layout and none can disagree about it. The binding walks that tree, sizes the value, allocates a block with `shmalloc`, and fills it. Reading is the reverse: the library turns a packet into a pointer to a voidstar value, and the binding walks it into native objects, resolving each relative pointer through `resolve_region`.

**ABI version.** `morloc.h` defines `MORLOC_ABI_VERSION`, an integer distinct from the release version, and the library reports the value it was built with through `morloc_abi_version()`. It changes whenever a declaration in the header or the packet format changes. A binding compiled against one version is only correct with a library that reports the same one.

**Errors.** Every fallible function takes `char** errmsg_` as its last parameter (`ERRMSG` in the header). The callee sets `*errmsg_` to NULL on entry. On failure it sets it to a ``malloc’d, NUL-terminated message, which the caller frees with `free()``, and returns a failure value, usually NULL for a pointer, `false` for a `bool`, `-1` for a handle, `RELNULL` for a relative pointer and non-zero for an `int` status. A caller tests `*errmsg_`, which is set exactly when the call failed. One outcome is not a failure: a stream write whose reader has gone returns `MLC_RESULT_PIPE_CLOSED` with no message, so the run can end with the broken-pipe status. A failure carried in a packet (status fail, [Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)) is data, not a failed call: reading such a packet’s value fails with the packet’s message.

**Ownership.**

| What the library returns | Who releases it, and how |
| --- | --- |
| `char*` strings and `uint8_t*` packets | The caller, with `free()`. |
| `Schema*` from `parse_schema` | The caller, with `free_schema`. |
| `morloc_call_t*` from `read_morloc_call_packet` | The caller, with `free_morloc_call`; the argument pointers inside it point into the call and die with it. |
| A shared-memory block | Reference counted. `shmalloc` returns a block holding one reference for the caller; `shincref` adds one; `shfree` releases one, and the last release frees the block. |
| A value (`void*`) returned by an intrinsic | A voidstar in a fresh shared-memory block the caller holds one reference to. |
| A stream handle or fold cell (`int64_t`) | The caller, with `mlc_close` or `mlc_cell_free`. A cell still live when its dispatch ends is swept. |

A data packet that names a shared-memory block carries a reference the sender took on the receiver’s behalf ([Shared memory layout](https://morloc-project.github.io/docs/build-architecture/build-shm.md)). The receiver inherits that reference and releases it once, when it is done with the value; it never takes its own on arrival. An Arrow array passed to `arrow_to_shm` is consumed: its release callback runs once the copy is made.

**Panics.** A panic in the library is an internal error, never a reported failure. Unless a catch scope holds it, it ends the process at once with exit status 70 ([Error propagation](https://morloc-project.github.io/docs/build-architecture/build-errors.md)). A binding installs the library’s hook once at start (`morloc_install_panic_hook`, `morloc_install_crash_handler`).

**Hosting a pool.** A binding chooses one of two process models ([Worker model](https://morloc-project.github.io/docs/build-architecture/build-workers.md)). A threaded pool calls `pool_main` with a `pool_config_t` holding its dispatch callbacks; the library accepts connections and runs each call on a worker thread. A forking pool calls `morloc_fork_pool_run` with a `morloc_fork_pool_t` that says how to fork, initialise and serve one connection; each worker reads the call with `stream_from_client` and answers with `send_reply_to_foreign_server`.

**Shared memory**

| Function | Purpose |
| --- | --- |
| `shinit` | Map the program’s shared memory, given its base name and initial size. |
| `shm_set_fallback_dir` | Directory for file-backed volumes when the shared-memory filesystem is too small. |
| `shmalloc` | Allocate a block holding one reference for the caller. |
| `shincref` / `shfree` | Take / release one reference on a block. |
| `rel2abs` / `abs2rel` | Convert between a relative pointer and an address in this process. |
| `rel2abs_extent` | `rel2abs`, checking that `extent` bytes are readable. |
| `resolve_region` / `resolve_array` | Inline resolve of a relative pointer to `extent` bytes, or to an array’s data, in a `morloc_space_t`; reads the per-process volume table and falls back to `rel2abs_extent`. |
| `morloc_shm_space` / `morloc_payload_space` | The space a value’s pointers lead into: shared memory, or an inline packet payload of known length. |
| `morloc_view_held` / `morloc_view_released` | Record and forget a native view (such as an array over a block) so a forked child keeps the block alive. |
| `morloc_shm_live_bytes` | Bytes of shared memory the program holds, when statistics are on. |

**Schemas and encodings**

| Function or type | Purpose |
| --- | --- |
| `Schema`, `morloc_serial_type`, `Array` | A parsed schema node (type, parameters, keys, hint, width, alignment, offsets); a variable-length slot. |
| `parse_schema` / `free_schema` | Parse a schema string into a `Schema` tree / free it. |
| `schema_to_string` | Render a `Schema` back to its string. |
| `pack` / `pack_with_schema` | Encode a voidstar value as MessagePack. |
| `unpack_with_schema` | Decode MessagePack into a voidstar value. |
| `morloc_f32_from_f64` | Narrow a double to a float, failing on a finite value out of range. |
| `morloc_first_null_in_value` | Describe the first string in a value holding a NUL byte, or NULL. |

**Packets and calls**

| Function | Purpose |
| --- | --- |
| `morloc_packet_fits` / `morloc_packet_size` | Check a buffer holds a whole packet / total size of a packet. |
| `packet_is_ping` / `packet_is_local_call` / `packet_is_remote_call` | Classify a received packet. |
| `return_ping` | The reply to a ping. |
| `read_morloc_call_packet` / `free_morloc_call` | Split a call packet into function index and argument packets / free it. |
| `make_morloc_local_call_packet` | Build a call packet from a function index and argument packets. |
| `make_data_packet_auto` | Wrap a voidstar value: inline below the size threshold, else by reference to its block. |
| `make_inline_data_packet` | Wrap a value inline whatever its size, for a value that must outlive its block. |
| `make_arrow_data_packet` | Wrap an Arrow block by reference. |
| `make_fail_packet` / `make_pipe_closed_packet` | An error packet / one marking a closed output pipe. |
| `morloc_packet_is_pipe_closed` | Whether a packet is the closed-pipe marker. |
| `get_morloc_data_packet_value` | The voidstar value a data packet carries, decompressed and loaded as needed. |
| `get_morloc_data_packet_error_message` | The message of a failed data packet, or NULL. |
| `morloc_dup_packet` | A copy of an argument packet a pool can return as its result, with its own reference. |
| `file_is_stream_packet` | Whether a path names a stream file rather than a single packet. |
| `send_and_receive_over_socket` | Send a call to another pool’s socket and return its reply. |
| `remote_call` | Run a call on a cluster node through the scheduler, with its resources. |

**Pools and processes**

| Function or type | Purpose |
| --- | --- |
| `pool_main`, `pool_config_t` | Run a threaded pool with the binding’s dispatch callbacks and per-dispatch release. |
| `morloc_fork_pool_run`, `morloc_fork_pool_t` | Run a forking pool; workers never return from it. |
| `morloc_fork_worker` | Fork a worker, refusing unless the process has one thread. |
| `stream_from_client` | Read one whole packet from a connection. |
| `send_reply_to_foreign_server` | Send a reply, running the release callback before it is sent. |
| `close_socket` / `close_daemon` | Close a socket / a pool’s listening socket and state. |
| `morloc_fork_generation` / `morloc_exit_if_forked` | Fork generation at request time / exit if user code forked during the call. |
| `morloc_install_panic_hook` / `morloc_install_crash_handler` | Install the panic exit / report the active function on a fatal signal. |
| `morloc_set_panic_classifier`, `morloc_catch_scope`, `morloc_panic_decide`, `morloc_panic_caught` | Tell user panics from runtime panics, for a pool whose own language panics. |

**Arrow**

| Function | Purpose |
| --- | --- |
| `arrow_to_shm` / `arrow_to_shm_typed` | Copy an Arrow C Data Interface array into a fresh table block; the typed form casts declared columns, refuses nulls in non-optional ones and puts declared columns first. |
| `arrow_stream_to_shm_typed` | The same for an Arrow stream, concatenating its batches. |
| `arrow_validate` | Check a received block against the declared columns. |
| `arrow_from_shm_owned` | Import a block as Arrow C Data Interface structs, recording it so a table returned unchanged is passed on without a copy. |
| `arrow_live_view_bytes` | Shared memory held by this process’s open table views, for languages whose collector cannot see it. |

**Caching**

| Function | Purpose |
| --- | --- |
| `morloc_pool_hash` | The pool’s source fingerprint, mixed into every key. |
| `morloc_cache_key_compute` | A key from a function index and its argument values (not their pointers). |
| `morloc_cache_lookup` / `morloc_cache_store` | Read / atomically write a cached result packet under a label and key. |
| `morloc_cache_record_hit` / `_miss` / `_store` | Count events for the run summary. |

**Intrinsics: values**

| Function | Purpose |
| --- | --- |
| `mlc_save` / `mlc_save_json` / `mlc_save_voidstar` | Write a value as MessagePack, JSON, or a voidstar packet (optionally compressed). |
| `mlc_load` | Read a value from a file of any of those forms, or a stream file as a list. |
| `mlc_read` / `mlc_show` | Parse a value from JSON / render it as JSON. |
| `mlc_hash` / `mlc_compare` | Hash a value / order two values of one schema. |
| `mlc_cell_new` / `_get` / `_put` / `_count` / `_slot` / `_free` | Per-thread accumulators of a fold handler. |

**Intrinsics: streams and handles**

| Function | Purpose |
| --- | --- |
| `mlc_open` / `mlc_close` / `mlc_fschema` | Open a stream file as a handle of a kind / close a handle / read a file’s schema. |
| `mlc_open_istream` / `mlc_open_ostream` / `mlc_append` | Open for reading, create for writing, reopen for appending. |
| `mlc_open_stdin` / `mlc_open_stdout` / `mlc_open_stderr` | Standard streams, routed through the nexus. |
| `mlc_reclaim_stdio_after_dispatch` | Release a standard stream a dispatch left open. |
| `mlc_next` / `mlc_next_frame` / `mlc_next_with` | Next batch as a list block / telling end from an empty batch / handed to a decoder in place. |
| `mlc_write` / `mlc_flush` / `mlc_concat` / `mlc_tell` | Write a batch / flush buffered elements / join stream files / elements written to standard output. |
| `mlc_ifile_walk` / `mlc_ifile_length` / `mlc_stream` / `mlc_stream_layout` | Random access into a file: a path into its value, its length, a reader over it, its batch layout. |
| `mlc_open_channel` / `mlc_spawn` / `mlc_settle` | A channel between pools, its producer, and its end. |
| `mlc_tmpfile` / `mlc_unlink_tmp` | A temporary file removed when the call ends / remove it early. |
| `mlc_handle_path_len`, `mlc_handles_path_lens`, `mlc_write_handle_voidstar`, `mlc_write_handles_voidstar`, `mlc_read_handle_voidstar` | Write a handle into a value as its path, and open a handle from one, when a handle crosses pools. |

**Utilities**

| Function | Purpose |
| --- | --- |
| `morloc_abi_version` | The ABI version the library was built with. |
| `morloc_log_next_id` / `morloc_log_emit` | A call id / a formatted log line for a labeled function. |
| `morloc_bench_record` | Record one timing of a benchmarked function. |
| `hex` | Print bytes in hexadecimal, for debugging. |
