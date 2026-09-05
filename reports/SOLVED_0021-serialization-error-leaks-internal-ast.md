# 0021: the "packer not generic enough" error prints raw Haskell constructors

- Status: fixed
- Found: 2026-09-02, writing the "Advanced Types" `Packable` section
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

When a `Packable` instance is too specialised for the type at hand, the error
should name the two types in morloc syntax. The rest of this same message
already does that.

## Observed

One line of the message dumps the internal `TypeF` value:

```
$ morloc make -o ronly ronly.loc
ronly.loc:1:24: error:
There was an error raised in subtyping while resolving serialization
The packer involved maps the type:
  forall b . Map Str b

To the serialized form:
  forall b . [(Str, b)]

Here the unresolved concrete packed type:
  b: forall b . list character b

Should be the subtype of the resolved packed type:
  a: AppF (VarF (FV (TV {unTVar = "Map"}) (CV {unCVar = "list"}))) [VarF (FV (TV {unTVar = "Int"}) (CV {unCVar = "integer"})),VarF (FV (TV {unTVar = "Str"}) (CV {unCVar = "character"}))]

The generic terms in b should be resolved through subtyping and used to resolve the unpacked type:
  c: forall b . list (list character b)

However, the b <: a step failed:
Cannot compare types character and integer
...
```

The `a:` line should read something like `Map Int Str` (R form `list`).

## Reproduce

`map-packing.R`:

```r
pack <- function(xs){
  out <- list()
  for (kv in xs) out[[kv[[1]]]] <- kv[[2]]
  out
}
unpack <- function(d){
  lapply(names(d), function(k) list(k, d[[k]]))
}
```

`ops.R`:

```r
count_keys <- function(d) length(d)
```

`ronly.loc`:

```
module main (countStr, countInt)

import root-r

newtype Map key val
type R => Map key val = "list" key val

instance Packable [(Str, b)] (Map Str b) where
    source R from "map-packing.R" ("pack", "unpack")

source R from "ops.R" ("count_keys" as countKeys)
countKeys :: Map a b -> Int

countStr :: Map Str Int -> Int
countStr = countKeys

countInt :: Map Int Str -> Int
countInt = countKeys
```

```
$ morloc make -o ronly ronly.loc
```

The error is correct -- `countInt` really cannot be served by a `Str`-keyed
packer. Only the rendering of one operand is wrong.

## Impact

This is the error a user hits the first time they write a `Packable` instance
that is narrower than the type it has to cover, so it is a first-contact
message for the feature. Seeing `unTVar`/`unCVar` in it reads as a compiler
crash rather than a type error.

## Guess

Unverified: that line uses `show`/`viaShow` on a `TypeF` instead of the
pretty-printer the neighbouring lines use.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

Two independent causes, both gone.

The raw constructors came from the `Pretty` instance for `TypeF`, which was
defined as `pretty = viaShow` in its entirety -- so every `TypeF` in every error
message printed as a Haskell value. It now renders morloc syntax.

The message quoted above no longer exists at all. It was raised by `resolveP`
when an instance failed to cover a use site, which treated a non-match as fatal
even when another instance matched (report 0049). `resolveP` is now a total
match test that returns the reason instead, and the caller reports only when
nothing matched -- naming every instance it tried and why each was rejected:

```
$ morloc make -o ronly ronly.loc
ronly.loc:1:24: error:
No Packable instance covers 'Map Int Str' (concrete: list integer character).
Instances declared for Map, and why each was rejected:
  forall b . Map Str b
    its concrete form forall b . list character b does not cover list integer character: Cannot compare types character and integer
```

Verified against this report's own reproduction.
