# features-where.asc — findings

Compiler tested: **morloc 0.93.0**, morloc-manager 0.25.0
(container image `ghcr.io/morloc-project/morloc/morloc-full:edge`).

Source file was not present on the host or the VM; fetched from
`https://raw.githubusercontent.com/morloc-project/morloc-project.github.io/master/src/content/features-where.asc`
(72 lines, master branch — the repo's default branch is `master`, not
`main`).

Every code snippet in the chapter was completed with the smallest
possible additions (`module`, `import root-py`, and a monomorphic type
signature so `morloc make` doesn't skip the export) and run through
`morloc make` + the nexus.

The six shown snippets all behave as advertised. Two problems worth
noting:

- The chapter's most surprising legal-syntax example — a chain of
  `let` blocks with no `in` between them — is real but is presented
  as ordinary and unexplained. It is unlike anything in the Haskell/ML
  family the docs so far have looked like.
- The chapter says `where` bindings "must not be mutually recursive"
  but shows no example and, more importantly, the compiler does not
  reject mutual recursion cleanly — it crashes with an internal
  assertion.

---

## Blockers

### 1. Compiler crashes on mutually-recursive `where` bindings

`features-where.asc :: 'where' and 'let' clauses`, paragraph starting
"In a `where` clause, bindings can refer to the function's arguments":

> The bindings in a `where` block are order-independent and may refer
> to each other freely (though must not be mutually recursive).

The docs promise a compile-time restriction. In practice, the compiler
panics.

Minimal case (self-recursive `where` binding — also rejected in
principle):

```morloc
module msw (f)
import root-py

f :: Int
f = a where
    a = a + 1
```

```
$ morloc make ex_selfw.loc
morloc: Can represent MonoSrc as SerialExpr
CallStack (from HasCallStack):
  error, called at library/Morloc/CodeGenerator/Serialize.hs:144:34 in
      morloc-0.93.0-AJTK8syS0d215qr7U3VCTx:Morloc.CodeGenerator.Serialize
```

Same behavior for a mutually-recursive pair:

```morloc
f = a where
    a = b + 1
    b = a + 1
```

The compiler makes it past the frontend's `checkWhereScope` check
(compiler/library/Morloc/Frontend/Desugar.hs:1880-1897 —
`duplicate binding` and `shadows function parameter` diagnostics only)
and blows up in codegen with an internal error instead of a proper
frontend diagnostic pointing at the recursive binding.

A first-time user hitting this has no way to know the docs' "not
mutually recursive" rule is what they've just violated — the message
mentions `MonoSrc`, `SerialExpr`, and `Serialize.hs`, none of which
appear anywhere in the docs.

### 2. "Chain of single-binding lets" example uses an undocumented syntactic form

`features-where.asc :: Scope rules: 'let' shadows, 'where' does not`:

```morloc
-- chain of single-binding lets
foo = let x = 1
      let x = 2
       in x       -- evaluates to 2
```

This does work — `foo` evaluates to `2`. It is legal per
`library/Morloc/Frontend/Parser.y:584-589` (via GitHub master):

```
let_expr :: { Loc CstExpr }
  : 'let' VLBRACE let_bindings VRBRACE 'in' expr
      { at $1 (CLetE $3 $6) }
  | 'let' VLBRACE let_bindings VRBRACE let_expr
      { at $1 (CLetE $3 $5) }
```

The second alternative (a `let` immediately followed by another `let`,
no `in` between them) is what makes the example parse. But this is a
morloc-specific extension over the classic ML/Haskell `let … in let …
in …` shape, and the chapter uses it in the first-and-only `let`
example that discusses scope without ever calling it out or saying why
the second `let` block does not need an `in`. A reader coming from
Haskell/OCaml will assume it's a typo.

The equivalent, more-familiar forms also work (and give the same
answer):

```morloc
foo = let x = 1
      in let x = 2
      in x                    -- returns 2

foo = let x = 1
          x = 2
      in x                    -- returns 2 (same-block shadowing)
```

Either name-the-feature ("morloc allows sequential `let` blocks to
chain without repeating `in`") or use one of the standard forms in
this example.

---

## Confusing

### 3. Nested-`where` example demonstrates outer→inner scope silently

`features-where.asc :: 'where' and 'let' clauses`, the second snippet:

```morloc
f = x where
    x = y where
        y = a + b
        a = 1
    b = 41
```

Runs cleanly and returns `42`. But the interesting thing about the
example — that the inner `where` binding `y = a + b` reaches out to
`b` in the *outer* `where` clause — is not called out in prose. The
narrative sentence right after ("Where clauses inherit the scope of
their parent and may be nested") is generic enough that a reader may
not realize that's what the example is illustrating.

Suggest annotating: "Note that `b` in the inner clause is bound by
the outer `where`."

### 4. `let` "must only refer to terms bound above them" — silent on how errors surface

`features-where.asc :: 'where' and 'let' clauses`, paragraph on `let`:

> These are guaranteed to be executed in order and may only refer to
> terms bound above them.

True. Verified with:

```morloc
f :: Int
f = let x = y + 1
        y = 10
    in x
```

```
ex_letfwd.loc:6:13: error:
Undefined term: y
  |
6 | f = let x = y + 1
  |             ^
```

Same message you'd get for any undefined identifier — nothing tells
the reader "this is because `let` is non-recursive." Not a bug, but
worth a sentence pointing out that a forward reference in `let`
surfaces as a generic "Undefined term."

---

## Minor

### 5. No mention of `let` block with multiple bindings vs `let` chain

The chapter shows `let` in exactly two shapes: (a) one `let` block
with two bindings, and (b) the chain-of-single-bindings variant from
finding #2. It does not spell out that a single `let` block *also*
allows same-name shadowing:

```morloc
foo = let x = 1
          x = 2
      in x       -- returns 2
```

Verified — evaluates to `2`. So the "later binding can shadow an
earlier one of the same name" rule applies both within one `let`
block and across chained `let` blocks. Worth stating explicitly.

### 6. Verified positive examples — for the record

| Example | Result | Expected |
| --- | --- | --- |
| `f x = y + b where { y = x+1; b = 41 }`, `f 0` | `42` | pass |
| Nested `where`, `f` | `42` | pass |
| `let m = n+1; y = m+2 in (m+y)`, `f 0` | `4` | pass |
| Chain-of-lets shadowing, `foo` | `2` | pass |
| Duplicate `where` binding | rejected with exact message from docs | pass |
| `where` shadows parameter | rejected with exact message from docs | pass |

Error messages compared verbatim against
`library/Morloc/Frontend/Desugar.hs:1893-1895` (fetched from GitHub
master, since the compiler source tree is not present on the host):

```
1893:            dfail pos ("where-clause binding shadows function parameter: " ++ T.unpack n)
1895:            dfail pos ("duplicate binding in where-clause: " ++ T.unpack n)
```

Exact match.
