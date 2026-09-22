# 4.1. Functions

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/functions.html | prev: https://morloc-project.github.io/docs/features/index.md | next: https://morloc-project.github.io/docs/features/foreign-functions.md

Everything in Morloc is built out of functions, so this is where to start. This section covers how they are defined, composed, and partially applied.

Most examples in this chapter are **fragments** — a definition or two, without the surrounding module. To run one, wrap it in a module and import implementations:

```morloc
module demo (myTerm)

import root-py    -- or root-cpp, root-r

myTerm = ...
```

Comments start with `--`. A `--'` comment is a docstring and attaches to the term below it.

## 4.1.1. Definition and application

Functions are defined with their arguments separated by whitespace, and applied the same way:

```morloc
foo x y z = g x (f y z)
```

`foo` takes the arguments `x`, `y`, and `z`. Application binds tighter than anything else, so `g x (f y z)` calls `g` with two arguments: `x`, and the result of `f y z`. If you have a background in the Algol family — C, Python, Java — the missing parentheses and commas take a little getting used to. The payoff shows up in the next two sections.

## 4.1.2. Composition and application operators

The `internal` module, re-exported from `root`, defines the composition operator `.` and the application operator `$`.

`.` glues two functions into one. These two definitions mean the same thing:

```morloc
foo1 x = g (f x)
foo2 = g . f
```

The first passes the output of `f x` into `g` explicitly. The second says the same thing without naming the argument at all — `foo2` **is** `g` after `f`. Composition chains read right to left and build pipelines cleanly:

```morloc
process = format . transform . validate . parse
```

`$` is application with the lowest possible precedence, which makes it a way to delete parentheses:

```morloc
foo1 x = h (g (f x))
foo2 x = h $ g $ f x
```

## 4.1.3. Partial application

Give a function of N arguments fewer than N, and you get back a function of the rest. This is not a special feature; it falls out of how application works.

Take `fold`, which reduces a container with a binary function, an initial value, and the container itself:

```morloc
fold :: Foldable f => (b -> a -> b) -> b -> f a -> b
```

Supplying one or two of those three arguments leaves a function behind:

```morloc
-- concatenate a list of strings onto an initial value
concatTo :: Str -> [Str] -> Str
concatTo = fold (<>)

-- extend an initial list
extend :: [[Int]] -> [Int]
extend = fold (<>) [1,2,3]

-- append a list of values to an initial value
append :: [[[Int]]] -> [Int] -> [[Int]]
append xss ys = map (fold (<>) ys) xss
```

Each of these carries a type signature, and that is not decoration. `fold` is a typeclass method: it works over any `Foldable` container, so a partial application like `fold (<>)` leaves the container type undetermined. Without a signature the compiler has nothing to pin it to and reports:

```console
$ morloc typecheck partial.loc
partial.loc:6:12: error:
General type error: No instance found for Foldable::fold
  Are you missing a top-level type signature?
  |
6 | concatTo = fold (<>)
  |            ^
```

The rule is worth internalizing early, because it is the most common thing to trip over: **a point-free definition built from typeclass methods usually needs a signature.** Adding arguments back is the other fix — `concatTo x xs = fold (<>) x xs` typechecks without help, because the arguments constrain the types.

## 4.1.4. Operator sections

Binary operators partially apply too, on either side. Leaving the right operand off gives a function of the right operand:

```morloc
divideByTwo :: [Real] -> [Real]
divideByTwo = map (/ 2.0)
```

and leaving the left operand off gives a function of the left:

```morloc
divideTwoBy :: [Real] -> [Real]
divideTwoBy = map (2.0 /)
```

The difference shows up immediately:

```console
$ ./sections divideByTwo '[1,2,3]'
[0.5,1,1.5]
$ ./sections divideTwoBy '[1,2,4]'
[2,1,0.5]
```

Numeric literals are not polymorphic across `Int` and `Real`, so `2.0` keeps these on `Real`. For integer division use `//`, which is defined on `Int`:

```morloc
halvedInts :: [Int] -> [Int]
halvedInts = map (// 2)
```

```console
$ ./sections halvedInts '[1,5,9]'
[0,2,4]
```

## 4.1.5. Lambdas

An anonymous function is a backslash, one or more parameters, `→`, and a body. Lambdas capture free variables from the enclosing scope:

```morloc
addBias :: Real -> [Real] -> [Real]
addBias bias = map (\x -> x + bias)
```

`bias` comes from the outer parameter list and is captured by the lambda.

```console
$ ./sections addBias 10 '[1,2]'
[11,12]
```

A lambda must take at least one argument. The zero-argument form is a parse error:

```console
$ morloc typecheck five.loc
five.loc:6:10: unexpected '->'
    |
  6 | five = \ -> 5
    |          ^
```

To wrap a value as a computation to be run later, use the effect system rather than a lambda — see [Effects and delayed evaluation](https://morloc-project.github.io/docs/features/effects.md).
