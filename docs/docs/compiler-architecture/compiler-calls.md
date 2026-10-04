# 14.8. Cross-language calls and tail calls

Morloc Manual > Compiler Architecture | https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.html | prev: https://morloc-project.github.io/docs/compiler-architecture/compiler-serialization.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-codegen.md

**STUB**: Specifies how a call in one language reaches a function in another: the stub generated on the calling side, the dispatch on the receiving side, and how arguments and results cross the boundary. Defines how tail calls, including mutually recursive ones that cross languages, run in constant stack space.
