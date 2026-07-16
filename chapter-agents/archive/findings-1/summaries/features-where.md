# Morloc knowledge added by chapter 11 (features-where)

## `where` clauses

- Attach to a definition's RHS at the outermost level (Parser.y line 188):
  `evar_or_op atom_exprs '=' expr opt_where_decls`. So `where` is
  grammatically bound to a top-level or nested value definition, not
  to arbitrary subexpressions.
- Bindings are order-independent — later bindings can be referenced by
  earlier ones. Verified: `z = a + b; a = b*2; b = 7` returns 21.
- Nested `where` blocks inherit outer scope (an inner binding may
  reference names declared in an enclosing `where`).
- Compile-time checks (all in
  `library/Morloc/Frontend/Desugar.hs :: checkWhereScope`, lines
  ~1880-1897 in master):
  - Two bindings with the same name in the same clause →
    `duplicate binding in where-clause: <name>`.
  - A binding whose name equals a function parameter →
    `where-clause binding shadows function parameter: <name>`.
- **Mutually-recursive `where` bindings**: the docs say these are
  disallowed. In v0.93.0, the frontend does NOT reject them; codegen
  crashes with an internal error instead:

  ```
  morloc: Can represent MonoSrc as SerialExpr
  CallStack (from HasCallStack):
    error, called at library/Morloc/CodeGenerator/Serialize.hs:144:34
  ```

  Same crash for self-recursive `where` bindings (`a = a + 1`).

## `let` expressions

- Sequential/non-recursive: each binding sees only earlier ones. A
  forward reference like `let x = y + 1; y = 10 in x` fails with
  `Undefined term: y` (generic "undefined identifier" error — no
  hint that this is because `let` is non-recursive).
- Later bindings can shadow earlier ones with the same name — both
  within one `let` block (`let x = 1; x = 2 in x` → 2) and across
  chained `let` blocks.
- **Chain-of-lets shape (morloc-specific)**:

  ```
  foo = let x = 1
        let x = 2
         in x
  ```

  Legal. Grammar (Parser.y:585-588):

  ```
  let_expr :: { Loc CstExpr }
    : 'let' VLBRACE let_bindings VRBRACE 'in' expr
    | 'let' VLBRACE let_bindings VRBRACE let_expr
  ```

  The second alternative permits `let ... let ... in ...` with no
  `in` between the two `let` blocks. Standard `let ... in let ... in
  ...` also works.
- Explicit-braces form exists in the grammar
  (`let { x = 1; y = 2 } in x + y` — with `;` as separator). Not used
  in this chapter.
- `let` binding CAN shadow a function parameter (unlike `where`).
  Verified: `f x = let x = 100 in x + 1` compiled and `f 5` returned
  101.
- `let` binding CANNOT self-reference (`let x = x + 1 in x` →
  `Undefined term: x`).

## For downstream chapters

- Both `where` and `let` are only exercised as expression-level
  scoping constructs — no `let/where` interaction with pattern
  matching, guards, or class methods was tested in this chapter.
- If a later chapter presents `where` recursion, expect the internal
  `Serialize.hs:144` crash — not the "friendly" error the docs imply.
- For any example using `let ... let ... in ...` without an
  intervening `in`, the parser accepts it; do not "fix" it to a
  Haskell-style `let ... in let ... in ...` unless the doc example
  itself is broken.

## Host / repo notes

- The chapter source is not on the host at
  `.../src/content/features-where.asc`. Only `chapter-agents/` is
  checked out. The docs repo lives at
  `github.com/morloc-project/morloc-project.github.io`, default
  branch **`master`** (not `main`). Fetch raw with
  `https://raw.githubusercontent.com/morloc-project/morloc-project.github.io/master/src/content/<chapter>.asc`.
- The compiler tree at `/home/z/projects/morloc-core/compiler/morloc`
  is not present either. Compiler files can be fetched from
  `github.com/morloc-project/morloc` (also `master`).
