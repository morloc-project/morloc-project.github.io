# 4.3. Booleans

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/booleans.html | prev: https://morloc-project.github.io/docs/features/foreign-functions.md | next: https://morloc-project.github.io/docs/features/integers.md

Booleans are written `True` and `False` and have the type `Bool`. The comparison and logical operators come from `root`, so a module that uses them imports one of the `root` implementations.

```morloc
yes :: Bool
yes = True

no :: Bool
no = False
```

The literals are capitalized, but a `Bool` prints as lowercase JSON:

```console
$ ./bools yes
true
```

## 4.3.1. Comparison operators

The `Eq` and `Ord` typeclasses in `root` provide the standard comparisons. They work over any type with the appropriate instance: integers, reals, strings, and tuples and lists of comparable values.

| Operator | Meaning |
| --- | --- |
| `==` | equal |
| `!=` | not equal |
| `<` | less than |
| `⇐` | less than or equal |
| `>` | greater than |
| `>=` | greater than or equal |

```morloc
isPositive :: Int -> Bool
isPositive x = x > 0

sameLength :: [a] -> [b] -> Bool
sameLength xs ys = length xs == length ys
```

`sameLength` is generic in both list types, which is fine inside a program but means it cannot be given a command line interface — the compiler cannot decide how to read an argument whose type is still a variable. Exporting it produces:

```console
$ morloc make bools.loc
Warning: skipping generic export 'sameLength'
```

The program still builds; only that one command is absent.

## 4.3.2. Logical operators

| Operator | Meaning |
| --- | --- |
| `&&` | logical AND |
| `\|\|` | logical OR |
| `not` | logical negation (a prefix function, not an operator) |
| `xor` | exclusive OR |
| `nand` | NOT AND |

Both `&&` and `||` are right-associative, and `&&` binds tighter than `||` (`infixr 3 &&` against `infixr 2 ||`), which matches the convention in most languages. So `a || b && c` groups as `a || (b && c)`.

```morloc
inRange :: Int -> Int -> Int -> Bool
inRange lo hi x = lo <= x && x <= hi

isWeekend :: Int -> Bool
isWeekend day = day == 0 || day == 6

isWeekday :: Int -> Bool
isWeekday day = not (isWeekend day)
```

```console
$ ./bools inRange 1 10 5
true
$ ./bools isWeekday 6
false
```

### Short-circuiting

`&&` and `||` short-circuit at run time: if the left operand settles the answer, the right one is never evaluated. This is worth demonstrating rather than asserting, because it is not obvious in a language where the two operands may run in different processes.

```morloc
divZero :: Int -> Int
divZero x = x // 0

-- b comes from the caller, so the compiler cannot fold this away
test :: Bool -> Int -> Bool
test b x = b && (divZero x == 0)
```

With `b` false, the division never happens:

```console
$ ./shortcircuit test false 5
false
```

With `b` true, it does, and the error surfaces with the call chain that produced it:

```console
$ ./shortcircuit test true 5
Error: run failed
integer division or modulo by zero
  at _ [py] (mid=1364, shortcircuit.loc:10:28)
  at test [py] (mid=1, shortcircuit.loc:1:22)
```

## 4.3.3. Boolean-valued list functions

`root` provides three `Foldable` functions that answer questions about a container:

| Function | Signature |
| --- | --- |
| `any` | `Foldable f ⇒ (a → Bool) → f a → Bool` |
| `all` | `Foldable f ⇒ (a → Bool) → f a → Bool` |
| `elem` | `(Foldable f, Eq a) ⇒ a → f a → Bool` |

`any` is `True` when the predicate holds for at least one element, `all` when it holds for every element, and `elem` tests membership using `==`.

```morloc
hasNegative :: [Int] -> Bool
hasNegative = any (< 0)

allPositive :: [Int] -> Bool
allPositive = all (> 0)

containsZero :: [Int] -> Bool
containsZero = elem 0
```

```console
$ ./bools hasNegative '[1,-2,3]'
true
$ ./bools containsZero '[1,0,3]'
true
```

## 4.3.4. Guards

Booleans drive Morloc’s guard syntax. A guard alternative starts with `?` and selects the first branch whose condition is `True`; the `:` line is the fallthrough:

```morloc
classify :: Int -> Str
classify x
  ? x < 0     = "negative"
  ? x == 0    = "zero"
  : "positive"
```

```console
$ ./bools classify -4
"negative"
$ ./bools classify 0
"zero"
$ ./bools classify 7
"positive"
```

See [Conditionals](https://morloc-project.github.io/docs/features/conditionals.md) for the full description of guard syntax.
