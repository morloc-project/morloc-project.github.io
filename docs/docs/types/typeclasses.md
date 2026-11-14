# 4.2. Overload terms with typeclasses

Morloc Manual > Advanced Types | https://morloc-project.github.io/docs/types/typeclasses.html | prev: https://morloc-project.github.io/docs/types/term-polymorphism.md | next: https://morloc-project.github.io/docs/types/infix-operators.md

A typeclass lets one name have a different implementation for each type it is applied to. Where term polymorphism gives the compiler a free choice between interchangeable definitions, a typeclass instance is *selected* by the type at the call site. The idea is the same as typeclasses in Haskell, traits in Rust, interfaces in Java, and concepts in C++.

A class declares method signatures. An instance supplies the implementations for one type:

**pretty.loc**

```morloc
module main (describeInts, describeReals)

import root-py

class Pretty a where
    pretty :: a -> Str

instance Pretty Int
       , Pretty Real where
    source Py from "ops.py" ("to_str" as pretty)

title :: Pretty a => a -> Str
title x = "value: " <> pretty x

describeInts :: [Int] -> [Str]
describeInts = map title

describeReals :: [Real] -> [Str]
describeReals = map title
```

**ops.py**

```python
def to_str(x):
    return str(x)
```

```console
$ morloc make -o pretty pretty.loc
$ ./pretty describeInts '[1,2]'
["value: 1","value: 2"]
$ ./pretty describeReals '[1.5]'
["value: 1.5"]
```

## 4.2.1. One class, many languages

An instance may source implementations from several languages at once. The compiler then has a choice of instance bodies for the same method, and the usual collapse applies: it takes whichever one keeps the program in one language.

```morloc
class Addable a where
    zero :: a
    (+) :: a -> a -> a

instance Addable Int where
    source Py from "arithmetic.py" ("add" as (+))
    source Cpp from "arithmetic.hpp" ("add" as (+))
    zero = 0

instance Addable Real where
    source Py from "arithmetic.py" ("add" as (+))
    source Cpp from "arithmetic.hpp" ("add" as (+))
    zero = 0.0
```

The native functions may be polymorphic in their own language, in which case the same implementation is named by several instances. The Python `add` above is one function:

**arithmetic.py**

```python
def add(x, y):
    return x + y
```

And so is the C++ one:

**arithmetic.hpp**

```cpp
template <class A>
A add(A x, A y){
    return x + y;
}
```

A method does not have to come from a foreign language. `zero = 0` is an ordinary Morloc definition, and it is polymorphic in the same way any other term is: `zero` in the `Int` instance is the integer literal, `zero` in the `Real` instance is the floating-point one.

> **Warning: This example collides with root**
> `Addable` redeclares `zero` and `(+)`, which `root` already supplies through its `Integral` class. Two classes cannot define the same term, so this module typechecks only in isolation — with `import internal` for the primitive types, not `import root-py` — and `internal` has no Python forms, so it cannot be built that way:
> 
> ```console
> $ morloc typecheck main.loc
> In module 'main': The typeclasses 'Integral' and 'Addable' have conflicting definitions of the term 'zero'
> ```

## 4.2.2. Superclasses

A class may require another class. Write the requirement to the left of `=>` in the class head:

```morloc
class Pretty a => Boxed a where
    box :: a -> Str
```

Any type with a `Boxed` instance must also have a `Pretty` instance, and a function constrained on `Boxed a` may use `pretty` as well as `box`. This is how `root` layers its numeric hierarchy: `class Integral a => Numeric a` means every `Numeric` type is also `Integral`.

## 4.2.3. Instances with contexts

An instance for a type with parameters may need instances at those parameters. Declare them before `=>`. Here `Sz` is a class with one method, `sz :: a → Int`:

```morloc
instance Sz a => Sz (List a) where
    sz xs = fold (\n x -> n + sz x) 0 xs
```

Inside the body, `sz x` at `a` is allowed because of `Sz a`, and `Sz (List Int)` exists wherever `Sz Int` does.

## 4.2.4. Importing a class from another module

A class is exported and imported by its name. Its methods are not separately importable and may not appear in an export list:

**numops/main.loc**

```morloc
module numops (Pretty, exclaim)

import root

class Pretty a where
    pretty :: a -> Str

exclaim :: Pretty a => a -> Str
exclaim x = pretty x <> "!"
```

Listing `pretty` in that export list gives `Module '.numops' does not export the following terms or types: [pretty]`, which is confusing but means what it says: a method has no standalone identity to export.

Importing the class name is enough to declare instances for it elsewhere:

**main.loc**

```morloc
module main (shout)

import root-py
import .numops (Pretty, exclaim)

instance Pretty Int where
    source Py from "ops.py" ("to_str" as pretty)

shout :: Int -> Str
shout = exclaim
```

```console
$ morloc make -o prog main.loc
$ ./prog shout 7
"7!"
```

This is the shape every language-specific standard library module takes. `root` declares `Eq`, `Ord`, `Functor`, `Foldable` and the rest; `root-py`, `root-cpp` and `root-r` import those names and fill in instances. Nothing in `root` knows which languages exist.

## 4.2.5. Deriving instances

Some instances follow from the shape of a type alone. Equality, ordering, a printed form and a hash can be defined once for every value Morloc can serialize, so you do not have to write them. A `deriving` clause on a `data`, `record` or `newtype` declaration (a nominal copy of another type, covered in [Naming a type: `type` and `newtype`](https://morloc-project.github.io/docs/types/newtype.md)) asks the compiler for them:

**shapes.loc**

```morloc
module main (sameShape, larger, describe, fingerprint)

import root-py

data Shape = Circle Real | Rect Real Real
  deriving (Eq, Ord, Show, Hashable)

sameShape :: Shape -> Shape -> Bool
sameShape a b = a == b

larger :: Shape -> Shape -> Shape
larger = max

describe :: Shape -> Str
describe = show

fingerprint :: Shape -> Str
fingerprint = hash
```

```console
$ morloc make -o shapes shapes.loc
$ ./shapes sameShape '{"Circle":[1.0]}' '{"Circle":[1]}'
true
$ ./shapes larger '{"Rect":[2,1]}' '{"Circle":[3]}'
{"Rect":[2,1]}
$ ./shapes describe '{"Rect":[2,1]}'
"{\"Rect\":[2,1]}"
$ ./shapes fingerprint '{"Rect":[2,1]}'
"e1a2ddc07d5d9530"
```

No foreign code was written, and none is needed. A derived instance works on the value in the form it takes when it crosses between languages, the same form the command line reads and prints. The instances of the fields are never consulted, so the answers do not depend on which language runs the comparison. Swap `root-py` for `root-cpp` or `root-r` and every line above prints the same thing, hash included.

The classes you can derive are these:

**`Eq`**

`==` is structural equality.

**`Ord`**

`<=` compares fields left to right. A `data` value orders by the position of its constructor in the declaration first, so every `Circle` is less than every `Rect`, and then by its fields. Lists compare element by element, strings by their UTF-8 bytes, and an absent optional value sorts before a present one.

**`Show`**

`show` gives the JSON text the command line would print.

**`Hashable`**

`hash` gives a hex string, equal for equal values.

**`Packable`**

Only on a `newtype`: it gives `pack`, the conversion from the wrapped type to the newtype. [Serializing custom types with `Packable`](https://morloc-project.github.io/docs/types/packable.md) covers the class and when a newtype needs it.

Floats are compared by their bits, not by IEEE equality: `NaN == NaN` is true and `-0.0 == 0.0` is false, and `Ord` puts `-0.0` before `0.0`. That keeps the rule that equal values have equal hashes.

> **Warning: Derived equality compares the serialized form as it is**
> A type whose serialized form is not unique gets an equality that can tell equal things apart. A `Map` crosses languages as a list of pairs, so two maps with the same entries inserted in different orders are not `==` under a derived instance. If your type needs equality up to some normal form, write the instance yourself.

A deriving clause and a hand-written instance of the same class for the same type is an error, since the compiler cannot know which one you meant:

```console
$ morloc make -o both both.loc
both.loc:7:1: error:
The instance Eq (Name) is also derived by its type's deriving clause; keep one.
  |
7 | instance Eq Name where
  | ^
```

And any other class is rejected where it is named:

```console
$ morloc make -o other other.loc
other.loc:5:30: cannot derive 'Functor'; a declaration may derive Eq, Ord, Show and Hashable, and a newtype also Packable
    |
  5 | newtype Name = Str deriving (Functor)
    |                              ^
```
