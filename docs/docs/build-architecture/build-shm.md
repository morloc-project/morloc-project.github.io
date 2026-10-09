# 13.6. Shared memory layout

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-shm.html | prev: https://morloc-project.github.io/docs/build-architecture/build-packets.md | next: https://morloc-project.github.io/docs/build-architecture/build-voidstar.md

> Large values pass between pools through shared memory, so a value written by one process can be read by another where it lies, with only an 8-byte pointer crossing the socket. This section specifies the shared-memory volumes and blocks of a run, the pointer forms that address them, and the rules for allocating, sharing and releasing a block among processes that may die at any moment.

**Volumes.** A run’s shared memory is a set of **volumes**, each a POSIX shared-memory object mapped by every process of the run. Volume *i* is named `<base>-<i>` with *i* as four hex digits, where the nexus chooses the base name (`/mlc-<pid>-<random>-<generation>`) and passes it to every pool. The generation changes when a daemon discards its shared memory and starts over, so the new namespace never collides with the old. Volume 0 is never created: index 0 is reserved for pointers into a self-contained buffer ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md)). The first volume is index 1, with 64 KiB of data; a process that needs more creates another volume at an unused index, at least twice the size of the last, up to 32767 volumes. If the shared-memory filesystem is full or unavailable, a volume is created as a file in the run directory instead, and a zero-length stub under the shared-memory name tells other processes where it is.

Each volume starts with a header:

| Offset | Size | Field | Meaning |
| --- | --- | --- | --- |
| 0 | 4 | magic | `0xFECA0DF0`, written last by the creator; a volume without it is not ready. |
| 4 | 128 | name | The volume’s name, NUL-padded. |
| 132 | 4 | index | The volume’s index, checked when a process opens it. |
| 136 | 8 | size | Bytes of data after the header. |
| 144 | 8 | reserved | 0. |
| 152 | \- | lock | A process-shared lock guarding the block list (size set by the platform). |
| \- | 8 | cursor | Offset of the block where the next search starts, or -1. |

The header is padded to a multiple of 16 bytes, and the data region follows it. Volumes never leave the machine, so the platform’s own lock layout is acceptable.

**Blocks.** The data region is a sequence of blocks, each a 16-byte header followed by its data:

| Offset | Size | Field | Meaning |
| --- | --- | --- | --- |
| 0 | 4 | magic | `0x0CB10DF0` for a block; `0x0CB1DEAD` for a header merged into a neighbor. |
| 4 | 4 | references | 0 when free; all ones while the last reference is being dropped. |
| 8 | 8 | size | Bytes of data. |

Block data is 16-byte aligned and its size a multiple of 16, because some Arrow column types hold 128-bit words that another language’s Arrow library will read in place and expects aligned. To allocate, a process takes the volume’s lock, searches first-fit from the cursor (merging adjacent free blocks as it passes them), splits off any usable remainder as a new free block, and sets the block’s count from 0 to 1. It tries the volume it used last, then the others, then creates a new volume.

**Pointers.** Three forms address shared memory:

| Form | Meaning |
| --- | --- |
| Relative | Volume index in bits 62-48 and offset into that volume’s data in bits 47-0; -1 is null ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md)). The same in every process; this is the only form that crosses a process boundary. |
| Volume | An offset into one volume’s data region. Used inside a volume, for its cursor. |
| Absolute | An address in this process. Never stored in shared memory, since each process maps the volumes at different addresses. |

Converting a relative pointer to an absolute one maps the named volume on first use, so a process can follow a pointer into a volume another process created after it started.

**References.** A block’s count is the number of holders that may still read it. The allocator holds the first reference. A process sending a pointer to another takes a reference for the receiver before sending ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)), and the receiver owns it on arrival. Taking a reference on a block that is free or being released fails rather than reviving it. The last release overwrites the block’s data with zeros before marking it free, so a stale reader sees zeros instead of another value. A count names no holder, so the references of a process that died cannot be found and released one by one; they are recovered only by discarding the whole namespace, which the end of a run, or a daemon’s recovery, does.

**Concurrency.** Each volume’s lock is **robust**: if a process dies holding it, the next process to take it is told so. The volume’s block list may then be half edited, so the volume is marked damaged and never allocated from again; allocation moves on to another volume. A volume is created with exclusive creation, so when two processes race to create the same index one wins and the other opens the winner’s volume once its magic appears.

**Removal.** The process that created the first volume (the nexus) removes the names of all volumes when the run ends ([Process lifecycle](https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md)). It never unmaps them while threads may still read; the kernel frees the memory once the last process unmaps it.
