# 0077: a parameterized `data` type cannot be serialized across a pool or inside a container

- Status: open
- Found: 2026-09-10, while writing the `Try` examples for the sum types and effects chapters
- Component: compiler
- morloc: 0.102.1

## Expected

A `data` type with a type parameter should be usable wherever any other type
is. `src/content/features-sum-types.asc` presents `data` as an ordinary type
constructor, and the standard library's `Try e a` -- the type every fallible
operation now returns -- is parameterized, so `[Try Str Int]` is a shape users
will reach for immediately (parse a list of strings, keep the failures).

## Observed

A parameterized `data` at the top level of an export works. The same type
inside a list or a tuple is rejected at build time.

```
$ cat par.loc
module main (bare, inList, inTuple)
import root
import root-py
data Opt a = Some a | None

bare :: Int -> Opt Int
bare x = Some x

inList :: [Int] -> [Opt Int]
inList = map (\x -> Some x)

inTuple :: Int -> (Opt Int, Int)
inTuple x = (Some x, x)

$ morloc make -o par par.loc
par.loc:1:20: error:
No Packable instance for type 'Opt Int' (concrete: Opt Int).
Define an instance, e.g.:
  instance Packable <unpacked> (Opt ...) where ...
or map Opt to a primitive list / tuple / sourced type.
  |
1 | module main (bare, inList, inTuple)
  |                    ^
```

Dropping the two nested exports leaves a program that builds and runs:

```
$ morloc make -o par2 par2.loc
$ ./par2 bare 3
{"Some":[3]}
```

The same type is also rejected when it merely has to cross a pool boundary,
with no container involved. `mkopt` is a sourced Python function:

```
$ cat cross.loc
module main (fromPool, madeHere)
import root
import root-py
data Opt a = Some a | None
source Py from "opt.py" ("mkopt")
mkopt :: Int -> <IO> (Opt Int)
fromPool :: Int -> <IO> (Opt Int)
fromPool n = mkopt n
madeHere :: Int -> Opt Int
madeHere n = Some n

$ morloc make -o cross cross.loc
cross.loc:1:14: error:
No Packable instance for type 'Opt Int' (concrete: Opt Int).
```

Drop `fromPool` and the nexus-local `madeHere` builds and runs:

```
$ ./cross2 madeHere 3
{"Some":[3]}
```

So the working case is narrow: a parameterized `data` may be built and
returned by the nexus itself, and nothing else. It may not cross into or out
of a pool, and it may not sit inside a list or a tuple.

An unparameterized `data` does all of these without complaint, so the
parameter is what matters, not the sum type:

```
$ cat try4.loc
module main (many)
import root
import root-py
data Box = Full Int | Empty
many :: [Int] -> [Box]
many = map (\x -> Full x)

$ morloc make -o try4 try4.loc      # builds
```

## Reproduce

Save `par.loc` above in an empty directory and run `morloc make -o par
par.loc`. The same failure appears with the standard library's own type: an
export of `[Str] -> [Try Str Int]` is rejected while `Str -> Try Str Int` is
accepted.

## Impact

Wide. `Try` is parameterized and is now the return type of every fallible
intrinsic, so this blocks two ordinary shapes: mapping a fallible operation
over a list and inspecting the outcomes, and writing a sourced function that
returns a `Try` for morloc code to match on. Intrinsic-produced `Try` values
happen to work at the top level because they are built in the nexus, which
masks the problem until a user writes their own fallible function in Python or
{cpp}. The workaround is to consume the `Try` inside the pool and return a
plain value, which forfeits exactly the reporting the type exists for.

## Guess

Unverified. The nexus had the same shape of hole in `generalTypeToSerialAST'`,
where an applied `data` fell through to alias expansion instead of being
treated as a leaf; that one was fixed by adding an applied-type case. The
Packable resolution that produces this message looks like it never grew the
equivalent case, so an applied `data` is not recognised as a type it can
already serialize.
