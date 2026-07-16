# features-records.asc — report

Chapter tested against morloc 0.93.0 in the standard VM container.
All test files placed under `~/test/features-records/`.

## Blocker

### B1. `WARNING: recursive types are not currently supported` is factually wrong

Chapter location: `features-records.asc :: Language-specific representation of records` (final line, WARNING admonition).

The chapter closes with:
```
WARNING: Records may contain fields with arbitrarily complex types, but
recursive types are not currently supported.
```

The compiler explicitly supports list-guarded and optional-guarded self
recursion. Verified single-language:

```
$ cat recursive3.loc
module recursive3 (makeTree)
import root-py
record Tree = Tree { value :: Int, children :: [Tree] }
record Py => Tree = "dict"
makeTree :: Int -> Tree
makeTree v =
    { value = v
    , children = [ { value = v + 1, children = [] }
                 , { value = v + 2, children = [] } ] }

$ morloc-manager run -- morloc make recursive3.loc && morloc-manager run -- ./recursive3 makeTree 1
{"value":1,"children":[{"value":2,"children":[]},{"value":3,"children":[]}]}
```

Verified cross-language (`Tree` round-tripped through a C++ pool and a
Python pool, three levels deep):

```
$ morloc-manager run -- ./recursive_x roundtrip \
    '{"value":1,"children":[{"value":2,"children":[{"value":3,"children":[]}]}]}'
{"value":1,"children":[{"value":2,"children":[{"value":3,"children":[]}]}]}
```

Compiler source is unambiguous — from
`library/Morloc/Frontend/Restructure.hs:74-134` (`classifyRecursion` /
`checkForSelfRecursion`):

```
--   * @OptionalU t@ (the @?_@ surface form) -- a recursive reference
--     inside is heap-indirected via the optional discriminant.
--   * @AppU (VarU (TV "List")) [t]@ -- a list field is empty-base-cased
--     and stored via a pointer to a heap region.
...
--   type (Tree n) = {value :: n, children :: [Tree n]}  -- legal (list-guarded)
--   type LL = {head :: Int, tail :: ?LL}                 -- legal (option-guarded)
--   type Bad = {a :: Bad}                                -- rejected (bare)
```

Only bare self-recursion is rejected (`record Bad = Bad { a :: Bad }`
errors with `Found unsupported self-recursive type alias: Bad`).

The WARNING as written is misleading — recursive record types work for
exactly the case a first-time user would try (a tree with a list of
children). Suggested rewrite: "recursive record types must be guarded
by `[...]` or `?...`; a bare self-reference field is rejected."

## Confusing

### C1. Doc never explains the doubled `Person` in `record Person = Person { ... }`

Chapter location: `features-records.asc :: Records` (first code block).

The general form shown is:

```
record Person = Person
    { name :: Str, age :: Int }
```

A first-time reader has no way to know what the second `Person` is for.
There is no term-level constructor bound by this declaration — the
compiler rejects `alice = Person "Alice" 30`:

```
positional.loc:6:9: unexpected type name 'Person'
```

Only the record-literal form `{ name = "Alice", age = 30 }` works.
Contrast with Haskell, where `Person "Alice" 30` would be a valid
constructor application. The parser accepts this legacy form (see
`library/Morloc/Frontend/Parser.y:317`,
`CstNamTypeLegacy Nothing ... $4 ...` where `$4` is `nam_constructor`)
but the doc gives no hint that this tag has no term-level meaning.

The chapter also never mentions the alternative `record T where { ... }`
syntax (Parser.y:315, `CstNamTypeWhere`) or the `object` keyword
(Parser.y:326, `nam_type : 'object'`).

### C2. Concrete-form example silently depends on the sourced `foo.hpp` containing the struct definition

Chapter location: `features-records.asc :: Records`, block ending with
`record Cpp => Person = "person_t"`.

The chapter says `person_t` "must be defined in the {cpp} code, as
shown below" and later shows the struct inside `foo.hpp`. But nothing
tells the reader that the `source Cpp from "foo.hpp" ("incAge" as cinc)`
line is what actually brings the struct definition into the compiled
pool. If a user writes a record whose C++ side has no accompanying
`source Cpp from "..."`, the compiled pool will not know about the
struct. Worth stating explicitly.

### C3. `foo` example has no type signature

Chapter location: `features-records.asc :: Language-specific representation of records` (last morloc block).

```
foo name age
    = (rinc . pinc . cinc)
      { name = name, age = age }
```

This works (the type is inferrable as `Str -> Int -> Person` because
`rinc`, `pinc`, `cinc` are all monomorphic `Person -> Person`), but
based on earlier chapters' repeated `Warning: skipping generic export`
diagnostic, a reader may reasonably expect a signature is required.
Adding `foo :: Str -> Int -> Person` above the definition would
eliminate the ambiguity.

## Minor

### M1. "increments its age 3 time in different languages" — should be "3 times"

Chapter location: `features-records.asc`, penultimate paragraph.

### M2. Inconsistent asciidoc language tags

`[source, cpp]` is used at line 34, but `[source, c++]` at line 116.
Both blocks contain C++ code. Choose one. (Earlier chapters use `cpp`.)

### M3. `[source, python]` and `[source, r]` tag also inconsistent with earlier chapters

Earlier chapters showed `[source, python]` for the sourced Python code
and no doc has established a convention. Purely cosmetic.

## Verified working as documented

- `record Person = Person { name :: Str, age :: Int }` typechecks.
- `record Py => Person = "dict"`, `record R => Person = "list"`,
  `record Cpp => Person = "person_t"` all typecheck; the compiled C++
  pool uses `person_t` as an actual struct (verified in
  `pools/rec3/pool.cpp` — `void* to_voidstar(..., const person_t& obj)`).
- The multi-language `rinc`, `pinc`, `cinc` example compiled and each
  command returned `{"name":"Alice","age":31}` when called with
  `{"name":"Alice","age":30}`.
- Field-by-name binding: both `{name = "Alice", age = 30}` and
  `{age = 30, name = "Alice"}` build the same value.
- Missing-field error: `Record literal does not match declared type
  Person: missing field(s): age` (with source caret). Matches the
  documented behavior; the actual error text is slightly different from
  the doc comment "error: missing field 'age'" but the same intent.
- Unknown-field error: `Record literal does not match declared type
  Person: unknown field(s): weight`.
- Duplicate-field error: `duplicate field in record literal: name`
  (caret on the second occurrence). Parser check at
  `library/Morloc/Frontend/Parser.y:1130-1141`
  (`checkRecordKeys`).
- Type-mismatched field errors correctly: `Type mismatch: expected: Int
  inferred: Str`.
- Records containing lists of other records serialize correctly:
  `mkComplex 7` →
  `{"id":7,"addresses":[{"street":"5th","city":"NYC"}],"tags":["a","b"]}`.
- `foo name age = (rinc . pinc . cinc) { ... }` triple-hop wired
  correctly: `./rec6 foo Alice 30` → `{"name":"Alice","age":33}`.
