# 3.9. Records

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/records.html | prev: https://morloc-project.github.io/docs/features/tuples-and-lists.md | next: https://morloc-project.github.io/docs/features/optionals.md

A record is a named, fixed set of named fields. It is the right shape when a tuple would leave you counting positions.

```morloc
record Person = Person
    { name :: Str
    , age :: Int
    }
```

The same declaration has a layout form, one field per indented line, which reads better for long records:

```morloc
record Person where
  name :: Str
  age :: Int
```

That declaration is all a record needs. Every language gets a native form of it without your saying anything: a `dict` in Python, a named `list` in R, and a `struct` the compiler writes for you in C++ and Rust. Internally the layout is positional, but the surface language always binds by name.

## 3.9.1. Native representations

The forms Morloc gives a record, and how code you source names it:

| Language | The record is | A sourced function names it as |
| --- | --- | --- |
| Python | a `dict` keyed by field name | a `dict`; nothing to import |
| R | a named `list` | a `list`; nothing to import |
| C++ | a generated `struct` with one member per field | `mlc::types::_local::recs::Person`, from `#include "mlc/types/_local/recs.hpp"` |
| Rust | a generated `struct` with one `pub` field per field | `crate::mlc::types::_local::recs::Person` |

The generated name follows the module that declares the record. `recs` is that module here, and `_local` marks it as one of your program’s own modules; a module of an installed package sits under its package’s name instead. The compiler writes the C++ header and the Rust module before it compiles your sources, so a source can include or `use` them like any other file.

**foo.hpp**

```cpp
#pragma once
#include "mlc/types/_local/recs.hpp"

using mlc::types::_local::recs::Person;

Person incAge(Person person){
    person.age++;
    return person;
}
```

**foo.rs**

```rust
use crate::mlc::types::_local::recs::Person;

pub fn inc_age(person: &Person) -> Person {
    Person { name: person.name.clone(), age: person.age + 1 }
}
```

The R and Python sides operate on their native containers directly. Each returns a changed copy rather than changing its argument; the C++ version gets its copy by taking the struct by value ([What sourced code may do with values](https://morloc-project.github.io/docs/features/foreign-functions.md#sourced-values)):

**foo.R**

```r
incAge <- function(person){
    person$age <- person$age + 1
    person
}
```

**foo.py**

```python
def incAge(person):
    return {**person, "age": person["age"] + 1}
```

### Python classes

In Python a record can instead be an instance of a class the compiler writes. You choose this with a **kind**, a bare word after the `=>`:

**people.loc**

```morloc
module people (older)

import root-py

record Person where
  name :: Str
  age :: Int

record Py => Person = dataclass

source Py from "older.py" ("incAge" as older)
older :: Person -> Person
```

`dataclass` gives a frozen, slotted dataclass, and `pydantic` a frozen pydantic model; `dict` is the default. Code written for the `dict` form keeps working, because a field can be read by subscript as well as by attribute. Since the instance is frozen, return a changed copy:

**older.py**

```python
import dataclasses

def incAge(person):
    print(type(person).__qualname__, person.name, person["age"])
    return dataclasses.replace(person, age=person.age + 1)
```

```console
$ ./people older '{"name":"Bob","age":40}'
Person Bob 40
{"name":"Bob","age":41}
```

A source that needs the class itself imports it from the generated package, here `from mlc_types._local.people import Person`. Only the package that declares a record may give it a class kind. A word the language does not define is an error that lists the ones it does:

```console
bad.loc:9:1: py has no record kind `pydantik`; its kinds are dataclass, dict, pydantic (a string names a type you write instead)
    |
  9 | record Py => Person = pydantik
    | ^
```

### Writing the type yourself

A quoted string after the `=>` names a type you write instead of the generated one. It is how you hand a record to an existing C++ or Rust type:

```morloc
record Cpp => Person = "person_t"
```

Field names and types still come from the general declaration, so they are not repeated. Your type must hold exactly the record’s fields, under the same names, because Morloc builds a value of it from those fields and nothing else. A type parameter that no field uses, a phantom like the `k` of `record Loc k where pos :: Int`, is best not passed to your type at all (`record Rust ⇒ Loc k = "LocT"`): Rust refuses a struct that does not use its parameter, and a marker field would be a field the record lacks.

Python has no such form yet. A record mapped to a Python class name you wrote is still passed as a `dict`; classes you write yourself are a planned feature.

The strings `"dict"`, `"list"`, `"struct"` and `"OrderedDict"` are older spellings of the default kinds. They still work, with a warning:

```console
warning: legacy.loc:9:1: "dict" is the old spelling of the py record kind `dict`; write `= dict` instead
```

### Recursive records

A record whose fields refer to the record itself needs no special treatment in Python or R. In C++ and Rust the generated type is a **handle**: a small value that shares an immutable struct of the fields, so that copying a tree copies one pointer. Read a field through `→` in C++; Rust’s handle dereferences to the fields:

```morloc
record Tree where
  label :: Str
  kids :: [Tree]
```

```cpp
inline int count(const Tree& t) {
    int n = 1;
    for (const auto& k : t->kids) n += count(k);
    return n;
}
```

```rust
pub fn count_rs(t: &Tree) -> i64 {
    1 + t.kids.iter().map(count_rs).sum::<i64>()
}
```

To build one, give the handle a struct of its fields: `Tree(Tree_fields{…​})` in C++, `Tree::new(TreeFields { …​ })` in Rust.

## 3.9.2. Record literals match by field name

Field values bind to declared fields by **name**. The order in a literal is irrelevant, so these two are the same value:

```morloc
alice :: Person
alice = { name = "Alice", age = 30 }

alice2 :: Person
alice2 = { age = 30, name = "Alice" }
```

```console
$ ./recs alice
{"name":"Alice","age":30}
$ ./recs alice2
{"name":"Alice","age":30}
```

A literal must mention every declared field exactly once. All three ways to get that wrong are compile-time errors. The examples below all come from a `recbad.loc` whose record is declared on one line:

```morloc
record Person = Person { name :: Str, age :: Int }
```

Missing a field:

```console
recbad.loc:8:8-25: error:
Record literal does not match declared type Person:
  missing field(s): age
  |
8 | bad1 = { name = "Alice" }
  |        ^~~~~~~~~~~~~~~~^
```

Naming a field the record does not have:

```console
recbad.loc:8:8-48: error:
Record literal does not match declared type Person:
  unknown field(s): weight
  |
8 | bad1 = { name = "Alice", age = 30, weight = 65 }
  |        ^~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~^
```

Repeating a field:

```console
recbad.loc:8:33: duplicate field in record literal: name
    |
  8 | bad1 = { name = "Alice", name = "Bob", age = 30 }
    |                                 ^
```

## 3.9.3. One record across three languages

Because the record has a native form in each language, a function that operates on it can be sourced from any of them, and they compose:

**recs.loc**

```morloc
module recs (foo, alice)

import root-r
import root-py
import root-cpp

record Person where
  name :: Str
  age :: Int

source R from "foo.R" ("incAge" as rinc)
source Py from "foo.py" ("incAge" as pinc)
source Cpp from "foo.hpp" ("incAge" as cinc)

rinc :: Person -> Person
pinc :: Person -> Person
cinc :: Person -> Person

foo :: Str -> Int -> Person
foo name age
    = (rinc . pinc . cinc)
      { name = name, age = age }

alice :: Person
alice = { name = "Alice", age = 30 }
```

`foo` builds a `Person` and then increments its age three times, once in each language, passing the record across two process boundaries on the way. The sources are the `foo.R`, the first `foo.py` and the `foo.hpp` shown above:

```console
$ ./recs foo Bob 40
{"name":"Bob","age":43}
```

Nothing in `foo.R`, `foo.py`, or `foo.hpp` knows the others exist. Each sees only its own language’s ordinary data structure.

## 3.9.4. Using the generated types outside Morloc

`morloc types` writes the generated files for a program to a directory of your choice, so that a program that is not built by Morloc can use the same types:

```console
$ morloc types recs.loc -o gen
$ find gen -type f | sort
gen/cpp/mlc/types/_local/recs.hpp
gen/py/mlc_types/__init__.py
gen/py/mlc_types/_builtin/__init__.py
```

There is one directory per language the program uses. For Rust it writes a crate, with a `Cargo.toml`, that a Rust project can depend on.

A field may hold a type from a library your module depends on. The generated file then has to include or import that library, so the dependency’s entry in `package.yaml` says where its types live: the `namespace` its names start with and, in C++, the headers to include. A Rust crate’s namespace defaults to the crate’s name, and the crate becomes a dependency of the written crate:

**package.yaml**

```yaml
cpp-deps:
  nlohmann_json:
    version: "*"
    source: conda
    namespace: nlohmann
    import: nlohmann/json.hpp
rust-deps:
  ndarray: "0.16"
```
