# Morloc knowledge added by chapter 3 (features-source)

## `source` statement

- Syntax: `source <Lang> from "<file>" ( "<term>" [as <alias>], ... )`.
- `from "<file>"` is syntactically optional per
  `library/Morloc/Frontend/Parser.y` line 528:
  `opt_from :: { {- empty -} { Nothing } | 'from' STRING { Just ... } }`.
- A parallel `source <Lang> [from "..."] where { <items> }` form exists
  in the grammar (`source_new_items`, supports `%inline`). Not yet
  documented in the chapters walked so far.
- Language tokens are just identifiers — the parser accepts any UPPER or
  LOWER identifier (`lang_token : UPPER | LOWER`). The docs' `Cpp`, `Py`,
  `R` are conventions, not enforced.
- Term aliases: `"src_name" as local_name` renames on import. Both
  quoted and unquoted forms exist:
    - `STRING` — the raw source symbol (`"morloc_map"`)
    - `STRING as LOWER` / `STRING as UPPER` / `STRING as source_op` —
      aliased on the morloc side.

## `type` mapping statement

- Grammar (Parser.y line 289):
  `type <Lang> => <TypeName> [<params>] = "<concrete>" [<params>]`.
- `$1`, `$2`, ... in the RHS string are placeholder positions filled
  by the recursively-translated parameters.
- The tuple syntax `(a, b)` desugars to `Tuple2 a b`; `[a]` desugars
  to `List a`. Both spellings work in general signatures. Confirmed by
  building the same program with either form.

## Foreign-function example (empirical)

- C++ side is picked greedily when both a C++ and Python source exist
  for the same term — the nexus manifest shows only the `cpp` pool for
  a program that had both. If you want to force the Python side, remove
  the C++ source (not covered by this chapter).
- The typechecker infers polymorphic signatures for definitions that
  compose sourced functions, e.g. `mapSum xs = sum (map snd xs)` typechecks
  as `[(a, Real)] -> Real`. But `morloc make` refuses to expose a
  generic-typed export in the nexus:

  ```
  Warning: skipping generic export 'mapSum'
  ```

  and produces no `pools/`. To get a runnable command, annotate the
  export with a monomorphic signature (e.g. `[(Str, Real)] -> Real`) —
  and provide the corresponding `type <Lang> => Str = "..."` entries.

## Nexus argument marshalling (from testing this chapter)

- Tuples wire as JSON arrays. To pass `[(Str, Real)]`, use
  `'[["a",1.25],["b",2.5]]'` (list of two-element arrays).
- A `Real` result may print without a decimal point (e.g. `7` for
  `7.0`). Use fractional inputs (`1.25`, `2.5`, ...) if you want to
  confirm arithmetic visually.

## Pitfalls surfaced by this chapter

- Sourcing a Python builtin name (`"map"`, `"sum"`, ...) requires
  re-exporting it at module scope, e.g. `from builtins import map, sum`
  at the top of the sourced file. Without that, the pool crashes at
  runtime with `module 'foo' has no attribute 'sum'`.

## For downstream chapters

- If a chapter presents a `source`/`type`/definition sequence but no
  explicit `module (...)` header and no concrete-typed export, expect
  `morloc make` to skip everything silently. Prefer showing runnable
  `morloc typecheck` snippets, or complete the module yourself.
- The "old" `(items)` and "new" `where { items }` source forms both
  exist in the parser. Don't assume the parenthesized form is the only
  one.
- Chapters that talk about polymorphic C++ code (`template <typename A>`)
  paired with a `Real`-restricted Morloc signature are describing a
  choice, not a compiler requirement — the general type is what gates
  the codegen, not the C++ template.
