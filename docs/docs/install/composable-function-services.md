# 12.8. Beyond fixed APIs: composable function services

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/composable-function-services.html | prev: https://morloc-project.github.io/docs/install/serve-and-freeze.md | next: https://morloc-project.github.io/docs/install/execution-contexts.md

A conventional API exposes a fixed set of endpoints. A Morloc serve container goes further: in addition to calling pre-compiled commands, the `/eval` endpoint lets callers compose *new* expressions from the functions available in installed modules. Because Morloc’s type system spans all installed languages, these compositions are type-checked before execution, and the runtime handles all cross-language marshalling automatically.

This means a single deployed container does not just serve a finite set of functions — it serves the entire *composition space* of every function in every installed module. An agent or client can discover available functions via `/discover`, read their argument schemas, and synthesize novel pipelines that were never anticipated at build time, all within the safety guarantees of the type system.

Eval is off until you turn it on (`mim view eval --allow <modules>`), and the safety model for it relies on several layers:

-   The serve-mode parser accepts only a restricted subset of the Morloc language: callers can compose primitives and functions from the modules on the eval allow-list, but cannot source new foreign code or import modules outside it
-   Module resolution is checked at compile time — only functions from installed modules are reachable
-   The type system prevents invalid compositions across language boundaries
-   The container runs with a read-only filesystem and a CPU-time limit on each evaluation, and an off-box endpoint serves eval only to holders of a bearer token ([freeze](https://morloc-project.github.io/docs/utilities/mim.md#mim-freeze))
