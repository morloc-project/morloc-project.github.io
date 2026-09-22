# 4.5. Floating-point types

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/floats.html | prev: https://morloc-project.github.io/docs/features/integers.md | next: https://morloc-project.github.io/docs/features/strings.md

Morloc’s floating-point types are IEEE 754 binary formats. `Real` is the default; `F32` and `F64` exist when you need to control precision explicitly.

| Type | Width | Use case |
| --- | --- | --- |
| `Real` | Language-dependent (typically 64-bit IEEE 754) | Default floating point. |
| `F32` | 32 bits (IEEE 754 binary32) | Tensors, GPU code, memory-constrained numerics. |
| `F64` | 64 bits (IEEE 754 binary64) | Default-precision scientific computation. |

Each maps to its host-language equivalent:

| Morloc type | C++ | Python | R |
| --- | --- | --- | --- |
| `Real` | `double` | `float` | `numeric` |
| `F32` | `float` | `float` (with f32 conversion at the boundary) | `numeric` |
| `F64` | `double` | `float` | `numeric` |

## 4.5.1. Literal forms

Real literals need a decimal point or an exponent:

```morloc
pi :: Real
pi = 3.14159265358979

-- scientific notation (upper or lowercase 'e')
avogadro :: F64
avogadro = 6.022e23

-- negative exponent
boltzmann :: Real
boltzmann = 1.380649e-23
```

```console
$ ./floats pi
3.14159265358979
$ ./floats avogadro
6.022e+23
$ ./floats boltzmann
1.380649e-23
```

Note the explicit `+` on the printed exponent.

A literal with neither a decimal point nor an exponent is an `Int`, not a `Real`. Write `1.0` or `1e0` when you want a floating-point one.

## 4.5.2. IEEE 754 and non-finite values

`Real` follows IEEE 754 in full, which means its value space is the finite reals representable at the target precision **plus** three classes of non-finite value:

-   `+Infinity`
-   `-Infinity`
-   `NaN` (Not-a-Number)

Ordinary arithmetic produces these: dividing by zero, overflowing the finite range, or evaluating an indeterminate form such as `Inf - Inf` or `0 * Inf`. They are not error states. They are values, and they propagate through later computation by rules the standard fixes.

### Source-level literals

Each has a dedicated literal, capitalized to match Morloc’s other keyword-like values (`True`, `False`, `Null`):

```morloc
posInf :: Real
posInf = Inf

negInf :: Real
negInf = -Inf

notANumber :: Real
notANumber = NaN
```

`-Inf` lexes as a single atomic token, the same way `-1.5` is one token rather than `negate 1.5`, so it works in pure-Morloc contexts where `negate` is not in scope. The same holds for `-NaN`, though the sign of a NaN collapses at the wire boundary: both `NaN` and `-NaN` come back as the canonical `nan`.

### Arithmetic on non-finite values

All three target languages follow IEEE 754 here, so these results do not depend on which pool the computation lands in. Every row below was run:

| Expression | Result | Why |
| --- | --- | --- |
| `Inf + Inf` | `Inf` | Same-sign infinity addition |
| `Inf + (-Inf)` | `NaN` | **Invalid op**: opposite-sign cancellation |
| `Inf - Inf` | `NaN` | **Invalid op**: same-sign cancellation |
| `Inf * 0.0` | `NaN` | **Invalid op**: zero times infinity |
| `Inf * 2.0` | `Inf` | Magnitude preservation |
| `Inf * (-1.0)` | `-Inf` | Sign rule on multiplication |
| `Inf * Inf` | `Inf` | Like-sign product |
| `Inf * (-Inf)` | `-Inf` | Mixed-sign product |
| `NaN + finite` | `NaN` | NaN absorption (additive) |
| `NaN * 0.0` | `NaN` | NaN beats zero |
| `NaN * Inf` | `NaN` | NaN beats infinity |
| `negate Inf` | `-Inf` | Sign-bit flip |
| `negate NaN` | `NaN` | Sign flip stays NaN |

## 4.5.3. Compile-time literal overflow

A real literal is bounds-checked against the precision it is written into. As with integer literals, the check runs during code generation, so `typecheck` passes and `make` rejects it.

For `Real` and `F64`, the maximum magnitude is about 1.8e308:

```morloc
tooBig :: Real
tooBig = 1e500
```

```console
$ morloc make fbig.loc
fbig.loc:6:10: error:
Float literal 1.0e500 overflows F64 (|x| > 1.8e308)
  |
6 | tooBig = 1e500
  |          ^
```

The check is per-precision, so a literal that fits `F64` can still overflow `F32` (maximum magnitude about 3.4e38):

```morloc
tooBigF32 :: F32
tooBigF32 = 1e100
```

```console
$ morloc make fbig32.loc
fbig32.loc:6:13: error:
Float literal 1.0e100 overflows F32 (|x| > 3.4e38)
  |
6 | tooBigF32 = 1e100
  |             ^
```

Negative literals are checked symmetrically:

```console
$ morloc make fneg.loc
fneg.loc:6:10: error:
Float literal -1.0e500 overflows F64 (|x| > 1.8e308)
  |
6 | tooNeg = -1e500
  |          ^
```

`Inf`, `-Inf`, and `NaN` bypass the bounds check by construction. They are explicit non-finite values, not finite literals that happened to overflow.

## 4.5.4. Wire format and JSON interop

The JSON wire format is RFC 8259 compliant, and standard JSON has no syntax for non-finite numbers. The specification’s recommended workaround is strings, so Morloc emits them as quoted lowercase strings:

| Value | JSON form |
| --- | --- |
| `+Inf` | `"inf"` |
| `-Inf` | `"-inf"` |
| `NaN` | `"nan"` |
| Finite `x` | The numeric form (`3.14`, `4.2e16`, and so on) |

You can see this in the output of the literals above:

```console
$ ./floats posInf
"inf"
$ ./floats negInf
"-inf"
$ ./floats notANumber
"nan"
```

So a `Real`\-typed field can arrive as either a JSON number or a JSON string. Consumers need to accept both.

Internal cross-language boundaries do not use JSON. Morloc-to-pool calls use a binary format that preserves IEEE 754 bytes verbatim, so non-finite values round-trip with no loss. Only the JSON boundary — usually the program’s final output — uses the string form.

> **Warning: Cross-language gotcha: division by zero in Python**
> The three languages agree on IEEE 754 **arithmetic**, but they disagree on one point of language **design**: Python raises `ZeroDivisionError` on `1.0 / 0.0`, where C++ and R produce `+Inf`.
> 
> That difference is visible from inside Morloc. `idpy` and `idcpp` pin a computation to one pool:
> 
> ```morloc
> pyDiv :: Real -> Real -> Real
> pyDiv x y = idpy (x / y)
> 
> cppDiv :: Real -> Real -> Real
> cppDiv x y = idcpp (x / y)
> ```
> 
> ```console
> $ ./divzero pyDiv 1.0 0.0
> Error: run failed
> float division by zero
>   at pyDiv [py] (mid=1, divzero.loc:1:17)
> $ ./divzero cppDiv 1.0 0.0
> "inf"
> ```
> 
> If a program depends on `1.0 / 0.0` giving `+Inf`, that expression must not run in a Python pool. Constructing infinity directly with the `Inf` literal avoids the question entirely.

## 4.5.5. F32 precision considerations

`F32` halves memory against `F64`, which matters for large numerical arrays — tensors, image buffers, GPU input — where the extra precision is not needed. The tradeoffs:

-   The significand carries about 7 decimal digits of precision, against about
    
    **15 to 17 for `F64`. A literal such as \`0.1**
    
    F32\` rounds to the nearest representable binary32 value; it is not exact.
    
-   Maximum magnitude is about 3.4e38, against 1.8e308 for `F64`. The compile-time bounds check enforces this for literals.
-   All `F32` arithmetic runs at single precision, including the overflow-to-infinity threshold.

For most application code `Real` is the right default. Reach for `F32` deliberately, when memory or single-precision hardware demands it.

## 4.5.6. Converting to and from floating point

The `TotalInto` and `PartialInto` classes from [Integer types](https://morloc-project.github.io/docs/features/integers.md) extend to floats. `into` covers the conversions that cannot fail: widening an integer whose full range fits the target mantissa (24 bits for `F32`, 53 for `F64`), `F32` to `F64`, and `Real` to and from `F64` in both directions — they are representationally identical in every current backend.

Integer-to-float conversions that may lose precision get their own class:

```morloc
class RealLike a where
  toReal :: a -> Real
```

`toReal` never fails but can lose precision above 2^53. Every numeric type has an instance. The canonical use is a mean:

```morloc
mean :: [Real] -> Real
mean xs = sum xs / toReal (size xs)
```

```console
$ ./floats mean '[1,2,3,4]'
2.5
```

`size` returns `U64` and `toReal` bridges it into the `Real` denominator. The precision loss is theoretical at any realistic container size, but naming it keeps the lossy step visible.

Float-to-integer conversion goes through `tryInto`, which raises rather than returning a value it cannot represent. It fails on `NaN`, on `Inf`, on non-integer values, and on values outside the target integer’s range:

```morloc
approx :: Real -> I32
approx x = tryInto x
```

```console
$ ./floats approx 3.0
3
$ ./floats approx 3.5
Error: run failed
cannot convert non-integer float 3.5 to integer
  at approx [py] (mid=8, floats.loc:1:75)
$ ./floats approx 1e20
Error: run failed
value 100000000000000000000 out of range [-2147483648, 2147483647]
  at approx [py] (mid=8, floats.loc:1:75)
```

To round to a nearby integer instead of failing, apply `round`, `floor`, `ceil`, or `trunc` from the `math` module first, then `tryInto` the result.

Narrowing `F64` to `F32`, and `Real` to `F32`, are deliberately **not** provided as `TotalInto` instances — they lose precision on every input. If you need one, source an explicit foreign function, so the lossy step is visible at the call site.

## 4.5.7. Negation of Real values

Negation works on `Real`, `F32`, and `F64` exactly as it does on integers, via the `Negatable` typeclass; see [Integer types](https://morloc-project.github.io/docs/features/integers.md) for the full unary-minus rules. Three IEEE 754 specifics:

-   `-Inf` and `-NaN` are atomic source literals. No `negate` lookup happens, so they work in pure-Morloc contexts.
-   `negate Inf` is `-Inf`, and `negate NaN` is `NaN` — the sign bit flips, but the value is still NaN.
-   `negate 0.0` is `-0.0`. The two compare equal under `==` but have different bit patterns. The binary cross-language format preserves the distinction; the JSON output does not.
