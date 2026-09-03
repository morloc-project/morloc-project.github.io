# Doc pass: "Advanced Types" -- 2026-09-02

Environment: morloc 0.100.2, mim 0.28.0, inside the shared dev container.

## Scope

The whole `== Advanced Types` part of `src/index.adoc`: term polymorphism,
typeclasses, infix operators, `type`/`newtype`, `Packable`, the kind system,
tensors, and tables.

Every Morloc example was compiled; every one that produces output was run.
Every console transcript in the rewritten files is real output captured from a
program of the name shown. Errors shown are real errors from a file of the name
shown, at the line numbers shown.

## Reorganisation

`types-source.asc` ("Mapping general types to native types") is gone. Its first
half duplicated `features-source.asc`'s "Native type mappings" subsection, which
a reader has already met; its one piece of new material (alias-chain
resolution) moved into the `type`/`newtype` section. The
`[[mapping-native-types]]` anchor moved to `features-source.asc` so the
cross-reference from `features-integers.asc` still lands somewhere real.

`types-newtype.asc` absorbed that material and was retitled "Naming a type:
`type` and `newtype`". `types-custom-types.asc` was retitled "Serializing custom
types with `Packable`" and moved after it, because a `Packable` instance is
declared on a type that `newtype` introduces.

New order: term polymorphism, typeclasses, infix operators, `type`/`newtype`,
`Packable`, kinds, tensors, tables.

Explicit anchors were added to every section in the part
(`term-polymorphism`, `typeclasses`, `infix-operators`, `types-newtype`,
`packable`, `kinds`, `tensors`, `tables`) and the five inbound cross-references
were repointed at them. Twelve pre-existing dangling xrefs elsewhere in the
manual were also fixed; every `<<...>>` in the corpus now resolves.

## Compiler / runtime bugs found (filed)

| # | Severity | Summary |
|---|---|---|
| 0035 | HIGH | The nexus cannot read a Parquet file written with snappy compression -- pyarrow's, pandas' and Spark's default. The crate is built without its codec features. Parquet input is effectively unusable against files from anywhere else. |
| 0012 | HIGH | A `newtype` at a foreign-function boundary needs a `Packable` instance even when its native form is identical to its wire parent's. The manual said the opposite. Failure is an internal `Cannot find constructor in VarF` at the module's export list. |
| 0015 | HIGH | Rec-kinded type expressions do not unify with themselves, so no user-written function can wrap `cbind`, `selectCols` or `getCol` -- not even one that delegates to a stdlib function with the identical signature. Every schema-changing table operation has to be a foreign primitive. |
| 0013 | HIGH | `cbind` on tables with overlapping column names compiles and produces a table with a duplicated key, unless the caller writes the result type out. The annotated form's error prints identical expected and inferred types. |
| 0036 | med | `selectColsDyn` lets the caller assert a schema that is never confronted with the columns actually returned; the mismatch surfaces as a runtime error in the consumer. |
| 0014 | med | `getCol` on a column absent from the schema passes `morloc typecheck` (as an unreduced `ProjectField`) and fails at codegen with an internal message at the wrong line. |
| 0020 | med | A type-level list of labels must be written `['x, 'y]`. `["x", "y"]` is a parse error; the single-element `["x"]` is *accepted with a different meaning* and only fails at a use site. |
| 0011 | med | `pack` cannot build a wire form that itself contains a packable type; the inner expression needs an explicit annotation. The error blames a missing instance on the outer `pack`. |
| 0017 | med | A `Table` argument cannot be read from stdin (`-`), which the manual claimed. |
| 0021 | low | The "packer not generic enough" error prints one operand as a raw Haskell `TypeF` value. |
| 0016 | low | A command that returns its `Table` argument unchanged fails with "Cannot render a Table to generic JSON". |
| 0019 | low | A parameterised type used with no arguments at all typechecks and fails at codegen, located at the export list. |
| 0018 | low | `metavar:` on a positional argument is recorded in the manifest and reaches `--json-help`, but `--help` never prints it. |
| 0034 | low | Nat arithmetic evaluates to negative values: `Vector (3 - 10) Int` is `Vector -7 Int`, accepted and unsatisfiable. |

## Stale documentation corrected

* **The label syntax `f:Str` / `n:Int` / `l:[Str]` is gone.** It is `f@Str`,
  `n@Int`, `l@[Str]`. The old form was used throughout the kinds, tensors and
  tables sections and is a parse error.
* **Type-level string lists were written `["x","y"]` everywhere.** The real
  syntax is `['x, 'y]`. See report 0020.
* `mean xs = sum xs // size xs` did not typecheck -- `size` returns `U64`.
  It is `length`.
* The "polyglot test suite" example called an undefined `runTests` and could
  not compile. Replaced with a four-module example that really does run the
  same suite against a Python and a {cpp} implementation.
* The infix typeclass example named a method `negate`, which collides with
  `internal`'s `Negatable`; and `import ops ((&), (|))` is invalid because `|`
  alone is a reserved token.
* `Table` is declared `type Table (n :: Nat) (r :: Rec)`, not `newtype`. (Both
  spellings mean the same thing for a bodiless declaration; the manual now says
  so.)
* `Vector` does have a `Packable` instance -- `Packable (List a) (Vector n a)`
  in `vector/main.loc`. The manual said it had none.
* `frames = [pack "abc", ...]` was fabricated: there is no
  `Packable Str (Vector n U8)`. Replaced with list literals, which do work.
* Nat subtraction was documented as "clamped at zero". It is not.
* `type R = Singleton "x" Int` was documented as rejected "because the slots
  don't match". It is not caught at typechecking at all; it fails at codegen
  with a serialization message.
* `cbind`'s duplicate-column rejection, `getCol`'s missing-column error, and
  the CNN pipeline's claim of full shape inference were all stated as working.
  The first two are reports 0013 and 0014; the CNN example was replaced with a
  `conv1d` example that is six lines and actually runs.
* The `--' @metavar KEY` docstring form is wrong -- directives are
  `--' metavar: KEY`. (The whole `cli-docstrings.asc` chapter still uses the
  `@` form; that is outside this pass's scope and was not touched.)
* The tables chapter's `m` row-count claims, file-format table, and
  `--output-form` behaviour were all verified and kept; the stdin row was
  removed and turned into a documented limitation.

## Newly documented (previously absent)

* Tensors on the command line take their wire form: a 2x3 matrix is
  `[[2,3],[1,2,3,4,5,6]]`. Nothing in the manual said this.
* Multi-head instances (`instance Pretty Int , Pretty Real where`).
* Classes have no default method bodies; the shared logic goes in a
  constrained free function.
* A generic (class-constrained) export is silently skipped -- `Warning:
  skipping generic export`.
* A typeclass is exported and imported by class name only; a method may not
  appear in an export list.
* Default operator fixity is `infixl 9`, and conflicting fixity declarations
  are an error.
* How the realizer actually chooses: an accumulated cost (10 same-language,
  10000 cross-language by default) with boundary count as a tiebreaker.
* A bodiless `type X` and `newtype X` are the same declaration -- an opaque
  primitive that owns its per-language forms and instances.
* CSV/Parquet/Arrow validation messages for a missing column, a wrong type,
  and a null in a non-optional column.

## Checks run on every file

Non-ASCII, block-delimiter balance (`----`, `====`, `=====`, `|===`), trailing
blank line, banned-word scan, 80-column prose, and xref resolution across the
whole corpus (`index.adoc` plus all 71 `.asc` files): 0 unresolved.

NOT run: `make`. No container engine and no asciidoctor in this environment, so
the HTML render is unverified.
