# features-guards.asc — findings

Compiler: **morloc 0.93.0** (container `ghcr.io/morloc-project/morloc/morloc-full:edge`).
Chapter is 73 lines, five code examples, all bare fragments (no
`module`/`import` headers).

Smallest completion I used for every example:

```
module m_<name> (<fn>)
import root
import root-py
<snippet>
```

`import root` supplies `Int`, `Str`, `<`, `>`, `>=`, `<>`, `neg`; `import
root-py` supplies the Python instances needed to actually build. Without
these two imports the snippets don't compile.

---

## 1. `abs` example works — needs completion `[minor]`

`features-guards.asc :: Conditionals` (first snippet, lines 7-13).

Ran with the module wrapper above (module tag `m_abs`):

```
$ morloc-manager run -- ./m_abs abs 5    → 5
$ morloc-manager run -- ./m_abs abs -3   → 3
$ morloc-manager run -- ./m_abs abs 0    → 0
```

`neg` is the `Integral`-class method from `plane/default/root/main.loc:57`,
not `negate` (which lives in `internal` and is what unary `-` desugars to).
A reader with no prior chapter context might assume `-` and try
`abs x ? x >= 0 = x : -x` — that would work too (both are members of the
same class), but this is not spelled out.

## 2. `clamp` works `[none]`

`features-guards.asc :: Conditionals` (second snippet).

```
$ ./m_clamp clamp 0 10 5    → 5
$ ./m_clamp clamp 0 10 -3   → 0
$ ./m_clamp clamp 0 10 15   → 10
```

## 3. `classify` with `where` works `[none]`

`features-guards.asc :: Conditionals` (third snippet).

```
$ ./m_classify classify 5    → "small"
$ ./m_classify classify 50   → "medium"
$ ./m_classify classify 500  → "big"
```

## 4. Guard inside `let` works `[none]`

`features-guards.asc :: Conditionals` (fourth snippet, `absLet`).

```
$ ./m_absLet absLet 5    → 5
$ ./m_absLet absLet -7   → 7
$ ./m_absLet absLet 0    → 0
```

The `let result ? cond = ... : ...` form is real (grammar rule
`let_binding: LOWER guard_clauses ':' expr` at `Parser.y:604-605`).

## 5. Inline guard with `<>` works — but the parens rule is wrong `[confusing]`

`features-guards.asc :: Conditionals` (fifth snippet, `labelOf`).

The chapter's example builds and runs as written:

```
$ ./m_inline labelOf 5    → "label: pos"
$ ./m_inline labelOf -3   → "label: non-pos"
$ ./m_inline labelOf 0    → "label: non-pos"
```

But the surrounding prose is inaccurate. Text (lines 56-59):

> The parentheses are required only when the inline guard appears
> *inside* a larger expression (as a function argument, inside a list,
> on the right of an operator, etc.); at top-level assignment position
> they may be omitted.

Three of those four positions do NOT require parens.

**On the right of an operator (parens NOT required — contra doc):**

```
labelOf :: Int -> Str
labelOf x = "label: " <> ? x > 0 = "pos" : "non-pos"
```

Builds and runs correctly:
```
$ ./m_np labelOf 5    → "label: pos"
$ ./m_np labelOf -3   → "label: non-pos"
```

**Inside a list (parens NOT required — contra doc):**

```
test :: Int -> [Int]
test x = [1, ? x > 0 = 2 : -2, 3]
```

Builds and runs:
```
$ ./m_list test 5   → [1,2,3]
$ ./m_list test -1  → [1,-2,3]
```

**Top-level assignment (parens NOT required — matches doc):**

```
foo :: Int -> Int
foo x = ? x >= 0 = x : neg x
```
Works.

**As a function argument (parens ARE required — matches "etc."):**

```
test x = id2 ? x > 0 = 1 : -1
```

Fails:
```
ex_argguard.loc:10:14: unexpected '?'
     |
  10 | test x = id2 ? x > 0 = 1 : -1
     |              ^
```

The actual rule (from `library/Morloc/Frontend/Parser.y`):

- `guard_expr` is one of the alternatives for `expr` (line 572).
- `list_expr` uses `expr_list1 → expr` (line 700, 684-686).
- `infix_expr` has `operand operator_name expr` (line 613) — so the RHS
  of any infix operator accepts a guard.
- Function application uses `atom_exprs` (space-separated atoms), and
  `guard_expr` is not an atom — so parens are only required when the
  guard sits in an atom position: as a function argument, inside another
  atom-taking construct, etc.

Suggested rewrite: "Parens are needed only when the guard sits in
function-application position (or any other atom position, such as an
accessor target). Inside lists, tuples, records, or on the right of an
operator, the guard's own `:` terminator ends it unambiguously and no
parens are needed."

## 6. `:` default is enforced `[none — corroborates prose]`

Doc claim: "The `:` default always terminates the guard chain, ensuring
exhaustiveness."

Omitting the `:` clause errors at parse time:

```
foo :: Int -> Int
foo x
  ? x >= 0 = x
```

```
ex_nodef.loc:9:1: unexpected end of indented block
  expected one of: '?', ':'
```

Matches grammar rule `evar_or_op atom_exprs guard_clauses ':' expr
opt_where_decls` (`Parser.y:190`).

## 7. Laziness holds — verified in Python `[none — corroborates prose]`

Doc claim: "Guards are evaluated lazily from top to bottom. The first
condition that evaluates to true determines the result; remaining guards
are not evaluated."

Test module (imports Python `boom` that raises on call):

```
source Py from "crash.py" ("boom")
boom :: Int -> Int

test :: Int -> Int
test x
  ? x >= 0 = 999
  ? boom x == 42 = 111
  : 0
```

```
$ ./m_lazy test 5  → 999
```

`boom` is not called. Confirms lazy evaluation of guard *conditions* is
real, not just of bodies. Backed by `library/Morloc/Frontend/Desugar.hs:
1907-1916`:

```haskell
desugarGuards sp ((cond, body) : rest) defaultExpr = do
  cond' <- desugarExpr cond
  body' <- desugarExpr body
  elseE <- desugarGuards sp rest defaultExpr
  freshExprSpan sp (IfE cond' body' elseE)
```

Guards lower to nested `IfE`, which properly short-circuits per language
codegen even in Python (unlike the `&&`/`||` operators — cf. the
features-boolean chapter's finding that Python-side `&&` is not
short-circuited).

## 8. Two `classify` definitions clash `[minor]`

`features-guards.asc :: Conditionals` (third snippet defines `classify`
with a `where` clause; fifth snippet defines `classify` again with
inline numeric thresholds).

A reader who copies both into one file to try them gets a duplicate
definition error. Give the second one a different name, or state
explicitly that each snippet is its own module.

## 9. `neg` is not mentioned anywhere in the chapter `[minor]`

The very first example uses `neg`, but neither its type, its provenance
(the `Integral` class from `root`), nor the fact that it is the
morloc-side name for unary negation is stated in this chapter. New
readers hitting `abs` will not know why `-x` isn't spelled `-x`. A
one-line note ("`neg` is `Integral.neg` from `root`; unary `-` also
works") would prevent the confusion.
