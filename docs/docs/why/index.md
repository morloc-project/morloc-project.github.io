# 1. Why Morloc

Morloc Manual | https://morloc-project.github.io/docs/why/ | next: https://morloc-project.github.io/docs/getting-started/index.md

Every command line tool reimplements the same machinery: argument parsing, input and output formats, help text, streaming, exit codes. None of it is the tool’s work, each tool solves it its own way, and every other caller — a library, a server, a model — gets another layer on top. Morloc derives that machinery from the function’s type instead of having you write it.

Morloc types name no language, so the function behind a type may be written in any supported language, or composed from functions written in several. A library of functions cannot be universal if it is partitioned by language.

## 1.1. One program

Two functions, in two languages, neither aware of the other. A C++ sum:

**foo.hpp**

```cpp
#pragma once
#include <vector>

double sum(const std::vector<double>& vec) {
    double sum = 0.0;
    for (double value : vec) {
        sum += value;
    }
    return sum;
}
```

and a parallel map in Python:

**foo.py**

```python
import multiprocessing as mp

def pmap(f, xs):
    with mp.Pool() as pool:
        results = pool.map(f, xs)
    return results
```

Neither file imports anything from Morloc. The Morloc module gives each a type and composes them:

**sums.loc**

```morloc
module m (sum, sumOfSums)

import root-py
import root-cpp

source Py from "foo.py" ("pmap")
source Cpp from "foo.hpp" ("sum")

pmap :: (a -> b) -> [a] -> [b]

--' Add up a list of numbers
sum :: [Real] -> Real

--' Add up a list of lists, summing each in parallel
sumOfSums :: [[Real]] -> Real
sumOfSums = sum . pmap sum
```

`.` is function composition, so `sumOfSums` reads right to left: `pmap sum` sums each inner list in parallel, and the outer `sum` adds the results. The `--'` lines are docstrings, which the compiler carries into every generated interface.

```console
$ morloc make sums.loc
$ ./sums sumOfSums '[[1,2],[3,4,5]]'
15
```

A Python function called a C++ function across a process boundary, and you wrote no binding, no serializer and no argument parser. [Getting Started](https://morloc-project.github.io/docs/getting-started/index.md) builds this program up one step at a time.

The same build is also a command line tool:

```console
$ ./sums -h
Usage: ./sums <nexus_options> <command> <command_options>

Commands:
  sum        Add up a list of numbers
  sumOfSums  Add up a list of lists, summing each in parallel

General Options:
  -h, --help  Print help; -hh adds details and examples, -hhh adds schemas
              (nexus options: -h @)
```

and a set of tool definitions a model client can consume:

```console
$ ./sums --mcp-tools
{
  "tools": [
    {
      "name": "sum",
      "description": "Add up a list of numbers",
      "inputSchema": {
        "type": "object",
        "properties": {
          "_1": {
            "type": "array",
            "items": {
              "type": "number"
            }
          }
        },
        "required": [
          "_1"
        ],
        "additionalProperties": false
      }
    },
...
```

These are renderings of the types the compiler checked, so they cannot drift from the functions: rename an argument and every one of them changes on the next build. The program also serves over HTTP, TCP and Unix sockets ([Building CLIs](https://morloc-project.github.io/docs/clis/index.md), [Serving](https://morloc-project.github.io/docs/apis/deploy-serving.md), [The interface as data](https://morloc-project.github.io/docs/clis/interface-as-data.md)).

## 1.2. Values cross boundaries, not file formats

Here is a second program. A C++ function counts every k-length subsequence of a string and hands back a `std::map<std::string, int>`. A Python function takes the Shannon entropy of a count table and expects a `dict`. Morloc knows both as `Map Str Int`, so composing them is an application and nothing else:

**kmers.loc**

```morloc
module kmers (countKmers, entropy, complexity)

import map-cpp
import map-py

source Cpp from "kmer.cpp" ("count_kmers" as countKmers)
source Py from "entropy.py" ("entropy" as entropy)

--' Count every k-length subsequence
countKmers :: Int -> Str -> Map Str Int

--' Shannon entropy of a count table, in bits
entropy :: Map Str Int -> Real

--' Sequence complexity: the entropy of its k-mer profile
complexity :: Int -> Str -> Real
complexity k seq = entropy (countKmers k seq)
```

Composed inside one program, nothing is ever written to a file or a pipe:

```console
$ ./kmers complexity 3 GATTACAGATTACA
2.75162916738782
```

The same declaration reaches past the edge of a program. Each of those functions is a command too, so the two halves can run as separate processes and pass the count table between them:

```console
$ ./kmers countKmers 3 GATTACAGATTACA
[["ACA",2],["AGA",1],["ATT",2],["CAG",1],["GAT",2],["TAC",2],["TTA",2]]

$ ./kmers countKmers 3 GATTACAGATTACA | ./kmers entropy -
2.75162916738782
```

Two commands built from one declaration agree on the wire form, so neither side writes a parser; composing inside one program skips the pipe. Data too large for memory is a handle to a file (`IFile`, `IStream`, `OStream`; see [Random access and streaming](https://morloc-project.github.io/docs/features/random-access-and-streaming.md)) that crosses between languages like any other value.

## 1.3. One signature, many implementations

A module may declare a signature with no code and import its implementations; when several languages implement it, the compiler picks one per call ([Writing code that is not tied to a language](https://morloc-project.github.io/docs/getting-started/abstract-modules.md), [One term may have many definitions](https://morloc-project.github.io/docs/types/term-polymorphism.md)). The standard library is built this way: `root` declares, `root-cpp`, `root-py`, `root-r` and `root-rust` implement.

Anything written against the signature works for every implementation. The `vector` module holds its own test suite, written once, in terms of the abstract module. Each implementation module binds that suite to itself in three lines:

**vector-py/test.loc**

```morloc
module test-vector-py (test)

import vector.test (test)
import vector-py
```

**vector-cpp/test.loc**

```morloc
module test-vector-cpp (test)

import vector.test (test)
import vector-cpp
```

Same tests, same assertions, different code underneath:

```console
$ cd vector-py && morloc make -o test test.loc && ./test test
...
All 81 tests pass

$ cd vector-cpp && morloc make -o test test.loc && ./test test
...
All 81 tests pass
```

## 1.4. Tools compose by import

A module compiled into a tool is still a module. A toolbox that takes commands from two installed modules, `sift` and `stats`, is an import list and an export list:

**tools.loc**

```morloc
--' A little toolbox for reading notes
module tools (scan, summarize, histogram)

import sift
import stats
```

Adding a command is an import; removing one is leaving it out of the export list, and the code behind it is never built. Neither needs a plugin system or the consent of the modules' authors.

## 1.5. Caching, logging and placement are annotations

Label a call site, and configure the label in the program’s YAML:

```morloc
foo xs = expensive_step@slowfn xs
```

```yaml
labeled-groups:
  expensive_step: { cache: true }
```

Every call into `expensive_step@slowfn` is now cached on disk. The same configuration turns on logging and, still in development, sends a call to a cluster; a `--debug` build records the arguments of every call a failure passes through. See [Caching](https://morloc-project.github.io/docs/runs/caching.md), [Logging](https://morloc-project.github.io/docs/runs/logging.md), [Running on a cluster](https://morloc-project.github.io/docs/apis/execution-contexts.md) and [Debugging](https://morloc-project.github.io/docs/runs/debugging.md).

## 1.6. One environment, solved once

A program declares its languages and packages, and `mim` resolves them all into one environment. Inside a language, calls are native; across languages, a call costs a Unix-socket round trip of a few microseconds. That is cheap enough to split work into small functions instead of monolithic tools, with format parsing pushed to the edges. [Does Morloc allow function-specific containerized environments?](https://morloc-project.github.io/docs/qa/per-function-environments.md) compares this with one container per task.

## 1.7. What Morloc is not

Morloc is not a foreign function interface generator. You write no bindings and the languages never import one another. They run as separate processes and the compiler generates the traffic between them, which is why adding a language to a program costs a line rather than a binding layer.

It is not a language you rewrite into. The C++, Python, R, and Rust in a Morloc program is ordinary code in those languages, with no Morloc imports, no annotations, and no base class. You keep your editor, your debugger, your libraries, and your existing code. What Morloc adds is a type and a name.
