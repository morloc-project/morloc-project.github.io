# 3.4. Writing code that is not tied to a language

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/abstract-modules.html | prev: https://morloc-project.github.io/docs/getting-started/sourcing.md | next: https://morloc-project.github.io/docs/getting-started/mixing-languages.md

Sourcing C++ works, but it pins these conversions to C++. Anyone who wants them from Python has to make a foreign call for arithmetic. Morloc lets you write the definition once, in no language at all:

**units-abstract.loc**

```morloc
module unitsAbstract (cels2fahr, meters2feet)

import root

--' Convert from Celsius to Fahrenheit
cels2fahr cels = 1.8 * cels + 32.0

--' Convert from meters to feet
meters2feet meters = meters * 3.28084
```

`root` is a language-independent module from the standard library. It declares the typeclasses for arithmetic and much else, but supplies no implementations. So `+` and `*` here are general operations with no code behind them yet.

This is the first module the manual imports, and you do not have to install it. `morloc make` fetches any missing import, and that module’s own imports, before it builds:

```console
$ morloc make units-abstract.loc
Auto-installing missing dependency: root
Fetching module 'root'...
Fetching module 'internal'...
Installed module 'internal'
Installed module 'root'
units-abstract.loc:6:29: error:
No implementation found for '+'
  |
6 | cels2fahr cels = 1.8 * cels + 32.0
  |                             ^
```

The install worked. The build did not, and that error is worth sitting with, because it is the shape of Morloc’s central idea.

Nothing is wrong with the module. Now that `root` is on disk you can ask the compiler directly, and it types both terms without complaint:

```console
$ morloc typecheck units-abstract.loc
cels2fahr :: Real -> Real
meters2feet :: Real -> Real
```

> **Note**
> Only the build commands fetch, which is why this section built before it typechecked. `typecheck`, `dump` and `eval` read what is already on disk and never reach the network, so on a fresh environment they fail on an import you have never built. Build it once, or run `morloc install root` by hand. Pass `--offline` to `morloc make` when you want the fetching off.

So the module is complete as a **specification** and empty as a **program**: there is nothing wrong to fix, there is only code missing. To get a program, import a module that carries implementations:

**convert.loc**

```morloc
module convert (cels2fahr, meters2feet)

import .units-abstract
import root-cpp
```

The leading `.` in `.units-abstract` marks a local file rather than an installed module. `root-cpp` holds the C++ implementations of \`root’s terms — here, just the arithmetic operators.

```console
$ morloc make convert.loc
$ ./convert cels2fahr 100
212
```

Same answer as the sourced-C++ version, from a definition that never mentioned C++. The build directory says which language it ended up in:

```console
$ ls convert-build/pools/
cpp
```

And that is the one line you change. Edit `convert.loc` to `import root-py`, rebuild, and the same abstract module compiles to Python:

```console
$ ls convert-build/pools/
py
$ ./convert cels2fahr 100
212
```

You can import both and let the compiler decide which implementations to use. How it chooses is [One term may have many definitions](https://morloc-project.github.io/docs/types/term-polymorphism.md).
