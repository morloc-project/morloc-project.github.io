# 13.1. Pipeline overview

Morloc Manual > Compiler Architecture | https://morloc-project.github.io/docs/compiler-architecture/compiler-pipeline.html | prev: https://morloc-project.github.io/docs/compiler-architecture/index.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-parsing.md

> The compiler is a sequence of passes over three kinds of program representation: a graph of modules, a set of typed expression trees (one per exported function), and per-language trees of callable units that become pool source. This section lists the passes in order and states what each consumes, produces and guarantees to the passes after it. It is the map for the rest of the chapter.

**Three phases.** The **frontend** reads source into a module graph, dissolves it into one expression tree per export, and typechecks those trees with **general** types: types that name no language. The **middle** chooses, for every call, which implementation runs and in which language. The **backend** lowers each realized tree into **manifolds**: the compiler’s unit of generated function, one per call site that needs a function of its own. It cuts the manifolds into per-language pools, adds serialization where values cross, and prints source text.

![Diagram](https://morloc-project.github.io/docs/static/img/mermaid-4e24c3a394e8c57503e628c86c1c95db.svg)

**The passes.** Each pass may assume what the passes before it established. A pass that receives input violating one of these guarantees stops with an internal compiler error; no pass repairs its input.

| Pass | Produces | Guarantees after it |
| --- | --- | --- |
| Lex and parse ([Parsing and module loading](https://morloc-project.github.io/docs/compiler-architecture/compiler-parsing.md)) | One syntax tree per source file | Layout is explicit; sugar (`do`, holes, string interpolation) is desugared to core expressions. |
| Load modules ([Parsing and module loading](https://morloc-project.github.io/docs/compiler-architecture/compiler-parsing.md)) | A directed acyclic graph of modules, edges labeled by import lists | Every import names a loaded module and only names that module exports. |
| Resolve names and link ([Parsing and module loading](https://morloc-project.github.io/docs/compiler-architecture/compiler-parsing.md)) | Global tables of signatures, implementations, types and instances | Every name refers to exactly one declaration; local binders are unique program-wide; the several definitions of one term are merged. |
| One tree per export | An expression tree per exported function, with declarations inlined at their uses | The module graph is gone; trees carry every candidate implementation of each term. |
| Typecheck and specialize ([Type system](https://morloc-project.github.io/docs/compiler-architecture/compiler-types.md)) | Trees annotated with general types | Every node has a general type; a polymorphic definition is elaborated once per type it is used at. |
| Value checks and term sharing ([Term sharing and inlining](https://morloc-project.github.io/docs/compiler-architecture/compiler-sharing.md)) | Trees with sharing made explicit | Alternative implementations do not provably contradict; a discarded `Try` is rejected; each named value is computed once. |
| Realize ([Realization](https://morloc-project.github.io/docs/compiler-architecture/compiler-realization.md)) | Pure trees, and realized trees with one implementation and language per node | Every call has exactly one implementation. A tree with no foreign call is pure and is evaluated by the nexus. |
| Manifest ([Interface generation](https://morloc-project.github.io/docs/compiler-architecture/compiler-interface.md)) | The command schema for every export | Each concrete export becomes a command; a generic export is skipped with a warning. |
| Express manifolds ([Segmentation and cross-language calls](https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.md)) | Per-language manifold trees with concrete types | Every node has its concrete type in its language; applied lambdas are reduced. |
| Insert effect boundaries ([Effects](https://morloc-project.github.io/docs/compiler-architecture/compiler-effects.md)) | Trees with every suspension and force explicit | The number of times each suspension runs is fixed; no later pass changes it. |
| Segment into pools ([Segmentation and cross-language calls](https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.md)) | One set of manifolds per language | No manifold calls across a language except through a foreign-call node. |
| Serialize ([Serialization](https://morloc-project.github.io/docs/compiler-architecture/compiler-serialization.md)) | Manifolds with pack and unpack at every crossing | Every crossing value has a wire form both sides agree on. |
| Emit pool source ([Code generation](https://morloc-project.github.io/docs/compiler-architecture/compiler-codegen.md), [Ownership](https://morloc-project.github.io/docs/compiler-architecture/compiler-ownership.md)) | Source text of each pool | Each read of a value in C++ and Rust is a borrow, copy or move. |
| Build | The program directory of [Compilation artifacts](https://morloc-project.github.io/docs/build-architecture/build-artifacts.md) | Pools are compiled, and the manifest records each pool’s source fingerprint. |

**General and concrete types.** The frontend works only with general types, so a program typechecks before any language is chosen. Concrete types, the native types a value has in one language, enter after realization. Keeping them apart is what lets one signature have implementations in several languages and lets the compiler choose among them late ([Type system](https://morloc-project.github.io/docs/compiler-architecture/compiler-types.md), [Realization](https://morloc-project.github.io/docs/compiler-architecture/compiler-realization.md)).

**Trees, not a graph.** After the frontend each export is its own tree, and a definition used in several places appears at each of them. Done naively, this duplicates terms exponentially in nesting depth. Term sharing and the rule that a definition is elaborated once per type keep the output proportional to the source ([Term sharing and inlining](https://morloc-project.github.io/docs/compiler-architecture/compiler-sharing.md)).

**What runs where.** Realization divides the program. A pure tree never reaches a pool: the nexus evaluates it directly. A realized tree becomes manifolds, and segmentation places each manifold in the pool of its language. The call from the nexus enters a pool at the manifold of the export, and calls between pools go through generated stubs ([Segmentation and cross-language calls](https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.md)).

**Inspecting the pipeline.** `morloc dump` prints the program after parsing. `morloc typecheck` runs the frontend and prints each export’s general type; with `--realize` it also runs realization. Neither command builds pools.
