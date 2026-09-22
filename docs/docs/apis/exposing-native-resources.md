# 7.2. Exposing native resources

Morloc Manual > Building APIs | https://morloc-project.github.io/docs/apis/exposing-native-resources.html | prev: https://morloc-project.github.io/docs/apis/search-and-install.md | next: https://morloc-project.github.io/docs/apis/data-transfer.md

The `dependencies` field links against shared libraries. The `expose` field handles a different need: a module that defines a C++ struct, a Python class, or an R helper whose definition downstream foreign code needs to `#include` (or `import`, or `source`) by name. On install, listed files are copied to per-language well-known paths under `$MORLOC_HOME`, namespaced by module name. Downstream code then refers to them through a stable path that is the same for every consumer.

```yaml
expose:
  cpp: [person.hpp]
  py:  [__init__.py, helpers/]
  r:   [util.R]
```

Each key is optional. Paths are relative to the module root; glob patterns ( **within a segment,** `*` across segments, trailing `/` for a directory) follow the same syntax as `include`. Subtree structure is preserved on copy — essential for Python packages with `*init*.py` markers and for C++ headers that `#include` siblings by relative path.

| Language | Destination | Consumer code |
| --- | --- | --- |
| C++ | `$MORLOC_HOME/include/<module>/...` | `#include "<module>/foo.hpp"` |
| Python | `$MORLOC_HOME/lib/python/<py_module>/...` | `import <py_module>.foo` |
| R | `$MORLOC_HOME/lib/R/<module>/...` | `.morloc.source("<module>/foo.R")` |

For Python, hyphens in the module name are converted to underscores so the destination is a legal Python identifier (a module `tensor-cpp` becomes `tensor_cpp`). The C subtree \`$MORLOC\_HOME/include\` is already on every C pool’s `-I` path, so no compile flags need tweaking; consumers just write the namespaced `#include`. `morloc uninstall` symmetrically removes the exposed copies alongside the install dir.

A worked example. The `people` module declares a Morloc type backed by a C++ struct and exposes the header that defines it:

**people/main.loc**

```morloc
module people (Person, makePerson)

import root-cpp

type Cpp => Person = "person_t"

source Cpp from "person.hpp" ("make_person" as makePerson)

makePerson :: Str -> Int -> Person
```

**people/package.yaml**

```yaml
name: people
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

Install with `morloc install ./people`. The exposed header now lives at `$MORLOC_HOME/include/people/person.hpp`. A downstream program imports the Morloc type and uses the underlying C++ struct directly in its own foreign code:

**main.loc**

```morloc
module main (greeting)

import people (Person, makePerson)
import root-cpp

source Cpp from "src.hpp" ("greet")

greet :: Person -> Str

greeting :: Str
greeting = greet (makePerson "Alice" 30)
```

**src.hpp**

```cpp
#include "people/person.hpp"
#include <string>

inline std::string greet(const person_t& p) {
    return "Hello, " + p.name + "! Age " + std::to_string(p.age);
}
```

The same exposed header is discoverable from non-Morloc C programs too: compile with \`g -I$MORLOC\_HOME/include\` and `#include "people/person.hpp"` works identically.
