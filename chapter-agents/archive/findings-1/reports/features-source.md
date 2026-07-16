# features-source.asc — findings

Chapter 3 of 48. Content pulled from
`https://raw.githubusercontent.com/morloc-project/morloc-project.github.io/master/src/content/features-source.asc`
(the checked-out copy at
`/home/z/projects/morloc-core/morloc-workspace/docs/morloc-project.github.io/src/content/features-source.asc`
was not present in this environment; fetched from the `master` branch instead).

Toolchain: `morloc-manager 0.25.0`, morloc `0.93.0` inside `morloc-full:edge`.
Compiler cross-checks against
`https://raw.githubusercontent.com/morloc-project/morloc/master/library/Morloc/Frontend/Parser.y`.

---

## Blocker: "Importing builtin functions" example is not the case it claims to demonstrate

**Location:** `features-source.asc :: === Foreign functions :: ==== Importing builtin functions`

Verbatim quote:

> If we directly sourced the builtins, as below:
>
> ```
> source Py from "foo.py" ("morloc_map" as map, "morloc_sum" as sum, "snd")
> ```

The prose says "directly sourced the builtins", but the code block still
sources the wrapper names `morloc_map` and `morloc_sum` — the exact same line
as the first example at the top of the chapter. The example fails to
demonstrate what the paragraph is describing.

The intended line is:

```morloc
source Py from "foo.py" ("map", "sum", "snd")
```

That change is what makes the following `foo.py` re-export (`from builtins import
map, sum`) necessary.

Verified end-to-end with the corrected code:

```
$ morloc-manager run -- morloc make mb.loc
$ morloc-manager run -- ./mb mapSum '[["a",1.25],["b",2.5],["c",3.5]]'
7.25
```

And confirmed the failure mode the docs are trying to explain — I removed
the `from builtins import map, sum` line from `foo.py`, kept
`source Py from "foo.py" ("map", "sum", "snd")`, and got:

```
$ morloc-manager run -- ./mn mapSum '[["a",1.25],["b",2.5],["c",3.5]]'
Error: run failed
module 'foo_nobuiltin' has no attribute 'sum'
  at m1 (py)
```

So the underlying claim is correct; only the code example that supports it
is wrong.

Severity: **blocker**. A first-time reader either sees a "problematic" line
that is identical to the earlier "correct" line, or copy-pastes it and
sees success (because the wrapper names really are defined), and comes
away thinking they understand the pitfall when they don't.

---

## Blocker: the top-level example, run verbatim, produces no working nexus command

**Location:** `features-source.asc :: === Foreign functions` (the whole
opening example).

The chapter walks the reader through:

1. Two `source` lines.
2. Three general type signatures (`map`, `snd`, `sum`).
3. Six `type X => ... = ...` mappings.

It never shows a `module` header, an exported term, or any code that
actually uses the imports. A first-time reader would reasonably assemble
the pieces like this and call `morloc make`:

```morloc
module m (mapSum)

source Cpp from "foo.hpp" ("map", "sum", "snd")
source Py from "foo.py" ("morloc_map" as map, "morloc_sum" as sum, "snd")

map :: (a -> b) -> [a] -> [b]
snd :: (a, b) -> b
sum :: [Real] -> Real

type Cpp => List a = "std::vector<$1>" a
type Cpp => Tuple2 a b = "std::tuple<$1,$2>" a b
type Cpp => Real = "double"
type Py => List a = "list" a
type Py => Tuple2 a b = "tuple" a b
type Py => Real = "float"

mapSum xs = sum (map snd xs)
```

`typecheck` succeeds and reports `mapSum :: [(a, Real)] -> Real`. But
`morloc make` prints only:

```
Warning: skipping generic export 'mapSum'
```

and produces no `pools/` directory and no runnable command in the nexus.
`./m` exists but exposes zero subcommands. This behavior is not mentioned
anywhere in the chapter, and the fix — adding a monomorphic signature such
as `mapSum :: [(Str, Real)] -> Real` (plus `type Cpp => Str = "std::string"`
and `type Py => Str = "str"`) — is nowhere in the docs at this point.

The chapter does not need to give an entire runnable program, but it
should either:

- restrict the discussion to `morloc typecheck`, since that is the only
  command that will complete cleanly with the shown code, or
- warn the reader that generic exports are silently skipped and show the
  smallest concrete-typed example needed to see the pipeline execute.

Severity: **blocker**, because a reader who tries to run the very first
end-to-end example gets a warning with no output and no explanation.

Cross-check confirming the compiler behavior is intentional (the "generic
export" concept is real, not an accidental error): compiler generates code
per monomorphic instance, and there is no way to synthesize C++/Python
code for `[(a, Real)]` without knowing `a`. The docs simply do not warn
the reader.

---

## Confusing: the C++ `sum` comment contradicts the general signature

**Location:** `features-source.asc :: === Foreign functions` (inside the
`c++` code block).

The C++ source contains this comment above `sum`:

```
// sum :: [a] -> a
template <typename A>
A sum(const std::vector<A>& xs) {
```

but the general Morloc signature the chapter gives is

```
sum :: [Real] -> Real
```

The comment claims full parametricity; the Morloc signature restricts it to
`Real`. Both are the author's choices, but they contradict each other in
the same page. A reader trying to reason about "how do concrete and general
types line up" will trip on this.

Severity: **confusing**. Either widen the Morloc signature (e.g.
`sum :: Num a => [a] -> a` — if that syntax is even supported in this
chapter's context) or narrow the C++ comment to `// sum :: [double] -> double`
to match the general type.

---

## Confusing: the "language" tokens `c++` vs `Cpp` are silently different things

**Location:** `features-source.asc :: === Foreign functions` (throughout).

The chapter uses `[source, c++]` for the C++ code block (an asciidoctor
highlighter hint) and `Cpp` for the morloc `source` keyword. Those two
tokens are unrelated (one is a syntax-highlighter language name, the
other is the morloc-parser `lang_token`). The chapter never states which
morloc language tokens exist or what the accepted spellings are.

Compiler grammar (`library/Morloc/Frontend/Parser.y`, line 366-368):

```
lang_token :: { Located }
  : UPPER                    { $1 }
  | LOWER                    { $1 }
```

So any UPPER or LOWER identifier lexically parses; the docs' `Cpp` and
`Py` are conventional but not enforced by the parser. Downstream, the
codegen selects language by matching these tokens (this chapter does not
enumerate them). A reader who tries `source c++ from ...` will see a parse
error because `c++` is not a valid identifier. This chapter should either
list the accepted spellings (`Cpp`, `Py`, `R`, ...) or link to the section
that does.

Severity: **confusing**.

---

## Minor: the `source` keyword's optional `from` clause and new `where` syntax are undocumented

**Location:** `features-source.asc :: === Foreign functions`.

Compiler grammar (`library/Morloc/Frontend/Parser.y`, lines 522-530):

```
source_decl :: { [Loc CstExpr] }
  : 'source' lang_token opt_from '(' source_items ')'
      { [at $1 (CSrcOldE $2 $3 $5)] }
  | 'source' lang_token opt_from 'where' VLBRACE source_new_items VRBRACE
      { [at $1 (CSrcNewE $2 $3 $6)] }

opt_from :: { Maybe Text }
  : {- empty -}                    { Nothing }
  | 'from' STRING                  { Just (getString $2) }
```

Two things the chapter doesn't mention:

- `from "file"` is syntactically optional (`opt_from`) — the parser accepts
  `source Cpp ("foo")`. This chapter isn't the right place to document
  what that means, but a reader who grep the parser will wonder.
- A parallel `source Lang [from "..."] where { ... }` form exists (with
  `%inline` support). The chapter mentions neither form nor the `%inline`
  attribute.

Severity: **minor** for a first pass; note it because the chapter presents
the parenthesized form as *the* source syntax.

---

## Minor: Python code block hides the `foo.py` needed for the first example

**Location:** `features-source.asc :: === Foreign functions`.

The chapter shows `foo.hpp` in full (the `c++` block), but the `foo.py`
file that would satisfy the top `source Py from "foo.py" ("morloc_map" as
map, "morloc_sum" as sum, "snd")` line is never shown. The only `foo.py`
shown is later, in the "Importing builtin functions" subsection, and it
defines only `snd` (plus the `from builtins import map, sum` re-export)
— it does *not* define `morloc_map` or `morloc_sum`.

A reader who follows the chapter top-to-bottom has to invent the wrapper
functions. Since the whole point of the chapter is to show a working
polyglot example, this is worth spelling out.

Severity: **minor** (readers can guess), but combined with the "blocker"
above (no `module`, no exported term) it means the chapter's headline
example never actually runs on the page.

---

## Minor: `snd :: (a, b) -> b` sourced from Python needs a note about JSON list-as-tuple

**Location:** `features-source.asc :: === Foreign functions`.

Not a bug, but worth a sentence somewhere in the chapter (or in
`interface-cli.asc`): when the reader eventually runs the nexus, the JSON
input for a `[(Str, Real)]` argument is a list of two-element lists:

```
morloc-manager run -- ./m mapSum '[["a",1.25],["b",2.5]]'
```

Nothing in this chapter suggests that tuples wire as JSON arrays. First
attempts using `{"0":"a","1":1.25}` or `["a",1.25]` will look opaque.

Severity: **minor** (may belong in a later chapter).

---

## Notes for later chapters

- The generic-export skipping observed here is going to bite every
  chapter that shows a signature with a bare type variable and calls
  `morloc make`. The pattern to watch for is a chapter that presents an
  `import`/`source`/`typeclass` example but never gives a concrete
  entry point.
- Parser has an "old" and "new" `source` syntax; the "new" `where` form
  will presumably appear in later chapters — if it doesn't, that is
  itself a finding.
