# 4.12. Conditionals

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/conditionals.html | prev: https://morloc-project.github.io/docs/features/where-and-let.md | next: https://morloc-project.github.io/docs/features/recursion.md

Guards are Morloc’s conditional branching. A guard clause starts with `?`, followed by a condition and a result. A `:` default closes the chain and is always required:

```morloc
abs :: Int -> Int
abs x
  ? x >= 0 = x
  : neg x       -- `neg` is negation, from root
```

```console
$ ./guards abs -5
5
```

Conditions are evaluated lazily from top to bottom. The first one that is true decides the result, and the rest are never evaluated. Because the `:` default always terminates the chain, a guard is exhaustive by construction — there is no way to write one that falls off the end.

Guards work with any number of parameters:

```morloc
clamp :: Int -> Int -> Int -> Int
clamp lo hi x
  ? x < lo = lo
  ? x > hi = hi
  : x
```

```console
$ ./guards clamp 0 10 42
10
```

## 4.12.1. Guards with `where`

A `where` clause can supply bindings used in both the conditions and the results:

```morloc
classify :: Int -> Str
classify x
  ? x > big = "big"
  ? x > small = "medium"
  : "small"
  where
    big = 100
    small = 10
```

```console
$ ./guards classify 150
"big"
$ ./guards classify 50
"medium"
$ ./guards classify 5
"small"
```

## 4.12.2. Guards in other positions

A guard may be the body of a `let` binding:

```morloc
absLet :: Int -> Int
absLet x =
  let result ? x >= 0 = x
             : neg x
  in result
```

and it may appear inline anywhere a value is expected. Parentheses are optional but usually clearer:

```morloc
labelOf :: Int -> Str
labelOf x = "label: " <> (? x > 0 = "pos" : "non-pos")
```

```console
$ ./guards labelOf 4
"label: pos"
$ ./guards labelOf -4
"label: non-pos"
```

## 4.12.3. Guards inside a pattern clause

Guards compose with refutable pattern matching ([Pattern Matching](https://morloc-project.github.io/docs/features/pattern-matching.md)). A `|`\-clause may use a guard as its body, so one definition can match on an argument’s shape and then branch on a condition. Variables bound by the clause pattern are in scope in the guard:

```morloc
sign :: Int -> Str
sign | 0 = "zero"                -- literal pattern matches only 0
     | x ? x < 0  = "neg"        -- otherwise bind x, then guard on it
         ? x < 10 = "small"
         : "large"
```

```console
$ ./guards sign 0
"zero"
$ ./guards sign -2
"neg"
$ ./guards sign 5
"small"
$ ./guards sign 500
"large"
```
