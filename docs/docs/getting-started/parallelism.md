# 3.6. Parallelism across languages

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/parallelism.html | prev: https://morloc-project.github.io/docs/getting-started/mixing-languages.md | next: https://morloc-project.github.io/docs/getting-started/where-to-go-next.md

Because implementations are interchangeable, so are execution strategies. Here is a parallel `map` written in Python, driving a summation written in C++:

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

**foo.py**

```python
import multiprocessing as mp

def pmap(f, xs):
    with mp.Pool() as pool:
        results = pool.map(f, xs)
    return results
```

**sums.loc**

```morloc
module sums (sumOfSums)

import root-py
import root-cpp

source Py from "foo.py" ("pmap")
source Cpp from "foo.hpp" ("sum")

pmap :: (a -> b) -> [a] -> [b]
sum :: [Real] -> Real

sumOfSums = sum . pmap sum
```

`sumOfSums` sums a list of lists. The `.` operator is function composition, so this reads right to left: `pmap sum` sums each inner list in parallel, and the outer `sum` adds the results.

The lowercase `a` and `b` in ``pmap’s signature are type variables, meaning `pmap`` works for any element types. That signature is the ordinary ``map’s, fixed to lists, so the two are interchangeable here: writing `map sum`` instead of `pmap sum` compiles and gives the same answer. Parallelism is a choice of implementation, not a change to the program.

```console
$ morloc make sums.loc
$ ./sums sumOfSums '[[1,2],[3,4,5]]'
15
```
