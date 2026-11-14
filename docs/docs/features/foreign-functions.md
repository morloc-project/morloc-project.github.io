# 3.2. Foreign functions

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/foreign-functions.html | prev: https://morloc-project.github.io/docs/features/functions.md | next: https://morloc-project.github.io/docs/features/importing-modules.md

A Morloc module by itself declares types and compositions but contains no implementations. Those come from other languages, pulled in with `source`. This is the mechanism the rest of the language is built on.

## 3.2.1. The `source` statement

`source` names a language, a file, and the terms to take from it:

```morloc
source Cpp from "foo.hpp" ("map", "sum", "snd")
source Py from "foo.py" ("morloc_map" as map, "morloc_sum" as sum, "snd")
```

The language tag (`Cpp`, `Py`, `R`, `Rust`) decides which toolchain compiles the code and which pool the function runs in. `as` renames a foreign term for use in Morloc, which matters when the foreign name is taken or awkward.

### Block form

There is a second spelling. `source ... where` opens an indented block with one term per line, which leaves room for a docstring above each:

```morloc
source Py from "foo.py" where
  --' Sum a list of reals.
  sum
  --' @name morloc_map
  map
```

The two forms are otherwise equivalent — pick whichever reads better.

`--' @name <foreign name>` says what the term is called on the other side, so the Morloc name and the foreign name can differ. It is the block-form equivalent of `as`, and these two declare the same thing:

```morloc
source Py from "foo.py" ("morloc_map" as map)

source Py from "foo.py" where
  --' @name morloc_map
  map
```

Prose docstring lines are allowed too and are carried as documentation.

**Curried foreign functions: the rsize directive**

Skip this unless a foreign function returns a closure rather than taking all its arguments at once. It assumes nothing beyond the section above.

In a pure functional language, `a -> (b -> c)` and `a -> b -> c` are the same type. A function of two arguments **is** a function of one argument returning a function of one argument; currying makes the distinction vanish. Morloc’s type system takes that view — the two spellings are interchangeable, and the compiler reports both the same way.

Real languages usually do not. In Python the two are different objects with different call syntax:

**curry.py**

```python
# one argument, returns a closure:  scale(2.0)([1, 2])
def scale(factor):
    return lambda xs: [factor * x for x in xs]

# two arguments, called at once:    shift(10.0, [1, 2])
def shift(offset, xs):
    return [offset + x for x in xs]
```

Both have the Morloc type `Real -> [Real] -> [Real]`, and nothing in that type says which shape the Python side has. By default Morloc assumes the flat one and emits a single call with every argument. Hand it `scale` and the pool dies:

```console
TypeError: scale() takes 1 positional argument but 2 were given
```

`--' @rsize N` declares how many arguments go in each call. The values are the sizes of the leading call groups; the final group is whatever is left over, so you never write it.

```morloc
source Py from "curry.py" where
  --' @rsize 1
  scale
  shift

scale :: Real -> [Real] -> [Real]
shift :: Real -> [Real] -> [Real]
```

A docstring attaches to the term directly below it, so `scale` is curried here and `shift` is not. The generated pool shows the difference:

```python
n2 = __morloc_src_curry.scale(n0) (n1)
n4 = __morloc_src_curry.shift(n2, n3)
```

Both work, and partial application works through a curried source too:

```console
$ ./curry scaled 3 '[1,2]'
[3,6]
$ ./curry shifted 10 '[1,2]'
[11,12]
$ ./curry doubler '[1,2]'
[2,4]
```

where `doubler = scale 2.0` compiles to `__morloc_src_curry.scale(2.0) (n4)`.

For deeper nesting, give one value per leading group:

| Declaration | Foreign shape | Emitted call |
| --- | --- | --- |
| *(none)* | `f(a, b, c)` | `f(a, b, c)` |
| `@rsize 1` | `f(a)(b, c)` | `f(a) (b, c)` |
| `@rsize 2` | `f(a, b)(c)` | `f(a, b) (c)` |
| `@rsize 1 1` | `f(a)(b)(c)` | `f(a) (b) (c)` |

Each value must be at least 1 and must leave at least one argument for the group after it, since the final group is implicit. So `@rsize 2` on a two-argument function is rejected — it would consume both arguments and leave an empty call behind.

`rsize` is the only place the curried-versus-flat distinction is recorded. Writing the type as `Real -> ([Real] -> [Real])` does not imply it and does not change the emitted call.

An effect also ends a call. A source typed `Int -> <IO> (Int -> Int)` is called with its one argument when the effect runs, and the function it returns is a value of its own, so it needs no `rsize`; `rsize` counts only the arguments before the first effect.

The other direction is a function morloc passes to a source, or one a source returns. The source calls it, and morloc calls it, with all of its arguments at once: `(a -> b -> c)` and `(a -> (b -> c))` are one type, and a parameter of either spelling is called with two arguments. Only an effect or a type variable of the signature ends the arguments: `(a -> <IO> (b -> c))` is called with one argument and returns a suspension, and a parameter `(a -> b -> c)` is called with two and returns `c`, even where `c` is a function. Morloc hands over any function of that type called that way, however the function was defined. If the function does work before the lambda it returns, that work runs at every call the source makes with those arguments; a partial application morloc passes has already run the work for the arguments it holds, once.

The C++ side is an ordinary header:

**foo.hpp**

```cpp
#pragma once
#include <vector>
#include <tuple>

// map :: (a -> b) -> [a] -> [b]
template <typename F, typename A>
auto map(F f, const std::vector<A>& xs) {
    std::vector<decltype(f(xs.front()))> result;
    result.reserve(xs.size());
    for (const auto& x : xs) {
        result.push_back(f(x));
    }
    return result;
}

// snd :: (a, b) -> b
template <typename A, typename B>
B snd(const std::tuple<A, B>& p) {
    return std::get<1>(p);
}

// sum :: [a] -> a
template <typename A>
A sum(const std::vector<A>& xs) {
    A total = A{0};
    for (const auto& x : xs) {
        total += x;
    }
    return total;
}
```

These implementations are completely independent of Morloc. They have no special constraints, they operate on ordinary native data structures, and nothing stops them being used outside Morloc entirely. That independence is the point: Morloc consumes libraries as they already exist.

## 3.2.2. General types

Morloc moves data between languages, and to do that it needs to know the shape of each function. You supply that as a **general type signature**:

```morloc
map :: (a -> b) -> [a] -> [b]
snd :: (a, b) -> b
sum :: [Real] -> Real
```

The syntax is borrowed from Haskell. Square brackets are homogeneous lists, parenthesized comma-separated values are tuples, and arrows are functions. In `map`, `(a -> b)` is a function from a generic `a` to a generic `b`, `[a]` is the input list, and `[b]` is the output. `snd` pulls the second element out of a two-tuple. `sum` reduces a list of reals to one real.

The brackets are sugar. Written out, the same signatures are:

```morloc
map :: (a -> b) -> List a -> List b
snd :: Tuple2 a b -> b
sum :: List Real -> Real
```

## 3.2.3. Native type mappings

A general type may correspond to a different concrete type in every language, so you also give the mapping:

```morloc
type Cpp => List a = "std::vector<$1>" a
type Cpp => Tuple2 a b = "std::tuple<$1,$2>" a b
type Cpp => Real = "double"
type Py => List a = "list" a
type Py => Tuple2 a b = "tuple" a b
type Py => Real = "float"
```

These are type **functions**. Take the C++ mapping for `List a`. Once the typechecker has solved for the parameter `a` and recursively converted it to C++, that result is substituted for `$1`. If `a` turns out to be `Real`, it maps to `double`, which substitutes into the list type to give `std::vector<double>` — and that is the type in the generated C++.

In practice you rarely write these. They come from foundational modules such as `root-cpp` and `root-py`, which is why the examples in [Getting Started](https://morloc-project.github.io/docs/getting-started/index.md) could import a language and start working.

With the signatures and mappings in place, the module compiles and runs:

```console
$ ./foreign mySum '[1,2,3.5]'
6.5
$ ./foreign mySnd '[1,2]'
2
```

Note that a tuple is written as a JSON array on the command line.

Higher-order functions cross the boundary too. A Morloc function passed into the sourced C++ `map` works exactly as you would hope:

```morloc
doubleAll :: [Real] -> [Real]
doubleAll = map twice
```

```console
$ ./foreign doubleAll '[1,2,3]'
[2,4,6]
```

## 3.2.4. Sourcing builtins and other non-exports

Morloc calls a sourced Python term as an attribute of its module: a term taken from `foo.py` is invoked as `foo.<name>`. Builtins are not attributes of `foo`, so sourcing one directly compiles fine and then fails when it runs:

```morloc
source Py from "foo.py" ("map", "sum", "snd")
```

```console
$ ./foreign mySum '[1,2,3.5]'
Error: run failed
module 'foo' has no attribute 'sum'
  at mySum [py] (mid=1, foreign.loc:1:17)
```

The failure is deferred to run time, which makes it worth knowing about in advance. There are three fixes.

Re-export the builtins so they become module attributes:

**foo.py**

```python
from builtins import map, sum  # make builtins module-level attributes

def snd(pair):
    return pair[1]
```

Or wrap them under names of your own and rename on the way in, which is where the `morloc_sum` in the first example came from:

**foo.py**

```python
def morloc_sum(xs):
    return sum(xs)

def snd(pair):
    return pair[1]
```

```morloc
source Py from "foo.py" ("morloc_sum" as sum, "snd")
```

Or source a builtin with no `from` at all, which names it directly:

```morloc
source Py ("sum" as bsum)
```

All three work. The same rule applies to anything that is not a module-level name: a term from a third-party package must be locally defined (`def bar(...)`) or explicitly imported (`from somemodule import bar`) in the sourced file.

## 3.2.5. Keyword-shaped foreign operators

Some foreign symbols are neither callable identifiers nor symbolic operators. Python’s `in` and `not in` are language keywords: they exist only as infix syntax, so `in(x, xs)` is a parse error and there is no function object to import.

A backtick-quoted name sources such a symbol as an infix operator whose emitted text is the quoted string:

```morloc
source Py from "core.py" (`in` as (<:), `not in` as (</:))

(<:) :: Str -> [Str] -> Bool
(</:) :: Str -> [Str] -> Bool
```

At each call site the generated pool writes the quoted text between the two arguments. No wrapper is needed on the Python side — `core.py` can be empty. The generated `pool.py` for `x <: xs` and `x </: xs` contains:

```python
n2 = (n0 in n1)
...
n4 = (n2 not in n3)
```

The backtick contents are emitted verbatim, so any two-argument infix operator the target language recognises works the same way: Python `is`, R `%in%`, and so on. The one exception is `&&` and `||`: they are built-in short-circuiting forms ([Booleans](https://morloc-project.github.io/docs/features/booleans.md)), and declaring either is an error.

## 3.2.6. What sourced code may do with values

Morloc decides where values are copied, moved and shared, and changes those decisions between versions to make programs faster. A sourced function sees the same value however Morloc placed it only if it treats its arguments as values. These rules are the price of that freedom; a program that breaks one has no defined result.

**Never change an argument.** A function that needs a changed value changes its own copy and returns it.

-   C++: take each argument by value or by `const T&`, never `T&`. A `T&` parameter does not build: Morloc passes every named value as const, so the C++ compiler reports
    
    ```console
    pools/cpp/pool.cpp:1525:35: error: binding reference of type 'std::vector<int>&' to 'std::add_const_t<std::vector<int> >' {aka 'const std::vector<int>'} discards qualifiers
    ```
    
    C++ code that calls a function Morloc passed to it calls it the same way, never with a non-const reference.
    
-   Rust: never take `&mut`. Morloc passes a `Copy` value by value and anything else as `&T`, so a `&mut T` parameter does not build. Do not change an argument through `Cell`, `RefCell`, `Mutex` or an atomic either; that is not detected.
-   Python: no `list.sort()`, `append`, item or attribute assignment, `dict.update`, or in-place numpy operation (`a += 1`, `out=`) on an argument. Copy first. A numpy array that came from another language or from a literal in your program is read-only, so writing to it raises a `ValueError`; call `.copy()` to get one you can change.
-   R: changing a local copy is fine, since R copies on modify. Do not change an argument by reference: an environment, an R6 or reference class object, ``data.table’s `:=`` and `set*` functions, or an external pointer.

**Return a value that owns its data.** A C++ result is not, and does not hold, a reference, pointer, `std::string_view`, `std::span` or other view into an argument, and is not a lambda capturing an argument by reference. A `const T&` to data that outlives every call, such as a static, is fine; Morloc copies it. A Rust result borrows from no argument, which rustc already enforces. A Python result may share objects with its arguments, including a numpy view onto one, since reference counting keeps the data alive.

**A mapped type behaves as a value.** A C++ or Rust type that a Morloc type maps to (`type Cpp ⇒ T = "…​"`, or for a record ([Records](https://morloc-project.github.io/docs/features/records.md)), `record Cpp ⇒ R = "…​"`):

-   copies into an independent, equal value, and copying, moving or destroying it does nothing a program depends on: no output, counters, files or locks;
-   is not a pointer, reference, view or `std::weak_ptr`, and has no such field; a `std::shared_ptr<const T>` is fine. The arms of a mapped `data` type ([Sum types](https://morloc-project.github.io/docs/features/sum-types.md)) and a recursive optional `?R` field of a C++ record are exactly that, `std::shared_ptr<const T>`, and any other spelling does not build; code still building a value may hold a `std::shared_ptr<T>` and store it into the const field;
-   can be built from moved fields and moved itself: no constructor takes a field by non-const reference, and no field type deletes its move constructor;
-   is safe to read through a `const` reference (C++) or `&` (Rust) from several threads at once.

Work that must happen at a definite time, such as writing a file or releasing a lock, belongs in an effectful function Morloc calls in order, not in a copy constructor or destructor.
