# Doc pass: "Syntax and Features" -- 2026-09-02

Environment: morloc 0.100.2, mim 0.28.0, inside a managed dev container.

## Scope

All 16 files in the `== Syntax and Features` part of `src/index.adoc`:
features-functions, -source, -boolean, -integers, -floats, -strings,
-tuples-and-lists, -records, -patterns, -pattern-matching, -where, -guards,
-recursion, -effects, -optionals, -intrinsics.

Roughly 3600 lines of source and ~140 morloc code blocks. Every example was
compiled and run; every console transcript in the rewritten files is real
output captured from a program of the name shown.

## Compiler / runtime bugs found (filed)

| # | Severity | Summary |
|---|---|---|
| 0009 | HIGH | `morloc typecheck` hangs forever on an arity mismatch (definition takes more arguments than the signature). Minimal case: `foo :: Int -> Int` / `foo x y = x`. Found because the manual's own effect-row example had this shape. |
| 0005 | med | R pool overflow error is malformed: doubled `Error:`, leaked `rmorloc.c` path, missing space, dropped remediation hint. |
| 0006 | med | A numeric literal in the `@catch` fallback position ignores the expected type, so `@catch (tryInto x) 0` fails for every fixed-width type. |
| 0007 | med | Compile-time NUL-in-literal rejection is a raw Haskell `error` with a `CallStack` and no source location. |
| 0008 | med | Runtime NUL rejection does not name the language, gives no offset, and echoes the offending string (zero byte included) into stderr. |

## Stale documentation corrected

* `tryInto` was documented as `a -> ?b` in TWO chapters. It is `a -> <Err> b`;
  the examples did not compile.
* `features-functions.asc` used `#` for comments. Morloc comments are `--`;
  the block was a parse error.
* The `fold` partial-application examples had no signatures and did not
  typecheck, in a file that explains the signature requirement two blocks later.
* The optionals chapter's {cpp} helper was named `default` -- a {cpp} keyword.
  Verified with `g++ -std=c++20`: `error: expected unqualified-id before 'default'`.
* The schema encoding has no separators: `(Int, Str)` is `t2js`, not `t2 j s`.
  A record is `<dict>m24names3agej`.
* `features-tuples-and-lists.asc` had its entire "Tuples" section duplicated
  verbatim at the end of the file.
* `features-guards.asc` defined `classify` twice with different bodies.
* `[Uint8]` / `Vector n Uint8` are not real type names (`U8` is). `Uint8`
  parses as an unknown constructor and then fails cryptically on the literal.
* Several NUL and overflow transcripts were fabricated or predated the current
  messages.
* Assorted: `xref:` forms that did not resolve, `[source, c++]` instead of
  `cpp`, `[source,morloc]` spacing, non-ASCII glyphs, and the anonymous-record
  type syntax (`{x = Int}`, not `{x :: Int}`) which several examples needed and
  nothing introduced.

## Verified accurate (no change needed beyond polish)

The IEEE 754 non-finite table (all 13 rows run individually), all 12 bracket
patterns and all 8 composition examples, the unary/binary `-` disambiguation
table, the do-block worked example (really does return 17), the four effect
rules and all three rule violations, both where-clause errors, all four
pattern-matching negative cases, and the record error diagnostics.

## Checks run on every file

Non-ASCII, block-delimiter balance (`----`, `====`, `=====`, `|===`),
trailing blank line, 80-column prose, and xref resolution. All 16 pass; the
only non-ASCII is the intentional Unicode example in `features-strings.asc`
(carve-out documented in STYLE.md).

NOT run: `make`. Neither asciidoctor nor a container engine is available here,
so the HTML render is unverified.
