# 2.6. Parallelism across languages

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/parallelism.html | prev: https://morloc-project.github.io/docs/getting-started/mixing-languages.md | next: https://morloc-project.github.io/docs/getting-started/where-to-go-next.md

Because implementations are interchangeable, so are execution strategies. The `sums` program in [One program](https://morloc-project.github.io/docs/why/index.md#one-program) drives a C++ `sum` with a parallel `map` written in Python: `sumOfSums = sum . pmap sum` sums each inner list in parallel, and the outer `sum` adds the results.

The lowercase `a` and `b` in ``pmap’s signature are type variables, meaning `pmap`` works for any element types. That signature is the ordinary ``map’s, fixed to lists, so the two are interchangeable here: writing `map sum`` instead of `pmap sum` compiles and gives the same answer. Parallelism is a choice of implementation, not a change to the program.
