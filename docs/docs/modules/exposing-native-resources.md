# 7.3. Exposing native resources

Morloc Manual > Modules and Libraries | https://morloc-project.github.io/docs/modules/exposing-native-resources.html | prev: https://morloc-project.github.io/docs/modules/universal-library.md | next: https://morloc-project.github.io/docs/modules/data-transfer.md

A module’s `package.yaml` can link against shared libraries through its `cpp-deps` and `cxx-flags` fields ([Configuring the C++ build](https://morloc-project.github.io/docs/modules/installing-modules.md#configuring-cpp-build)). The `expose` field handles a different need: a module that defines a C++ struct, a Python class, or an R helper whose definition downstream foreign code needs to `#include` (or `import`, or `source`) by name. On install, listed files are copied to per-language well-known paths under `$MORLOC_HOME`, namespaced by module name. Downstream code then refers to them through a stable path that is the same for every consumer.

```yaml
expose:
  cpp: [person.hpp]
  py:  [__init__.py, helpers/]
  r:   [util.R]
```

Each key is optional. Paths are relative to the module root; glob patterns ( **within a segment,** `*` across segments, trailing `/` for a directory) follow the same syntax as `include`. Subtree structure is preserved on copy — essential for Python packages with `*init*.py` markers and for C++ headers that `#include` siblings by relative path.

| Language | Destination | Consumer code |
| --- | --- | --- |
| C++ | `$MORLOC_STATE/modules/include/<lib>/<module>/...` | `#include "<lib>/<module>/foo.hpp"` |
| Python | `$MORLOC_STATE/modules/python/mlc_lib/<lib>/<py_module>/...` | `import mlc_lib.<lib>.<py_module>.foo` |
| R | `$MORLOC_STATE/modules/R/<lib>/<module>/...` | `.morloc.source("<lib>/<module>/foo.R")` |

`<lib>` is the module’s library: `std` for the standard library (`#include "std/tensor-cpp/tensor.hpp"`). For Python, hyphens in the library and module names are converted to underscores so the destination is a legal Python identifier (a module `tensor-cpp` becomes `tensor_cpp`). The C++ subtree `$MORLOC_STATE/modules/include` is already on every C++ pool’s `-I` path, so no compile flags need tweaking; consumers write the namespaced `#include`. `morloc uninstall` symmetrically removes the exposed copies alongside the install dir.

A worked example. The `people` module declares a Morloc type backed by a C++ struct and exposes the header that defines it:

**people/main.loc**

```morloc
module people (Person, makePerson)

import root-cpp

record Person where
  name :: Str
  age :: Int
record Cpp => Person = "person_t"

source Cpp from "person.hpp" ("make_person" as makePerson)

makePerson :: Str -> Int -> Person
```

**people/package.yaml**

```yaml
name: people
library: weena
version: 0.1.0
expose:
  cpp: [person.hpp]
```

**people/person.hpp**

```cpp
#ifndef PEOPLE_PERSON_HPP
#define PEOPLE_PERSON_HPP

#include <string>

struct person_t {
    std::string name;
    int age;
};

inline person_t make_person(const std::string& name, int age) {
    return person_t{name, age};
}

#endif
```

Install with `morloc install ./people`. The exposed header now lives at `$MORLOC_STATE/modules/include/weena/people/person.hpp`, under the module’s library and name. A downstream program imports the Morloc type and uses the underlying C++ struct directly in its own foreign code:

**main.loc**

```morloc
module main (greeting)

import weena/people (Person, makePerson)
import root-cpp

source Cpp from "src.hpp" ("greet")

greet :: Person -> Str

greeting :: Str
greeting = greet (makePerson "Alice" 30)
```

**src.hpp**

```cpp
#include "weena/people/person.hpp"
#include <string>

inline std::string greet(const person_t& p) {
    return "Hello, " + p.name + "! Age " + std::to_string(p.age);
}
```

The same exposed header is discoverable from non-Morloc C++ programs too: compile with `g++ -I$MORLOC_STATE/modules/include` and `#include "weena/people/person.hpp"` works identically.
