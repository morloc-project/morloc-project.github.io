# features-boolean.asc — findings

Chapter 4 of 48. Content pulled from
`https://raw.githubusercontent.com/morloc-project/morloc-project.github.io/master/src/content/features-boolean.asc`
(the checked-out copy at
`/home/z/projects/morloc-core/morloc-workspace/docs/morloc-project.github.io/src/content/features-boolean.asc`
was not present in this environment; fetched from the `master` branch instead).

Toolchain: `morloc-manager 0.25.0`, morloc `0.93.0` inside `morloc-full:edge`.
Compiler cross-checks against
`/opt/morloc/src/morloc/plane/default/root*/` on the VM.

Every code snippet in the chapter was completed with a minimal `module m (...)`
header (and an `import root-py` where the chapter omitted it) and run via
`morloc make` + `./m <cmd>`.

---

## Blocker: `&&` and `||` are NOT short-circuiting in Python (only in C++)

**Location:** `features-boolean.asc :: ==== Logical operators`

Verbatim quote:

> `&&` and `||` are short-circuiting and right-associative.

Right-associativity is fine (see cross-check below). The short-circuiting
claim is **only true for C++**. In Python, `&&` is a plain function call
that evaluates both operands before the call.

Test module (`e_short.loc`), sourcing a Python `crash` that always
raises:

```morloc
module m (test1, test2)
import root-py
source Py from "crash.py" ("crash")

crash :: Int -> Bool

test1 :: Int -> Bool
test1 x = False && crash x

test2 :: Int -> Bool
test2 x = True || crash x
```

`crash.py`:

```python
def crash(x):
    raise RuntimeError("SIDE EFFECT")
```

Runs:

```
$ morloc-manager run -- morloc make e_short.loc     # succeeds
$ morloc-manager run -- ./m test1 5
Error: run failed
SIDE EFFECT
  at m1364 (py)
  at m1 (py)
$ morloc-manager run -- ./m test2 5
Error: run failed
SIDE EFFECT
  at m1371 (py)
  at m2 (py)
```

Both `False && crash x` and `True || crash x` call `crash`.

The same test in C++ (`import root-cpp`, `source Cpp from "crash.hpp"
("crash")`) works as the docs claim — `test1` returns `false`, `test2`
returns `true`, `crash` never fires.

Root cause is visible in the codegen. C++ pool for `test1`:

```
/* pools/m/pool.cpp */
bool n2 = (false && m1363(n0));   // native C++ &&, short-circuits
```

Python pool for `test1`:

```
/* pools/m/pool.py */
n2 = default_root_py_core.morloc_and(n0, n1)   // both args eval'd first
```

And `morloc_and` in `root-py/core.py`:

```
def morloc_and(x, y):
    return x and y
```

Python evaluates `x` and `y` at call time, so this is not short-circuiting
regardless of `x and y` being short-circuit inside the body.

Cross-check: `root-py/main.loc` line 40-45 does mark the ops
`%inline`, but Python has no operator-level inlining — the `%inline`
attribute affects codegen structure, not evaluation order at Python's
call boundary.

Severity: **blocker**. The prose makes a language-agnostic claim
("`&&` and `||` are short-circuiting") that only holds for one of the
two languages actually shipped in the standard root modules. A reader
guarding effectful code with `flag && expensive` will silently get the
opposite of what the docs promise.

Minimum fix: qualify the sentence, e.g. "In the C++ backend `&&` and `||`
are short-circuiting; in the Python backend both operands are always
evaluated. Do not rely on short-circuiting to guard effectful code."

Cross-check for the right-associativity / precedence half of the same
sentence (which *is* correct):

`/opt/morloc/src/morloc/plane/default/root/main.loc`:

```
5:infixr 2 ||
6:infixr 3 &&
```

Both right-associative; `&&` (fixity 3) binds tighter than `||` (fixity 2).

---

## Blocker: `sameLength :: [a] -> [b] -> Bool` is silently skipped by `morloc make`

**Location:** `features-boolean.asc :: ==== Comparison operators`

The chapter shows:

```morloc
import root-py

isPositive :: Int -> Bool
isPositive x = x > 0

sameLength :: [a] -> [b] -> Bool
sameLength xs ys = length xs == length ys
```

Assembled as a minimal module (`module m (isPositive, sameLength)` +
the two definitions above) and built:

```
$ morloc-manager run -- morloc make e2.loc
Warning: skipping generic export 'sameLength'
$ morloc-manager run -- ./m sameLength "[1,2]" "[3,4]"
error: unexpected argument '[1,2]' found
```

`isPositive` builds and runs; `sameLength` is silently dropped from the
nexus because it is generic. A reader who assembles the chapter's example
verbatim will not see `sameLength` at all in `./m --help`.

To get it to run I had to monomorphize:

```morloc
sameLength :: [Int] -> [Int] -> Bool
sameLength xs ys = length xs == length ys
```

after which:

```
$ morloc-manager run -- ./m sameLength "[1,2,3]" "[4,5,6]"
true
$ morloc-manager run -- ./m sameLength "[1,2]" "[3,4,5]"
false
```

Same "generic-export-skipped" pattern flagged in chapter 3
(`features-source.asc`). The chapter should either mention it, restrict
this example to `morloc typecheck` (which does typecheck `sameLength`
fine), or replace the signature with a monomorphic one.

Severity: **blocker** for the reader following the doc end-to-end.

---

## Confusing: "the `root` modules" (plural) — bare `import root` doesn't provide comparison instances

**Location:** `features-boolean.asc :: === Booleans` (opening paragraph)
and `==== Comparison operators`.

Verbatim quote:

> Comparison and logical operators can be imported from the `root` modules.

Later, the code example uses `import root-py`, without explaining why not
`root`. If a reader tries just `import root` (as several earlier chapters
suggest is enough), comparison ops fail:

```
$ cat e2c.loc
module m (isPositive)
import root
isPositive :: Int -> Bool
isPositive x = x > 0

$ morloc-manager run -- morloc make e2c.loc
/opt/morloc/src/morloc/plane/default/root/main.loc:30:13: error:
General type error: No instance found for Ord::<=
  Are you missing a top-level type signature?
   |
30 | (>) x y = y <= x && not (x <= y)
   |             ^
```

`root/main.loc` provides only signatures (`(&&) :: Bool -> Bool -> Bool`
etc.); the instances live in `root-py` / `root-cpp` / `root-r`. The
chapter should say so explicitly ("`import root-py` or `import root-cpp`
for the language-specific instances").

Severity: **confusing**. The opening sentence is technically true if
"root modules" is read as the family, but the first-time reader is
likely to try `import root` and immediately hit a compiler error whose
message does not point at the missing-instance module.

---

## Confusing: `True`/`False` at source, `true`/`false` in output; lowercase source is rejected

**Location:** `features-boolean.asc :: === Booleans` and
`==== Literals and basic use`.

The chapter says values are `True` or `False`. That is correct at the
source level. But nexus output prints them lowercase:

```
$ morloc-manager run -- ./m yes
true
$ morloc-manager run -- ./m no
false
```

A reader who sees `true`/`false` output and copies it back into source
gets a surprising error:

```
$ cat e_lower.loc
module m (v)
v :: Bool
v = true

$ morloc-manager run -- morloc typecheck e_lower.loc
e_lower.loc:4:5: error:
Undefined term: true
  |
4 | v = true
  |     ^
```

The chapter should either mention the print form or use uppercase
`True`/`False` in the shown output.

Severity: **confusing**.

---

## Minor: dangling cross-reference "See the Guards section"

**Location:** `features-boolean.asc :: ==== Guards` (last line).

> See the Guards section for a full description of guard syntax.

There is no cross-reference / anchor / link. The Guards chapter is
`features-guards.asc` (~9 chapters later in `index.adoc`). AsciiDoc's
`<<Guards>>` or `xref:features-guards.asc#...[]` would produce a real
hyperlink. Consistent with the practice already used elsewhere per the
prior-chapter notes.

Severity: **minor**.

---

## Minor: opening paragraph example lists `no :: Bool = False` right next to a
reserved-looking identifier

**Location:** `features-boolean.asc :: ==== Literals and basic use`.

Not actually a bug — `no` is a legal identifier — but the reader who
already knows other functional languages will pause on `no` and wonder
whether it collides with a keyword. Using `yes/no` and expecting a
first-time reader to understand these are arbitrary names is a mild
readability trap. Fine to leave.

Severity: **minor**.

---

## Verified as documented

- Right-associativity of `&&` and `||` and that `&&` binds tighter than
  `||` (confirmed against `root/main.loc:5-6`, `infixr 2 ||`,
  `infixr 3 &&`).
- `xor` and `nand` work (`xt true false` -> `true`, `nt true true` -> `false`).
- `any`, `all`, `elem` work as advertised for `[Int]` predicates.
- Guard syntax `? cond = expr` / `: expr` works — `classify -3` returns
  `"negative"`, `classify 0` returns `"zero"`, `classify 5` returns
  `"positive"`.
- `not (isWeekend day)` works; `inRange 1 10 5` -> `true`,
  `inRange 1 10 -1` -> `false`.

---

## Notes for later chapters

- The "short-circuit lies in Python" finding is likely to bite any
  chapter that recommends guarding effectful expressions with `&&` / `||`
  (patterns, guards, effects). Watch for it.
- Generic-export skipping keeps recurring; the chapter that eventually
  documents `morloc make`'s export selection rules should surface it.
