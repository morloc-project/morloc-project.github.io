# 2. Why Morloc?

Morloc Manual | https://morloc-project.github.io/docs/why/ | prev: https://morloc-project.github.io/docs/intro/index.md | next: https://morloc-project.github.io/docs/getting-started/index.md

Every command line tool solves the same problems a second time. Argument parsing, input and output formatting, compression, streaming, exit codes, introspection: none of it is the tool’s actual work, all of it admits many reasonable answers, and every tool picks its own. Consistency across an ecosystem is then reachable only if every author agrees on a wide range of conventions and writes their code accordingly.

The costs of that are structural rather than accidental. A tool’s `--help` is prose written at its author’s whim, so no machine can build a reliable inventory of an environment. Two tools exchange structured data only if they already agree on a format, so anything richer than a byte stream needs a shared framework or a lossy encoding. A user who wants one more feature, or one fewer, has no move short of asking the maintainer. And because the command line is the only face a tool has, every other caller — a library, a network client, a model — gets a fresh layer of boilerplate laid over it, generating system calls and parsing text back out. That face also forces a shape on the work: a tool takes its input from the filesystem and delivers its output there, and calling it means spawning a process, whether or not the computation needed any of that.

Morloc’s answer to each of these is the same answer: derive the interface from the type instead of writing it. The sections below are that answer applied in different directions.

## 2.1. The interface is derived, not written

The program above declared two functions. It also, without further instruction, became a command line tool:

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

The same program serves over HTTP, TCP, and Unix sockets, and answers `--json-help` with a machine-readable description of every command. None of these is a separate build or a separate description. They are renderings of the types the compiler already checked, so they cannot drift from the functions: rename an argument or change a return type and every one of them moves on the next build.

[Building CLIs](https://morloc-project.github.io/docs/clis/index.md) covers the command line view, [Building APIs](https://morloc-project.github.io/docs/apis/index.md) the network and MCP views, and [The interface as data](https://morloc-project.github.io/docs/clis/interface-as-data.md) the introspection formats.

## 2.2. Values cross boundaries, not file formats

A Morloc command writes its return type, serialized. A command that accepts that type reads it. Neither end invents a file format and neither end writes a parser.

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

Same answer, and nobody wrote a format. Composing is the faster of the two and the one to reach for; the piped form pays for a pipe. What makes the piped form work at all is that the wire form falls out of the same declaration that generated each command’s interface, so two programs built by different people, in different languages, at different times meet at the seam having agreed on nothing but a type.

The wire form is the compiler’s business, not yours. A compiled Morloc program runs one **pool** per language — a process holding all of that language’s functions — and the compiler decides how a value moves between them: small values ride inside the packet, large ones go through shared memory with only a pointer on the socket, and the reader can ask for JSON or MessagePack instead. Data too large for memory need not be a value at all: `IFile`, `IStream`, and `OStream` describe data that lives in a file, indexed or walked in order, and a handle to one crosses a pool boundary like any other argument. See [Controlling data transfer](https://morloc-project.github.io/docs/apis/data-transfer.md) and [Random access and streaming](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md).

## 2.3. A signature and its implementations are separate things

A Morloc module may declare types and signatures and supply no code at all. Such a module typechecks and will not compile, because there is nothing to generate. It is complete as a specification and empty as a program.

Implementations arrive by import. [Writing code that is not tied to a language](https://morloc-project.github.io/docs/getting-started/abstract-modules.md) writes two unit conversions in no language at all, then compiles them to C++ by importing `root-cpp` — or to Python, by changing that one line to `root-py`. Import both and the compiler chooses per function; how it chooses is [One term may have many definitions](https://morloc-project.github.io/docs/types/term-polymorphism.md).

The standard library is built this way. `root` declares the typeclasses and signatures; `root-cpp`, `root-py`, `root-r`, and `root-rust` supply the code. The same split runs through `vector`, `map`, `set`, `text`, and the rest.

A signature is a surface, not a size. Nothing here says an implementation must be small: the functional core of a large application — tens of thousands of lines, once the format parsing and the incidental IO are stripped off — takes a type in a few lines. Morloc modules are small in their typed interface, which is the surface you compose against, and can be whatever size they need to be underneath.

## 2.4. Tests and benchmarks follow the type, not the language

Because the signature is separate from the implementations, so is everything written against the signature.

The `vector` module holds its own test suite, written once, in terms of the abstract module. Each implementation module binds that suite to itself in three lines:

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

Benchmarking works the same way, and for the same reason. Write the composition once against the abstract module, bind it to two implementations, and call both from one program. The runtime reports per-call timings through a log template you configure rather than code you write, so the measurement is not something each implementation reports for itself. See [Logging](https://morloc-project.github.io/docs/runs/logging.md).

## 2.5. Toolboxes add and subtract

A module that compiles to a command line tool is still a module, so another module can import it. Given two installed modules — `sift`, which searches files, and `stats`, which draws charts — a toolbox that takes some commands from each is an import list and an export list:

**tools.loc**

```morloc
--' A little toolbox for reading notes
module tools (scan, summarize, histogram)

import sift
import stats
```

Two imports, one export line, no glue. The result is a tool in its own right, with its own help, completions, and MCP surface, built from commands their authors never coordinated on.

Addition is another import. Subtraction is leaving a name out of the export list: `sift` may export five commands and this toolbox publishes two, and the three left out are gone from the help, from the completions, and from the MCP surface, with the code behind them never built. Neither move requires a plugin system, and neither requires the consent of whoever wrote `sift`.

## 2.6. Caching, logging, and placement are annotations

Memoizing an expensive step, recording what ran and how long it took, or moving heavy work onto another machine are not properties of a function. They are properties of where a function sits in a composition, and Morloc lets you say so without touching the function.

Label a call site, and configure the label in the program’s YAML:

```morloc
foo xs = expensive_step@slowfn xs
```

```yaml
labeled-groups:
  expensive_step: { cache: true }
```

Every call into `expensive_step@slowfn` is now memoized to disk. The freshness check is content-based rather than mtime-based: editing an unrelated comment does not invalidate the cache, copying the program to a new path does not either, and two machines that build byte-identical pool sources share it. The same group config carries `log: true`, and a label may cover a complex term rather than a single call, so an entire branch of the execution tree can be cached, logged, or — this is the part still in development — dispatched to a remote worker.

Failure is handled in the same spirit. A build flag wraps every foreign call so that anything which throws dumps its arguments to disk and records the chain of calls that reached it, which makes a failure inspectable without reproducing it. Builds without the flag pay nothing. See [Caching](https://morloc-project.github.io/docs/runs/caching.md), [Logging](https://morloc-project.github.io/docs/runs/logging.md), [Debugging](https://morloc-project.github.io/docs/runs/debugging.md), and [Execution contexts](https://morloc-project.github.io/docs/install/execution-contexts.md).

## 2.7. One environment, solved once

The usual objection to a polyglot program is that it multiplies package managers. Morloc’s answer is to solve the dependency problem rather than route around it.

A program declares what it needs — its languages, and its packages from conda, PyPI, crates, and the system — and `mim`, the Morloc installation manager, resolves the whole set together into one environment. That environment may be built natively on Linux or MacOS Silicon, and the compiler provisions it on demand. Imported Morloc modules are fetched automatically at versions compatible with your compiler.

Conventional workflow managers reach the opposite conclusion and give each task its own container. That does make the conflict go away, and the price is that every value between every pair of steps must be serialized, written, and parsed again, with a process launch on top. There is no other way for two containers to exchange anything.

Morloc pays a boundary cost only where a value actually crosses between pools. Within a pool there is none: the functions are compiled into one unit and call each other natively, with no serialization, no socket, and no IPC. Across pools the floor is a Unix domain socket round trip — a few microseconds — plus whatever marshalling the two representations need (zero in cases where shared memory can be used).

What that buys is granularity. When every boundary costs a container, functions have to be big enough to amortize it, and a tool becomes a monolith: one program that parses a bespoke format, hard-codes a parallelism strategy, and writes another bespoke format governed by its own flags. When a call inside a language is free and a call across one is microseconds, you can decompose to the level the problem actually has — one function for the base case, an existing library for the parallelism — and the formats move out to the edges, where one parser module reads an archival format once instead of every tool reimplementing it.

[Does Morloc allow function-specific containerized environments?](https://morloc-project.github.io/docs/qa/per-function-environments.md) in the Q&A takes up the comparison directly.

## 2.8. What this makes possible

Everything above is already in the compiler. What it is **for** is not built yet, and I want to be plain about which is which.

If interfaces are derived rather than written, the only artifact worth publishing is the function itself. That makes a few things possible that are not possible today:

-   **A library indexed by type.** The compiler already knows every exported signature. Searching a library by the shape of the function you need, across languages, becomes a question of building the index rather than inventing the data.
-   **Implementations that compete.** One signature, many implementations, with shared tests and shared benchmarks deciding between them — across languages, on your data.
-   **Composition that is checked rather than trusted.** If two modules typecheck against a common environment, they compose, and the compiler proves it where they meet. No pairwise integration testing is required, so the guarantee does not get more expensive as the library grows.
-   **Communities organized by values instead of by language.** Morloc calls these **planes**: namespaces that differ not by subject area or language but by what their members demand of code — review, verification, performance, or nothing at all. See [Planes of libraries](https://morloc-project.github.io/docs/future/index.md#planes-of-libraries).

None of that infrastructure exists yet. There is no registry, no type-directed search, and no plane but the default one.

## 2.9. Where the project stands

Morloc has been in development for about ten years. I use it for my own work, but it is not yet used widely by anyone else.

Solid: the compiler and its type system, C++/Python/Rust/R as fully supported languages, the generated CLI, HTTP, socket and MCP interfaces, environment and dependency management through `mim`, and a standard library covering the common data structures, text, math, tables, and tensors.

Thin or unfinished: library coverage far from complete, remote execution (the SLURM dispatch that makes Morloc usable as a cluster workflow language) is in development, editor support is current for vim and Pygments and stale for VS Code/Zed, some aspects of the type system are still experimental, and the module registry is unbuilt.

## 2.10. What I need

I’m looking for people who can:

-   **Write a module.** Take your program, give it types, and publish it.
-   **Report what breaks.** A bug report is worth more to me than a patch right now. Unexpected behavior, a bad error message, a gap in this manual, and anything that was harder than it should have been all count.
    
    -   **Fix the editor tooling.** Add support for your favorite editor.
    -   **Bring a language.** Every new language brings fun design questions, I would be happy to work with you in bringing your language into the Morloc ecosystem.
    -   **Tell me the right way to build a type system.** There is a lot of interesting theory to hash through. There’s a paper or two buried somewhere in all of this.
