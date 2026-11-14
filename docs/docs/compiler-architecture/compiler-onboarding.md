# 13.12. Language onboarding

Morloc Manual > Compiler Architecture | https://morloc-project.github.io/docs/compiler-architecture/compiler-onboarding.html | prev: https://morloc-project.github.io/docs/compiler-architecture/compiler-interface.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-libmorloc.md

> A language joins Morloc through four things: a **language description** that the compiler reads as data, a code generator that writes its pools, a **binding** to the runtime library that its pools call, and a library module that maps Morloc’s base types and functions into it. This section specifies what each must provide, how a guest language that has no pool of its own is attached to a host, and the behavior that makes a binding conforming. It is the checklist for adding a language; the pieces it names are specified in the sections it links to.

**The language description.** Everything the compiler needs to know about a language that is not code generation is declared as data, not built into the compiler:

| Declaration | Used for |
| --- | --- |
| Name, aliases, file extension | Resolving `source Py from …​` and `type Py ⇒ …​` to the language, and naming its files. |
| Compiled or interpreted, and the run command | Whether the pool is built into a binary or run as a script by an interpreter. The manifest’s start command for the pool is derived from these ([Compilation artifacts](https://morloc-project.github.io/docs/build-architecture/build-artifacts.md)). |
| Name and operator patterns | Which sourced names are legal. A sourced name that matches neither, such as a fragment of code, is rejected at build. |
| Reserved prefixes and names | Names the pool defines for itself. A sourced name that uses one is rejected at build. |
| Whether a `Str` may hold a NUL byte | A language that cannot carry one has such strings refused at the boundary into its pool. |
| Preamble | Lines placed at the top of every pool, with the Morloc home and library directories filled in. |
| Call costs | The cost of a call within the language, of a call into it from another language, and of any pair of languages that bypasses the usual crossing. Realization weighs implementations with these ([Realization](https://morloc-project.github.io/docs/compiler-architecture/compiler-realization.md)). |
| Host | For a guest language only: the language whose pool it runs in. |
| Dependencies | The runtime and the packages a pool needs, each marked as needed to build, to run, or both, and optionally as needed only by some programs. The environment manager installs them ([Environments](https://morloc-project.github.io/docs/ecosystem-architecture/eco-environments.md)). |

**The code generator.** A dynamically typed language is generated entirely from templates in its description: literals (including infinities and NaN), list, tuple and record constructors, index and field access, assignment, function headers and block style, lambdas, partial application, the import statement for a sourced file, the entries of the two dispatch tables, and the names of the binding’s functions that serialize, deserialize and call another pool. A statically typed language needs a translator of its own, because it must render a native type for every value and generate type definitions and marshalling code ([Code generation](https://morloc-project.github.io/docs/compiler-architecture/compiler-codegen.md)). Either kind also supplies a pool template: the fixed scaffolding into which the generated sections are spliced.

**Build parameters.** A compiled language’s builder reads its own keys from the `-X LANG:KEY=VALUE` parameters ([Build parameters](https://morloc-project.github.io/docs/languages/build-parameters.md)) and validates their values itself; the compiler stores them without interpreting them. The key `flags` is reserved in every language as a raw, ordered passthrough to the compile command.

**The binding.** A pool talks to the rest of the program only through the runtime library ([Runtime library API](https://morloc-project.github.io/docs/compiler-architecture/compiler-libmorloc.md)). The binding exposes it to the language: an extension module for an interpreted language, a library that a compiled pool links. It must provide:

-   conversion between the language’s native values and the binary form, in both directions, driven by the value’s schema ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md));
-   reading and writing packets, and the shared-memory references they carry ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md), [Shared memory layout](https://morloc-project.github.io/docs/build-architecture/build-shm.md));
-   the foreign call, which sends a call packet to another pool and returns its result or raises its failure in the caller;
-   the runtime intrinsics, such as `@save`, `@load`, `@hash` and the stream operations;
-   the pool loop. A threaded pool hands its two dispatch tables to the runtime’s pool main loop. A forking pool hands the runtime’s scheduler a callback that runs one job; the scheduler binds the socket and forks, retires and replaces workers ([Worker model](https://morloc-project.github.io/docs/build-architecture/build-workers.md)).

**The base library.** Morloc’s base types have no meaning in a language until a module gives them native forms (`type Py ⇒ Int = "int"`, `type Cpp ⇒ (List a) = "std::vector<$1>" a`), and the base functions until it sources implementations of them. Each shipped language has such a module, named `root-` and the language (`root-py`, `root-cpp`).

**Guest languages.** A guest has no pool. Its sourced functions are compiled into its host’s pool and called there, so a call between guest and host is a native call, not a crossing. Before realization, the compiler builds each guest source file into a linkable library with the guest’s own compiler, checks each sourced Morloc signature against the entry point the guest compiler reports (arity, element types and rank), generates host glue that converts the host’s native values to the guest’s and back, and rewrites each guest source into an ordinary host source that calls the glue. From then on the guest is invisible: the host pool links its objects, and those objects are folded into the pool’s fingerprint ([Caching](https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.md)). A guest signature may use only types the guest can represent. Futhark is a guest of C++ ([Futhark](https://morloc-project.github.io/docs/languages/futhark.md)), restricted to fixed-width numeric scalars and vectors and matrices of them.

**Conformance.** A binding is conforming when every program means the same thing whichever language the compiler picks for a call. Concretely:

| Behavior | Requirement |
| --- | --- |
| Crossing | A value sent to another language and back arrives equal to the original, whatever the route (inline, shared memory, file). |
| `Int` | Arrives as the language’s own default integer type. Fixed-width types keep their width. |
| Functions | A function value crosses as a native callable that runs in the language where it was built, called with each argument group as the source signature writes it. |
| Suspensions | Cross as callables of no arguments, run each time they are called, never by the crossing. |
| Threads | A function value may be called from threads the sourced function starts, concurrently. |
| Failures | An exception or error escaping a sourced function is a failure of that call, which `@try` can catch in any language; the pool goes on serving. |
| Arguments | Sourced code never changes a value it is given. A language that can pass by reference must make that impossible or document it as the user’s error. |
| `@show`, `@hash`, `@eq`, `@le` | Depend only on the wire value, so they agree in every language. |
| The pool | Has every property listed in [Code generation](https://morloc-project.github.io/docs/compiler-architecture/compiler-codegen.md). |

The rules for the four shipped languages, including what a mapped C++ or Rust type must allow, are in [C++](https://morloc-project.github.io/docs/languages/cpp.md), [Python](https://morloc-project.github.io/docs/languages/python.md), [R](https://morloc-project.github.io/docs/languages/r.md) and [Rust](https://morloc-project.github.io/docs/languages/rust.md).
