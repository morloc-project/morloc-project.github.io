# Morloc knowledge added by chapter 5 (features-integers)

## Integer literals

- Decimal, hex (`0x...`, case-insensitive), octal (`0o...` or `0O...`),
  binary (`0b...`) all lex to `Int`.
- Malformed digit-in-base (e.g. `0xF0OD`) is a lex error with location:
  `<expr>:1:1: malformed hexadecimal literal: 0xF0OD`.
- `morloc eval -e "<expr>"` runs a single expression. Prefixing the
  expression with `-` (e.g. `morloc eval -e "-0xff"`) fails because the
  option parser eats the dash: `Invalid option '-0xff'`. Use `-e=-0xff` or
  wrap in parentheses.

## Integer types

- `Int` — variable-width by wire format. In-language range depends on the
  host language (`int` in Python is arbitrary; `int` in C++ and `integer`
  in R are 32-bit signed).
- Fixed-width: `Int8`, `Int16`, `Int32`, `Int64`, `UInt8`, `UInt16`,
  `UInt32`, `UInt64`. All type-check. Doc's fixed-width mapping table is
  accurate.
- Compile-time bounds check on integer literals against the target type is
  real: `tooLarge :: UInt8; tooLarge = 1000` errors with
  `Integer literal 1000 overflows UInt8 (range 0 to 255)` and a caret at
  the literal.

## Big integers / cross-language overflow

- `fact 100` in a pure-Python (`import root-py`) module returns the exact
  158-digit factorial. `Int` really is arbitrary-precision *inside a Python
  pool*.
- Sending a big integer across a language boundary raises an "Integer
  overflow: N-limb integer (M bits) does not fit in ..." error, message
  originating at the C runtime.
- Force a value to live in Python with `idpy :: a -> a` (in `root-py`);
  same trick with `idcpp` / `idr` for the other languages.

## KNOWN COMPILER BUG (do not trust in later chapters)

Integer literals in a `Real` context are NOT converted. `x :: Real; x = 255`
compiles silently but yields ≈ 1.26e-321 at runtime (255 reinterpreted as
the raw bytes of a double). Negative form yields `"nan"`. Applies to plain
decimal, hex, and octal literals. Impact:

- Any doc example that puts an integer literal (esp. hex like `-0xff`) into
  a `Real` position is broken at runtime.
- Downstream Real-typed examples should use fractional literals (`255.0`,
  `-255.0`) exclusively.

## Negation / unary minus

- `-x` desugars to `negate x` (`class Negatable a where negate :: a -> a`,
  defined in `internal/main.loc:10-11`).
- `Negatable` instances for every numeric primitive in `root-py`, `root-cpp`,
  and `root-r`.
- Asymmetric-whitespace rule (verified):
  - `f -1` = `f (-1)` (negative literal argument)
  - `f - 1` = `f - 1` (binary subtraction; will type-error if `f` is a
    function)
  - `5-1` = `4` (binary subtraction, no whitespace)
  - `1 + -2` = `-1` (`-2` is a literal)
  - `-(3 + 1)` = `-4`
- Two adjacent prefix dashes (`- -x`) are a parse error; wrap the inner
  with parens (`-(-x)`) instead. Confirmed:
  `main.loc:4:11: unexpected '-' ...`.
- Negative-literal parsing works inside lists `[-1, -2, -3]`, tuples
  `(-3, -4)`, and pure-data files.

## Nexus quirks reinforced

- `Real` value `-255.0` prints as `-255` (no trailing `.0`). Not
  Real-specific — nexus JSON prints ints when the value is a whole double.
- `morloc make -o <name>` renames the output executable. First place this
  chapter uses it; earlier chapters relied on the module-name default.

## Downstream tips

- When exercising later chapters that put integer-looking literals into
  Real contexts, always write them with a decimal (`2.0`, `-1.5`).
- If a chapter demonstrates R-side behavior via `idr`, be ready for the
  actual error to be wrapped in an R traceback with a stray
  `rmorloc.c:1022` path leak.
- The compiler source tree the harness expected
  (`/home/z/projects/morloc-core/compiler/morloc`) is NOT on this host. For
  compiler cross-checks, use the installed stdlib on the VM
  (`/opt/morloc/src/morloc/plane/default/<module>/main.loc`) via
  `morloc-manager run -- cat ...`. That is enough for stdlib-level checks;
  it does not help with parser/typechecker source questions.
