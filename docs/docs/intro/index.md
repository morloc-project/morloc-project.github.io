# 1. Intro

Morloc Manual | https://morloc-project.github.io/docs/intro/ | next: https://morloc-project.github.io/docs/why/index.md

Morloc replaces the application with the function as the unit you build, publish, and compose.

You write ordinary code in an ordinary language and give it a type in Morloc. From that one type the compiler derives the command line interface, the network API, the MCP tool description a model reads, the wire format, and the argument parser, and it checks every boundary those cross before anything runs. The interface is not a convention an author remembered to follow. It is a consequence of a declaration.

Morloc types are language-neutral, so the implementation behind a type may come from any supported language, or from a composition of functions written in several. The compiler generates the code that carries data between them. That is why Morloc is polyglot: a library of functions cannot be universal if it is partitioned by language.

## 1.1. Morloc in one program

Two functions, in two languages, neither aware of the other. A C++ sum:

**foo.hpp**

```cpp
#pragma once
#include <vector>

double sum(const std::vector<double>& vec) {
    double sum = 0.0;
    for (double value : vec) {
        sum += value;
    }
    return sum;
}
```

and a parallel map in Python:

**foo.py**

```python
import multiprocessing as mp

def pmap(f, xs):
    with mp.Pool() as pool:
        results = pool.map(f, xs)
    return results
```

Neither file imports anything from Morloc. The Morloc module gives each a type and composes them:

**sums.loc**

```morloc
module m (sum, sumOfSums)

import root-py
import root-cpp

source Py from "foo.py" ("pmap")
source Cpp from "foo.hpp" ("sum")

pmap :: (a -> b) -> [a] -> [b]

--' Add up a list of numbers
sum :: [Real] -> Real

--' Add up a list of lists, summing each in parallel
sumOfSums :: [[Real]] -> Real
sumOfSums = sum . pmap sum
```

`.` is function composition, so `sumOfSums` reads right to left: `pmap sum` sums each inner list in parallel, and the outer `sum` adds the results. The `--'` lines are docstrings, which the compiler carries into every generated interface.

```console
$ morloc make sums.loc
$ ./sums sumOfSums '[[1,2],[3,4,5]]'
15
```

A Python function called a C++ function across a process boundary, and you wrote no binding, no serializer, and no argument parser. [Getting Started](https://morloc-project.github.io/docs/getting-started/index.md) builds this program up one step at a time.

## 1.2. What Morloc is not

Morloc is not a foreign function interface generator. You write no bindings and the languages never import one another. They run as separate processes and the compiler generates the traffic between them, which is why adding a language to a program costs a line rather than a binding layer.

It is not a language you rewrite into. The C++, Python, R, and Rust in a Morloc program is ordinary code in those languages, with no Morloc imports, no annotations, and no base class. You keep your editor, your debugger, your libraries, and your existing code. What Morloc adds is a type and a name.
