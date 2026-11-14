# 3.16. Recursion

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/recursion.html | prev: https://morloc-project.github.io/docs/features/sum-types.md | next: https://morloc-project.github.io/docs/features/effects.md

A function may refer to itself, and the compiler generates the corresponding recursion in the target language. Factorial, with guards:

```morloc
fact :: Int -> Int
fact n
  ? n == 0 = 1
  : n * fact (n - 1)
```

```console
$ ./recur fact 10
3628800
```

Functions may also be mutually recursive. This pair decides, inefficiently, whether a number is even:

```morloc
isEven :: Int -> Bool
isEven n
  ? n == 0 = True
  : isOdd (n - 1)

isOdd :: Int -> Bool
isOdd n
  ? n == 0 = False
  : isEven (n - 1)
```

```console
$ ./recur isEven 10
true
```

> **Warning**
> A call in tail position runs in constant stack space in every target language, even one that does not optimize tail calls itself. Deep recursion that is not in tail position is bounded by the target language’s own depth limit and can overflow the stack or crash the pool.

## 3.16.1. Recursive types

The idiomatic recursive type is a `data` type whose constructor takes its own type, like the `Tree` in [Sum types](https://morloc-project.github.io/docs/features/sum-types.md). Functions over it recurse the same way `fact` does, one clause per constructor.

**Recursive types without data**

A type alias or record may also refer to itself, as long as every cycle through the definition passes under an optional `?T` (with `Null` as the base case) or a list `[T]` (with `[]` as the base case). A bare self-reference is rejected:

```console
recx.loc:5:1: Type alias 'X' has a vacuous body: it reduces to a self-reference with no payload
    |
  5 | type X = X
    | ^
```

Two aliases or records that refer to each other are rejected too, unless a `data` type sits on the cycle (see [Sum types](https://morloc-project.github.io/docs/features/sum-types.md)).

The examples below take two helpers for optional values from the standard library: `isNull` tests whether an optional is absent, and `require` asserts it is present and strips the `?`.

```morloc
import maybe-py (require, isNull)
```

A linked list is a payload paired with an optional tail of the same type:

```morloc
type LL a = (a, ?(LL a))

llExample :: LL Int
llExample = (42, (7, (99, Null)))

llRange :: Int -> LL Int
llRange n ? n > 0 = (n, llRange (n - 1))
          : (0, Null)

llLen :: LL Int -> Int
llLen x ? isNull (.1 x) = 1
        : 1 + llLen (require (.1 x))
```

```console
$ ./recur llExample
[42,[7,[99,null]]]
$ ./recur llRange 3
[3,[2,[1,[0,null]]]]
$ ./recur llLen '[1,[2,[3,null]]]'
3
```

In `llRange` the recursive call returns `LL Int` where the second slot wants `?(LL Int)`; the implicit coercion from `a` to `?a` (see [Optional types](https://morloc-project.github.io/docs/features/optionals.md)) bridges the two with no annotation.

A list guard gives arbitrary branching. A rose tree holds a payload and a list of children, and an empty list ends a branch:

```morloc
type Rose a = (a, [Rose a])

roseSum :: Rose Int -> Int
roseSum x = .0 x + fold (\acc child -> acc + roseSum child) 0 (.1 x)
```

```console
$ ./recur roseSum '[1,[[2,[]],[3,[]]]]'
6
```

The same rules apply to a `record`, whose fields are addressed by name instead of position:

```morloc
record LL where
  head :: Int
  tail :: ?LL

llLen :: LL -> Int
llLen x ? isNull (.tail x) = 1
        : 1 + llLen (require (.tail x))
```

```console
$ ./recrec llLen '{"head":1,"tail":{"head":2,"tail":null}}'
2
```
