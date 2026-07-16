# features-floats.asc — findings

Chapter fetched from GitHub master (no local docs source on host).
Compiler tested: morloc 0.93.0 (image
`ghcr.io/morloc-project/morloc/morloc-full:edge`). The compiler source tree
referenced in the shared context
(`/home/z/projects/morloc-core/compiler/morloc`) does not exist on this
host. `Inf`/`NaN` are compiler-built-in tokens — they are not defined in any
`*.loc` file in the installed stdlib, so no stdlib cross-check is possible
for the lexer claims.

Legend: **blocker** / **confusing** / **minor**.

---

## Findings

### 1. `Tensor1` type does not exist in the stdlib — **blocker**

`features-floats.asc :: Literal forms`, lines 52–53:

```morloc
-- 32-bit float for reduced memory in tensors
weights :: Tensor1 1000 Float32
```

The stdlib's `tensor` module (at
`/opt/morloc/src/morloc/plane/default/tensor/main.loc`) defines only
`Matrix`, `Tensor3`, `Tensor4`, `Tensor5`. There is no `Tensor1` and no
`Tensor2`:

```
$ grep -n 'newtype' tensor/main.loc
8:newtype Matrix (m :: Nat) (n :: Nat) a = ((Int, Int), Vector (m * n) a)
11:newtype Tensor3 (d1 :: Nat) (d2 :: Nat) (d3 :: Nat) a
13:newtype Tensor4 ...
15:newtype Tensor5 ...
```

The example silently passes `morloc typecheck` even without importing
`tensor`, because bare-signature typechecking does not resolve the type
constructor. But any actual use fails. A 1-D dense array would be
`Vector n a`, not `Tensor1`. The chapter should either use `Vector 1000
Float32` or add `Tensor1` to the tensor module.

Additionally, this line is a bare signature with no accompanying
definition, unlike the three literal examples above it (`pi`, `avogadro`,
`boltzmann`) which are all fully defined. Mixing forms in one code block
is confusing — a copy-paste of the whole block into a module fails with
`No implementation found for 'weights'`.

### 2. Bare-int literal in `Real` context silently produces garbage — **blocker**

`features-floats.asc :: Literal forms`, lines 56–58:

> A literal without a decimal point and without an exponent is parsed as
> an `Int`, not a `Real`. Use `1.0` or `1e0` if you want a floating-point
> literal of value 1.

The wording implies the reader will get a type error if they write
`one :: Real; one = 1`. They will not — the compiler accepts it silently
and produces garbage at runtime (this is the same bug flagged in
features-integers.md § 1). Reproduction:

```console
$ cat liteInt.loc
module m (one)
import root-cpp
one :: Real
one = 1
$ morloc-manager run -- morloc make liteInt.loc
$ morloc-manager run -- ./m one
4.94065645841247e-324
```

The doc should either point at this trap explicitly (this is the natural
place for a reader to trip over it) or the compiler should reject the
mismatched literal at typecheck time. The current wording gives false
comfort.

### 3. `morloc typecheck` does not run the overflow check — **confusing**

`features-floats.asc :: Compile-time literal overflow`, lines 125–147.

The chapter shows the overflow error firing on `morloc make`. It does
fire there — verified with `main.loc:7:10` in the exact format the doc
shows (adjusted for imports). But the same file passes `morloc typecheck`
with no complaint:

```console
$ cat overflow.loc
module m (tooBig)
tooBig :: Real
tooBig = 1e500
$ morloc-manager run -- morloc typecheck overflow.loc
tooBig :: Real
$ morloc-manager run -- morloc make overflow.loc
overflow.loc:7:10: error:
Float literal 1.0e500 overflows Float64 (|x| > 1.8e308)
  |
7 | tooBig = 1e500
  |          ^
```

Readers exercising the chapter with `typecheck` (a natural first step,
recommended by earlier chapters as a light-weight check) will see no
error and conclude the overflow claim is false. A one-line note "these
checks fire during `morloc make`, not `morloc typecheck`" would fix
this. The exact error text and caret position for all three examples
(Real overflow, Float32 overflow, negative overflow) match the doc.

### 4. IEEE 754 arithmetic table — all rows verified

`features-floats.asc :: Source-level literals`, lines 103–120.

Every row of the arithmetic table matches. Tested via `morloc eval -e
'import root-py; <expr>'` and confirmed a subset in C++:

| Expression       | Doc says | Got (Py) | Got (Cpp) |
|------------------|----------|----------|-----------|
| `Inf + Inf`      | `Inf`    | `"inf"`  | (n/a)     |
| `Inf + (-Inf)`   | `NaN`    | `"nan"`  | `"nan"`   |
| `Inf - Inf`      | `NaN`    | `"nan"`  | (n/a)     |
| `Inf * 0.0`      | `NaN`    | `"nan"`  | `"nan"`   |
| `Inf * 2.0`      | `Inf`    | `"inf"`  | `"inf"`   |
| `Inf * (-1.0)`   | `-Inf`   | `"-inf"` | (n/a)     |
| `Inf * Inf`      | `Inf`    | `"inf"`  | (n/a)     |
| `Inf * (-Inf)`   | `-Inf`   | `"-inf"` | (n/a)     |
| `NaN + 1.0`      | `NaN`    | `"nan"`  | (n/a)     |
| `NaN * 0.0`      | `NaN`    | `"nan"`  | (n/a)     |
| `NaN * Inf`      | `NaN`    | `"nan"`  | (n/a)     |
| `negate Inf`     | `-Inf`   | `"-inf"` | (n/a)     |
| `negate NaN`     | `NaN`    | `"nan"`  | (n/a)     |

Non-finite literals working in a pure-morloc context (no `root-*`
import) verified for `Inf`, `-Inf`, `NaN`, `-NaN` — atomic-token claim
holds. Insertion of a space breaks it as expected:

```console
$ cat negSpace.loc
module m (x)
x :: Real
x = - Inf
$ morloc-manager run -- morloc typecheck negSpace.loc
negSpace.loc:4:5: error:
Undefined term: negate
  |
4 | x = - Inf
  |     ^
```

### 5. Type-mapping table matches the stdlib — verified

`features-floats.asc :: Floating-point types`, lines 25–32.

Confirmed against `root-cpp/main.loc`, `root-py/main.loc`,
`root-r/main.loc`:

```
root-cpp: type Cpp => Real = "double"     Float64 = "double"     Float32 = "float"
root-py : type Py  => Real = "float"      Float64 = "float"      Float32 = "float"
root-r  : type R   => Real = "numeric"    Float64 = "numeric"    Float32 = "numeric"
```

### 6. Wire format claims — verified

`features-floats.asc :: Wire format and JSON interop`, lines 190–198.

Nexus emits non-finite Reals as quoted lowercase `"inf"`, `"-inf"`,
`"nan"`. Confirmed with the `Inf`/`-Inf`/`NaN` example module and via
`morloc eval`. `-NaN` also round-trips as `"nan"` (sign-collapse claim
holds).

### 7. Cross-language `1.0 / 0.0` divergence — verified

`features-floats.asc :: Cross-language gotcha`, lines 210–233.

* Python pool: `float division by zero` runtime error (Morloc wraps it
  as `Error: run failed / float division by zero / at m1 (py)`).
* C++ pool: prints `"inf"`.
* R pool: prints `"inf"`.

All three match the doc.

### 8. `-0.0` printed sign vs doc "JSON output does not preserve" — **minor**

`features-floats.asc :: Negation of Real values`, lines 266–268.

The doc says the binary format preserves the `+0.0` vs `-0.0` bit
pattern but "the JSON output does not". Numerically true (JSON `-0`
and `0` are the same number), but the printed text is not uniform:

```console
$ morloc-manager run -- morloc eval -e 'import root-py; negate 0.0'
-0
$ morloc-manager run -- morloc eval -e 'import root-py; -0.0'
0
```

`negate 0.0` prints as `-0` (sign visible in text), while the source
literal `-0.0` prints as `0` (sign gone). A reader checking the
distinction empirically will see something inconsistent with the doc's
"JSON output does not [preserve]" wording. A stronger claim ("the JSON
numeric form may or may not carry the sign") or an explicit note about
the literal-`-0.0`-collapsing-to-`0` case would be more accurate.

---

## Summary

Two blockers (fictional `Tensor1` type in a code block, and the
`Int`-in-`Real`-context silent-corruption trap that the "literal without
a decimal point... is parsed as an Int" text glosses over) and one
confusing point (overflow checks require `make`, not `typecheck`). All
other executable claims in the chapter — the IEEE 754 arithmetic table,
the wire format, the cross-language `1/0` divergence, the atomic
`-Inf`/`-NaN` tokens, and the compile-time overflow error text and caret
positions — reproduce exactly.
