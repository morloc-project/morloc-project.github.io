# 10.3. The universal library

Morloc Manual > Modules and Libraries | https://morloc-project.github.io/docs/modules/universal-library.html | prev: https://morloc-project.github.io/docs/modules/installing-modules.md | next: https://morloc-project.github.io/docs/languages/index.md

A module may export types, typeclasses, and function signatures but no implementations. Such a module would be completely language agnostic. A powerful approach to building libraries in the Morloc ecosystem is to write one module that defines all types, then $n$ modules for language-specific implementations that import the type module, and then one module to import and merge all implementations. This is the approach taken by the `base` module and by other core libraries.

In the future, when hundreds of languages are supported, and when possibly some functions may even have many implementations per language, it will be desirable to have finer control over what functions are used. One solution would be to add filters to the import statement. Thus the import expressions would be a sort of query. Alternatively, constraints could be added at the function level, and thus the entire Morloc script would be a query over the universal library. This would be especially powerful when imported types are expressed as unknowns to be inferred by usage.
