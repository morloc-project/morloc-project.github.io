# features-optionals.asc — findings

Compiler: morloc 0.93.0 in `ghcr.io/morloc-project/morloc/morloc-full:edge`.
All examples were exercised by copying to `~/test/features-optionals/` on the
VM and running under `morloc-manager run --`.

## Blockers

### B1. `at 0 xs` does not exist — the flagship `safeHead` example fails to build

`features-optionals.asc :: Working with optional values` (lines 51-73) shows:

```
safeHead :: [Int] -> ?Int
safeHead xs
  ? length xs == 0 = Null
  : at 0 xs
```

There is no `at` function in scope. `import root-py` (and its transitive
imports) does not bring one in, and grep of the installed stdlib finds
nothing named `at ::`:

```
$ morloc-manager run -- grep -rn '^at ' /opt/morloc/src/morloc/plane/default/
(no matches)
$ morloc-manager run -- grep -rn '\bat\b' .../root/main.loc .../root-py/main.loc .../root-cpp/main.loc
(only prose "at runtime" hits)
```

Building the file exactly as printed:

```
$ morloc-manager run -- morloc make main.loc
main.loc:8:5: error:
Undefined term: at
  |
8 |   : at 0 xs
  |     ^
```

Smallest fix that runs: replace `at 0 xs` with the built-in bracket
accessor `.[0] xs` (documented in `features-patterns.asc`), which yields
an `Int` that is coerced to `?Int` per this chapter's own coercion rule.
With that change the module builds and the four documented outputs
match:

```
$ ./main testSafeHead
10
$ ./main testSafeHeadEmpty            # empty line
$ ./main --keep-null testSafeHeadEmpty
null
$ ./main testFromNull
0
```

Impact: the FIRST end-to-end example in the chapter fails to compile as
printed. A first-time reader who copies it verbatim gets an "undefined
term" error before they have any evidence that optionals do anything.

Severity: **blocker**.

## Confusing

### C1. `require` is redeclared with a different signature two sections apart

- Lines 30-31 (Syntax section):
  ```
  require :: a -> ?a -> a
  ```
- Line 63 (Working with optional values), aligned with the Python impl:
  ```
  require :: a -> ?a -> a
  ```
- Line 205 (Implicit coercion):
  ```
  require :: a -> ?a -> a
  source Py from "foo.py" ("require")
  ```

That much is consistent. But `require` is ALSO the exported name of
`morloc_fromMaybe` from the `maybe-py` module:

```
$ morloc-manager run -- cat /opt/morloc/src/morloc/plane/default/maybe-py/main.loc
module maybe-py (*)
import maybe
import root-py
source Py from "maybe.py"
    ( "morloc_fromMaybe" as require
    , "morloc_isNull" as isNull
    )
```

The chapter's `require` shadows the stdlib one (as long as
`maybe-py` isn't imported). But it also has SWAPPED arguments compared
to the stdlib version — chapter's `require default_val x` returns the
default when `x` is `Null`, whereas the stdlib name means "unwrap or
crash" (features-recursion summary shows this: "does NOT assert; safe
only under a null guard"). A reader following the docs will build a
mental model of `require = fromMaybe` that will break when they later
`import maybe`.

Severity: **confusing**.

### C2. `--keep-null` position for a single-export nexus contradicts the help text

Not directly a chapter claim, but downstream of the chapter's `./main
--keep-null testSafeHeadEmpty` invocation. That invocation uses the
multi-export syntax and works fine when the module has three exports.
But when a module has a SINGLE export (the "Syntax" section's
`testNull` fits this shape after being wrapped in a module), the nexus
rejects the same syntax:

```
$ ./m --keep-null
error: unexpected argument '--keep-null' found
Usage: m <nexus_options> @ <command_options>
...
hint: `--keep-null` is a nexus option, not a command option. Place it left
of `@` (single-export) or left of the subcommand (multi-export), e.g.
`./prog --keep-null X @ cmd arg` or `./prog --keep-null X cmd arg`.
```

The correct incantation is `./m --keep-null @` for the single-export
form. The chapter never shows this form, and the hint text itself is
garbled (the `X` in `--keep-null X @ cmd arg` has no referent). A
reader who applies the chapter's syntax to their own single-export
module will get this error.

Severity: **confusing**.

## Minor

### M1. `--keep-null` on `bob` in "Optional record fields" is not needed

Line 159-160:

> When serialized to JSON, `alice` becomes `{"name":"Alice","age":30}`
> and the age field of `bob` becomes `null`.

Actually verified — `null` inside a record is preserved with OR without
`--keep-null`:

```
$ ./main bob
{"name":"Bob","age":null}
$ ./main --keep-null bob
{"name":"Bob","age":null}
```

The chapter's earlier note (line 98-104) is about `--keep-null`
suppressing the TOP-LEVEL `null`; nested `null` inside a JSON object is
always kept. The text is accurate as written, just worth confirming.

Severity: **minor** (not a defect; noted for the summary).

### M2. `type <Lang> => ... = "..."` for `Person` in the C++/R prose (lines 106-134) is not shown

Line 106 says "The same pattern works in {cpp} ... and R ..." and then
prints only the language-side function bodies. There is no
corresponding `source Cpp from ...` / `source R from ...` block or
concrete-type mapping. A first-time reader who tries to run these
snippets doesn't have enough to reproduce them — they'd have to
reverse-engineer the boilerplate from the Python example. Since the
prose says "The same pattern", the reader could infer, but the chapter
should either point to a runnable file or drop the C++/R snippets.

Severity: **minor**.

### M3. Line 30 uses `require :: a -> ?a -> a` in the "Syntax" example without introducing what it does

The Syntax section prints:

```
--' Get the first element from a list or empty on failure
safeHead :: [Int] -> ?Int
require :: a -> ?a -> a
```

The docstring only applies to `safeHead`. `require` appears with no
description and no reader knows what it does until page-down to the
next section. Not wrong, but jarring.

Severity: **minor**.

## What the compiler agrees with

- The nested-optional idempotence claim matches the compiler. From
  `library/Morloc/Frontend/Desugar.hs:1970` (fetched from GitHub master):

  > `type X = ?X` (collapses to nothing under the `?(?T) == ?T`
  > idempotence: every inhabitant is `null`).

  Verified end-to-end:

  ```
  $ ./main --keep-null collapsed1   # was ?(?Int) = Null
  null
  $ ./main collapsed2               # was ?(?Int) = 7
  7
  ```

- `Null` is a reserved keyword, not a term-level constructor. From
  `library/Morloc/Frontend/Lexer.hs:533` (`classifyWord "Null" = TokNull`)
  and `library/Morloc/Frontend/Parser.y:110,661`
  (`'Null' { Located _ TokNull _ } ... 'Null' { at $1 CNullE }`).
  Consistent with the chapter's NOTE at lines 41-44.

- The `where` form of record declaration used on line 144-147
  (`record Person where name :: Str; age :: ?Int`) parses and behaves
  identically to the brace form. Confirmed with a full build and
  JSON output `{"name":"Alice","age":30}`.

- Implicit `Int -> ?Int` coercion at call sites and across language
  boundaries (C++ `Int` → Python `?Int`) works exactly as claimed.
  `testCoerceAddOpt` → `7`; `testCoerceArg` → `42`;
  `testCppIntToPyOpt` → `42`.

- Cross-language optional (`std::optional<int>` from C++ consumed as
  Python `Optional`) works exactly as claimed. `testCppToPy` → `3`;
  `testCppToPyNull` → `-1`.
