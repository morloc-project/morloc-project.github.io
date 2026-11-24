# 13.10. Code generation

Morloc Manual > Compiler Architecture | https://morloc-project.github.io/docs/compiler-architecture/compiler-codegen.html | prev: https://morloc-project.github.io/docs/compiler-architecture/compiler-ownership.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-interface.md

> Code generation is the last stage that works on the program’s code. It takes the per-language trees left by segmentation, serialization and ownership planning, in which every call is resolved to one implementation in one language and every crossing has a wire form, and turns each language’s share into the source text of one pool. This section specifies how pools are assembled, how user types become native definitions, which values are fixed at build time, and the properties every generated pool has whatever its language. The manifest that describes the program’s commands is built beside the pools and is specified in [Interface generation](https://morloc-project.github.io/docs/compiler-architecture/compiler-interface.md).

**Input.** The unit of code generation is the **manifold**: a function the compiler generates for a call site, together with the context it needs ([Segmentation and cross-language calls](https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.md)). Each manifold carries an integer id, unique within the build, and a language. Manifolds are grouped by the pool they run in, which is their language’s own pool, except that a guest language’s manifolds join the pool of its host ([Language onboarding](https://morloc-project.github.io/docs/compiler-architecture/compiler-onboarding.md)). Within one pool every manifold, nested ones included, is defined once under its id. Two different manifolds that would share an id in one pool are an internal compiler error, since a caller of that id would run whichever one was emitted.

**Build-time values.** Before translation, the intrinsics whose value is fixed when the program is built are replaced by literals:

| Intrinsic | Replaced by |
| --- | --- |
| `@version` | The compiler version that built the program. |
| `@compiled` | The build time, as an ISO 8601 UTC timestamp. |
| `@lang` | The name of the language whose pool evaluates it. |
| `@datafile p` | The installed location of data file `p`, or `p` unchanged when the program is not installed. |

Every other intrinsic (`@save`, `@load`, `@hash`, `@show`, the stream operations, …​) is a call into the language’s runtime binding, which implements it once for every program ([Intrinsics](https://morloc-project.github.io/docs/features/intrinsics.md), [Runtime library API](https://morloc-project.github.io/docs/compiler-architecture/compiler-libmorloc.md)).

**Two translators.** Every language is translated in two steps: the manifolds are lowered into one shared imperative form (statements, expressions, function definitions, and two dispatch tables), and a per-language printer writes that form as source text. The languages differ in how much of this is data:

-   A dynamically typed language (Python, R) is translated entirely from its language description: literals, list and record constructors, field and index access, function headers, lambdas, partial application, block style, and the names of the runtime calls that serialize, deserialize and call another pool are all templates in that description. No code specific to the language exists in the compiler.
-   A statically typed language (C++, Rust) has a dedicated translator, because it must render a native type for every value, emit type definitions in an order the compiler accepts, and generate marshalling code for each user type.

**Pool assembly.** Each language has a fixed pool template that holds the runtime scaffolding: process start, the arguments a pool is started with, and the hand-off to the runtime’s pool loop. The generated code is spliced into marked sections of that template:

![Diagram](https://morloc-project.github.io/docs/static/img/mermaid-b8906e70d5074bf42c9be1a26858a021.svg)

| Section | Contents |
| --- | --- |
| Sources | Imports or includes of the user’s sourced files, and the language’s preamble. |
| Types | Native definitions of user types and their marshalling code (statically typed languages only). |
| Declarations | Forward declarations of every manifold, so definition order never matters. |
| Manifolds | One function per manifold, named by its id. |
| Dispatch | A local table mapping each entry point’s id to its function, and a remote table for calls that arrive as jobs from another node. |

The ids in the dispatch tables are the `mid` values the manifest records for each command, and the ids a calling pool puts in its call packets ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)).

**Inlining keeps evaluation order.** Not every application becomes a function of its own; one that does not is written as an expression at its use. Such an inlined application is evaluated exactly where the call it replaces would have been: its statements go immediately before the statement that uses its value, in the same block. A position that is not evaluated eagerly (an arm of a conditional, the second operand of `&&` or `||`) is a block of its own, so whatever is inlined there is evaluated only if that position is.

**Native types.** A morloc type reaches a language through its native form, a template that a `type L ⇒ …​` declaration gives ([Native type mappings](https://morloc-project.github.io/docs/features/foreign-functions.md#mapping-native-types)): `type Cpp ⇒ (List a) = "std::vector<$1>" a` renders `[Int]` as `std::vector<int>`, given `type Cpp ⇒ Int = "int"`. An alias with no form of its own uses its expansion’s. How user types appear in each language:

| Language | Record | `data` type with payloads |
| --- | --- | --- |
| Python | A `dict` keyed by field name by default, or a generated frozen dataclass or pydantic model when the record names that kind. | Generated: a base class with one frozen class per constructor nested in it. A type with no payloads is a generated `enum.Enum` whose values are the wire tags. |
| R | A named `list`. | Nothing is generated; the binding builds the value from its wire form. |
| C++ | Generated: a struct named by the declaring module’s path, unless the user maps the record to a type of their own. A recursive record is a handle sharing an immutable struct of its fields. | Generated: a struct holding a `std::variant` of `std::shared_ptr<const Arm>`, one alternative per constructor in declaration order. A type with no payloads is a generated enum. |
| Rust | Generated, as in C++, with its marshalling code. | Generated, with its marshalling code. |

In C++ the declarations follow what holds what by value: enums first, then variant wrappers (which hold their arms through pointers), then records, then arm bodies, and every marshaller is declared before any is defined.

**Wrappers.** Three kinds of manifold get a wrapper around their body. A call labeled for caching looks its key up before running and stores the result after ([Caching](https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.md)). A program built with `--debug` records every call in its trace ([Error propagation](https://morloc-project.github.io/docs/build-architecture/build-errors.md)). A tail-recursive function that the compiler can run as a loop is emitted as one ([Segmentation and cross-language calls](https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.md)).

**The fingerprint.** When every pool’s source is final, the compiler hashes each one and writes the hash into the manifest. The hash covers the pool’s emitted source text, the files the program lists under `hash-include`, the build parameters, and any compiled guest objects linked into the pool, since the last two change the binary without changing the source. It is the pool’s contribution to every cache key ([Caching](https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.md)), so it is computed after emission and before anything is written to disk.

**What every pool does.** Whatever its language, a generated pool:

-   is started with three trailing arguments: its socket path, the run’s temporary directory, and the shared-memory base name;
-   is ready when it answers a ping on its socket ([Process lifecycle](https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md));
-   answers every call with exactly one packet, a value or a failure ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md));
-   turns an error raised by user code into a failure of that call, and goes on serving;
-   is entered only through its dispatch tables, by manifold id; calls within the pool are native calls.

A language may reserve name prefixes and names for what its pool defines. A sourced name that uses one is rejected at build, so user code and generated code cannot shadow each other.

How a pool spreads its calls over threads or processes is specified in [Worker model](https://morloc-project.github.io/docs/build-architecture/build-workers.md).
