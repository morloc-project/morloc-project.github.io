# 0065: `morloc make` prints internal build commands and provisioning chatter at default verbosity

- Status: not-a-bug
- Found: 2026-09-06, re-verifying the Getting Started chapter against 0.101.0
- Component: compiler
- morloc: 0.101.0     mim: 0.28.0 (source 0.29.0)

## Expected

A successful build is quiet, or says something a user can act on. `morloc make`
has no `-q`, so whatever it prints at default verbosity is what every user sees
on every build, including the first build in the manual.

## Observed

Building the manual's second example, a two-function C++ module
(`src/content/getting-started.asc:403`):

```
$ morloc make units.loc
Provisioning environment dependencies (/opt/morloc-runtime/mim sync)...
Environment dependencies synced for 'units'.
$ ${CXX:-g++} -O2 -o pools/cpp/pool-cpp.out pools/cpp/pool.cpp pools/cpp/pool_host.cpp -std=c++20 -include morloc_pch.hpp -I/opt/morloc/include -I/opt/morloc-state/modules/include -L/opt/morloc/lib -L/opt/morloc-state/modules/lib -lmorloc -lcppmorloc -lpthread -I. -I/tmp/.../scratchpad/gs


```

Three separate problems in one transcript:

1. The C++ compile line is echoed verbatim, including absolute install paths.
   It is one 300-character line that wraps to five terminal rows.
2. The provisioning lines name the hook by absolute path
   (`/opt/morloc-runtime/mim`), which is an implementation detail of how the
   environment was built.
3. Two blank lines follow the compile line -- the captured `stderr` of a
   successful compile, `tell`-ed and then printed.

None of it is gated on verbosity. `morloc make` accepts `-v` to raise
verbosity but has no flag to lower it, so there is no way to get a quiet build.

## Reproduce

Any module that sources C++, in a managed environment:

```
$ cat > units.hpp <<'H'
#pragma once
double cels2fahr(double cels){ return 1.8 * cels + 32.0; }
H
$ cat > units.loc <<'L'
module units (cels2fahr)
source Cpp from "units.hpp" ("cels2fahr")
type Cpp => Real = "double"
cels2fahr :: Real -> Real
L
$ morloc make units.loc
```

## Impact

Every C++ build. It is the first output a new user sees after their
"Hello World", and it looks like a build system leaking rather than a compiler
reporting. It also makes the manual's build transcripts unshowable as-is: the
Getting Started chapter shows `$ morloc make units.loc` with no output, which
is not what happens.

## Guess

Unverified. `Morloc.Monad.runCommand` and `runCommandWith` both open with an
unconditional `hPutStrLn stderr ("$ " <> cmd)` (`library/Morloc/Monad.hs:375`
and `:417`) rather than `sayVV`. The provisioning lines are `MM.say`
(`library/Morloc/ProgramBuilder/Build.hs:172`), which is `sayIf 0`.

## Resolution

Not a bug. Compilers print what they run, and a user who wants the build quiet
can redirect. Chasing byte-for-byte agreement between the manual and a `g++`
invocation full of absolute install paths is a game with no end and no payoff,
so the manual should not try.

What the manual does instead: transcripts show the command and its result, not
the build log. `src/content/getting-started.asc` carries no elision markers and
no paragraph explaining the noise -- the noise is unremarkable and pointing at
it would only invite alarm.

The three observations in the report stand as descriptions of what a build
prints. None of them is a defect, and no flag to silence them is wanted.
