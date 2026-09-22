# 5.1. One term may have many definitions

Morloc Manual > Advanced Types | https://morloc-project.github.io/docs/types/term-polymorphism.html | prev: https://morloc-project.github.io/docs/types/index.md | next: https://morloc-project.github.io/docs/types/typeclasses.md

A Morloc term may have more than one definition, and the compiler picks whichever one produces the best program. This is *term polymorphism*. It is what lets you write a composition once and have it collapse onto a single language, or onto whatever mix of languages the imports make available.

The `=` operator is the thing to understand first. It does not bind a name to a value the way assignment does in most languages. It states that the two sides are *substitutable*: anywhere the term appears, the compiler may put the right-hand side instead. Writing `=` twice for the same term does not shadow the first definition, it adds a second option.

Here `mean` is given three definitions — one sourced from C++, two written in Morloc:

**mean.loc**

```morloc
module main (mean)

import root-cpp

source Cpp from "mean.hpp" ("mean")
mean :: [Int] -> Int
mean xs = sum xs // length xs
mean xs = fold (+) 0 xs // length xs
```

**mean.hpp**

```cpp
#pragma once
#include <vector>

inline int mean(std::vector<int> xs){
    if (xs.empty()) return 0;
    int s = 0;
    for (int x : xs) s += x;
    return s / (int)xs.size();
}
```

All three compute the same thing. `sum` and `fold` come from `root`, and `//` is integer division:

```console
$ morloc make -o mean mean.loc
$ ./mean mean '[1,2,3,4]'
2
```

## 5.1.1. How the choice collapses a program

The compiler does not pick a definition per call site in isolation. It scores whole realizations: every call carries a cost, and a call that crosses a language boundary carries a far larger one than a call that stays put — the built-in defaults are 10 for a same-language call and 10000 for a crossing. It takes the cheapest realization, breaking ties by the number of boundaries crossed.

The consequence is that a composition tends to collapse onto one language — whichever one the surrounding code is already in. Drop the C++ source from the module above, keep both Morloc definitions, and import `root-py` instead:

```morloc
module main (mean)

import root-py

mean :: [Int] -> Int
mean xs = sum xs // length xs
mean xs = fold (+) 0 xs // length xs
```

Nothing about `mean` changed, but the generated program is now pure Python. The build directory shows which pools were generated:

```console
$ morloc make -o mean mean.loc
$ ./mean mean '[1,2,3,4]'
2
$ ls mean-build/pools/
py
```

With the C++ version, the same listing shows `cpp`. Without term polymorphism, changing the language of one component would mean rewriting and rewiring everything downstream of it by hand.

## 5.1.2. Contradictory definitions

Because `=` means "substitutable", nothing stops you from claiming two things are the same when they are not:

**contradiction.loc**

```morloc
module main (x)

import root-py

x :: Int
x = 1
x = 2
```

`x` is now 1 *or* 2, and which one you get is up to the compiler. Morloc has a *value checker* that catches the blatant cases — literals that disagree, and containers whose sizes disagree:

```console
$ morloc make -o contradiction contradiction.loc
Unification error: Error in value checker: Cannot equate non-equal primitives (the two operands disagree):
a: 2
b: 1
Found while unifying contradiction.loc:1:14
With values

  |
7 | x = 2
  |     ^
and

  |
6 | x = 1
  |     ^
```

The value checker is shallow. It compares literals; it does not evaluate foreign code. So this contradiction gets through:

**deep.loc**

```morloc
x :: Real
x = 2.0 / (1.0 + 1.0)
x = 2.0 / 1.0
```

```console
$ morloc make -o deep deep.loc
$ ./deep x
2
```

The compiler cannot see inside `(+)` to know that the first definition is 1. It compiled, it ran, and it silently picked the second definition. Multiple definitions are a promise you are making to the compiler, and it can only check part of it.

## 5.1.3. A test suite that runs against every implementation

The Morloc standard library uses term polymorphism to test every language backend with one test suite. The pattern is worth copying.

Split the module into a language-agnostic parent that declares the interface, one child per language that supplies implementations, and a test module that depends only on the parent.

The parent declares signatures and nothing else:

**clock/main.loc**

```morloc
module clock (incSec)

import root

--' Advance an (hour, minute, second) triple by one second
incSec :: (Int, Int, Int) -> (Int, Int, Int)
```

Each language child imports the parent and sources implementations for it:

**clock-py/main.loc**

```morloc
module clock-py (*)

import .clock
import root-py

source Py from "clock.py" ("inc_sec" as incSec)
```

**clock-cpp/main.loc**

```morloc
module clock-cpp (*)

import .clock
import root-cpp

source Cpp from "clock.hpp" ("inc_sec" as incSec)
```

The test module imports the parent — never a language child — so it has no opinion about which implementation runs:

**clocktest/main.loc**

```morloc
module clock.test (runTests)

import .clock
import root

-- The harness itself is Python, so it needs Python forms for the types
-- it touches, whatever language the implementation under test uses.
type Py => Int = "int"
type Py => Str = "str"
type Py => List a = "list" a
type Py => Tuple3 a b c = "tuple" a b c

source Py from "check.py" ("check")
check :: (Str, a, a) -> Str

runTests :: [Str]
runTests = map check
  [ ("rolls seconds",  incSec (1, 2, 3),     (1, 2, 4))
  , ("rolls minutes",  incSec (1, 2, 59),    (1, 3, 0))
  , ("rolls hours",    incSec (1, 59, 59),   (2, 0, 0))
  , ("wraps midnight", incSec (23, 59, 59),  (0, 0, 0))
  ]
```

**clocktest/check.py**

```python
def check(case):
    msg, observed, expected = case
    return ("ok   " if observed == expected else "FAIL ") + msg
```

A top-level module then chooses the implementation by choosing an import:

**main.loc**

```morloc
module main (runTests)

import .clocktest (runTests)
import .clock-py
```

```console
$ morloc make -o runtests main.loc
$ ./runtests runTests
["ok   rolls seconds","ok   rolls minutes","ok   rolls hours","ok   wraps midnight"]
$ ls runtests-build/pools/
py
```

Swap `import .clock-py` for `import .clock-cpp` and the identical test suite now exercises the C++ implementation. The test cases, the expected values, and the comparison logic are unchanged:

```console
$ morloc make -o runtests-cpp cppmain.loc
$ ./runtests-cpp runTests
["ok   rolls seconds","ok   rolls minutes","ok   rolls hours","ok   wraps midnight"]
$ ls runtests-cpp-build/pools/
cpp
py
```

Two pools this time: the implementation under test is C++, the harness is Python, and the tuples cross between them. That crossing is the point — the test suite is checking the real cross-language path, not a mock of it.
