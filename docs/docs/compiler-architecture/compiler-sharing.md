# 13.5. Term sharing and inlining

Morloc Manual > Compiler Architecture | https://morloc-project.github.io/docs/compiler-architecture/compiler-sharing.html | prev: https://morloc-project.github.io/docs/compiler-architecture/compiler-effects.md | next: https://morloc-project.github.io/docs/compiler-architecture/compiler-realization.md

> The compiler expands each named term at every place it is used, so that each use can be realized on its own, in its own language. Done naively, that expansion makes generated code, and type checking, grow exponentially with the depth of the program’s call graph. This section specifies how the compiler keeps both proportional to the source: shared specializations for functions, let-sharing for data values, shared closures for lambdas in pools, and static-argument specialization for recursive helpers. Each one preserves the evaluation semantics of [Effects](https://morloc-project.github.io/docs/compiler-architecture/compiler-effects.md).

**Inline by name.** A morloc term may have several implementations in different languages, and realization chooses one for each call ([Realization](https://morloc-project.github.io/docs/compiler-architecture/compiler-realization.md)). So the front end does not compile a definition once and call it. It substitutes the definition at every name that refers to it, with fresh indices, and each copy is realized independently. A `where` binding is treated the same way as a top-level definition.

**Why that explodes.** If each level of a definition names the one below it twice, `d` levels of expansion produce `2^d` copies:

```morloc
f0 x = g x
f1 x = f0 x + f0 (x + 1)
f2 x = f1 x + f1 (x + 1)
-- ... f_d has 2^d copies of f0, and type checking pays the same exponent
```

The same thing happens with a value. `y = expensive x` named twice in `where` would be computed twice per copy. That costs time, and it would also violate the language’s evaluation rules: a pure argument is evaluated once, at the application, and a named value is computed at most once each time its scope is evaluated.

**Shared specializations.** A signed definition is checked once against its signature. Each use is then solved to a type, and that type, with the definition, forms a **key**. The definition is elaborated once per key, and every use at the same key gets that one elaboration, so checking cost follows the number of distinct keys, not the number of paths. When a use’s type is not fully solved, the definition or export that contains it is checked with every term expanded in place. An elaboration is either copied to each use or **shared**: emitted as a root of its own, which each use calls by name. Sharing turns copies into calls, so it is allowed only when that changes neither what the program computes nor how often it computes it:

| Condition | Why |
| --- | --- |
| A function of at least one argument, whose result is not a suspension | A shared root is called. A constant or a suspension would be evaluated per call instead of per use. |
| Every implementation takes all its arguments at once and is already a value | A function that does work before returning a function is evaluated once per command. As a root it would be evaluated once per call. |
| Fully solved key, no recursion out of the body | A recursion keeps its back-edges inside the copy that contains it. |
| Reads no top-level constant | Such a constant is computed once per command at the use. Inside a root it would be recomputed per call. |
| Larger than a small size threshold | Small bodies are cheaper to inline, and inlining them does not compound. |

Sourced implementations of a shared term stay at each use, so realization can still pick a foreign implementation per call site and fall back to the shared root.

**Let-sharing.** After type checking, the copies of a data-typed binding (a type with no function or suspension inside it) are merged within one evaluation of their scope and bound once, as a `let`, at the nearest point that every use passes through. The binding may be a parameterless `where`, a top-level constant, or a `let`. Placement has three rules:

-   A use in one arm of a conditional, in one implementation of a term, or in the argument of `@try` is served inside that arm. A value read only by a `@try` argument is computed inside it, so its failure becomes that ``@try’s `Err``. Uses in several exclusive arms are each served in their own arm.
-   A pure `let` in a `do` block is never placed above an effect statement written before it. An effectful `let`, a block’s discarded statement, and a pattern check’s guard are never moved.
-   A `where` binding nothing reads is never computed.

A top-level constant, or a value a definition computes without reading its parameters, is computed at most once per command, however many functions or recursion levels its copies came from. A value read by pools in several languages is computed once and passed to each ([Segmentation and cross-language calls](https://morloc-project.github.io/docs/compiler-architecture/compiler-calls.md)).

**Beta-reduction.** Expansion leaves applied lambdas, `(\x → body) arg`, which code generation reduces before segmentation. Because arguments are strict, an argument is substituted into the body only when it is a value: evaluating it computes nothing. In a pool, even a value is substituted only when the parameter is used at most once, or when it is a scalar literal; otherwise it is bound once and shared. Any other argument is bound once by a `let` at the application, whatever its reference count, zero included, so its work happens exactly once and in the right place. When a substituted value is used once, the argument itself moves into the body and nothing is copied, which keeps a long chain of reductions linear.

**Lambdas: inlined or shared.** What happens to a lambda bound to a name and used more than once depends on where the code runs:

| Where | Rule |
| --- | --- |
| Pure nexus evaluation | A command with no language pool is evaluated by the nexus itself, which holds only data and cannot keep a function value. Every lambda is inlined at every use. A function computed by an expression is split into its strict parts, bound once, and a choice among function values that is substituted. A computation with no such form is rejected with an error asking for a language pool. |
| Pools | A lambda used once is reduced away. A lambda used more than once is kept as one native closure and each use calls it, so its body is emitted once. A function computed by an expression is split the same way when possible, and otherwise computed once into a closure that each use calls. |

**Static-argument specialization.** A recursive helper that receives a function and passes it unchanged to every recursive call would otherwise carry it as a closure value, which is heavier than a direct reference. Through a serial entry point the closure is a proxy that calls back into the pool once per application. When a call site passes a **closed** function (a sourced function, or a lambda with no free variables) at such a position, the helper gets its own copy with that function written in place and the parameter removed. The transformation is optional, so anything unrecognized is left alone: helpers whose back-edges do not all pass the parameter through, helpers carrying a label or cache configuration keyed to their own manifold, partial applications (which would be recomputed every iteration), and arguments that are not closed values. Copies are bounded: calls passing the same sourced function share one copy, a copy is never specialized again on a helper it copies, and each helper has a fixed maximum number of copies.

![Diagram](https://morloc-project.github.io/docs/static/img/mermaid-127c9d4d37bd5f27a69da701c4a6b0db.svg)
