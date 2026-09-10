# 0075: comparison of a `data` value is wrong inside an R pool

- Status: fixed
- Found: 2026-09-10, while writing `src/content/features-sum-types.asc`
- Component: runtime
- morloc: 0.102.1

## Expected

`==` and the ordering operators on a `data` value give the same answer wherever
the comparison is realized. `src/content/features-sum-types.asc` (section
"Comparison") says `==` compares constructor then fields, and that ordering
follows declaration position.

## Observed

A comparison realized in an R pool answers `false` for values that are equal,
and `false` for an ordering that holds. The same expressions are right in the
nexus and in Python, {cpp} and Rust pools. Nothing is reported; the wrong
answer is returned.

```
$ ./ordp rLt Red      # Red < Blue, realized in an R pool
false
$ ./ordp pyLt Red     # the same comparison, realized in a Python pool
true
$ ./e5 rEq Blue       # Blue == Blue, realized in an R pool
false
```

## Reproduce

```
$ cat > ordr.R <<'END'
ident <- function(x) x
END
$ cat > ordp.loc <<'END'
module main (rLt)
import root-r
data Color = Red | Green | Blue
source R from "ordr.R" ("ident" as rId)
rId :: Color -> Color
rLt :: Color -> Bool
rLt c = rId c < Blue
END
$ morloc make -o ordp ordp.loc
$ ./ordp rLt Red
false        # expected true
```

## Impact

Silent wrong answers for any program that compares a `data` value in R. There
is no error and no warning, and the same source is correct in the other three
languages, so the failure only shows up as a wrong result.

## Guess

Unverified. An enum reaches an R pool as a `factor`, whose comparison
semantics are not the integer comparison the generated code assumes: `==`
against an unordered factor compares levels, and `<` on an unordered factor
returns `NA` with a warning. Equality alone is filed upstream as
morloc-project/morloc#64; the ordering half is not.

## Resolution

Fixed in `morloc` commit `05293c74`.

An enum reaches an R pool as an ORDERED factor, and a constructor written as a
literal into generated R is built the same way, so the two forms a value can
arrive in are one form. R then compares in level order, which is declaration
order, and answers what every other language answers. The generated Rust enum
also derives `PartialOrd`/`Ord`, so an ordering comparison no longer fails to
compile when the realizer happens to put it in a Rust pool.

Covered by the `enum-comparison` golden test, which asserts `==` and `<` in
all four languages and in the nexus, and asserts that the R literal and the R
wire value have the same class.
