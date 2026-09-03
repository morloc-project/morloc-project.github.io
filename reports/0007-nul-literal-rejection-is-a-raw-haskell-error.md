# 0007: compile-time NUL rejection is a raw Haskell `error`, not a sourced diagnostic

- Status: fixed (87268b8e)
- Resolution: the check moved from the pure pool printer to the point where a
  string literal is bound to a pool language, which has the source position.
  What remains in the printer is a backstop that a user literal cannot reach.
- Found: 2026-09-02, testing `features-strings.asc`
- Component: compiler (CodeGenerator/Grammars/Translator/Generic.hs)
- morloc: 0.100.2     mim: 0.28.0

## Expected

Every other compile-time rejection in the manual is a sourced diagnostic with a
file, a line, a column, and a caret:

```
intbounds.loc:6:12: error:
Integer literal 1000 overflows U8 (range 0 to 255)
  |
6 | tooLarge = 1000
  |            ^
```

The NUL-in-a-literal check should look the same. The rule it enforces is
correct and its wording is genuinely helpful; only the delivery is wrong.

## Observed

```
$ morloc make nul3.loc
morloc: Embedded NUL byte in a Str literal destined for the "r" pool. The "r" language cannot represent NUL bytes in its native string type. Move the literal to a language that supports it (Python, C++, Julia, or the nexus itself), or remove the NUL byte. (See lang.yaml's allow_string_null field.)
CallStack (from HasCallStack):
  error, called at library/Morloc/CodeGenerator/Grammars/Translator/Generic.hs:1193:11 in morloc-0.100.2-K6dJR871PdK1IUXogtQzxg:Morloc.CodeGenerator.Grammars.Translator.Generic
```

Three problems:

1. It is thrown with `error`, so it prints the `morloc:` prefix, a `CallStack`,
   the compiler source path, and the package hash. To a user this reads as a
   compiler crash, not as a diagnosis of their program.
2. No source location for the offending literal. The message says "a Str
   literal" but not which one; in a module with many literals the user must hunt.
3. Exit status and formatting differ from every other build error, so tooling
   that parses morloc diagnostics will not recognise it.

## Reproduce

```morloc
module nul3 (rNul)

import root-py
import root-r

nulStr :: Str
nulStr = "ab\0cd"

rNul :: Str
rNul = idr nulStr
```

```
$ morloc make nul3.loc
```

For contrast, the same literal in a Python-only program builds and runs, with
the NUL preserved end to end and emitted as the standard JSON escape:

```
$ ./nul4 len
5
$ ./nul4 pyNul
"ab\u0000cd"
```

## Impact

Any user who puts a NUL in a literal that reaches an R pool sees what looks like
an internal compiler failure. The underlying check is a good one and deserves
the normal diagnostic path.

## Guess

Unverified: `Generic.hs:1193` calls `error` directly instead of going through
the `MorlocMonad` error machinery that carries source positions. The literal
position should be available there, since the translator walks typed, sourced
expressions.
