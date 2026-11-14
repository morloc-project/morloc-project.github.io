# 4.4. Naming a type: `type` and `newtype`

Morloc Manual > Advanced Types | https://morloc-project.github.io/docs/types/newtype.html | prev: https://morloc-project.github.io/docs/types/infix-operators.md | next: https://morloc-project.github.io/docs/types/packable.md

Morloc gives you two keywords for putting a name on a type, and the choice between them decides whether the new name is the same type as the old one or a different one.

`type X = Y` is a **transparent alias**. `X` and `Y` are one type with two spellings, interchangeable everywhere.

`newtype X = Y` is a **nominal type**. `X` is a genuinely new type that happens to travel across language boundaries in the same format as `Y`. It owns its own typeclass instances and its own per-language representations, and a value cannot flow between `X` and `Y` without an explicit conversion.

A third form, a declaration with no right-hand side at all, declares an opaque primitive. That is covered at the end.

## 4.4.1. `type`: transparent aliases

An alias is fully substitutable with its right-hand side anywhere a type can appear — in signatures, annotations, container parameters, instances, everywhere.

```morloc
type Filename = Str
type UserID   = Int
```

A `Filename` goes wherever a `Str` is expected and a `Str` goes wherever a `Filename` is expected. Two aliases on the same chain are interchangeable with each other too: with `type A = Str` and `type B = Str`, an `A` flows into a `B` slot without conversion.

Aliases are useful for three things: naming (a signature reads better when a `Filename` is called a `Filename`), shortening long type expressions (`type Coord = (Real, Real)`), and attaching per-argument CLI documentation, which is described below.

## 4.4.2. Alias chains resolve on their own

[Native type mappings](https://morloc-project.github.io/docs/features/foreign-functions.md#mapping-native-types) showed how a general type is mapped to each language:

```morloc
type Py => Str = "str"
```

You do not repeat that mapping for every alias. The compiler follows the chain until it finds a language-specific form, however many hops it takes:

**alias.loc**

```morloc
module main (shout)

import root-py

type LastName = Str
type Surname  = LastName

source Py from "ops.py" ("to_upper" as shout)
shout :: Surname -> LastName
```

**ops.py**

```python
def to_upper(s):
    return s.upper()
```

```console
$ morloc make -o prog alias.loc
$ ./prog shout 'smith'
"SMITH"
```

`Surname` resolves to `LastName`, which resolves to `Str`, which resolves to `"str"` in Python. Writing `type Py => Surname = "str"` would be redundant — and, as shown below, is rejected.

## 4.4.3. Docstring inheritance

A docstring on an alias, with its directives, is inherited by every argument of that type, and an alias may override individual fields of its parent’s. Two `Str` aliases can therefore document two arguments differently; [Docstrings](https://morloc-project.github.io/docs/clis/docstrings.md) shows this in the help output.

`newtype` does not inherit docstrings. A `newtype` is its own identity and its own documentation.

## 4.4.4. What an alias cannot do

An alias has no identity of its own, so it cannot own anything.

**It cannot have its own typeclass instances.** The instance belongs to the root of the chain, and every alias on the chain shares it:

```console
$ morloc typecheck aliasinst.loc
aliasinst.loc:4:1: error:
Cannot declare instance on transparent alias 'Filename'.
All members of an alias tree share a single instance. Either declare the instance for the root type, or change the declaration of 'Filename' from 'type' to 'newtype' so it becomes a nominally distinct type that owns its own instances.
  |
4 | instance Eq Filename where
  | ^
```

**It cannot have its own per-language form.** The chain has to resolve to one native type per language:

```console
$ morloc typecheck aliaslang.loc
aliaslang.loc:4:1: error:
'Filename' is declared as a 'type' alias but has a per-language form for py.
Change 'type' to 'newtype' so 'Filename' becomes a nominally distinct type that owns its native language forms.
  |
4 | type Py => Filename = "pathlib.Path"
  | ^
```

Both errors tell you the fix: use `newtype`.

## 4.4.5. `newtype`: nominal types

A `newtype` is a new type that shares a wire format with the type on its right-hand side. Its instances, its native forms, and its identity are its own.

```morloc
newtype Path = Str
type Py => Path = "pathlib.Path"
type Cpp => Path = "std::filesystem::path"
```

`Path` and `Str` are now different types, and mixing them is an error:

**nomix.loc**

```morloc
module main (bad)

import root-py

newtype Path = Str
type Py => Path = "pathlib.Path"

f :: Path -> Path
bad :: Str -> Path
bad s = f s
```

```console
$ morloc typecheck nomix.loc
nomix.loc:10:11: error:
Type mismatch:
  expected: Path
  inferred: Str
Cannot compare types Str and Path
   |
10 | bad s = f s
   |           ^
```

The wire format is still `Str`: a `Path` crosses a language boundary as a string. Turning that string into a real `pathlib.Path` inside the pool, and converting between `Path` and `Str` explicitly, takes `pack` and `unpack`, the methods of the `Packable` typeclass; [Serializing custom types with `Packable`](https://morloc-project.github.io/docs/types/packable.md) covers them, including when a `newtype` needs an instance of its own.

## 4.4.6. Declarations with no body

A declaration with no right-hand side introduces a primitive: nominal, opaque, owning its own per-language forms and instances, with no underlying Morloc representation.

```morloc
newtype Int
newtype Str
newtype List a
```

`type` and `newtype` mean the same thing in this position — there is no alias to be transparent about — and the compiler treats them identically. Prefer `newtype`, which is what these declarations behave like. The standard library uses this form for every built-in type; `internal/main.loc` is a long list of them.

This is also how you declare a type that exists only in the foreign languages:

```morloc
newtype Map key val
type Py  => Map key val = "dict" key val
type Cpp => Map key val = "std::map<$1,$2>" key val
```

Such a type has no wire form, so a value of it cannot cross between languages. To let it cross, give it a body, as `Map` does in [Serializing custom types with `Packable`](https://morloc-project.github.io/docs/types/packable.md).

## 4.4.7. The rules

1.  **An instance belongs to the root of an alias chain.** `instance Foo MyAlias` where `type MyAlias = Bar` is rejected. Declare it on `Bar`, or make `MyAlias` a `newtype`.
2.  **Every member of a `type` chain shares the root’s instances.** With `type A = Str` and `type B = Str`, the single `instance Eq Str` is found at every site that mentions `A`, `B`, or `Str`.
3.  **A `type` alias may not carry a per-language form.** `type Py ⇒ MyAlias = "…​"` is rejected. Use `newtype`.
4.  **A `newtype` is nominal.** It owns its instances and its per-language forms. It needs a `Packable` instance only when it declares a native form that the language binding cannot build from the wire form on its own ([Serializing custom types with `Packable`](https://morloc-project.github.io/docs/types/packable.md)).
5.  **`newtype` wire-parent chains may not cycle.** `newtype A = B` with `newtype B = A` gives ``Mutual recursion between type definitions is not supported unless a `data` type cuts the cycle. Cycle: A, B``.
