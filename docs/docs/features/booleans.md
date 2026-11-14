# 3.4. Booleans

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/booleans.html | prev: https://morloc-project.github.io/docs/features/importing-modules.md | next: https://morloc-project.github.io/docs/features/integers.md

Booleans are written `True` and `False` and have the type `Bool`. `&&` and `||` are built in. The comparison operators and the other logical functions come from `root`, so a module that uses them imports one of the `root` implementations.

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

## 3.4.1. Comparison operators

The `Eq` and `Ord` typeclasses in `root` provide the standard comparisons. They work over any type with the appropriate instance: integers, reals, strings, and tuples and lists of comparable values.

| Operator | Meaning |
| --- | --- |
| `==` | equal |
| `!=` | not equal |
| `<` | less than |
| `<=` | less than or equal |
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

## 3.4.2. Logical operators

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

`&&` and `||` short-circuit at run time: if the left operand settles the answer, the right one is never evaluated, in every language and wherever the operands run. They are built-in forms rather than ordinary functions, which is why no module can redefine them.

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
  at test [py] (mid=1, shortcircuit.loc:10:1)
```

## 3.4.3. Boolean-valued list functions

`root` provides three `Foldable` functions that answer questions about a container:

| Function | Signature |
| --- | --- |
| `any` | `Foldable f => (a -> Bool) -> f a -> Bool` |
| `all` | `Foldable f => (a -> Bool) -> f a -> Bool` |
| `elem` | `(Foldable f, Eq a) => a -> f a -> Bool` |

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

## 3.4.4. Guards

Booleans drive Morloc’s conditional syntax, the `?`/`:` guard, covered in [Conditionals](https://morloc-project.github.io/docs/features/conditionals.md).
