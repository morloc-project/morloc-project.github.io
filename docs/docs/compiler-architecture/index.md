# 13. Compiler Architecture

Morloc Manual | https://morloc-project.github.io/docs/compiler-architecture/ | prev: https://morloc-project.github.io/docs/build-architecture/build-runs.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-pipeline.md

This chapter specifies how the compiler turns Morloc source into the artifacts described in [Build Architecture](https://morloc-project.github.io/docs/build-architecture/index.md). It begins with a map of the pipeline. It then follows a program through it: parsing and module loading, typechecking, effects, term sharing, realization, segmentation into pools, serialization, ownership and code generation. It ends with how the manifest’s command interface is derived, how a new language is brought into Morloc, and the API of the runtime library, which is the contract every language binding is written against.
