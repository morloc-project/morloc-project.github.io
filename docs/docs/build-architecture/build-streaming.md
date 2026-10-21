# 13.9. Streaming and memory mapping

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-streaming.html | prev: https://morloc-project.github.io/docs/build-architecture/build-tables.md | next: https://morloc-project.github.io/docs/build-architecture/build-errors.md

> A **stream** is a list too large or too long-lived to hold in memory at once, kept in a file and read or written in batches. Any pool can read a stream another pool is writing, and a finished stream file can be read at random without loading it. This section specifies the stream file format, its compression, how processes share an open stream, how every write reaches the file through a single writer in the nexus, and what a reader may rely on while the stream is still being written.

**Stream types.** Three Morloc types name a stream, each a 16-byte slot in voidstar (schema codes `F`, `I`, `O`):

| Type | Use |
| --- | --- |
| `IFile [a]` | A finished file, read at random by element index. |
| `IStream a` | A stream read forward in batches. Several readers share one cursor, so together they consume each batch once. |
| `OStream a` | A stream written in batches. |

The slot’s first byte says what follows in its last eight: 0 for a relative pointer to a path (length, then bytes), 1 for the index of an open stream in the run’s stream registry (below). A path can cross between runs; an index means something only inside the run that opened it.

**File format.** A stream file is a sequence of packets ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)):

| Part | Contents |
| --- | --- |
| Head | A stream packet (type 3) whose metadata holds the schema of the list, `a` followed by the element schema. Its length field is all ones. |
| Batches | Data packets, one per batch. Each payload is a self-contained voidstar array of that batch’s elements, its pointers relative to the start of the payload. |
| Footer | A footer packet (type 4) whose metadata holds a batch index (offset and element count of every batch), a final marker, and a status. |
| Tail | 8 bytes: the footer’s length as a 32-bit integer, then the magic bytes reversed (`07 07 f8 6d`). |

A reader finds the footer from the end of the file through the tail, so random access needs no scan. The status is `closed` for a stream written to the end, `paused` for one a writer stopped and may resume, or `failed` for one whose writer died in the middle of an update. While a stream is open for writing, a temporary footer carrying only diagnostics is rewritten after every batch, so the file always ends in a valid tail.

**Compression.** Each batch is compressed separately with Zstandard, so a reader can decompress any batch without the others. A batch is split into independent frames of at most 16 MiB, listed in the batch’s metadata, so they can be decompressed in parallel straight into shared memory. The user’s compression level 0-9 maps to Zstandard levels 0, 1, 3, 6, 9, 12, 15, 19, 21 and 22, with long-distance matching from level 7.

**Sharing an open stream.** A stream’s identity lives in a **registry** in shared memory, created with the run’s first volume. Each slot records the file’s path, schema and element count, a write buffer, and a generation number that changes when the slot is opened and when it is released. A stream index carries the generation it was made with, and every operation checks it, so an index to a closed stream can never touch the stream that later reuses its slot. A process reading a stream keeps its own descriptor and read-only mapping of the file.

**Writing a stream.** Every output stream has exactly one writer: a thread in the nexus, started when the stream is opened. No pool opens, locks or writes the file of a stream it writes to; it only hands the nexus its elements. Standard output and standard error are written the same way.

![Diagram](https://morloc-project.github.io/docs/static/img/mermaid-575da0c868de8571b65f511c685c406a.svg)

1.  `@open` and `@append` ask the nexus to open the file. It takes an exclusive lock on the file, writes the head (or, for `@append`, finds the end of the last complete batch), registers the stream and starts its writer.
2.  A `@write` from any process appends its elements to the stream’s buffer in shared memory, holding the stream’s lock only for the copy. One \`@write’s elements stay together; writes from different processes interleave only between writes, in the order they took the lock.
3.  A full buffer is moved onto the stream’s queue and replaced by an empty one, still under the lock and without touching the file. The writer takes buffers off the queue in order, compresses them on several threads (as under Compression above), and appends them to the file in queue order, so compression never reorders elements.
4.  The queue holds a bounded number of buffers (7 for a compressed stream, 1 for an uncompressed one). A writer that finds it full waits for the nexus, never for another pool, so streams add no way for pools to deadlock.
5.  `@flush` queues the buffered elements and returns once the nexus has written them, so a reader opened afterwards sees them. `@close` does the same and also waits for the final footer, so when it returns the file is complete, its lock is released and its path can be opened again at once.

A process that exits or dies after its `@write` returned loses nothing: its elements are already in shared memory, and the nexus writes them when the stream is flushed or closed. A process that dies while holding the stream’s lock may leave the buffer half updated; the stream is then failed, the batches queued before it are still written, and the footer says `failed`. A stream the program never closes is discarded when its index is dropped or the run ends: what was queued is written, the unflushed elements are dropped, and the file keeps its temporary footer, the sign that its writer did not finish. A daemon recovering from a pool crash ([Serving](https://morloc-project.github.io/docs/ecosystem-architecture/eco-serving.md)) stops every writer before it discards shared memory, and each file ends with a `failed` status.

**Readers.** An `IFile` maps the file and locates an element through the batch index. A batch stored uncompressed and 8-byte aligned is read where it lies in the mapping; any other batch is decompressed or copied into shared memory first. An `IStream` reads forward from the shared cursor. A reader that opens a stream still being written sees the batches written before it opened, up to the temporary footer; reading past the end yields an empty batch.

**Rewriting a file.** Opening an `OStream` on a file that already has data writes a new file and renames it into place, so a reader that still has the old file mapped keeps a consistent view. Where a rename is impossible (the directory is not writable, say) and nothing in the program is reading the file, it is truncated in place instead. The runtime never deletes a stream file; only a half-written temporary file is removed on failure.
