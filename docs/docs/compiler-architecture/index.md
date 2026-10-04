# 14. Compiler Architecture

Morloc Manual | https://morloc-project.github.io/docs/compiler-architecture/ | prev: https://morloc-project.github.io/docs/build-architecture/build-runs.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-pipeline.md

This chapter specifies how the compiler turns Morloc source into the artifacts described in [Build Architecture](https://morloc-project.github.io/docs/build-architecture/index.md). It follows the pipeline from parsing through typechecking, realization, serialization and code generation, and then specifies how a new language is brought into Morloc. It ends with the public API of the runtime library, the contract every language binding is written against.
