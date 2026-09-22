# 4.9. Patterns

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/patterns.html | prev: https://morloc-project.github.io/docs/features/records.md | next: https://morloc-project.github.io/docs/features/pattern-matching.md

Morloc’s **pattern functions** are first-class getters, setters, and bracket operators for reaching into and rearranging data structures. They are ordinary values, so you can pass them around, `map` them over a list, and compose them like any other function.

This section is about **extracting and rebuilding** data. To bind a value’s parts to names, or to dispatch a function on the shape of its arguments, see [Pattern Matching](https://morloc-project.github.io/docs/features/pattern-matching.md) instead.

The examples below use anonymous record types, which are written with `=` rather than `::`:

```morloc
pts :: [{x = Int, y = Int}]
pts = [{x=0, y=100}, {x=1, y=101}, {x=2, y=102}, {x=3, y=103}]
```

Using `::` inside a record type is a common slip, and the compiler says so:

```console
pat.loc:8:9: type-level record literals use `=` to bind fields, not `::`
  try: {x = <type>, ...}
  `::` is for declarations (e.g. `x :: Int`, `record R where { x :: Int }`)
```

## 4.9.1. Getter patterns

A getter describes an optionally branching path into a structure. Each segment is a tuple index, a record key, or a group of them. Terminal positions come back as a tuple.

```morloc
-- the 1st element of a tuple of any size
.0 (1,2)              -- 1
.0 ((1,3),2,5)        -- (1,3)

-- the 2nd element of the first element
.0.1 ((1,3),2,5)      -- 3

-- the 2nd and 1st elements, in that order
.(.1,.0) (1,2,3)      -- (2,1)
.(.1,.0) (1,2)        -- (2,1)

-- indices and keys mix freely
.0.(.x, .y.1) ({x=1, y=(1,2), z=3}, 6)   -- (1,2)
```

A pattern is a function, so it goes wherever a function goes:

```morloc
map .1 [(1,2),(2,3)]  -- [2,3]
```

## 4.9.2. Setter patterns

A setter is the same path with an assignment at each terminus:

```morloc
.(.0 = 99) (1,2)

.0.(.x=99, .y.1=33) ({x=1, y=(1,2), z=3}, 6)
```

```console
$ ./patterns s1
[99,2]
$ ./patterns s2
[{"x":99,"y":[1,33],"z":3},6]
```

Setters do not mutate. The **spine** of the structure is copied, and unmodified fields still point at the original data. So `.(.0 = 42) x` builds a new tuple whose first field is 42 and whose remaining fields are the original elements. Records behave the same way.

## 4.9.3. Bracket patterns

Lists get a dedicated bracket form with Python’s index and slice syntax, written after a dot: `.[i]` picks an element, `.[i:j]` takes a sub-range, and `.[i:j:k]` adds a stride. The semantics track Python — negative indices count from the end, out-of-range bounds are clamped, and `.[::-1]` reverses.

```morloc
ten :: [Int]
ten = [0,1,2,3,4,5,6,7,8,9]
```

```console
$ ./patterns b1     -- .[0] ten
0
$ ./patterns b2     -- .[-1] ten        negative index counts from the end
9
$ ./patterns b3     -- .[1+1] ten       any expression of an IndexLike type
2
$ ./patterns b4     -- .[2:5] ten
[2,3,4]
$ ./patterns b5     -- .[:3] ten        omitted start defaults to 0
[0,1,2]
$ ./patterns b6     -- .[7:] ten        omitted stop defaults to length
[7,8,9]
$ ./patterns b7     -- .[:] ten         no-op copy
[0,1,2,3,4,5,6,7,8,9]
$ ./patterns b8     -- .[8:99] ten      bounds are clamped
[8,9]
$ ./patterns b9     -- .[0:-1] ten      Python-style negative stop
[0,1,2,3,4,5,6,7,8]
$ ./patterns b10    -- .[::2] ten       every other element
[0,2,4,6,8]
$ ./patterns b11    -- .[::-1] ten      full reverse
[9,8,7,6,5,4,3,2,1,0]
$ ./patterns b12    -- .[7:2:-2] ten    strided reverse slice
[7,5,3]
```

Any integral type can be an index or a bound. The conversion to the underlying 64-bit width dispatches through the `IndexLike` typeclass, so mixed widths are fine:

```morloc
ix :: I8 -> U32 -> [Int]
ix i j = .[(i :: I8) : (j :: U32)] ten
```

### Composing brackets with other patterns

Brackets chain with the other pattern forms. The rule depends on whether the bracket selects one element or a list:

-   `.[i].tail xs` — an index yields a scalar, so the tail composes directly. `.[0].x pts` is `(.x . .[0]) pts`.
-   `.[i:j].tail xs` — a slice yields a list, so the tail is **lifted** with `map`. `.[0:3].x pts` is `map .x (.[0:3] pts)`.

The tail can be any pattern body: a record key, a tuple index, a grouped selector, or another bracket. Nested brackets follow the same rule, with the outer map running the inner bracket on each row.

```morloc
rows :: [{a = [(Int,Int)], b = [{x = Int, y = Int}]}]
rows = [ {a = [(10,20)], b = [{x=100, y=200}]}
       , {a = [(30,40)], b = [{x=300, y=400}]} ]

xss :: [[Int]]
xss = [[1,2,3,4,5], [6,7,8,9,10]]
```

```console
$ ./patterns c1     -- .[0].x pts       scalar tail composes directly
0
$ ./patterns c2     -- .[2].y pts
102
$ ./patterns c3     -- .[-1].x pts
3
$ ./patterns c4     -- .[:3].x pts      slice + field, map-lifted
[0,1,2]
$ ./patterns c5     -- .[::-1].x pts
[3,2,1,0]
$ ./patterns c6     -- .[0:3].(.x, .y) pts        slice + group tail
[[0,100],[1,101],[2,102]]
$ ./patterns c7     -- .[0:2].[0:3] xss           slice + nested slice
[[1,2,3],[6,7,8]]
$ ./patterns c8     -- .[0:2].(.a.[0].0, .b.[0].y) rows    deep mixed chain
[[10,200],[30,400]]
```

Remember that these are JSON outputs, so a tuple prints as an array: `c6` returns three two-tuples, which JSON shows as `[[0,100],…​]`.

Brackets are getters only. There is no setter form (`.[i] = v $ xs`) in this release, and multi-axis brackets (`.[i,j]` for matrices and tensors) are not available yet either. Both are planned.

## 4.9.4. Patterns next to Python

| Pattern | Python | Note |
| --- | --- | --- |
| `.0` | `lambda x: x[0]` | patterns are functions |
| `.0 x` | `x[0]` |  |
| `.0.k x` | `x[0]["k"]` |  |
| `.(.1,.0) x` | `(x[1], x[0])` |  |
| `foo .0 xs` | `foo(lambda x: x[0], xs)` | higher order |
| `.(.k = 1) x` | `x["k"] = 1` | but non-mutating |
| `.[i] xs` | `xs[i]` | scalar result |
| `.[i:j] xs` | `xs[i:j]` | slice result (list) |
| `.[::-1] xs` | `xs[::-1]` | full reverse |
| `.[i:j].x xs` | `[e["x"] for e in xs[i:j]]` | tail map-lifted over slice |

## 4.9.5. Adding bracket support to your own types

Bracket syntax is not hardcoded. It dispatches through ordinary typeclasses declared in the standard library’s `internal` module, so a new container type can opt in:

```morloc
-- Indexing: .[i] xs
class Indexable f where
  __access_index__ :: ?I64 -> f a -> a

-- Slicing for shape-preserving containers (List, Str, ...)
class Sliceable f where
  __get_slice__ :: ?I64 -> ?I64 -> ?I64 -> f a -> f a

-- Slicing for Nat-parameterized containers (Vector, Tensor, ...) where the
-- output length differs from the input length
class SliceableDim f where
  __get_slice_dim__ :: ?I64 -> ?I64 -> ?I64 -> f n a -> f m a

-- Casting any user expression in a bound position to ?I64
class IndexLike i where
  __to_index__ :: i -> ?I64
```

For a plain container, source an `Indexable` and a `Sliceable` instance per target language. For a container parameterized by a dimensional `Nat` such as `Vector n a`, source `Indexable` and `SliceableDim` instead; the compiler picks `SliceableDim` automatically when `Sliceable` is absent.

If someone passes an expression of a custom integer-like type at a bound position, the compiler casts it through that type’s `IndexLike` instance. So you can extend bracket syntax to accept new bound types — a `Char` index, a fixed-point coordinate — by adding an `IndexLike` instance whose `*to_index*` returns `?I64`. Pass `Null` through as `Nothing` so it composes with the omitted positions in `.[i:]`, `.[:j]`, and `.[::]`.

Because the dispatch lives in libraries rather than in the compiler, a module that does not import the standard library is free to substitute a different typeclass hierarchy. Bracket syntax simply errors at codegen if no matching instance is in scope.
