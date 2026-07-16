# features-tuples-and-lists.asc — findings

Chapter 8 of 48. The local checkout at
`/home/z/projects/morloc-core/morloc-workspace/docs/morloc-project.github.io/src/content/features-tuples-and-lists.asc`
is not present in this environment, so the chapter was fetched from
`https://raw.githubusercontent.com/morloc-project/morloc-project.github.io/master/src/content/features-tuples-and-lists.asc`
(70 lines).

Toolchain: `morloc-manager 0.25.0`, `morloc 0.93.0` inside `morloc-full:edge`.
Compiler cross-checks against `master` at
`https://raw.githubusercontent.com/morloc-project/morloc/master/…`.

---

## Blocker: the entire "Tuples" section is duplicated

**Location:** `features-tuples-and-lists.asc :: === Tuples` (lines 11-26)
duplicated verbatim at lines 56-69, dangling after `==== Lists`.

Lines 56-69:

```
Tuples may be used to store a fixed number of terms of different type.

[source, morloc]
----
x :: (Int, Bool, Real)
x = (1, True, 6.45)
----

Tuple types and tuple values are both represented as comma-delimited values
within parentheses. The parenthesized type representation is syntactic sugar for
a fixed-size tuple type such as `Tuple3` or `Tuple8`; the parser generates the
appropriate `TupleN` form from the number of fields, so there is no fixed upper
bound on tuple arity. Generally, if you have more than a few members in a
tuple, it is better to define a record type with named values.
```

This is the same paragraph and code block as lines 13-26, minus the `==== Tuples`
heading. A first-time reader reaches the end of the Lists section, sees a
sudden re-explanation of tuples with no heading and no lead-in, and cannot
tell whether it is a continuation, a subtopic of Lists, or a copy-paste
mistake. This is unambiguously a copy-paste mistake.

Severity: **blocker** (editorial defect that must be removed).

---

## Confusing: broken grammar in the specialization pitch

**Location:** `features-tuples-and-lists.asc :: ==== Lists`, lines 45-50.

Verbatim:

> While all list types share the same representation on the wire -- zero or more
> elements in contiguous memory -- there are several data structures that for
> accessing this data that have different performance tradeoffs.

Two `that` clauses collide: "several data structures that for accessing this
data that have different performance tradeoffs." This parses as broken
grammar. Presumably intended to be something like "several data structures
for accessing this data that have different performance tradeoffs" or
"several data structures that provide different performance tradeoffs when
accessing this data".

Severity: **confusing** (readable, but the reader hesitates).

---

## Minor: `morloc typecheck` prints paren-sugar only through arity 8

**Location:** the chapter's claim in the (duplicated) Tuples paragraph:
"parenthesized type representation is syntactic sugar for a fixed-size tuple
type such as `Tuple3` or `Tuple8`".

The parser really does accept arbitrary arity — verified end-to-end with
`Tuple10` and `Tuple50`:

```
$ cat big_tup.loc
module m (t8, t10, t20)
t8  :: (Int, Int, Int, Int, Int, Int, Int, Int)
t8  = (1,2,3,4,5,6,7,8)
t10 :: (Int, Int, Int, Int, Int, Int, Int, Int, Int, Int)
t10 = (1,2,3,4,5,6,7,8,9,10)
t20 :: (Int, Int, ... 20 total ...)
t20 = (1,2, ... 20 total ...)

$ morloc-manager run -- morloc typecheck big_tup.loc
t8  :: (Int, Int, Int, Int, Int, Int, Int, Int)
t10 :: Tuple10 Int Int Int Int Int Int Int Int Int Int
t20 :: Tuple20 Int Int Int Int Int Int Int Int Int Int Int Int Int Int Int Int Int Int Int Int
```

`t8` renders with paren sugar, but `t10`/`t20` render with the raw `TupleN`
form. That is because `library/Morloc/Namespace/Type.hs:1326-1332` (Pretty
instance for `Type`) special-cases only `Tuple2` through `Tuple8`:

```haskell
f _ (AppT (VarT (TV "Tuple2")) ts) = encloseSep "(" ")" ", " (map (f True) ts)
...
f _ (AppT (VarT (TV "Tuple8")) ts) = encloseSep "(" ")" ", " (map (f True) ts)
```

So the mention of `Tuple3` / `Tuple8` in the docs is not just "for example";
it is the exact range where the sugar is legible. Arity 9+ works but only
prints with the prefix form. The chapter should either note this asymmetry
or (better) extend the pretty printer to cover it — the choice of `Tuple8`
as the upper example is coincidentally on the boundary and thus reads as
arbitrary.

Also verified end-to-end: `Tuple10` and `Tuple50` build with `morloc make`
and return correct JSON from the nexus (`[1,2,...,10]` and `[1,2,...,50]`
respectively). No tuple-arity ceiling was hit.

Compiler cross-check for the "parser generates any arity" claim:
`library/Morloc/BaseTypes.hs:135-136,303-304`:

```haskell
tuple :: Int -> TVar
tuple k = TV $ "Tuple" <> pretty k
...
tupleU :: [TypeU] -> TypeU
tupleU ts = AppU (VarU $ tuple (length ts)) ts
```

Severity: **minor**.

---

## Minor: parenthesised type sugar and `TupleN` interchangeability is not documented

The doc says the paren syntax is sugar for `TupleN` but never shows the
explicit form. Verified they are interchangeable:

```
$ cat tup_named.loc
module m (t3, t3paren)
t3      :: Tuple3 Int Int Int
t3      = (1,2,3)
t3paren :: (Int, Int, Int)
t3paren = (1,2,3)

$ morloc-manager run -- morloc typecheck tup_named.loc
t3      :: (Int, Int, Int)
t3paren :: (Int, Int, Int)
```

A reader may want to know they can name the type explicitly (useful in
polymorphic contexts and typeclass instances). The chapter never says so.

Severity: **minor**.

---

## Working as documented

- The tuple example (`x :: (Int, Bool, Real); x = (1, True, 6.45)`) type-checks
  cleanly with a trivial module wrapper:

  ```
  $ cat tuple_ex.loc
  module m (x)
  x :: (Int, Bool, Real)
  x = (1, True, 6.45)

  $ morloc-manager run -- morloc typecheck tuple_ex.loc
  x :: (Int, Bool, Real)
  ```

- The list example (`x :: [Int]; x = [1, 2, 3]; ys :: List Real; ys = ...`)
  type-checks with the same wrapper. Notable: the `List Real` form is
  normalized back to `[Real]` in the output — both spellings work but the
  pretty printer canonicalizes to brackets:

  ```
  $ morloc-manager run -- morloc typecheck list_ex.loc
  x  :: [Int]
  ys :: [Real]
  ```

- The Deque reference in the specialization sentence is real — `root/main.loc`
  in the shipped stdlib defines `newtype Deque a = List a` and instances for
  `Foldable`, `Functor`, `Stack`, `Queue`, `Semigroup`, `Monoid`, `Eq`, `Ord`.
  Not exercised in the chapter but the claim is not aspirational.

- The `xref:types-newtype[...]` cross-reference resolves to
  `content/types-newtype.asc` which begins with `[#types-newtype]` (explicit
  anchor). Valid.

- The `<<Tensors>>` cross-reference resolves to
  `content/features-tensors.asc` which begins with `=== Tensors` (auto-anchor).
  Valid.

- The wire-format claim (JSON arrays; `[1,2,3]` ambiguous between list and
  3-tuple) is consistent with the JSON output observed in every prior chapter
  and needs no new verification.

## Chapter completeness note

The chapter has neither a `xref:List` link nor any mention of the standard
functions available on lists (`map`, `fold`, `filter`, `zip`, `range`,
bracket accessors, ...). It also does not show a runnable list example
(neither example exports a function; both are pure-data declarations). A
reader who has just installed morloc has no idea from this chapter how to
consume a `[Int]` argument from the nexus, how to slice one, or where the
list functions live. Everything is deferred to the two cross-references at
the bottom.

Severity: **minor** (arguable — the chapter title is "Tuples and Lists",
not "Working with Lists"), but the second half of the chapter is dominated
by a "here be more elsewhere" pointer that leaves a first-time user hanging.
