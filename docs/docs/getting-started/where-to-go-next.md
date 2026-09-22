# 3.7. Where to go next

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/where-to-go-next.html | prev: https://morloc-project.github.io/docs/getting-started/parallelism.md | next: https://morloc-project.github.io/docs/getting-started/editor-support.md

You now have the whole shape of Morloc: modules export terms, terms get general types, implementations come from foreign languages or from other Morloc modules, and the compiler generates every interface and every boundary crossing.

From here:

-   [Syntax and Features](https://morloc-project.github.io/docs/features/index.md) is the language proper — records, pattern matching, effects, optionals, and the rest.
-   [Advanced Types](https://morloc-project.github.io/docs/types/index.md) covers typeclasses, polymorphism, and how one term takes many implementations.
-   [Building CLIs](https://morloc-project.github.io/docs/clis/index.md) goes deeper on the command line interface you saw above, including how to control argument shapes and output formats.
-   [Building APIs](https://morloc-project.github.io/docs/apis/index.md) is the same library served over HTTP and MCP.
-   [Modules and Libraries](https://morloc-project.github.io/docs/modules/index.md) explains the standard library and how to publish your own modules.

`mim demos` fetches example programs published for your Morloc version. Every demo in a bundle is known to build and pass on that version, so nothing there fails for reasons unrelated to what you are learning:

```console
$ mim demos --list             # see what is available, download nothing
$ mim demos                    # fetch them all
$ mim demos --tag rust-examples  # fetch one group
```

They land in `examples-<tag>-<version>/` in the current directory.

> **Note**
> The demo collection is still being assembled, so `mim demos` currently answers `no demos are published yet`. The first bundles are expected shortly; until they land, the examples in this manual and the test suite in the compiler repository are the working code to read.
