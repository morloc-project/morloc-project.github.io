# 4.10. Pattern Matching

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/pattern-matching.html | prev: https://morloc-project.github.io/docs/features/patterns.md | next: https://morloc-project.github.io/docs/features/where-and-let.md

A **pattern** describes the shape of a value using the same notation you would use to build it. Morloc matches values against patterns in two ways.

**Irrefutable patterns** destructure a value into named parts at binding positions: lambda parameters, function-definition arguments, `let` left-hand sides, and `do`\-block `←` binds. Every well-typed receiver matches, so these patterns contain only variable names, wildcards, and structural constructors — no literals, no alternatives. That is what makes them irrefutable.

**Refutable patterns** dispatch on the shape of a value through a list of `|`\-clauses. A clause can fail to match, because a literal matches only itself, so clauses are tried in order and the first that matches wins. Clauses appear either in a function’s definition, dispatching on its arguments, or in a `match` expression, dispatching on any value you hand it.

[Patterns](https://morloc-project.github.io/docs/features/patterns.md) covers the related but distinct topic of pattern **functions** — `.0`, `.[i:j]`, and friends — which extract and rebuild data rather than bind names.

## 4.10.1. Irrefutable patterns

The supported shapes:

-   **variable** — `x` binds the whole value
-   **wildcard** — `_` matches without binding
-   **tuple** — `(x, y)` binds each component. Full arity is required; use wildcards for positions you want to ignore, as in `(x, _, _)`
-   **record** — `{a = x, b = y}` binds fields by name. Extra fields are ignored, order does not matter, and the receiver only has to **have** the keys the pattern mentions. This is structural, or row-polymorphic, matching — the same rule as the `.(.a, .b)` group getter
-   **as-pattern** — `label@atom` binds `label` to the whole receiver and destructures further through `atom`
-   **nesting** is free: `(x, {a = y, b = _}, q@(l, r))`

All four binding sites take them:

```morloc
-- lambda parameter
first = \ (a, b) -> a

-- function-definition argument
snd (_, y) = y

-- let-binding
demo pair = let (a, b) = pair in a

-- do-block bind
useIt = do
  (a, b) <- readPair
  a
```

Records mix in cleanly:

```morloc
record Pair = Pair { a :: Int, b :: Int }

-- field-polymorphic: any record with keys 'a' and 'b'
pickA {a = x, b = _} = x

-- nested
combine :: (Int, Pair) -> Int
combine (n, {a = p, b = q}) = n + p + q
```

```console
$ ./match pickA '{"a":5,"b":6}'
5
$ ./match combine '[1,{"a":2,"b":3}]'
6
```

### Wildcards

`_` matches without binding. In a `let` left-hand side or a `do` bind, the right-hand side is still evaluated, so effects still fire; in a lambda or function-argument position the slot is accepted and discarded.

```morloc
-- discard the first tuple element
snd (_, y) = y

-- do-bind: the effect fires, the value is discarded
main = do
  _ <- setup
  work
```

### As-patterns

`label@atom` binds `label` to the whole receiver **and** destructures through `atom`, so both are in scope:

```morloc
tag p@(x, y) = (p, x + y)
```

```console
$ ./match tag '[3,4]'
[[3,4],7]
```

There must be **no whitespace** around `@`. Write `p@(x, y)`, never `p @ (x, y)`:

```console
pmx.loc:6:7: unexpected operator '@'
    |
  6 | tag p @ (x, y) = (p, x + y)
    |       ^
```

This matches the tight-binding style of Morloc’s other qualifier operators — `.` for namespaces, `:` for group labels. An `@name` in a fresh position (start of line, after whitespace, after a delimiter) still means an intrinsic such as `@stdout`.

### Record patterns on `let` and `do` need parentheses

`let` and `do` both accept an explicit `{` right after the keyword as an alternative to layout-based blocks:

```morloc
let { a = 1; b = 2 } in a       -- explicit-brace form of a two-binding let
do  { readValue; useIt }        -- explicit-brace form of a do-block
```

So a record pattern in those positions has to be parenthesized, or its `{` is read as the start of a bindings block:

```morloc
-- required
let ({a = p, b = q}) = mkPair in p
do
  ({a = p, b = q}) <- fetch
  p
```

Without the parentheses you get a parse error that does not obviously point at the real problem — the parser is inside a bindings block by then and is complaining about the comma:

```console
pmx.loc:9:18: unexpected ','
    |
  9 | demo = let {a = p, b = q} = mkPair in p
    |                  ^
  expected one of: '}', ';'
```

Function-definition and lambda positions are unaffected: neither `\` nor a function name is a layout keyword, so `foo {a = x, b = y} = x` and `\ {a = x, b = y} → x` parse without parentheses. Tuple and as-patterns on `let` and `do` are also fine unparenthesized, because they do not start with `{`.

## 4.10.2. Refutable patterns

A function can dispatch on the shape of its arguments by giving several `|`\-clauses instead of one body. Each clause lists one pattern per argument, then `=` and a result. Clauses are tried top to bottom, and the first whose patterns all match wins:

```morloc
fibonacci :: Int -> Int
fibonacci | 0 = 1
          | 1 = 1
          | n = fibonacci (n - 1) + fibonacci (n - 2)
```

A multi-argument function carries one pattern per argument per clause:

```morloc
ackermann :: Int -> Int -> Int
ackermann | 0 n = n + 1
          | m 0 = ackermann (m - 1) 1
          | m n = ackermann (m - 1) (ackermann m (n - 1))
```

```console
$ ./match fibonacci 10
89
$ ./match ackermann 2 3
9
```

A clause pattern may take any irrefutable shape — variable, wildcard, tuple, record, as-pattern — plus one more: a **literal**. An `Int`, `Real`, `Str`, or `Bool` value matches only itself, and that is what makes a clause refutable.

There is a second refutable shape, the **constructor pattern**, which matches one alternative of a sum type. It is covered in [Sum types](https://morloc-project.github.io/docs/features/sum-types.md), together with the `data` declaration that creates the constructors, and it works in every position described here.

```morloc
greet :: Str -> Str
greet | "en" = "hello"
      | "fr" = "bonjour"
      | _    = "hi"
```

```console
$ ./match greet fr
"bonjour"
$ ./match greet de
"hi"
```

Literals nest inside structural patterns, so you can pin part of a compound value and bind the rest:

```morloc
-- match a pair whose first element is 0, bind the second
firstZero :: (Int, Int) -> Int
firstZero | (0, n) = n
          | (m, n) = m + n
```

> **Note**
> A literal pattern compiles to an equality test, so the argument’s type needs an `Eq` instance in scope — the same requirement as writing `x == 0` yourself. The standard library provides `Eq` for the primitive types.

## 4.10.3. `match` expressions

A definition’s clauses dispatch on that definition’s arguments. When the value you want to dispatch on is one you **computed**, there is no argument to hang clauses on. `match` takes the value directly, then the same `|`\-clause list:

```morloc
statusText :: Int -> Str
statusText code = match code // 100
  | 2 = "success"
  | 3 = "redirect"
  | 4 = "client error"
  | 5 = "server error"
  | _ = "unknown"
```

```console
$ ./match statusText 200
"success"
$ ./match statusText 404
"client error"
$ ./match statusText 999
"unknown"
```

The clauses match the status **class**, `code // 100`, not `code`. A clause list cannot: it only sees the argument, so this would mean inventing a second function that takes the class, naming it, and calling it.

The scrutinee is a full expression, so `match code // 100` needs no parentheses. Anywhere an expression is allowed, a `match` is allowed — in one branch of a guard:

```morloc
describeStatus :: Int -> Str
describeStatus code
  ? code < 100 = "not a status code"
  : match code // 100
      | 2 = "success"
      | 4 = "client error"
      | 5 = "server error"
      | _ = "other"
```

```console
$ ./match describeStatus 42
"not a status code"
$ ./match describeStatus 503
"server error"
```

or inside a lambda, where there is no definition head at all:

```morloc
labels :: [Int] -> [Str]
labels = map (\c -> match c // 100 | 2 = "ok" | _ = "not ok")
```

```console
$ ./match labels '[200,404,201]'
["ok","not ok","ok"]
```

A `do`\-block statement is the other common home; matching on a bound result is how a fallible call is consumed, which [Failure and recovery](https://morloc-project.github.io/docs/features/intrinsics.md#failure-and-recovery) covers along with the type it produces.

When you **are** dispatching on a plain argument, keep the clause form. It says the same thing with less punctuation, and it is what the rest of this chapter uses.

### Where a clause list ends

A `match` has no closing keyword. Its clause list runs until something appears that cannot begin another clause, and `|` can always begin another clause. So a comma, a closing bracket, the `:` of a guard, the end of a `do` statement, `where`, and the end of a definition all end the list, and two `match` expressions sit side by side in a tuple with no help:

```morloc
pairUp :: Int -> Int -> (Str, Str)
pairUp x y = (match x | 0 = "a" | _ = "b", match y | 0 = "c" | _ = "d")
```

What does **not** end the list is a `|` belonging to something enclosing. A `match` written inside another ``match’s arm swallows that outer arm’s remaining clauses, and the error lands on the outer `match``, which has now lost its catch-all:

```console
nest2.loc:4:14: `|` patterns for 'match' are not exhaustive; a literal pattern cannot cover its type, so add a final catch-all clause (a variable or '_')
    |
  4 | nested x y = match x
    |              ^
```

The same happens inside a definition’s clause body, where the inner `match` absorbs the next clause of the definition. There the clause it swallowed has one pattern per argument, so the error names the arity rule instead:

```console
nest.loc:4:14: each `match` clause takes exactly one pattern, but this one has 2
    |
  4 | both | 0 y = match y | 1 = "a" | _ = "b"
    |              ^
```

Parenthesize the inner `match` and both compile:

```morloc
both :: Int -> Int -> Str
both | 0 y = (match y | 1 = "a" | _ = "b")
     | x _ = "c"
```

Parentheses are also required to pass a `match` as an argument, since it is not an atom:

```console
paren.loc:6:21: unexpected 'match'
    |
  6 | noParens x = double match x | 0 = 1 | _ = 2
    |                     ^
```

Write `double (match x | 0 = 1 | _ = 2)` instead.

Each `match` clause takes exactly one pattern, because there is one value being matched. That is the only structural difference from a definition’s clause list; the patterns themselves, the top-to-bottom order, and the exhaustiveness requirement below are the same.

**Why there is no closing keyword**

Languages with this construct usually bracket it: ML and Haskell write `case e of` and close the alternatives with layout or braces, Rust and Scala use `{}`. Morloc reuses the `|`\-clause list it already has for definitions instead, which keeps one notation for one idea and costs a terminator.

The cost is the case above. A clause list that ends at "the next thing that cannot be a clause" is unambiguous to parse — the grammar resolves the conflict by continuing the innermost list, which is what greedy gathering means — but it is not always what a reader expects when two lists are adjacent, and indentation does not disambiguate. Parentheses do, and are the only tool for it.

## 4.10.4. Exhaustiveness

Every clause of a term belongs to one definition and the last clause is the fall-through, so a `|`\-match must be exhaustive. That holds when the final clause is irrefutable — a variable or a `_` catch-all:

```morloc
classify :: Int -> Str
classify | 0 = "zero"
         | _ = "nonzero"
```

or when the clauses of a single `Bool` argument already cover both cases:

```morloc
invert :: Bool -> Bool
invert | True  = False
       | False = True
```

Anything else is rejected at compile time, with the fix named:

```console
pmx.loc:6:1: `|` patterns for 'stuck' are not exhaustive; add a final catch-all clause (a variable or '_')
    |
  6 | stuck | 0 = "a"
    | ^
```

A `match` is held to the same requirement, and its clauses are reported against the word `match` rather than a definition’s name:

```console
mne.loc:4:16: `|` patterns for 'match' are not exhaustive; a literal pattern cannot cover its type, so add a final catch-all clause (a variable or '_')
    |
  4 | sizeLabel xs = match (size xs)
    |                ^
```

## 4.10.5. Guards inside a clause

A clause body may itself be a `?`/`:` guard (see [Conditionals](https://morloc-project.github.io/docs/features/conditionals.md)), so one definition can match on an argument’s shape and then branch on a condition. Variables bound by the clause pattern are in scope in the guard:

```morloc
foo :: Int -> Int
foo | 0 = 0                     -- literal-pattern clause
    | x ? x < 10 = 1            -- variable pattern, guard as the body
        : 2
```

```console
$ ./match foo 0
0
$ ./match foo 5
1
$ ./match foo 50
2
```

## 4.10.6. Not yet supported

-   **List and vector patterns** (`[x, y, z]`). These are only sound when the receiver’s length is statically known, so they are deferred until Morloc’s fixed-width versus variable-length list story settles.
