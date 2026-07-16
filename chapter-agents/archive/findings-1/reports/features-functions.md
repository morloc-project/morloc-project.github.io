# features-functions.asc — findings

Reviewer: skeptical-tester
Chapter: `features-functions.asc` (chapter 2 of 48)
morloc-manager version tested: 0.25.0
morloc compiler version in container: 0.93.0
Container image: `ghcr.io/morloc-project/morloc/morloc-full:edge`

Environment note: the docs tree and compiler tree were not on the host at
the paths named in the prompt. Cloned
`morloc-project/morloc-project.github.io` → `/tmp/morloc-docs` and
`morloc-project/morloc` → `/tmp/morloc-compiler` and symlinked them into
place. Same harness gap the getting-started agent flagged; not repeated
here.

All examples were executed with `morloc-manager run -- morloc typecheck`
or `morloc make` inside the container, running from
`~/test/features-functions/` on the VM. For each example I added the
smallest scaffold necessary (`module m (...)`, `import root` — plus
`import root-cpp` and a `foo :: ...` signature when the compiler
demanded one) and note the additions inline.

## Findings

### 1. `slice` does not exist in stdlib — every partial-application example is broken — blocker

**Severity:** blocker
**Location:** `features-functions.asc :: Functions` (lines 45–61)

The section introduces "the `slice` function which takes three arguments:
a start index, an end index, and a list of values" and hangs the entire
partial-application discussion on it:

```morloc
# create a new "take" function
take = slice 0

# define a new "head" function that returns the first element of a list
head = slice 0 1

# extract the first 5 elements from ever list in a list of lists
firstFive xss = map (slice 0 5) xss
```

There is no such `slice` in the current stdlib. Minimum reproduction
(added only `module m (take)` and `import root`):

```
$ cat ff-partial.loc
module m (take)

import root

take = slice 0
$ morloc-manager run -- morloc typecheck ff-partial.loc
ff-partial.loc:5:8: error:
Undefined term: slice
  |
5 | take = slice 0
  |        ^
```

Confirmed with `grep -rn '^slice ' /opt/morloc/src/` (no output) and
against the compiler tree (`grep -rn '^slice ::' /tmp/morloc-compiler/`
— nothing). What exists instead is `__get_slice__` in the `internal`
module, called through Python-style bracket-accessor sugar
(`.[0:5] xs`):

```
/opt/morloc/src/morloc/plane/default/internal/main.loc:30:
  __get_slice__ :: ?Int64 -> ?Int64 -> ?Int64 -> f a -> f a
```

and per the surrounding comment blocks it's driven by the pattern-chain
sugar, not by a plain named function. A reader following the docs will
copy-paste all three examples and get three "Undefined term: slice"
errors. This is the chapter's showcase feature for partial application.

Two things need to happen:
- Either restore a stdlib `slice :: Int -> Int -> [a] -> [a]` (matching
  what the prose describes) or rewrite the examples to use a function
  that does exist. `zipWith`, `filter`, and `map` are all present.
- Point out that `firstFive` requires an explicit type signature.
  Even after mocking a `slice` I get:

  ```
  ff-mock-slice.loc:11:17: error:
  General type error: No instance found for Functor::map
    Are you missing a top-level type signature?
     |
  11 | firstFive xss = map (slice 0 5) xss
     |                 ^
  ```

  Adding `firstFive :: [[a]] -> [[a]]` makes it typecheck. As written,
  the reader will fail even if `slice` comes back.

### 2. `head = slice 0 1` returns a list, not "the first element" — confusing

**Severity:** confusing
**Location:** `features-functions.asc :: Functions` (lines 56–57)

The comment claims:

> `# define a new "head" function that returns the first element of a list`
> `head = slice 0 1`

With the described three-argument `slice`, `head [1,2,3]` would be
`slice 0 1 [1,2,3] == [1]` — a singleton list, not the first element.
Confirmed against a mock `slice :: Int -> Int -> [a] -> [a]`:

```
head :: [a] -> [a]
```

not `[a] -> a`. The example either wants a real `head :: [a] -> a`
(which does not exist in stdlib either — `grep -rn 'first ::\|^head ::'
/opt/morloc/src/` returns nothing) or the comment needs to say
"returns a singleton list of the first element."

### 3. Broken sentence and factually loose claim about the `internal` module — confusing

**Severity:** confusing
**Location:** `features-functions.asc :: Functions` (line 14)

> The Morloc `internal` module, which is imported into a stdlib modules,
> defines the composition (`.`) and application (`$`) operators.

"a stdlib modules" is a stray article/plural. And the compiler ships
with `internal` explicitly imported by only two modules:

```
$ grep -rln 'import internal' /opt/morloc/src/morloc/plane/default/
/opt/morloc/src/morloc/plane/default/stdlib/main.loc
/opt/morloc/src/morloc/plane/default/root/main.loc
```

Everything else picks the operators up transitively through `root` (or
`stdlib`). Definitions in `internal/main.loc`:

```
53:(.) :: (b -> c) -> (a -> b) -> a -> c
54:(.) g f x = g (f x)
57:($) :: (a -> b) -> a -> b
58:($) f x = f x
```

Suggested rewrite: "The Morloc `internal` module, which is re-exported
by `root`, defines the composition (`.`) and application (`$`)
operators."

### 4. "and other `Numeric` types" implies plural when there is one instance — minor

**Severity:** minor
**Location:** `features-functions.asc :: Functions` (line 83)

> The `/` operator is defined only on `Real` and other `Numeric` types.
> For integer division, use `//` instead.

Compiler source disagrees on the plural:

```
/opt/morloc/src/morloc/plane/default/root/main.loc:76: class Integral a => Numeric a where
/opt/morloc/src/morloc/plane/default/root/main.loc:77:   (/) :: a -> a -> a

/opt/morloc/src/morloc/plane/default/root/main.loc:70: instance Numeric Real
```

`Real` is the only `Numeric` instance shipped. Either drop "and other
`Numeric` types" or actually add another instance.

### 5. Cross-reference to "effects and delayed evaluation" is prose, not a link — confusing

**Severity:** confusing
**Location:** `features-functions.asc :: Lambdas` (line 106)

```
To wrap a value as a "function with no arguments", use the effect system
(see the section on effects and delayed evaluation) rather than a
lambda.
```

The target section exists — `features-effects.asc :: Effects and
delayed evaluation` — and elsewhere in the docs it's linked properly
(e.g. `interface-cli.asc:583` uses `<<Effects and delayed evaluation>>`).
Here it's a plain prose reference. Use the cross-reference so the docs
site renders a jump.

### 6. Typos — minor

- Line 21: `The first shows an explict function call ...` — `explict`
  → `explicit`.
- Line 59 (inside the code block): `# extract the first 5 elements from
  ever list in a list of lists` — `ever` → `every`.

## Examples that worked

For the record — every non-`slice` example ran cleanly. Filenames are
scaffolding I added (nothing else changed):

- `foo x y z = g x (f y z)` — typechecks (`ff-typecheck1.loc`, added
  `f, g :: Int -> Int -> Int` stubs).
- `foo2 = g . f` composition — typechecks and builds. `./m result 10`
  → `22` for `g = (*2)`, `f = (+1)`.
- `process = format . transform . validate . parse` — typechecks with
  four `Str -> Str` stubs.
- `foo2 x = h $ g $ f x` — typechecks and builds. `./m result 10` →
  `19` for `h = (\x -> x-3)`, `g = (*2)`, `f = (+1)`.
- `divideByTwo :: [Real] -> [Real]; divideByTwo = map (/ 2.0)` — with
  `import root-cpp`, builds. `./m divideByTwo '[10.0,20.0,30.0]` →
  `[5,10,15]`.
- `divideTwoBy :: [Real] -> [Real]; divideTwoBy = map (2.0 /)` — builds.
  `./m divideTwoBy '[1.0,2.0,4.0]'` → `[2,1,0.5]`.
- `halvedInts :: [Int] -> [Int]; halvedInts = map (// 2)` — builds.
  `./m halvedInts '[10,21,5]'` → `[5,10,2]`.
- `addBias :: Real -> [Real] -> [Real]; addBias bias = map (\x -> x + bias)`
  — builds; free variable capture works. `./m addBias 1.5 '[10.0,20.0]'`
  → `[11.5,21.5]`.
- Zero-arg lambda `\ -> 5` — is rejected as documented:

  ```
  ff-zero-lambda.loc:3:13: unexpected '->'
      |
    3 | getFive = \ -> 5
      |             ^
    expected one of: '(', '[', ...
  ```

- Non-polymorphic numeric literals — verified. `foo :: [Real] -> [Real];
  foo = map (/ 2)` (integer literal) fails:

  ```
  Type mismatch:
    expected: [Real] -> [Real]
    inferred: (a Int) -> (a Int)
  Cannot compare types Real and Int
  ```

  So the doc's insistence on `2.0` is justified.

- Missing signature on `divideByTwo` — also verified:

  ```
  General type error: No instance found for Functor::map
    Are you missing a top-level type signature?
  ```

  So the "give the binding a signature so `map`'s `Functor` instance
  can be resolved" advice is real, not folkloric.

## Non-doc side observation (for the harness, not for the doc)

`import stdlib` blows up on the shipped container because
`plane/default/random/main.loc` uses an `effect escapable Random`
syntax the parser rejects:

```
/opt/morloc/src/morloc/plane/default/random/main.loc:3:8:
  unexpected 'escapable'
```

Not this chapter's concern, but it means downstream chapters that
suggest `import stdlib` will need `import root` (or something more
specific) as a workaround. Filing for the getting-started/stdlib
summary rather than as a finding here.
