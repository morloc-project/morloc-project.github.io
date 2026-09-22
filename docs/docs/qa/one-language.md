# 15.1. I only use one language, is Morloc still useful?

Morloc Manual > Q&A | https://morloc-project.github.io/docs/qa/one-language.html | prev: https://morloc-project.github.io/docs/qa/index.md | next: https://morloc-project.github.io/docs/qa/bioinformatics-only.md

Yes, Morloc remains useful even if you only use one programming language.

While Morloc is designed to allow polyglot development, its core benefits also apply to single-language projects. In the Morloc ecosystem, you may continue working in your preferred language, but focus shifts to writing libraries instead of standalone applications.

Morloc lets you compose these functions and automatically generate applications from them, offering several advantages:

-   **Broader usability**: Your functions can be easily reused and easily accessed by other language communities.
-   **Improved testing and benchmarking**: Functions can be integrated into language-agnostic testing and benchmarking frameworks.
-   **Future-proofing**: If you ever need to migrate to a new language, Morloc’s type annotations and documentation carry over—only the implementation needs to change. And if you want to leave the Morloc ecosystem, your implementation does not need to change.
-   **Better workflows**: Especially in fields like bioinformatics, Morloc shifts workflows from chaining applications and files to composing typed functions and native data structures, making pipelines more robust and easier to validate.
-   **No more format parsing**: Morloc data structures replace bespoke file formats and offer efficient serialization.

While language interop is a major feature of Morloc, it is not the main purpose. The very first version of Morloc was not even polyglot at all. The focus originally was to just have a simple composition language that separated pure code from associated effects, conditions, caching, etc.

The primary goal of Morloc is to support the development of composable, typed universal libraries. Support for many languages is required for this goal, since no one language is best for all cases. Most Morloc users would continue to program in their favorite language, but gain the ability to compose, share, and extend functionality more easily.
