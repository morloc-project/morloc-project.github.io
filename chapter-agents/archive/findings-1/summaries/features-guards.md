# Morloc knowledge added by chapter 12 (features-guards)

## Guard grammar

- Multi-clause guard on a top-level definition:
  ```
  f x y
    ? cond1 = body1
    ? cond2 = body2
    : defaultBody
  ```
  The `:` default is mandatory (parser: `Parser.y:190`
  `evar_or_op atom_exprs guard_clauses ':' expr opt_where_decls`).
  Omitting it errors: `unexpected end of indented block, expected '?' or ':'`.
- Guards may have an attached `where` clause. Layout: guards indented
  under the function name, `where` at the same indent, bindings below.
- Guard inside a `let` binding:
  `let name ? cond = body : default in expr` — real form
  (`let_binding: LOWER guard_clauses ':' expr`, `Parser.y:604-605`).
- Guard as inline `expr`: `guard_expr` is one of the `expr`
  alternatives (`Parser.y:572,576-583`). This means guards work in
  most positions **without parentheses**:
  - RHS of a binary operator (`... <> ? c = x : y`): works.
  - Inside a list `[a, ? c = x : y, b]`: works.
  - RHS of top-level `=` (`f x = ? c = x : neg x`): works.
  Parens are only needed in atom positions — notably **function
  application**:
  `id ? c = 1 : -1` is a parse error; `id (? c = 1 : -1)` is fine.
  The chapter's prose says parens are needed in all of these; that
  claim is inaccurate.
- Guards can be nested; `neg` (unary negate as a member of `Integral`,
  from `root/main.loc:57`) can appear as a body without any special
  wrapping.

## Semantics

- Guards desugar to nested `IfE` (`Desugar.hs:1910-1916`):
  ```
  desugarGuards sp ((cond, body):rest) def = do
    ...
    freshExprSpan sp (IfE cond' body' elseE)
  ```
- Because they lower to `IfE`, **guard conditions are lazily evaluated
  top-to-bottom in every backend**, including Python — verified with a
  Python `boom` function in a later condition that raises when called.
  This is different from the `&&`/`||` operators, which in Python are
  eagerly evaluated (see features-boolean summary).
- Not tested this chapter: C++ and R laziness. Both should be laziness
  by construction (native `if`/`else`), but not verified here.

## Chapter-independent gotchas that came up

- `abs`, `neg`, `<>`, `<`, `>`, `>=` and friends all require
  `import root` PLUS a language-specific instance module (usually
  `import root-py` for tests). Bare `import root` typechecks the
  signatures but pool codegen needs the language instances.
- Multiple examples in one file: the chapter defines `classify` twice;
  copying both into one module errors with a duplicate binding.

## Not exercised (defer)

- Guards on `Real` / on user-defined records.
- Interaction between guards and typeclasses (e.g. an `Ord` guard on a
  polymorphic value — probably hits the standard "skipping generic
  export" trap).
- Guards inside `do` notation (mentioned by parser comment
  `Parser.y:196-199`: layout may insert a `VSEMI` between last guard
  and `:` inside `do`/`let`, which the grammar special-cases). Not
  demonstrated by the chapter.

## Doc host / compiler reference notes (unchanged from prior chapters)

- Docs source repo: `github.com/morloc-project/morloc-project.github.io`,
  default branch **`master`**. Chapter file lives at
  `src/content/<name>.asc` (not checked out on this VM).
- Compiler tree not checked out on VM; use
  `github.com/morloc-project/morloc` raw fetches to cross-check.
  Notably `library/Morloc/Frontend/Parser.y` and
  `library/Morloc/Frontend/Desugar.hs`.
