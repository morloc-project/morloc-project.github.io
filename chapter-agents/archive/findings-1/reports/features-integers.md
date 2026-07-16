# features-integers.asc — findings

Chapter fetched from GitHub master (no local docs source on host/VM). Compiler
tested: morloc 0.93.0 (image `ghcr.io/morloc-project/morloc/morloc-full:edge`).
The compiler source tree referenced in the shared context
(`/home/z/projects/morloc-core/compiler/morloc`) does not exist on this host;
grepping was done against the installed stdlib on the VM
(`/opt/morloc/src/morloc/plane/default/...`) instead. Reported and worked
around.

Legend: **blocker** / **confusing** / **minor**.

---

## Findings


### 2. `factR` example uses an undefined command — **blocker**

`features-integers.asc :: Cross-language overflow errors`, second console
block (lines 168-175):

```
$ ./calc factR 100
Error: run failed
Integer overflow: 9-limb integer (576 bits) does not fit in
R's numeric type (max 2^53 for integer precision).
Use a fixed-width type (Int32, Int64) or keep computation in Python.
```

The morloc module immediately above the console (lines 129-145) defines only
`factCpp`; there is no `factR`, no `import root-r`, no `idr`. A reader
following the chapter verbatim gets:

```
$ ./calc factR 100
Command 'factR' not found. Available: factCpp
```

I completed the example with the smallest edit — added `import root-r` and
`factR x = idr (factPy x)`. It builds and produces an R-side error. But the
actual error message is not what the docs show:

```
Error: run failed
Error in morloc_get_value(s2, mlc_schema_table[[1]]) :
  Error in R pool (/opt/morloc/include/rmorloc.c:1022 in from_voidstar_inner):Integer overflow: 9-limb integer (576 bits) does not fit in R's numeric type (max 2^53 for integer precision).
Calls: <Anonymous> -> morloc_idr -> m2814 -> morloc_get_value -> .Call
```

Differences from the doc:

- The trailing hint `"Use a fixed-width type (Int32, Int64) or keep
  computation in Python."` is NOT emitted by 0.93.0.
- The message is wrapped in an R traceback (`Error in morloc_get_value ...`,
  `Calls: ...`) rather than a clean two-line output.
- A stray file path (`rmorloc.c:1022 in from_voidstar_inner`) leaks into the
  message with no space after the colon.

Reader impact: the code doesn't run at all as printed, and once completed,
the "expected" error is presented as canonical when it isn't. Recommend
either (a) including the `factR` binding in the sample and updating the
expected error to match runtime, or (b) reworking the R runtime so its error
matches the C++ shape.

### 3. `morloc eval -e "-…"` fails on any negative literal — **confusing**

`features-integers.asc :: Integer types`, opening console block (lines
27-34). The docs use `morloc eval -e "0xF00D"` and `morloc eval -e "0b1001"`.
A first-time reader who tries the negation section with `eval` gets:

```
$ morloc-manager run -- morloc eval -e "-0xff"
Invalid option `-0xff'.
```

The wrapping parser treats a leading `-` as a flag. The workaround
(`-e=-0xff` or `-e "(-0xff)"`) works but isn't documented anywhere in the
chapter. Worth a one-line note in the eval example or in the negative-literal
section.

### 4. `Int` in Python advertised as arbitrary precision, but is capped by cross-language boundary — **confusing**

`features-integers.asc :: The default Int type`, table on lines 69-76 says:

| Python | `int` | Arbitrary precision |

Then the same section (lines 78-80) says a program that needs values above
32 bits in C++ or R should use `Int64`. This is technically consistent but
the reader has to piece it together. The table would benefit from an
explicit column footnote: "arbitrary-precision only while the value stays
in the Python pool; sending it into C++/R triggers the overflow error shown
below."

### 5. `Int` type description conflicts with wire-format claim — **confusing**

`features-integers.asc :: The default Int type`, lines 64-66:

> The on-wire representation is variable-width: values up to 64 bits fit in
> 16 bytes inline, and larger values spill to a pointer to an array of 64-bit
> limbs.

This is a low-level implementation detail (limb encoding, inline vs pointer)
dropped without warning into a chapter that has otherwise stayed at the user
level. It doesn't help the reader use `Int` and it invites questions
("what's a limb?"). Consider moving to a future serialization chapter, or
prefixing with "advanced: ".

### 6. UInt8 overflow error uses column-12 caret, but example has no module header — **minor**

`features-integers.asc :: Compile-time literal bounds`, expected error (lines
197-204):

```
main.loc:2:12: error:
Integer literal 1000 overflows UInt8 (range 0 to 255)
```

The morloc snippet above it is:

```
tooLarge :: UInt8
tooLarge = 1000
```

Only two lines, no `module main (tooLarge)`. If the reader adds a module
header (which they must — a fresh `.loc` file without `module` errors), the
line reported by `morloc make` shifts to `main.loc:4:12`. The caret column
still matches. Recommend adding `module main (tooLarge)` to the snippet, or
telling the reader to keep it as-is (bare) and to expect the shifted line
number if they add a header.

### 7. Big-int factorial example missing `-o calc` explanation — **minor**

`features-integers.asc :: Big integers from Python`, console (line 111):

```
$ morloc make -o calc main.loc
$ ./calc fact 100
```

Previous chapters have said the executable is named after the module (so it
would be `./main` here). This is the first place `-o <name>` appears without
any mention that it renames the executable. Add a one-line "the `-o` flag
names the output executable" or use the module-name default (which would
require renaming the module).

### 8. R error path references `rmorloc.c` implementation detail — **minor**

Not strictly a doc issue but relevant to the doc's expected R output above.
See finding 2.

### 9. Table for Python fixed-width mapping: all types are `int` — **minor**

`features-integers.asc :: Fixed-width integer types`, table lines 216-228,
lists Python column as `int` for every fixed-width type. That's accurate,
but the note underneath is somewhat buried (starts with "You might wonder
why..."). The reader who wants numpy has to page down to "Type Hierarchies"
which the chapter doesn't cross-link.

---

## What passed

- Every hex/octal/binary integer literal example (`0xf00d`, `0xDEADBEEF`,
  `0o755`, `0b0101`, `0xF0OD` malformed error) matched the docs exactly.
- Factorial 100 in Python matched the doc byte-for-byte.
- C++ overflow error (`factCpp 100`) matched the docs byte-for-byte.
- `tooLarge = 1000 :: UInt8` compile-time bounds error message body matched
  (only the line-number caret shifted, per finding 6).
- All negation examples (`neg`, `shifted`, `flipReal`, `neg1`..`neg4`,
  `double`, explicit `negate`) built and ran to correct values.
- Two-adjacent-prefix-dash rejection (`bad x = - -x`) errors at parse time as
  claimed.
- Asymmetric whitespace: `f -1` = `f (-1)` = call with negative literal (got
  99 for `f x = x + 100`); `5-1` = 4 (binary subtraction); `1 + -2` = -1;
  `-(3 + 1)` = -4. Matches the table on lines 301-313.
- All eight fixed-width type signatures type-check.
- `Negatable` class defined at `/opt/morloc/src/morloc/plane/default/internal/main.loc:10`:
  ```
  class Negatable a where
    negate :: a -> a
  ```
  Instances present in each of `root-cpp/main.loc:113-125`,
  `root-py/main.loc:107-120`, `root-r/main.loc:122-135`, exactly as the doc
  describes.
