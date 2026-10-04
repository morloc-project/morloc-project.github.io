# 13.1. Runtime overview

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-overview.html | prev: https://morloc-project.github.io/docs/build-architecture/index.md | next: https://morloc-project.github.io/docs/build-architecture/build-artifacts.md

**STUB**: Gives the high-level picture of a running program. The nexus is the entry point that parses the request, reads the manifest, and dispatches calls. Pools are one long-lived process per language that execute the generated code. Explains how a call travels from the nexus into a pool, between pools, and back, and when data moves inline versus through shared memory. Serves as the map for the rest of the chapter.
