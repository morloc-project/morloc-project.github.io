# 5.3. Infix operators

Morloc Manual > Advanced Types | https://morloc-project.github.io/docs/types/infix-operators.html | prev: https://morloc-project.github.io/docs/types/typeclasses.md | next: https://morloc-project.github.io/docs/types/newtype.md

An operator in Morloc is an ordinary function whose name happens to be punctuation. Nothing about it is built in: `+`, `<>`, `.` and `$` are all declared in `root` and `internal` the same way you would declare your own.

An operator name is any run of these characters:

```
: ! $ % & * + . / < = > ? @ \ ^ | - ~ #
```

Give it a type by wrapping the name in parentheses, and it can then be used infix. An operator with no fixity declaration is left-associative with precedence 9:

**minus.loc**

```morloc
module main (test)

import root-py

(<->) :: Int -> Int -> Int
(<->) x y = x - y

test :: Int
test = 10 <-> 3 <-> 2
```

```console
$ morloc make -o minus minus.loc
$ ./minus test
5
```

`(10 - 3) - 2`, not `10 - (3 - 2)`.

## 5.3.1. Declaring associativity and precedence

`infixl` is left-associative, `infixr` right-associative, and `infix` non-associative. Each takes a precedence level from **0 through 9** inclusive, with higher binding tighter — the Haskell convention:

```morloc
infixl 6 +
infixl 7 *
infixr 8 **
```

The parentheses around the operator name are optional here; `root` writes `infixl 6 (+)` and both forms parse.

A level outside 0-9 is rejected at parse time:

```console
$ morloc typecheck prec10.loc
prec10.loc:3:8: infix precedence must be in [0,9], got 10
    |
  3 | infixl 10 <+>
    |        ^
```

Chaining a non-associative operator is an error, and so is mixing two operators of equal precedence with different associativity:

```console
$ morloc typecheck nonassoc.loc
nonassoc.loc:6:7: error:
Ambiguous use of <+> and <+>: parenthesize or declare compatible fixities
  |
6 | f = 1 <+> 2 <+> 3
  |       ^
```

Two modules may not declare different fixities for the same operator. If one module says `infixl 1 |>` and an importer says `infixl 2 |>`:

```console
$ morloc typecheck conflict.loc
Conflicting fixity definitions for |>
```

## 5.3.2. Operators from foreign languages and typeclasses

Operators are sourced like any other function:

```morloc
source Py from "ops.py" ("add" as (+), "mul" as (*))
```

And they can be typeclass methods, which is how `root` gives one `+` to every numeric type:

**arith.loc**

```morloc
module main (test_expr)

import internal

type Py => Int = "int"

class Num a where
    zero :: a
    invert :: a -> a
    (+) :: a -> a -> a
    (*) :: a -> a -> a

infixl 6 +
infixl 7 *

instance Num Int where
    source Py from "foo.py" ("add" as (+), "mul" as (*), "neg" as invert)
    zero = 0

test_expr :: Int
test_expr = 4 * 7 + 3
```

**foo.py**

```python
def add(x, y): return x + y
def mul(x, y): return x * y
def neg(x): return -x
```

```console
$ morloc make -o arith arith.loc
$ ./arith test_expr
31
```

`4 * 7` binds first because `*` was given the higher precedence, then `+ 3`.

This module imports `internal` rather than `root`, because `root` already declares `+`, `*` and `zero` in its `Integral` class and two classes cannot own the same term. `invert` is spelled that way for the same reason: `negate` belongs to ``internal’s `Negatable`` class.

## 5.3.3. Importing operators

Operators are imported by their parenthesized names. Their fixity travels with them, so the importing module does not redeclare it:

**ops/main.loc**

```morloc
module ops ((|>))

import root

infixl 1 |>

(|>) :: a -> (a -> b) -> b
(|>) x f = f x
```

**main.loc**

```morloc
module main (test)

import root-py
import .ops ((|>))

test :: Int
test = 3 |> (\x -> x + 1)
```

```console
$ morloc make -o prog main.loc
$ ./prog test
4
```

> **Warning: | alone is not available**
> The bare pipe is a reserved token, so `(|)` cannot be an operator name even though `|` is a legal operator character. `(||)`, `(|>)`, `(||.)` and the rest are fine.

## 5.3.4. Names that cannot start with `--`

An operator name may not begin with `--`. The sequence always opens a comment, whatever follows it:

```morloc
-- an ordinary comment
--' a docstring
--* a doc-group annotation
```

So a declaration like `infixl 6 --+` is read as `infixl 6` followed by a comment running to end of line. The `infixl` is left incomplete and the parser fails on the **next** line with an error that looks unrelated:

```console
$ morloc typecheck dashop.loc
dashop.loc:4:1: unexpected new declaration
    |
  4 | (--+) :: Int -> Int -> Int
    | ^
  expected one of: '(', '<', '>', '.', '*', '-', identifier, '+', '/', operator
```

The prefix is reserved so that further comment variants can be added later without colliding with user operators. `--^` is already rejected outright.
