# 0012: a `newtype` at a foreign-function boundary needs a `Packable` instance even when its native form matches its wire parent's

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" newtype section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/types-newtype.asc` says:

> The `Packable` instance is only needed when the native form really differs.
> If you write `newtype Path = Str` and stop there -- no `type Py => Path = ...`
> override -- then `Path`'s native form is just `Str`'s native form in every
> language, and no bridge is needed.

So a `newtype` with no per-language override should be usable as the argument
or return type of a sourced function without any further declarations.

## Observed

```
$ morloc make -o d2 d2.loc
d2.loc:1:14: error:
Cannot find constructor in VarF "str"  finalType=Name
  |
1 | module main (label)
  |              ^
```

Three things are wrong here:

1. It fails at all.
2. The message is an internal one (`VarF`, `finalType=`), not a user-facing
   diagnostic naming the missing `Packable` instance.
3. The source location is the module's export list, not the signature that
   caused it.

The same failure appears for `newtype Count = Int` (`VarF "int"`) and
`newtype Celsius = Real` (`VarF "float"`), and it still appears when the
per-language form is declared redundantly:

```
newtype Name = Str
type Py => Name = "str"        -- same form as the wire parent, still fails
```

Adding a `Packable` instance with real sources fixes it, and the pack function
really is called at runtime, so this is not a spurious requirement that the
codegen could short-circuit:

```
instance Packable Str Name where
  source Py from "nm.py" ("pack_name" as pack, "unpack_name" as unpack)
```

```
$ ./d10 label 'hi'
pack_name called
"HI"
```

An abstract `instance Packable Str Name` (no `where` block) does not help --
same error.

The failure needs a foreign function. A `newtype` that only flows through pure
morloc is fine:

```
newtype Path = Str
f :: Path -> Path
f x = x                        -- builds and runs
```

## Reproduce

`units.py`:

```python
def shout(s):
    return s.upper()
```

`main.loc`:

```
module main (label)
import root-py
newtype Name = Str
source Py from "units.py" ("shout" as label)
label :: Name -> Str
```

```
$ morloc make -o main main.loc
main.loc:1:14: error:
Cannot find constructor in VarF "str"  finalType=Name
```

## Impact

Every user who reaches for `newtype` to get a distinct type with the same wire
format -- which is the headline use in the manual. The failure surfaces only at
codegen, with an internal message and a location that points at the wrong line,
so there is nothing in the output to suggest "declare a `Packable` instance".

## Guess

Unverified: the serialization tree builder looks for a `Packable` entry keyed
on the newtype and never falls back to "the native forms are identical, emit
an identity conversion", even though `root-py`'s `Packable (List a) (Deque a)`
comment says such a short-circuit exists.
