# 3.3. Sourcing a foreign function

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/sourcing.html | prev: https://morloc-project.github.io/docs/getting-started/first-program.md | next: https://morloc-project.github.io/docs/getting-started/abstract-modules.md

A Morloc module on its own has no implementations. Real work comes from functions imported out of other languages. Let’s write two unit conversions in C++:

**units.hpp**

```cpp
#pragma once

double cels2fahr(double cels){
  return 1.8 * cels + 32.0;
}

double meters2feet(double meters){
  return meters * 3.28084;
}
```

This is ordinary C++. It includes no Morloc headers and knows nothing about Morloc — that is the point. Now source it:

**units.loc**

```morloc
module units (cels2fahr, meters2feet)

source Cpp from "units.hpp" ("cels2fahr", "meters2feet")

type Cpp => Real = "double"

--' Convert from Celsius to Fahrenheit
cels2fahr :: Real -> Real

--' Convert from meters to feet
meters2feet :: Real -> Real
```

Reading it line by line:

-   `source Cpp from "units.hpp" (…​)` pulls two names out of a C++ header. The language tag `Cpp` tells the compiler which toolchain and which pool the functions belong to.
-   `type Cpp ⇒ Real = "double"` maps the general Morloc type `Real` onto the concrete C++ type `double`. Morloc types are language-neutral; this is how you say what one becomes in a particular language.
-   `cels2fahr :: Real → Real` is the general type signature. Morloc checks calls against this, not against the C++ declaration.

Compile and run it:

```console
$ morloc make units.loc
$ ./units cels2fahr 100
212
```

The generated interface lists both exported commands, with the docstrings you wrote:

```console
$ ./units -h
Usage: ./units <nexus_options> <command> <command_options>

Commands:
  cels2fahr    Convert from Celsius to Fahrenheit
  meters2feet  Convert from meters to feet

General Options:
  -h, --help  Print help; -hh adds details and examples, -hhh adds schemas
              (nexus options: -h @)
```

and each command has its own help, showing the types it derived:

```console
$ ./units cels2fahr -h
Convert from Celsius to Fahrenheit

Usage: ./units <nexus_options> cels2fahr <command_options>

General Options:
  -h, --help  Print help; -hh adds details and examples, -hhh adds schemas
              (nexus options: -h @)

Positional arguments:
  1:  type: Real

Return: Real
```
