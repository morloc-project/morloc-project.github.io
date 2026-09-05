# 0005: R pool overflow error is malformed and drops its remediation hint

- Status: fixed (e18a2021)
- Resolution: the R binder no longer prefixes user-attributable failures with
  the runtime source location, and the dispatcher normalizes R's rendered
  error buffer to the bare message. The R output now matches the C++ shape.
  The remediation sentence this report expected never existed in the runtime;
  the documentation was corrected instead.
- Found: 2026-09-02, testing `features-integers.asc` cross-language overflow
- Component: runtime (rmorloc / R pool error path)
- morloc: 0.100.2     mim: 0.28.0

## Expected

The {cpp} boundary produces a clean, actionable message:

```
Integer overflow: 9-limb integer (576 bits) does not fit in 32-bit type (range -2147483648 to 2147483647)
```

`features-integers.asc` documents the R equivalent as:

```
Integer overflow: 9-limb integer (576 bits) does not fit in
R's numeric type (max 2^53 for integer precision).
Use a fixed-width type (I32, I64) or keep computation in Python.
```

## Observed

```
Error: run failed
Error: Error in R pool (/opt/morloc/include/rmorloc.c:1070 in from_voidstar_inner):Integer overflow: 9-limb integer (576 bits) does not fit in R's numeric type (max 2^53 for integer precision).
  at _ [r] (mid=2815, main.loc:19:16)
  at factR [r] (mid=2, main.loc:1:23)
```

Four defects in one line:

1. `Error: Error in R pool` -- "Error" is emitted twice; the nexus adds its own
   prefix on top of one the R pool already added.
2. An internal build path leaks into user-facing output:
   `/opt/morloc/include/rmorloc.c:1070 in from_voidstar_inner`. That is a
   runtime-source location, meaningless to a user, and it also exposes the
   environment layout.
3. No space after the closing `):` -- the internal location runs straight into
   the message.
4. The remediation sentence ("Use a fixed-width type (I32, I64) or keep
   computation in Python.") is absent. The {cpp} path has no such sentence
   either, so the docs may be describing an older message; but the advice is
   the most useful part and is worth keeping.

Compare the {cpp} path, which has none of these problems.

## Reproduce

```morloc
module main (factCpp, factR)

import root-py
import root-cpp
import root-r

fact :: Int -> Int
fact n
  ? n == 0 = 1
  : n * fact (n - 1)

factPy :: Int -> Int
factPy n = idpy (fact n)

factCpp :: Int -> Int
factCpp x = idcpp (factPy x)

factR :: Int -> Int
factR x = idr (factPy x)
```

```
$ morloc make -o calc main.loc
$ ./calc factCpp 100     # clean error
$ ./calc factR 100       # malformed error
```

## Impact

Any R-boundary runtime error, not just overflow, presumably carries the same
double prefix and leaked internal path -- this is the shared R error wrapper,
so the blast radius is every R pool failure a user will ever see.

## Guess

Unverified: the R pool wraps its message with `Error in R pool (<file>:<line> in
<fn>):` and the nexus then prefixes `Error: `, while the {cpp} path passes the
bare message through. Making the R path emit the bare message (and keeping the
file/line only under a debug flag) would align the two.

## Resolution

Fixed in `morloc` commit `e18a2021`.

The R binder no longer decorates user-attributable failures with the C source
file, line, and function that raised them, and it no longer lets R prepend its
own `Error in .Call(...)` frame to a message morloc already wrote. An overflow
now reports the value, the target type, and the manifold that asked for the
conversion, and nothing else.
