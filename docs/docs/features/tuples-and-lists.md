# 4.7. Tuples and Lists

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/tuples-and-lists.html | prev: https://morloc-project.github.io/docs/features/strings.md | next: https://morloc-project.github.io/docs/features/records.md

Tuples and lists are the two containers you will reach for first. A tuple has a fixed size and may hold elements of different types; a list has variable size and holds elements that all share one type.

Both become JSON arrays on the wire, so from JSON alone you cannot tell whether `[1,2,3]` is a three-element list of integers or a three-integer tuple. The type is what distinguishes them, and the type is not in the JSON.

## 4.7.1. Tuples

A tuple stores a fixed number of terms of differing type:

```morloc
x :: (Int, Bool, Real)
x = (1, True, 6.45)
```

```console
$ ./tuples x
[1,true,6.45]
```

Tuple types and tuple values look the same: comma-separated inside parentheses. The parenthesized type is sugar for a fixed-arity constructor, `Tuple3` here. The parser builds the right `TupleN` from the number of fields, so there is no fixed upper bound on arity — a twelve-element tuple reports its type as:

```console
$ morloc typecheck tuples.loc
big :: Tuple12 Int Int Int Int Int Int Int Int Int Int Int Int
```

That said, past a few members a record with named fields is easier to read and harder to get wrong. See [Records](https://morloc-project.github.io/docs/features/records.md).

## 4.7.2. Lists

Lists are homogeneous and variable length. The base type is `List a`, and `[a]` is sugar for it:

```morloc
x :: [Int]
x = [1, 2, 3]

ys :: List Real
ys = [1.0, 2.0, 3.0]
```

The two spellings name the same type, and the compiler reports both in the sugared form:

```console
$ morloc typecheck tuples.loc
x :: [Int]
ys :: [Real]
```

`List` maps to each language’s natural ordered container: `list` in Python, `std::vector` in C++, and list or vector in R.

Every list-like type shares one wire representation — zero or more elements in contiguous memory — but different in-language structures make different performance tradeoffs. `Deque`, for example, is declared in `root` as a distinct type over the same representation:

```morloc
newtype Deque a = List a
```

so it costs nothing to send but can add to either end cheaply in the languages that back it with a real deque. For how to define such specializations yourself, see [Naming a type: `type` and `newtype`](https://morloc-project.github.io/docs/types/newtype.md).

For numeric work there is a more rigorous and faster alternative to `List`: the `Vector` type, which is the one-dimensional tensor. See [Tensors](https://morloc-project.github.io/docs/types/tensors.md).
