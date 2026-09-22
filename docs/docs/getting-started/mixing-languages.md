# 3.5. Mixing languages in one program

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/mixing-languages.html | prev: https://morloc-project.github.io/docs/getting-started/abstract-modules.md | next: https://morloc-project.github.io/docs/getting-started/parallelism.md

Morloc composes across languages freely, and that includes passing functions across the boundary. Here is a Python function that takes a temperature and a conversion **function**:

**format.py**

```python
def report(ctemp, c2f):
  return f"The current temperature is {ctemp}C ({c2f(ctemp)}F)"
```

We can hand it the C++ `cels2fahr` from earlier:

**report.loc**

```morloc
module report (report)

import root-py
import root-cpp

source Py from "format.py" ("report" as report_wrapper)
report_wrapper :: Real -> (Real -> Real) -> Str

source Cpp from "units.hpp" ("cels2fahr")
cels2fahr :: Real -> Real

--' Write a cute string about the temperature
report t = report_wrapper t cels2fahr
```

The `as` keyword renames an imported term, which lets the sourced Python function and the exported Morloc term share a concept without colliding.

```console
$ morloc make report.loc
$ ./report report 21
"The current temperature is 21.0C (69.80000000000001F)"
```

A Python function called a C++ function, and you wrote no binding code. All of the interop — serializing the argument, starting both pools, passing a callable reference across the process boundary — is generated. [Build Architecture](https://morloc-project.github.io/docs/internals/index.md) covers how.
