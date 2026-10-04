# 12.4. Environment solving

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-solving.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-modules.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-freezing.md

**STUB**: Specifies the contract between the compiler and the environment solver: which events trigger solving (build, install, sync), what the compiler asks for, and what it receives back. Defines how foreign packages for each language are provided to an environment, how the solved result is locked, and the guarantees the lock gives (reproducibility, and when a lock is reused or invalidated). Describes where environments and locks live and how concurrent operations on one environment are kept safe.
