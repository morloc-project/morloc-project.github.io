# 13.5. Shared memory layout

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-shm.html | prev: https://morloc-project.github.io/docs/build-architecture/build-packets.md | next: https://morloc-project.github.io/docs/build-architecture/build-voidstar.md

**STUB**: Specifies the shared memory that pools use to exchange large values without copying. Defines volumes, the volume header, block headers, and the three pointer forms (pool-relative, volume-relative, absolute) with the rules for converting between them. Covers allocation, reference counting and release, how volumes are created and attached safely by concurrent processes, and how file locking protects them.
