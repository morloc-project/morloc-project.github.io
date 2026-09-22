# 15.4. What about object-oriented programming?

Morloc Manual > Q&A | https://morloc-project.github.io/docs/qa/object-oriented.html | prev: https://morloc-project.github.io/docs/qa/per-function-environments.md | next: https://morloc-project.github.io/docs/qa/ai-relevance.md

An "object" is a somewhat loaded term in the programming world. As far as Morloc is concerned, an object is a thing that contains data and possibly other unknown stuff, such as hidden fields and methods. All types in Morloc have must forms that are transferable between languages. Methods do not easily transfer; at least they cannot be written to Morloc binary. However, it is possible to convey class-like APIs through typeclasses. Hidden fields are more challenging since, by design, they are not accessible. So objects cannot generally be directly represented in the Morloc ecosystem.

Objects that have a clear "plain old data" representation can be handled by Morloc. These objects, and their component types, must have no vital hidden data, no vital state, and no required methods. Examples of these are all the basic Python types (`int`, `float`, `list`, `dict`, etc) and many C++ types such as the standard vector and tuple types. When these objects are passed between languages, they are reduced to their pure data.
