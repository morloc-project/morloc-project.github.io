# 4.11. `where` and `let` clauses

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/where-and-let.html | prev: https://morloc-project.github.io/docs/features/pattern-matching.md | next: https://morloc-project.github.io/docs/features/conditionals.md

Both introduce local bindings, and they differ in exactly one way that matters: `where` is order-invariant, `let` is sequential. Pick whichever fits how you want to read the definition.

## 4.11.1. `where`

A `where` clause hangs local bindings off the end of a definition:

```morloc
f1 :: Int -> Int
f1 x = y + b where
    y = x + 1
    b = 41
```

```console
$ ./locals f1 1
43
```

Bindings in a `where` block are order-independent and may refer to each other freely, though not mutually recursively. They can see the function’s arguments, and the main expression can see them.

Clauses inherit their parent’s scope and nest:

```morloc
f2 :: Int
f2 = x where
    x = y where
        y = a + b
        a = 1
    b = 41
```

```console
$ ./locals f2
42
```

Note that the inner clause sees `b` from the outer one.

## 4.11.2. `let`

`let` is the more orderly cousin. Several bindings may precede the terminal `in`, they run in order, and each may only refer to names bound above it:

```morloc
f3 :: Int -> Int
f3 n =
  let m = n + 1
      y = m + 2
  in (m + y)
```

```console
$ ./locals f3 1
6
```

## 4.11.3. The scope rule that separates them

`let` is **non-recursive sequential**: each binding is in scope for everything after it, and a later binding may shadow an earlier one of the same name. So a chain of single-binding \`let\`s is legal, and the last one wins:

```morloc
foo :: Int
foo = let x = 1
      let x = 2
       in x
```

```console
$ ./locals foo
2
```

`where` is **order-invariant**: every binding sees every other one. That makes shadowing meaningless, so a name may be bound only once in a clause, and it may not collide with a function parameter. Both violations are compile-time errors.

Binding the same name twice:

```console
whx.loc:8:3: duplicate binding in where-clause: y
    |
  8 |   y = n + 2
    |   ^
```

Binding a name that is already a parameter:

```console
whx.loc:7:3: where-clause binding shadows function parameter: x
    |
  7 |   x = 100
    |   ^
```

If you want shadowing, that is what `let` is for.
