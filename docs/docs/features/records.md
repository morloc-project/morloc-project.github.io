# 4.8. Records

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/records.html | prev: https://morloc-project.github.io/docs/features/tuples-and-lists.md | next: https://morloc-project.github.io/docs/features/patterns.md

A record is a named, fixed set of named fields. It is the right shape when a tuple would leave you counting positions.

```morloc
record Person = Person
    { name :: Str
    , age :: Int
    }
```

Records map to whatever each language uses for the job: a `dict` in Python, a `list` in R, a `struct` in C++. Internally the layout is positional, but the surface language always binds by name.

## 4.8.1. Native representations

The concrete forms must share the general record’s field names and types, so those are not repeated. You only name the container:

```morloc
record Py => Person = "dict"
record R => Person = "list"
record Cpp => Person = "person_t"
```

Python and R need nothing further — `dict` and `list` hold arbitrary fields already. C++ needs the struct to exist:

**foo.hpp**

```cpp
#pragma once
#include <string>

struct person_t {
    std::string name;
    int age;
};

person_t incAge(person_t person){
    person.age++;
    return person;
}
```

The R and Python sides operate on their native containers directly:

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
    person["age"] += 1
    return person
```

## 4.8.2. Record literals match by field name

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

## 4.8.3. One record across three languages

Because the record has a native form in each language, a function that operates on it can be sourced from any of them, and they compose:

**recs.loc**

```morloc
module recs (foo)

import root-r
import root-py
import root-cpp

record Person = Person
    { name :: Str
    , age :: Int
    }

record Py => Person = "dict"
record R => Person = "list"
record Cpp => Person = "person_t"

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
```

`foo` builds a `Person` and then increments its age three times, once in each language, passing the record across two process boundaries on the way:

```console
$ ./recs foo Bob 40
{"name":"Bob","age":43}
```

Nothing in `foo.R`, `foo.py`, or `foo.hpp` knows the others exist. Each sees only its own language’s ordinary data structure.
