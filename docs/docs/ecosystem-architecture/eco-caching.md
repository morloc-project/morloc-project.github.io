# 12.4. Caching

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-bootstrap.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-remote.md

> A label that asks for `cache` makes each call through it look up its result on disk before computing it, and store the result after. The cache is shared by every program, pool language and run on a machine, and by every machine that mounts the same directory. This section specifies what identifies a call, where entries live, how they are written so that readers never see a partial one, and what invalidates them. What a label wraps, and when a cached call is worth making, is in [Caching](https://morloc-project.github.io/docs/runs/caching.md).

**What is cached.** A label wraps one call of a function, or one run of a suspension. A cached call is looked up when it is made and stored when it returns. A call that fails is not stored, so the same call fails again rather than returning a value that was never computed. A suspension is cached per run: a held suspension run twice looks up twice, and the second run is a hit. Caching is the user’s claim that the call returns the same value whenever it is made with the same inputs; the runtime does not check it.

**The key.** A call is identified by three things, hashed with XXH64 into a 64-bit key:

-   The **fingerprint** of the pool the call runs in. A pool is the process that runs one language’s share of a program. Its fingerprint covers the pool’s generated source, the contents of every file the program lists under `hash-include`, the build parameters, and any compiled guest objects linked into it. The compiler computes it once per build and records it in the manifest; the nexus hands it to the pool.
-   The **call site**: the compiler’s identifier for the labeled call within the build.
-   The **value** of each argument, or for a suspension, of each value it captured. A value is hashed by walking it as its type describes it, so the hash does not depend on where the value is stored (inline in a message, in shared memory, or in a file) and never covers a pointer.

The arguments are evaluated by the caller before the lookup, so evaluating them is never skipped by a hit. Editing a function’s source, an imported module that compiles into the same pool, or a `hash-include` file changes the fingerprint, and every key from that pool with it. Nothing else does: the cache has no notion of time, and moving or copying a program does not invalidate it.

**Where entries live.** The cache base is the first of these that is set: `MORLOC_CACHE_BASE`; `$XDG_CACHE_HOME/morloc/cache`; `~/.cache/morloc/cache`; a `cache` directory in the user’s private runtime directory. An entry is two files under it:

```
<cache base>/
|-- <label>/<key>.dat     index: names the content file, and the value's type
`-- data/<hash>.dat       content: the value, as a self-contained data packet
```

The content file is named by the hash of the value it holds, so equal values stored by different labels, call sites or languages share one file. It is a data packet ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)) whose payload holds the whole value, with every reference to a file handle replaced by the file’s path; it may be compressed at the level `MORLOC_CACHE_COMPRESSION_LEVEL` gives (default: none).

**Writing.** Each file is written to a temporary name and renamed into place, so a reader sees the whole file or none of it. The content file is written first and skipped if it already exists; the index is written last. A crash between the two leaves an unreferenced content file, which a later store of the same value reuses. Concurrent stores of one key each write a complete file, and the last rename wins.

**Reading.** A lookup reads the index and follows it to the content. A missing index is a miss. So is an index that is too short to be a packet, that cannot be parsed, or whose content file is missing or empty; the lookup deletes it, and the call is computed and stored as if the entry had not existed.

Morloc removes an entry only when a lookup finds it invalid. Deleting the cache base, or any part of it, is safe while no program is using it.
