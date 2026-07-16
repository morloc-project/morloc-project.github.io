# features-recursion.asc — findings

Compiler: **morloc 0.93.0** (container `ghcr.io/morloc-project/morloc/morloc-full:edge`).

Chapter is 264 lines, 15 code snippets. Every snippet is a bare fragment
(no `module`/`import`/language-root lines). The chapter states just above
the linked-list section that the examples "assume one stdlib import"
(`import maybe-py (require, isNull)`), but every example additionally
needs `module m (...)`, `import root`, and `import root-py`. A
first-time reader who copies the snippet verbatim into a file will hit
`Undefined term` or `No instance found` errors.

Smallest completion I used for every example:

```
module m (<exports>)
import root
import root-py
import maybe-py (require, isNull)   -- only where isNull/require appear
<snippet>
```

All 15 snippets compile and run once wrapped like this, except where noted below.

---

## 1. `containerLength` silently dropped from the nexus `[blocker]`

`features-recursion.asc :: Parameterised recursion` (lines 247-254).

The chapter presents `containerLength :: Container a -> Int` as "A
polymorphic consumer". Wrapped with the minimum module/imports and
built:

```
$ cd ~/test/features-recursion && morloc-manager run -- morloc make container.loc
Warning: skipping generic export 'containerLength'
```

Attempting to run it fails with the wrong-argument error because no
command was generated:

```
$ morloc-manager run -- ./m containerLength '{"val":1,"sub":{"val":2,"sub":null}}'
error: unexpected argument 'containerLength' found
Usage: m <nexus_options> @ <command_options>
```

`containerExample` is exposed, but nothing polymorphic is. The chapter
does not mention that a polymorphic export is silently dropped, and
this is at least the sixth chapter to hit the same footgun without a
callout. Reader who follows the doc verbatim gets a dead example.

Fix: either monomorphise the signature (`Container Int -> Int`), or add
a one-line callout that polymorphic top-level exports don't get nexus
commands and must be monomorphised for CLI use.

---

## 2. Missing module/language-root imports on every snippet `[confusing]`

`features-recursion.asc` (all snippets).

Only the maybe-py import is mentioned in the prose. Missing on every
snippet:

- `module m (...)` header
- `import root` (for `Int`, `==`, `>`, `<=`, `-`, `+`, `*`, guards)
- `import root-py` (for Python instances so `morloc make` produces a pool)
- `import root-py`'s `fold` instance is what makes the rose-sum snippet
  buildable — no root-py, no pool.

Verified minimum-viable wrapping above. Same trap every previous
chapter has hit. A short "how to run these" preamble at the top of
this chapter (or a link to one) would save every reader the same
15-minute stumble.

---

## 3. "The `?` guard can appear more than once in a body" — terminology collision `[confusing]`

`features-recursion.asc :: Branching: binary trees` (line 116).

Full sentence: "The `?` guard can appear more than once in a body. A
binary tree node carries a payload and _two_ independently optional
children, so each node may have zero, one, or two subtrees."

Two problems:

1. "The `?` guard" in features-guards.asc means the `?`-branch of a
   guard clause. Here it means the `?T` optional type constructor.
   Same character, two entirely different language features. The
   preceding paragraph did establish `?T` as "an optional"
   (line 46-47), but calling it a "guard" here re-uses the word from
   the previous chapter for something different.
2. "each node may have zero, one, or two subtrees" is true of the
   *type*, but the very next example (`btreeBuild`) builds trees that
   have zero or two children, never one. The claim would land better if
   `btreeExample` included at least one node with a single child.

Suggested edit: replace "The `?` guard can appear more than once in a
body." with "A recursive type may reach itself under `?T` more than
once. A binary tree node..."

---

## 4. `require`'s claim overpromises `[minor]`

`features-recursion.asc :: Recursive types` (line 59-60).

Doc says: "`isNull` tests whether an optional value is absent; `require`
asserts it is present and strips the `?`."

Implementation:

```
$ morloc-manager run -- cat /opt/morloc/src/morloc/plane/default/maybe-py/maybe.py
def morloc_fromMaybe(x):
    return x
def morloc_isNull(x):
    return x is None
```

`require` is just `id` on the Python side (and similarly for C++/R).
It does not assert anything — it just strips the type wrapper. If the
caller mis-guards and passes `Null`, `require` silently returns `None`
and the crash happens somewhere downstream, not at `require`. "asserts"
is the wrong verb. "strips the `?` wrapper (safe under a null guard)"
matches the maybe/main.loc comment word-for-word.

---

## 5. Record `LL` example silently changes shape `[minor]`

`features-recursion.asc :: Record form` (lines 202-224).

The tuple form was `type LL a = (a, ?(LL a))` — parameterised.

The record form is:

```
record LL where
  head :: Int
  tail :: ?LL
```

— monomorphic `Int`, not parameterised. Reader who is trying to see
"the record form of the same thing" has to notice this on their own.
Either use `record LL a where` / `head :: a`, or state that the record
version is monomorphic for readability.

Ran the example verbatim (no `record Py => LL = "dict"` line — none is
needed, verified) and it works:

```
$ morloc-manager run -- ./m llRecordExample
{"head":42,"tail":{"head":7,"tail":null}}
$ morloc-manager run -- ./m llLen '{"head":42,"tail":{"head":7,"tail":null}}'
2
```

---

## 6. Nexus schema drops parameter on optional recursive fields `[minor]`

Observed while running `container.loc`. Not a claim from this chapter,
but a first-time reader will see it after copying the example:

```
$ morloc-manager run -- ./m --help
...
Record Schemas:
  Container Int
    val :: Int
    sub :: ?Container
```

The declared type is `sub :: ?(Container a)` and the export is
`containerExample :: Container Int`. The schema should print
`sub :: ?(Container Int)` — the type parameter is lost. This is a
nexus rendering bug, not a recursion bug. Filing here because the
recursion chapter is the first place a reader is likely to see it.

---

## Cross-checks against the compiler (all confirmed as claimed)

- "Bare self-reference like `type X = X` is rejected at compile time":
  verified.

  ```
  $ cat bad.loc  # type X = X
  $ morloc-manager run -- morloc typecheck bad.loc
  bad.loc:6:1: Type alias 'X' has a vacuous body: it reduces to a
  self-reference with no payload
  ```

  Compiler source: `library/Morloc/Frontend/Desugar.hs:1982,1997` —
  `"' has a vacuous body: it reduces to a self-reference with no payload"`.

- "Mutually recursive type aliases -- two or more type definitions
  that reference each other in a cycle -- are not supported": verified.

  ```
  $ cat mutual.loc  # type A = B ; type B = A
  $ morloc-manager run -- morloc typecheck mutual.loc
  mutual.loc:6:1: error:
  Mutual recursion between type definitions is not supported. Cycle: A, B
  ```

  Compiler source: `library/Morloc/Frontend/Restructure.hs:237` —
  `"Mutual recursion between" <+> scopeMsg <+> "is not supported."`
  and `classifyRecursion` at line 94.

- "The typechecker's element-wise coercion (`a -> ?a`) handles that
  automatically" (line 92-93): empirically verified — `llRange` builds
  and runs. Did not locate a named coercion routine in the compiler,
  but the empirical result matches the claim.

- `fold` from `root`: verified in
  `/opt/morloc/src/morloc/plane/default/root/main.loc:81` —
  `fold :: (b -> a -> b) -> b -> f a -> b`.

## Positive results (all examples that ran)

| Snippet | Result |
| --- | --- |
| `fact 10` | `3628800` |
| `fact 0` | `1` |
| `fact 20` | `2432902008176640000` |
| `isEven 10` | `true` |
| `isEven 7` | `false` |
| `isOdd 5` | `true` |
| `llExample` | `[42,[7,[99,null]]]` |
| `llRange 5` | `[5,[4,[3,[2,[1,[0,null]]]]]]` |
| `llLen '[42,[7,[99,null]]]'` | `3` |
| `llSum '[42,[7,[99,null]]]'` | `148` |
| `btreeExample` | `[10,[5,null,null],[15,null,null]]` |
| `btreeBuild 3` | full 15-node tree with leaves = 1 |
| `btreeSum '[10,[5,null,null],[15,null,null]]'` | `30` |
| `roseExample` | `[1,[[2,[]],[3,[]]]]` |
| `roseBuild 3` | full rose tree |
| `roseSum '[1,[[2,[]],[3,[]]]]'` | `6` |
| `llRecordExample` (record form) | `{"head":42,"tail":{"head":7,"tail":null}}` |
| `llLen` (record form) on the same | `2` |
| `containerExample` | `{"val":1,"sub":{"val":2,"sub":null}}` |
| `containerLength` | **dropped from nexus — see finding 1** |
