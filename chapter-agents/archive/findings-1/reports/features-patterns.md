# features-patterns.asc — findings

Compiler tested: **morloc 0.93.0**, morloc-manager 0.25.0 (container image
`ghcr.io/morloc-project/morloc/morloc-full:edge`).

Every runnable snippet from the chapter was executed. All 24 numeric
examples in the "Getter patterns", "Setter patterns", "Bracket patterns",
and "Composing brackets with other patterns" sub-sections produce the
outputs the docs promise. The class declarations in "Adding bracket
support to your own types" match `internal/main.loc` verbatim, and the
compiler produces friendly, on-point errors for the two features the doc
explicitly calls out as "not yet available" (bracket setters, multi-axis
brackets).

Findings below are the loose threads.

---

## Blockers

None.

---

## Confusing

### C1. `map .1 [(1,2),(2,3)]` cannot be pasted into `morloc eval` as-is

Doc location: `features-patterns.asc :: Getter patterns` (line 36-39)

The chapter presents this as the first demonstration that "patterns are
functions" and gives no surrounding context:

```
[source, morloc]
----
map .1 [(1,2),(2,3)] -- returns [2,3]
----
```

A reader who tries the obvious thing gets a cryptic error, because the
inferred type of the expression is polymorphic (`[Int]` vs `[Real]`
undecided, since `Int` and `Real` are both `Num`-shaped and the list
literal is unresolved). `morloc eval` refuses:

```
$ morloc-manager run -- morloc eval -e 'import root-py; map .1 [(1,2),(2,3)]'
Warning: skipping generic export '__expr__'
error: unexpected argument '__expr__' found

Usage: eval <nexus_options> <command> <command_options>

For more information, try '--help'.
Error running expression: callProcess: ... failed
```

Adding an output type annotation makes it work:

```
$ morloc-manager run -- morloc eval -e 'import root-py; (map .1 [(1,2),(2,3)]) :: [Int]'
[2,3]
```

This is the same "skipping generic export" trap that has bitten every
prior chapter. The docs never explain it. A one-line note ("wrap in a
type annotation to disambiguate the numeric type") would spare a
first-time reader a lot of confusion.

Severity: **confusing** (the example is factually correct; the
reproducer needs one addition the doc does not mention).

---

### C2. Tuple-vs-list JSON output notation

Doc location: `features-patterns.asc :: Getter patterns` (throughout)

The chapter writes expected outputs in tuple notation:

```
.0 ((1,3),2,5) -- return (1,3)
.(.1,.0) (1,2,3) -- returns (2,1)
```

But every tuple crosses the nexus boundary as a JSON array. Actual
runs:

```
$ morloc-manager run -- morloc eval -e 'import root-py; .0 ((1,3),2,5)'
[1,3]
$ morloc-manager run -- morloc eval -e 'import root-py; .(.1,.0) (1,2,3)'
[2,1]
```

Not a defect (JSON has no tuple), but the doc's paren-form outputs do
not match what the reader sees on the terminal. The tuples/lists
chapter already established the convention, so a reader might trip on
"is `[1,3]` right? the doc says `(1,3)`". A one-line reminder at the
top of the section — "tuples serialize as JSON arrays" — would land.

Severity: **confusing**.

---

### C3. "Pass-through `Null` as `Nothing`" is vague

Doc location: `features-patterns.asc :: Adding bracket support to your own types`
(paragraph beginning "If a user passes an expression...")

> Pass-through `Null` as `Nothing` to compose cleanly with omitted
> positions in `.[i:]`, `.[:j]`, `.[::]`, etc.

Read cold, this sentence is unclear. `Null` and `Nothing` are unrelated
constructor-like names in morloc (`Null :: Unit`, `Nothing :: ?a`). The
bracket signatures take `?Int64`, which is `Optional Int64` — the two
constructors of that are `Nothing` (empty) and `Just x` (value). The
intended guidance is "when the user writes `.[:5]`, the missing start
position is passed to `__to_index__` as `Nothing`, so your `IndexLike`
instance for a nullable type must map `Null → Nothing`." Rewriting to
be explicit about which type is being talked about would help.

Severity: **confusing**.

---

### C4. `SliceableDim` auto-selection is asserted, not verified in text

Doc location: `features-patterns.asc :: Adding bracket support to your own types`
(sentence beginning "For a container parameterized by a dimensional `Nat`...")

> the compiler picks `SliceableDim` automatically when `Sliceable` is
> absent.

This is a claim about typeclass dispatch semantics that the reader
cannot verify from the docs alone (nothing on this page shows a
`Vector` slice example). The `internal` module comment above
`SliceableDim` is the closest thing to documentation, and it doesn't
say anything about auto-selection either. If a reader tries to define
both instances on the same type, does the compiler error, silently
pick one, or something else? Adding a minimal `Vector`-slice example
would remove the ambiguity.

Severity: **confusing** (no counter-example, but the claim is
unmotivated).

---

## Minor

### M1. The higher-order comparison-table row lacks a runnable example

Doc location: `features-patterns.asc :: Comparison of patterns to Python syntax`
(row "foo .0 xs | foo(lambda x: x[0], xs)")

The row asserts that patterns can be passed to any higher-order
function — not just `map` — but the chapter never runs one. Confirmed
working with a two-line module:

```
$ cat higher.loc
module m (out)
import root; import root-py
apply :: ((Int,Int) -> Int) -> (Int,Int) -> Int
apply f x = f x
out :: Int
out = apply .0 (7,8)
$ morloc-manager run -- morloc make higher.loc && morloc-manager run -- ./m out
7
```

Cosmetic: an inline snippet mirroring the `map .1 ...` example would
back the table entry.

Severity: **minor**.

---

## Verified working

All examples below produced the doc's promised output on the first try
(morloc 0.93.0, using `morloc eval` for one-liners and `morloc make` +
`morloc-manager run -- ./m <cmd>` for module-scope cases).

### Getter patterns
| example | actual output |
| --- | --- |
| `.0 (1,2)` | `1` |
| `.0 ((1,3),2,5)` | `[1,3]` (paren notation in doc, list in JSON — C2) |
| `.0.1 ((1,3),2,5)` | `3` |
| `.(.1,.0) (1,2,3)` | `[2,1]` |
| `.(.1,.0) (1,2)` | `[2,1]` |
| `.0.(.x, .y.1) ({x=1, y=(1,2), z=3}, 6)` | `[1,2]` |
| `map .1 [(1,2),(2,3)]` (with `:: [Int]`) | `[2,3]` — see C1 |

### Setter patterns
| example | actual output |
| --- | --- |
| `.(.0 = 99) (1,2)` | `[99,2]` |
| `.0.(.x=99, .y.1=33) ({x=1, y=(1,2), z=3}, 6)` | `[{"x":99,"y":[1,33],"z":3},6]` |
| `.(.k = 1) {k = 0}` (from comparison table) | `{"k":1}` |

### Bracket patterns (module `brackets.loc`, `ten = [0..9]`)
| example | actual output | doc expected |
| --- | --- | --- |
| `.[0]      ten` | `0`  | `0` |
| `.[-1]     ten` | `9`  | `9` |
| `.[1+1]    ten` | `2`  | `2` |
| `.[2:5]    ten` | `[2,3,4]`   | `[2,3,4]` |
| `.[:3]     ten` | `[0,1,2]`   | `[0,1,2]` |
| `.[7:]     ten` | `[7,8,9]`   | `[7,8,9]` |
| `.[:]      ten` | `[0,1,2,3,4,5,6,7,8,9]` | `[0,...,9]` |
| `.[8:99]   ten` | `[8,9]`     | `[8,9]` |
| `.[0:-1]   ten` | `[0,1,2,3,4,5,6,7,8]` | `[0,...,8]` |
| `.[::2]    ten` | `[0,2,4,6,8]` | `[0,2,4,6,8]` |
| `.[::-1]   ten` | `[9,8,7,6,5,4,3,2,1,0]` | `[9,8,...,0]` |
| `.[7:2:-2] ten` | `[7,5,3]` | `[7,5,3]` |

`IndexLike` cross-width bound check: `.[(2 :: Int8) : (5 :: UInt32)] ten`
→ `[2,3,4]`. Confirmed.

### Composed bracket patterns (module `composed.loc`)
| example | actual output |
| --- | --- |
| `.[0].x pts` | `0` |
| `.[2].y pts` | `102` |
| `.[-1].x pts` | `3` |
| `.[:3].x pts` | `[0,1,2]` |
| `.[::-1].x pts` | `[3,2,1,0]` |
| `.[0:3].(.x, .y) pts` | `[[0,100],[1,101],[2,102]]` |
| `.[0:2].[0:3] xss` | `[[1,2,3],[6,7,8]]` |
| `.[0:2].(.a.[0].0, .b.[0].y) rows` | `[[10,200],[30,400]]` |

### "Not yet available" claims
Both diagnostics are precise, source-caret-carrying, and helpful.

- `out = .[0,1] xss`:
  ```
  multi-axis bracket accessors are not supported in v1 (1D lists only)
  ```
- `out = .(.[0] = 99) xs` and `out = .[0] = 99 $ xs`:
  ```
  setters are not supported on accessor chains that contain a bracket
  ```

### Class definitions (`internal/main.loc`)

The four typeclass blocks the doc reproduces (`Indexable`,
`Sliceable`, `SliceableDim`, `IndexLike`) match
`/home/vagrant/.local/share/morloc/environments/base/src/morloc/plane/default/internal/main.loc`
verbatim. The extra `Sliceable` comment in the source (default
directions, `step 0` runtime error) is useful and could arguably be
mirrored into the doc.

---

## Notes on the compiler-source cross-check

The compiler-source path the harness advertises
(`/home/z/projects/morloc-core/compiler/morloc`) does not exist on
this host — only the installed stdlib is available on the VM. All
cross-checks in this report are grounded in
`/home/vagrant/.local/share/morloc/environments/base/src/morloc/plane/default/internal/main.loc`
plus observed compiler messages. Multi-axis and bracket-setter
diagnostics carry precise text (`"multi-axis bracket accessors are
not supported in v1 (1D lists only)"`, `"setters are not supported
on accessor chains that contain a bracket"`) which almost certainly
originates from the frontend, but I cannot cite the specific
Haskell source line without the compiler tree.
