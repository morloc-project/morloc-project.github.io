# getting started


=== Installing Morloc

The easiest way to run Morloc is through containers in a UNIX environment. Linux
will work natively. MacOS and Windows are more complicated and I'll deal with
their special cases later on. For Windows, you will need to install through the
https://learn.microsoft.com/en-us/windows/wsl/about[Windows Subsystem for Linux].

The only dependency is a container engine --
https://docs.docker.com/engine/install/[Docker] (v20+) or
https://podman.io/docs/installation[Podman] (v3+) are supported.

.Podman instructions
[%collapsible]
====

Unlike Docker, `podman` runs rootless by default, so no sudo is required. On
Linux, it also runs natively with no daemons.

On MacOS and Windows (even through WSL), a virtual machine is required. So you
will need to initialize `podman` as so:

[%nowrap, console]
----
$ podman machine init
$ podman machine start
----

You can confirm that podman is running by entering

[%nowrap, console]
----
$ podman --version
podman version 5.4.1   # version on my current setup
----

++++
<hr>
++++

====

.Docker instructions
[%collapsible]
====

Docker requires either sudo access or
https://docs.docker.com/engine/security/rootless/[rootless mode] configuration.

Verify Docker is running:

[%nowrap, console]
----
$ docker --version
$ docker run hello-world
----

++++
<hr>
++++

====


After confirming either Podman or Docker is running on your system, download
`morloc-manager` from the
https://github.com/morloc-project/morloc/releases[latest release] and place it
on your PATH. Static binaries are available for x86 Linux, Linux ARM, and
macOS:

[%nowrap, console]
----
$ # Example for x86 Linux -- adjust the URL for your platform
$ curl -Lo morloc-manager https://github.com/morloc-project/morloc/releases/latest/download/morloc-manager-x86_64-linux
$ chmod +x morloc-manager
$ mv morloc-manager ~/.local/bin/
----

Configure the container engine and install Morloc:

[%nowrap, console]
----
$ morloc-manager setup
$ morloc-manager install
----

The `setup` command auto-detects available container engines (preferring Podman).
The `install` command pulls the container images and sets up the local
configuration.

`morloc-manager run` executes commands inside the Morloc container. Your
current working directory is automatically mounted. It can be used to compile
and run Morloc programs:

[%nowrap, console]
----
$ morloc-manager run -- morloc make -o foo foo.loc
$ morloc-manager run -- ./foo double 21
----

To drop into an interactive container shell with Python, R, C++ compiler, vim,
and other conveniences:

[%nowrap, console]
----
$ morloc-manager run --shell
----

Throughout the rest of this manual, whenever an example uses the `morloc`
command directly, you can assume it is being run from within a container shell
started with `morloc-manager run --shell`.

=== Setting up IDEs

We are currently working on expanding the editor support for Morloc.

Here are supported editors

.vim
[%collapsible]
====

If you are working in vim, you can install Morloc syntax highlighting as
follows:

[%nowrap, console]
----
$ mkdir -p ~/.vim/syntax/
$ mkdir -p ~/.vim/ftdetect/
$ curl -o ~/.vim/syntax/loc.vim https://raw.githubusercontent.com/morloc-project/vimmorloc/main/loc.vim
$ echo 'au BufRead,BufNewFile *.loc set filetype=loc' > ~/.vim/ftdetect/loc.vim
----

image::vim-highlights.png[]

++++
<hr>
++++
====

.VS Code / VSCodium / Cursor
[%collapsible]
====

We have a publicly available "morloc" extension with support for highlighting
and snippet expansion.

image::vscode-highlights.png[]

++++
<hr>
++++

====

.Zed
[%collapsible]
====

This is currently under development, see repo https://github.com/morloc-project/zed-morloc[here].

The extension is mostly written, and the required Tree-sitter grammar is
written, but there are bugs to be resolved. I'm happy to accept pull requests!

====

I've also written several syntax highlighting and static analysis tools:

.Pygmentize
[%collapsible]
====

A repo with the Pygmentize parser can be found
https://github.com/morloc-project/pygmentize[here]. This parser is used to
highlight code here in the manual. It can be easily integrated into Python code,
e.g., in the https://github.com/morloc-project/weena-bot[Weena discord bot].

====

.Tree-sitter
[%collapsible]
====

Tree-sitter is a program for defining parsers and using them to query languages
and add advanced grammatical understanding to editors. These grammars require a
complete lexer and parser specification for the language. This grammar is
available for Morloc, see repo
https://github.com/morloc-project/tree-sitter-morloc[here]. Tree-sitter allows
general purpose syntax highlighting (e.g., over the command line) and parses a
full concrete syntax tree from the code:

image::tree-sitter.png[]

====

=== Say hello

The inevitable "Hello World" case is implemented in Morloc like so:

[source, morloc]
----
module hw (hello)
hello = "Hello up there"
----

The module named `hw` exports the term `hello` which is assigned to a literal
string value.

Paste this code into a file (e.g. "hello.loc") and then it can be imported by
other Morloc modules or directly compiled into a program where every exported
term is a subcommand.

[source, console]
----
$ morloc make hello.loc
----

This command will produce an executable named after the module (in this case,
`hw`) along with a `hw.manifest` JSON file and pool files for each
language used (e.g., `pool.py`, `pool-cpp.out`, `pool.R`). The executable is the
command line interface (CLI) to the commands exported from the module.

// NOTE: Functions arguments are separated by whitespace

Calling the executable with no arguments or with the `-h` flag, will print a help
message:

[source, console]
----
$ ./hw -h
Usage: ./hw [OPTION]... COMMAND [ARG]...

Nexus Options:
 -h, --help            Print this help message
 -o, --output-file     Print to this file instead of STDOUT
 -f, --output-format   Output format [json|mpk|voidstar]

Exported Commands:
  hello
    return: Str
----


This usage message is automatically generated. For each exported term, it
specifies the input (none, in this case) and output types as inferred by the
compiler. For this case, the exported command is just the term `hello`, so no
input types are listed.

The command is called as so:

[source, console]
----
$ ./hw hello
Hello up there
----

=== Dice rolling

Let's write a little program rolls a pair of 20-sided dice and prints the larger
result. Here is the Morloc script:

[source, morloc]
----
module dnd (rollAdv)
import types
source Py from "foo.py" ("roll", "narrate")

roll :: Int -> Int -> [Int]
max :: [Int] -> Int
narrate :: Int -> Str

rollAdv = narrate (max (roll 2 20))
----

Here we define a module named `dnd` that exports the function `rollAdv`. In line
2, we import the required type definitions from the Morloc module
`types`. Later on we'll go into how these types are defined. In line 3, we
source two functions from the Python file "foo.py". In lines 5-8, we assign
each of these functions a Morloc type signature. You can think of the arrows
in the signatures as separating arguments. For example, the function `roll`
takes two integers as arguments and returns a list of integers. The square
brackets indicate lists. In the final line, we define the `rollAdv` function.

The Python functions are sourced from the Python file "foo.py" with the
following code:

[source, python]
----
import random

def roll(n, d):
    # Roll n d-sided dice, return a list of results
    return [random.randint(1, d) for _ in range(n)]

def narrate(roll_value):
    return f"You rolled a {roll_value!s}"
----

Nothing about this code is particular to Morloc.

One of Morloc's core values is that foreign source code _never_ needs to know
anything about the Morloc ecosystem. Sourced code should always be nearly
idiomatic code that uses normal data types. The inputs and outputs of these
functions are natural Python integers, lists, and strings -- they are not
Morloc-specific serialized data or ad hoc textual formats.

This module is dependent on the `types` module, which in turn is dependent on
the `prelude` module. So before compiling, we need to import both of these:

[source, console]
----
morloc install prelude
morloc install types
----

Now we can compile and run this program as so:

[source, console]
----
$ morloc make dnd.loc
$ ./dnd rollAdv
"You rolled a 20"
----

As a random function, it will return a new result every time.

So, what's the point? We could have done this more easily in a pure Python
script. Morloc generates a CLI for us, type checks the program, and performs
some runtime validation (by default, just on the final inputs and outputs). But
there are other tools in the Python universe can achieve this same end. Where
Morloc is uniquely valuable is in the polyglot setting.

=== Polyglot dice rolling

In this next example, we rewrite the prior dice example with all three functions
being sourced from different languages:

[source, morloc]
----
module dnd (rollAdv)

import types

source R from "foo.R" ("roll")
source Cpp from "foo.hpp" ("max")
source Py from "foo.py" ("narrate")

roll :: Int -> Int -> [Int]
max :: [Int] -> Int
narrate :: Int -> Str

rollAdv = narrate (max (roll 2 20))
----

Note that all of this code is exactly the same as in the prior example except
the source statements.

The `roll` function is defined in R:

[source, r]
----
roll <- function(n, d){
    sample(1:d, n)
}
----

The `max` function is defined in {cpp}:

[source, c++]
----
#pragma once
#include <vector>
#include <algorithm>

template <typename A>
A max(const std::vector<A>& xs) {
    return *std::max_element(xs.begin(), xs.end());
}
----

The `narrate` function is defined in Python:

[source, python]
----
def narrate(roll_value):
    return f"You rolled a {roll_value!s}"
----

This can be compiled and run in exactly the same way as the prior monoglot
example. It will run a bit slower, mostly because of the heavy cost of starting
the R interpreter.

The Morloc compiler automatically generates all code required to translate data
between the languages. Exactly how this is done will be discussed later.

=== Parallelism example

Here is an example showing a parallel map function written in Python that calls {cpp} functions.

[source, morloc]
----
module m (sumOfSums)

import types

source Py from "foo.py" ("pmap")
source Cpp from "foo.hpp" ("sum")

pmap :: (a -> b) -> [a] -> [b]
sum :: [Real] -> Real

sumOfSums = sum . pmap sum
----

This Morloc script exports a function that sums a list of lists of real
numbers. Here we use the dot operator for function composition. The type
signature for `pmap` uses lowercase type variables (`a` and `b`) to indicate
that the function is generic -- it works for any types `a` and `b`. The sum
function is implemented in {cpp}:

[source, c++]
----
// C++ header sourced by morloc script
#pragma once
#include <vector>

double sum(const std::vector<double>& vec) {
    double sum = 0.0;
    for (double value : vec) {
        sum += value;
    }
    return sum;
}
----

The parallel `pmap` function is written in Python:

[source, python]
----
# Python3 file sourced by morloc script
import multiprocessing as mp

def pmap(f, xs):
    with mp.Pool() as pool:
        results = pool.map(f, xs)
    return results
----

The inner summation jobs will be run in parallel. The `pmap` function has the
same signature as the non-parallel `map` function, so can serve as a drop-in
replacement.

This can be compiled and run with the lists being provided in JSON format:

[source, console]
----
$ morloc make main.loc
$ ./m sumOfSums '[[1,2],[3,4,5]]'
15
----

# features source

=== Source function from foreign languages

In Morloc, you can import functions from many languages and compose them under
a common type system. The syntax for importing functions from source files is as
follows:

[source, morloc]
----
source Cpp from "foo.hpp" ("map", "sum", "snd")
source Py from "foo.py" ("map", "sum", "snd")
----

This brings the functions `map`, `sum`, and `snd` into scope in the Morloc
script. Each of these functions must be defined in the {cpp} and Python
scripts. For Python, since `map` and `sum` are builtins, only `snd` needs to be
defined. So the `foo.py` function only requires the following two lines:

[source, python]
----
def snd(pair):
    return pair[1]
----

The {cpp} file, `foo.hpp`, may be implemented as a simple header file with generic
implementations of the three required functions.

[source, c++]
----
#pragma once
#include <vector>
#include <tuple>

// map :: (a -> b) -> [a] -> [b]
template <typename F, typename A>
auto map(F f, const std::vector<A>& xs) {
    std::vector<decltype(f(xs.front()))> result;
    result.reserve(xs.size());
    for (const auto& x : xs) {
        result.push_back(f(x));
    }
    return result;
}

// snd :: (a, b) -> b
template <typename A, typename B>
B snd(const std::tuple<A, B>& p) {
    return std::get<1>(p);
}

// sum :: [a] -> a
template <typename A>
A sum(const std::vector<A>& xs) {
    A total = A{0};
    for (const auto& x : xs) {
        total += x;
    }
    return total;
}
----

Note that these implementations are completely independent of Morloc -- they
have no special constraints, they operate on perfectly normal native data
structures, and their usage is not limited to the Morloc ecosystem. The
Morloc compiler is responsible for mapping data between the languages. But to
do this, Morloc needs a little information about the function types. This is
provided by the general type signatures, like so:

[source, morloc]
----
map :: (a -> b) -> [a] -> [b]
snd :: (a, b) -> b
sum :: [Real] -> Real
----

The syntax for these type signatures is inspired by Haskell. Square
brackets represent homogenous lists and parenthesized, comma-separated values
represent tuples, and arrows represent functions. In the `map` type, `(a -> b)`
is a function from generic value `a` to generic value `b`;  `[a]` is the input
list of initial values; `[b]` is the output list of transformed values.

Removing the syntactic sugar for lists and tuples, the signatures may be written
as:

[source, morloc]
----
map :: (a -> b) -> List a -> List b
snd :: Tuple2 a b -> b
sum :: List Real -> Real
----

These signatures provide the _general types_ of the functions. But one general
type may map to multiple _native_, language-specific types. So we need to
provide an explicit mapping from general to native types.

[source, morloc]
----
type Cpp => List a = "std::vector<$1>" a
type Cpp => Tuple2 a b = "std::tuple<$1,$2>" a b
type Cpp => Real = "double"
type Py => List a = "list" a
type Py => Tuple2 a b = "tuple" a b
type Py => Real = "float"
----

These type functions guide the synthesis of native types from general
types. Take the {cpp} mapping for `List a` as an example. The basic {cpp} list type
is `vector` from the standard template library. After the Morloc typechecker
has solved for the type of the generic parameter `a`, and recursively converted
it to {cpp}, its type will be substituted for `$1`. So if `a` is inferred to be
a `Real`, it will map to the {cpp} `double`, and then be substituted into the list
type yielding `std::vector<double>`. This type will be used in the generated {cpp}
code.




# features functions

=== Functions

Functions are defined with arguments separated by whitespace:

[source, morloc]
----
foo x = g (f x)
----

Here `foo` is the Morloc function name and `x` is its first argument.

The Morloc `internal` module, which is imported into all `root` modules, defines
the composition (`.`) and application (`$`) operators.

With `.` , we can re-write `foo` as:

[source, morloc]
----
foo = g . f
----

Composition chains can build multi-stage pipelines:

[source, morloc]
----
process = format . transform . validate . parse
----

The `$` operator is the application operator. It has the lowest precedence, so
it can be used to avoid parentheses:

[source, morloc]
----
-- these are equivalent
foo (bar (baz x))
foo $ bar $ baz x
----

Morloc supports partial application of arguments.

For example, to multiply every element in a list by 2, we can write:

[source, morloc]
----
multiplyByTwo = map (mul 2)
----

Partial application works well for leading arguments, but what if we want to
partially apply a later argument?

For example, we can use direct partial application with subtraction to create
functions that subtract the input argument from a given value:

[source, morloc]
----
map (sub 1) [1,2,3] -- returns [0,-1,-2]
----

But what if we want to do the reverse:

[source, morloc]
----
map ??? [1,2,3] -- we want to return [0,1,2]
----

One solution is to use anonymous function, lambdas, like so:

[source, morloc]
----
map (\x -> sub x 1) [1,2,3] -- returns [0,1,2]
----

Morloc also supports a shortcut for more flexible partial application using
underscores as placeholders:

[source, morloc]
----
map (sub _ 1) [1,2,3] -- returns [0,1,2]
----

This will be transformed in the compiler frontend to a lambda, so it behaves
identically. These placeholders may also be used in data structures. The
following two expressions obtain the same result:

[source, morloc]
----
map (\x -> (x,42)) [1,2,3] 
map (_,42) [1,2,3]
----

The placeholders may be used in nested data structures as well:

[source, morloc]
----
people :: [Person]
people = zipWith { name = _, age = _ } ["Alice", "Bob"] [42, 44]
----

When multiple placeholders are used, the arguments generated for the lambda are
applied in left-to-right order.

Placeholders also work in string interpolation:

[source, morloc]
----
map "Hello #{_}!" ["Alice", "Bob"]
----

=== Native Morloc functions

While Morloc's primary purpose is composing foreign functions, you can also
define functions entirely in Morloc without sourcing from any language. These
_native_ functions are written using Morloc's own expression syntax:

[source, morloc]
----
module main (double, greet)

import root-py

double :: Real -> Real
double x = x + x

greet :: Str -> Str
greet name = "Hello #{name}!"
----

Native functions can use composition, `where` clauses, lambdas, and all other
Morloc expression forms. They are compiled down to whichever language the
compiler selects for execution.



# features types

=== Basic data types

Morloc supports standard primitives, homogenous lists, and tuples.

.Booleans

Booleans in Morloc are represented as `True` or `False` under the `Bool` type.

.Numbers

Numbers may be represented in normal format, scientific notation, or as
hexadecimal/octal/binary format:

[source, morloc]
----
-- standard notation for integers and floats
42
4.2

-- scientific notation (upper or lowercase 'e')
4.2E16
4.2e16
4.2e-8

-- hexadecimal notation (case insensitive)
0xf00d
0xDEADBEAF 

-- octal notation (upper or lowercase 'o')
0o755

-- binary notation (upper or lowercase 'b')
0b0101
----

.Strings

Morloc supports multi-line strings and string interpolation.

String interpolation uses the `#{...}` syntax. The expression inside the braces
must evaluate to a `Str`:

[source, morloc]
----
helloYou you = "hello #{you}"
----

String interpolation works with any expression that returns a string.

Multi-line strings use triple quotes. Leading indentation common to all lines is
stripped:

[source, morloc]
----
longString =
  """
  this is a long
  string
  """

-- single-quote triple-strings also work
anotherString = '''single quotes are also OK'''

-- triple-quoted strings can contain internal quotes
quoted = """you can use "internal quotes" freely"""
----

.Tuples

Tuples may be used to store a fixed number of terms of different type.

[source, morloc]
----
x = (1, True, 6.45)
----

.Records

Records are essentially named tuples. Record type definitions and
language-specific handling will be addressed in the Records section, but record data is expressed
as shown in the example below:

[source, morloc]
----
{ name = "Alice", age = 42 }
----

.Lists

Lists are used to store a variable number of terms of the same type.

[source, morloc]
----
x = [1,2,3]
----

Lists do not yet have special accessors (e.g., slicing). List operations are
performed through sourced functions such as `head`, `tail`, `take`, etc. You may
import many of these from the `root` modules.


# features records

=== Records

A record is internally a named tuple. Records may map to different structures in
different languages.

A general record is defined as follows:

[source, morloc]
----
record Person = Person
    { name :: Str
    , age :: Int
    }
----

Concrete forms must have the same field names and field types. Since these must
be the same, they need not be specified. We only need to specify the name of the
concrete type:

[source, morloc]
----
record Py => Person = "dict"
record R => Person = "list"
record Cpp => Person = "person_t"
----

In Python and R, records are typically `dict` and `list` types,
respectively. These types can contain any fields of any type. In {cpp}, records
are represented as structs; these must be defined in the C++ code, as shown
below.

[source, cpp]
----
struct person_t {
    std::string name;
    int age;
};
----

Functions may be defined that act on the records, as below:

[source, morloc]
----
source R from "foo.R" ("incAge" as rinc)
source Py from "foo.py" ("incAge" as pinc)
source Cpp from "foo.hpp" ("incAge" as cinc)

-- Increment the person's age
rinc :: Person -> Person
pinc :: Person -> Person
cinc :: Person -> Person
----

Records may, like all `morloc` types, be passed freely between languages. As
shown above, records may be written in braces and their type will be inferred.

The "foo.R" file contains the function:

[source, r]
----
incAge <- function(person){
    person$age <- person$age + 1
    person
}
----

No special code is needed for `person`, it is just a builtin R list. Similarly for Python:

[source, python]
----
def incAge(person):
    person["age"] += 1
    return person
----

{cpp} requires a definition of a `person_t` struct:

[source, c++]
----
struct person_t {
    std::string name;
    int age;
};

person_t incAge(person_t person){
    person.age++;
    return person;
}
----

Records may be initialized and functions called on them:

[source, morloc]
----
foo name age
    = (rinc . pinc . cinc)
      { name = name, age = age }
----

`foo`, above, initializes a `Person` record and then increments its age 3 time
in different languages.

Records may contain fields with arbitrarily complex types, but recursive types
are not currently supported.


# features optionals

=== Optional types

All programming languages must have a way to deal with missing values. If you
query a database for a record that doesn't exist, what is returned? If a
parameter is not set, what value does it have? In Python, the `None` type stores
missing values. In R, `NULL` serves a similar purpose. In both languages, types
that may lack values are represented as a union of the original type and the
`null` type. JSON, similarly, stores missing values as `null`. Other languages
solve this problem in libraries. C++ has the standard template library
datastructure `std::optional<T>` for representing values of generic type `T`
that have null, `std::nullopt` types.

Haskell offers the `Maybe` sum type that may be `Nothing` or `Just a`. This is
perhaps the cleanest solution, but it is not practical for Morloc. One of the
core principles of Morloc is that sourced functions should be idiomatic. So
Morloc needs a built-in mechanism that can vary freely in language-specific
implementation while preserving between language consistency. To this end,
Morloc offers a dedicated "Optional" type with supported implicit coercion.

==== Syntax

The `?` prefix marks a type as optional and the `null` primitive indicates an
absent value. `?Int` is an integer that might be `null`, `?Str` is a string that
might be `null`, and so on. The `?` prefix can be applied to any type, including
lists (`?[Int]`), records (`?Person`), and nested optionals (`??Int`).

[source, morloc]
----
--' Get the first element from a list or empty on failure
safeHead :: [Int] -> ?Int
fromNull :: a -> ?a -> a
----

The `null` keyword represents an absent value:

[source, morloc]
----
testNull :: ?Int
testNull = null
----

==== Working with optional values

Functions that produce or consume optional values are sourced from foreign
languages like any other function. Here is a complete example in Python:

[source, morloc]
----
module main (testSafeHead, testSafeHeadEmpty, testFromNull)

import root-py

safeHead :: [Int] -> ?Int
safeHead xs
  ? length xs == 0 = null
  : head xs

source Py from "main.py" ("fromNull")
fromNull :: a -> ?a -> a

testSafeHead :: ?Int
testSafeHead = safeHead [10, 20, 30]

testSafeHeadEmpty :: ?Int
testSafeHeadEmpty = safeHead []

testFromNull :: Int
testFromNull = fromNull 0 null
----

The Python implementations handle `None` in the usual way:

[source, python]
----
def fromNull(default_val, x):
    if x is None:
        return default_val
    return x
----

Running this program gives:

----
$ ./main testSafeHead
10
$ ./main testSafeHeadEmpty
null
$ ./main testFromNull
0
----

The same pattern works in {cpp} (using `std::optional`) and R (using `NULL`).
In {cpp}:

[source, c++]
----
#include <optional>

template <class T>
T fromNull(T default_val, const std::optional<T>& x) {
  if(x.has_value()){
    return x.value();
  } else {
    return default_val;
  }
}
----

In R:

[source, r]
----
fromNull <- function(default_val, x){
  if(is.null(x)){
    return(default_val)
  } else {
    return(x)
  }
}
----

==== Optional record fields

Record fields can be optional. This is useful for data with missing or unknown
values. The `where` form below is an alternative syntax for record declarations
(equivalent to the brace syntax used in the Records section):

[source, morloc]
----
record Person where
  name :: Str
  age :: ?Int
record Py => Person = "dict"

makePerson :: Str -> ?Int -> Person
source Py from "foo.py" ("makePerson")

alice :: Person
alice = makePerson "Alice" (toNull 30)

bob :: Person
bob = makePerson "Bob" null
----

When serialized to JSON, `alice` becomes `{"name":"Alice","age":30}` and the
age field of `bob` becomes `null`.

==== Optional values across languages

Optional types work seamlessly across language boundaries. A function in one
language can produce an optional value that is consumed by a function in another:

[source, morloc]
----
-- C++ produces an optional value
cSafeDiv :: Int -> Int -> ?Int
source Cpp from "foo.hpp" ("cSafeDiv")

-- Python consumes it
pFromNull :: Int -> ?Int -> Int
source Py from "foo.py" ("pFromNull")

-- Chain them together: C++ to Python
testCppToPy :: Int
testCppToPy = pFromNull (-1) (cSafeDiv 10 3)

testCppToPyNull :: Int
testCppToPyNull = pFromNull (-1) (cSafeDiv 10 0)
----

The Morloc compiler generates the necessary serialization code at each language
boundary. A `null` value in {cpp} (`std::nullopt`) is serialized as JSON `null`,
which Python reads as `None`. The programmer does not need to handle the interop
manually.

==== Implicit coercion

Morloc automatically coerces a non-optional value to an optional when the
context requires it. If a function expects `?Int`, you can pass a plain `Int`
without wrapping it:

[source, morloc]
----
addOpt :: ?Int -> ?Int -> ?Int
source Py from "foo.py" ("addOpt")

-- Both arguments are plain Int, coerced to ?Int automatically
testCoerceAddOpt :: ?Int
testCoerceAddOpt = addOpt 3 4

fromNull :: a -> ?a -> a
source Py from "foo.py" ("fromNull")

-- The second argument (42) is Int, coerced to ?Int
testCoerceArg :: Int
testCoerceArg = fromNull 0 42
----

This coercion is transitive: `a` coerces to `?a`, which coerces to `??a`.

Coercion also works across language boundaries. If a {cpp} function returns
`Int` and a Python function expects `?Int`, the compiler inserts the appropriate
serialization so that the value is received correctly:

[source, morloc]
----
-- C++ returns a plain Int
cAddOne :: Int -> Int
source Cpp from "cfoo.hpp" ("cAddOne")

-- Python expects ?Int in the second argument
pUnwrapOr :: a -> ?a -> a
source Py from "pfoo.py" ("pUnwrapOr")

-- The Int result from C++ is coerced to ?Int for Python
testCppIntToPyOpt :: Int
testCppIntToPyOpt = pUnwrapOr 0 (cAddOne 41)  -- returns 42
----

==== Language mapping

Optional types map to native nullable types in each language:

[cols="1,2", options="header"]
|===
| Language | Representation

| Python | `None` for null, plain value otherwise
| {cpp} | `std::optional<T>`
| R | `NULL` for null, plain value otherwise
|===

No special type mappings are needed for optionals -- the `?` prefix works with
any type that already has a language mapping.

# features modules

=== Importing modules

Every Morloc file is a module. A module declaration names the module and
optionally lists the terms it exports:

[source, morloc]
----
module mylib (foo, bar)
----

This declares a module named `mylib` that exports `foo` and `bar`. Only
exported terms are visible to other modules that import this one.

If a module exports everything it defines, you can use the wildcard form:

[source, morloc]
----
module mylib (*)
----

For submodules that exist only to be imported by a parent, you can omit the
name entirely:

[source, morloc]
----
module (*)
----

An anonymous module's name is inferred from its file path relative to the
importing module. For example, if `main.loc` imports `.utils`, the compiler
will resolve the module in `utils/main.loc` (or `utils.loc`) and assign it the
name `utils`.

Morloc distinguishes between two kinds of imports: *system* modules and *local*
modules.

System modules are installed packages that live in
`~/.local/share/morloc/lib/`. They are imported by name, without any prefix:

[source, morloc]
----
import root-py
import root-cpp
----

System modules are installed with `morloc install`:

[source, console]
----
$ morloc install root
$ morloc install root-py
----

Local modules are files or directories within your own project. They are
imported with a dot (`.`) prefix to distinguish them from system modules:

[source, morloc]
----
import .utils (helper)
import .lib.math (square)
----

The dot prefix tells the compiler to look for the module relative to the
directory of the importing file, not in the system library.

Both system and local imports support selective imports. Without a selector, all
exported terms are brought into scope:

[source, morloc]
----
import root-py             -- import everything from root-py
import .mylib              -- import everything from local mylib
import .mylib (foo, bar)   -- import only foo and bar from local mylib
----

When you write `import .foo`, the compiler looks for the module relative to the
directory containing the current file. It checks two locations, in order:

1. A directory module: `foo/main.loc`
2. A file module: `foo.loc`

Dot-separated paths map to nested directories. For example, `import .lib.math`
resolves to either `lib/math/main.loc` or `lib/math.loc`.

Here is an example project layout:

----
project/
  main.loc            -- module main, imports .utils and .lib.math
  utils.loc           -- module (*), a flat file module
  utils.py
  lib/
    math/
      main.loc        -- module (*), a directory module
      main.py
----

The top-level `main.loc` imports both:

[source, morloc]
----
module main (negate_square, square_negate)

type Py => Real = "float"

import .utils (negate)
import .lib.math (square)

negate_square :: Real -> Real
negate_square x = negate (square x)

square_negate :: Real -> Real
square_negate x = square (negate x)
----

The flat file `utils.loc` exports `negate`:

[source, morloc]
----
module (*)

source Py from "utils.py" ("negate")

type Py => Real = "float"

negate :: Real -> Real
----

And the directory module `lib/math/main.loc` exports `square`:

[source, morloc]
----
module (*)

source Py from "main.py" ("square")

type Py => Real = "float"

square :: Real -> Real
----

Local modules can also import other local modules. The path is always relative
to the importing file. For example, if `bar/baz/main.loc` needs to import a
sibling at `bif/biz/`, it writes:

[source, morloc]
----
import .bif.biz (mul)
----

This resolves relative to `bar/baz/`, looking for `bar/baz/bif/biz/main.loc`.

Since `root` is also the name of a system module, a local directory named
`root/` must be imported with the dot prefix to avoid ambiguity:

[source, morloc]
----
import root         -- imports the system "root" module
import .root        -- imports the local "root/" directory
----

The dot prefix always forces local resolution, so there is never a collision
between local and system module names.


# features effects

=== Effects and delayed evaluation

Morloc is a functional programming language. Here a "function" is a mapping from
a value in one domain to value in another domain. This works neatly for pure
functions. But it becomes complicated when "effects", like interactions with the
operating system, are introduced.

Consider a simple `readFile` program:

[source,morloc]
----
readFile :: Filename -> Str
----

This Morloc program takes a filename as input and returns a string containing
the file contents. Logically, this is a function. You are mapping a filename to
the file contents. At a given slice of time on a given system, there is a
one-to-one mapping between filenames and files.

You can save the contents in a variable:

[source,morloc]
----
contents = readFile "myfile.txt"
----

`contents` is now a value storing a string. But the world is not constant. Files
change. Let's say that `myfile.txt` is a log file and we want to read it at
multiple time points. Further, we don't want to specify the filename every time
we call the function. It would be more convenient to partially apply the
filename and have a function that will map the applied filename to whatever is
currently at the file location. But partially applying the filename to
`readFile` results in a **value** not a **function**. In many familiar
languages, you can define functions that have no arguments. So you could call
`read_log()` and it would read the log and return a fresh contents blob every
time the function was executed.

Let's look at an even trickier problem. Suppose we wanted a function that
returns the current epoch time. How would this be defined in Morloc? You could
require arguments that transform the problem to a true function. The world state
could be an argument. This state might be the locale or some other
reference. The function then becomes

[source,morloc]
----
time :: TemporalState -> Time
----

But once again, when we partially apply the function, we again are reduced to a
value. Perhaps we want a "function" that always returns California time.

A second example is random numbers. We can define a family of random functions like so:

[source,morloc]
----
runif :: Real -> Real -> Real
choose :: [a] -> a
coinToss :: ???
----

`runif` and `choose` are functions that produce random values when given the
required arguments. But what is `coinToss`? There are no arguments. Again, you
could reparameterize these random functions as pure functions that take a random
seed, or a stateful random generator, as an argument. That would look something
like this:

[source,morloc]
----
runif :: Real -> Real -> RNG -> (Real, RNG)
choose :: [a] -> RNG -> (a, RNG)
coinToss :: RNG -> (Bool, RNG)
----

This is the "right" way to do random effects. But it is certainly not the most
common way of doing it. In most languages, the random number generator exists in
global state. Or the random number generator might use actual system noise to
get truly random values.

What we want in Morloc is to preserve the power of partial function application
but still have the ability to call "functions" with no arguments. We can achieve
this by annotating functions with **named effects** that indicate what kind of
side effects they may perform.

In Morloc, effects are specified at the type level using angle brackets with
named labels. For example:

[source,morloc]
----
runif :: Real -> Real -> <Rand> Real
----

This declares `runif` as a function that takes two `Real` arguments and returns
a `Real`, but its return value involves a `<Rand>` effect -- the result may be
different each time it is evaluated.

Effect labels are open-ended -- you can use any uppercase name. Common
conventions include `IO` for input/output, `Rand` for randomness, and `Error`
for fallible computations. Multiple effects can be combined:

[source,morloc]
----
riskyRead :: Filename -> <IO, Error> Str
----

Let's look at some examples:

[source,morloc]
----
time :: <IO> Time

readFile :: Filename -> <IO> Str

-- roll one d-sided dice
rollDie :: Int -> <Rand> Int

roll1d20 :: <Rand> Int
roll1d20 = rollDie 20
----

==== Do-blocks and the `!` operator

A `do`-block creates an effectful computation. It is the only place where
effects can be evaluated. Inside a `do`-block, the `!` operator forces an
effectful expression to execute and returns its unwrapped value. The `do`-block
collects all the effect labels from its `!` evaluations and wraps the result.

Here is a function that rolls two independent d20s:

[source,morloc]
----
roll2d20 :: <Rand> (Int, Int)
roll2d20 = do (!roll1d20, !roll1d20)
----

Each `!` independently evaluates the effectful expression and returns the plain
result. The `do`-block sees two `<Rand>` evaluations and gives the whole
expression the type `<Rand> (Int, Int)`.

The `<-` operator is the binding form of `!`. Writing `x <- e` is equivalent to
`let x = !e` -- it forces the effect and binds the result to a name. This is
useful when you need the result in subsequent expressions:

[source,morloc]
----
rollAdv :: <Rand> Int
rollAdv = do
  x <- roll1d20
  y <- roll1d20
  max x y
----

Or equivalently using `!` inline:

[source,morloc]
----
rollAdv :: <Rand> Int
rollAdv = do max !roll1d20 !roll1d20
----

Inside a `do`-block there are four forms of statement:

* `!e` -- forces the effectful expression `e` and returns the unwrapped value
  inline.

* `x <- e` -- forces `e` and binds the result to `x`. Equivalent to
  `let x = !e`.

* `e` (bare statement) -- forces `e` for its side effects and discards the
  result.

* `let x = e` -- binds `x` to `e` without forcing anything. If `e` is
  effectful, the effect is deferred until `x` is later forced with `!` or `<-`.

The final expression in the `do`-block is the return value.

The distinction between `let` and `<-`/`!` is about **when** effects happen.
Here is an example:

[source,morloc]
----
deferredForce :: <IO> Int
deferredForce = do
  let t = sideEffect 3    -- t :: <IO> Int (not yet evaluated)
  x <- sideEffect 1       -- evaluated immediately
  y <- t                   -- NOW evaluates t
  add x y
----

Here `let t = sideEffect 3` stores the effectful expression without evaluating
it. The effect is only triggered when `t` is later forced with `<-`.

==== Sequencing and conditionals

Effects can be combined with guards:

[source,morloc]
----
damage :: Int -> Int -> <Rand> Int
damage ac baseDmg = do
  ? !roll1d20 > ac = add baseDmg !roll1d20
  : 0
----

For sequencing effects where the return value is not needed, bare statements in
a `do`-block are evaluated and discarded:

[source,morloc]
----
mkdir :: Path -> <IO> ExitCode
cd :: Path -> <IO> ExitCode
touch :: Path -> <IO> ExitCode

script :: <IO> ExitCode
script = do
  mkdir "foo/bar"
  cd "foo/bar"
  touch "baz"
----

Here `mkdir` and `cd` are called for their side effects and their return values
are discarded. The exit code from `touch` becomes the return value.

When an effectful function is exported, the effect is automatically forced at
the boundary. If `script` is exported, the CLI user receives a plain `ExitCode`
-- all `<IO>` effects are evaluated before returning the result.

==== Coercion and subtyping

Pure values are automatically coerced to effectful types when needed. If a
function expects `<IO> Int`, you can pass a plain `Int`:

[source,morloc]
----
pureFortyTwo :: <IO> Int
pureFortyTwo = 42
----

This implicit coercion means pure code composes freely with effectful code
without any manual wrapping.

Effects also support subtyping: fewer effects are a subtype of more effects.
A value of type `<IO> Int` can be used wherever `<IO, Error> Int` is expected,
since a computation that only does IO is a special case of one that does both IO
and error handling.

==== Cross-language effects

Effects work seamlessly across language boundaries. A `do`-block can mix
effectful calls to functions implemented in different languages:

[source,morloc]
----
source Cpp from "stats.hpp" ("sampleCpp")
source Py from "stats.py" ("analyzePy")

sampleCpp :: Int -> <Rand> [Real]
analyzePy :: [Real] -> <IO> Report

pipeline :: <IO, Rand> Report
pipeline = do
  samples <- sampleCpp 1000
  analyzePy samples
----

The compiler handles all cross-language serialization and process coordination
automatically. Each `<-` in the `do`-block may cross a language boundary, with
data serialized between processes as needed.

# features guards

=== Guards

Guards provide conditional branching within function definitions. Each guard
clause begins with `?` followed by a condition and a result expression, with a
`:` default that is always required as the final case:

[source, morloc]
----
abs :: Int -> Int
abs x
  ? x >= 0 = x
  : neg x
----

Guards are evaluated lazily from top to bottom. The first condition that
evaluates to true determines the result; remaining guards are not evaluated. The
`:` default always terminates the guard chain, ensuring exhaustiveness.

Guards work naturally with multiple parameters:

[source, morloc]
----
clamp :: Int -> Int -> Int -> Int
clamp lo hi x
  ? x < lo = lo
  ? x > hi = hi
  : x
----

Guards can be combined with `where` clauses to define local bindings used in the
conditions and result expressions:

[source, morloc]
----
classify :: Int -> Str
classify x
  ? x > big = "big"
  ? x > small = "medium"
  : "small"
  where
    big = 100
    small = 10
----

Guards may appear inside `let` bindings:

[source, morloc]
----
absLet :: Int -> Int
absLet x =
  let result ? x >= 0 = x
             : neg x
  in result
----

Guards can also be used as inline expressions anywhere a value is expected,
enclosed in parentheses. The parentheses are required to delimit the inline
guard from the surrounding expression:

[source, morloc]
----
classify :: Int -> Str
classify x = (? x > 100 = "big" ? x > 10 = "medium" : "small")
----

# features where

=== `where` and `let` clauses

Functions may use `where` clauses to define local bindings:

[source, morloc]
----
f x = y + b where
    y = x + 1
    b = 41.0
----

Where clauses inherit the scope of their parent and may be nested:

[source, morloc]
----
f = x where
    x = y where
        y = a + b
        a = 1.0
    b = 41.0
----

`let` is the more orderly cousin of `where`. In a `where` clause, bindings can
refer to the function's arguments (from the left-hand side) and can be used in
the main expression (the right-hand side). The bindings in a `where` block are
order-independent -- they may appear in any order and refer to each other freely.

[source, morloc]
----
f n =
  let m = n + 1
  let y = m + 2
  in (m + y)
----

The ability to ignore the result of a `let` binding (using `_`) will become
useful when we move on to computations that have side-effects.

# features patterns

=== Pattern functions for data access/update

Data structures may be accessed and modified using pattern functions. These are
not pattern matching as in Haskell or ML -- rather, they are a dedicated
accessor and update syntax for navigating into data structures. Patterns may be
_getters_ that extract a tuple of values from a data structure or _setters_
that update a data structure without changing its type.

.Getter patterns

A *getter* pattern describes an optionally branching path into a data
structure. Each segment of the path may be a tuple index, a record key, or a
group of indices/keys. The terminal positions in the pattern are returned as
elements in a tuple. Here are a few examples:

[source, morloc]
----
-- return the 1st element in a tuple of any size
.0 (1,2) -- return 1
.0 ((1,3),2,5) -- return (1,3)

-- return the 2nd element in the first element of a tuple
.0.1 ((1,3),2,5) -- return 3 

-- returns the 2nd and 1st elements in a tuple
.(.1,.0) (1,2,3) -- returns (2,1)
.(.1,.0) (1,2)   -- returns (2,1)

-- indices and keys may be used together
.0.(.x, .y.1) ({x=1, y=(1,2), z=3}, 6) -- returns (1,2)
----

These patterns are transformed into functions that may be used exactly like any other
function.

[source, morloc]
----
map .1 [(1,2),(2,3)] -- returns [2,3]
----

.Setter patterns

Setter patterns are similar but add an assignment statement to each pattern
terminus.

[source, morloc]
----
.(.0 = 99) (1,2) -- return (99,2)

-- indices and keys may be used together
.0.(.x=99, .y.1=33) ({x=1, y=(1,2), z=3}, 6) -- returns ({x=99, y=(1,33), z=3}, 6)
----

.Comparison of patterns to Python syntax
[cols="2, 2, 3"]
|===
| Pattern                 | Python                   | Note
                          
| .0                      | lambda x: x[0]           | patterns are functions
| .0 x                    | x[0]                     |
| .0.k x                  | x[0]["k"]                |
| .(.1,.0) x              | (x[1], x[0])             |
| foo .0 xs               | foo(lambda x: x[0], xs)  | higher order
| .(.k = 1) x             | x["k"] = 1               |
|===

Note that setters are designed to not mutate data. The *spine* of the data
structure will be copied which retains links to the original data for unmodified
fields. So the expression `.(.0 = 42) x` when translated into Python will create
a new tuple with the first field being 42 and the remaining fields assigned to
elements of the original field. The same goes for records.


# features infix


=== Infix operators

Morloc supports user-defined infix operators with explicit associativity and
precedence. Operators are declared with `infixl` (left-associative) or `infixr`
(right-associative) followed by a precedence level (higher binds tighter):

[source, morloc]
----
infixl 6 +
infixl 7 *
infixr 8 **
----

Operators are given type signatures by wrapping them in parentheses:

[source, morloc]
----
(+) a :: a -> a -> a
(*) a :: a -> a -> a
(**) :: Int -> Int -> Int
----

Operators may be sourced from foreign languages like any other function:

[source, morloc]
----
source Py from "ops.py" ("add" as (+), "mul" as (*))
----

Infix operators work naturally with typeclasses:

[source, morloc]
----
class Num a where
    zero :: a
    negate :: a -> a
    (+) :: a -> a -> a
    (*) :: a -> a -> a

infixl 6 +
infixl 7 *

instance Num Int where
    source Py from "foo.py" ("add" as (+), "mul" as (*), "neg" as negate)
    zero = 0

-- now we can write natural expressions
test_expr :: Int
test_expr = 4 * 7 + 3  -- evaluates to 31 (precedence: 4*7 first, then +3)
----

Operators may also be imported from other modules:

[source, morloc]
----
import ops ((&), (|))
----



# features intrinsics


=== Intrinsics

Intrinsics are compiler-generated special functions. They are prefixed with `@`
and provide capabilities that cannot be implemented as ordinary sourced
functions -- they require the compiler to generate specialized code based on the
types involved.

==== Reference table

[cols="1,2,3", options="header"]
|===
| Intrinsic | Signature | Description

| `@save`
| `a -> Str -> <IO> ()`
| Save a value to file in flat binary format (fast, minimal overhead)

| `@savem`
| `a -> Str -> <IO> ()`
| Save a value to file in MessagePack format (portable, compact)

| `@savej`
| `a -> Str -> <IO> ()`
| Save a value to file as plain JSON text (human-readable)

| `@load`
| `Str -> <IO> ?a`
| Load a value from file, auto-detecting the format. Returns `null` if the file does not exist.

| `@hash`
| `a -> Str`
| Hash a value via MessagePack serialization (xxhash), returns a 16-character hex string

| `@version`
| `Str`
| The compiler version string (resolved at compile time)

| `@compiled`
| `Str`
| The compilation timestamp (resolved at compile time)

| `@lang`
| `Str`
| The name of the language used in the current pool (resolved at compile time)

| `@schema`
| `a -> Str`
| The serialization schema string for the given type (value is ignored at runtime)

| `@typeof`
| `a -> Str`
| The concrete runtime type name for the given type (value is ignored at runtime)
|===

All intrinsics are polymorphic in their data argument: `@save`, `@savem`,
`@savej`, `@hash`, `@schema`, and `@typeof` accept a value of any type. `@load`
returns a value of any type, inferred from context. The `@save`/`@savem`/`@savej`
functions return `<IO> ()` because they perform I/O as a side effect.


==== Saving and loading data

The `@save`, `@savem`, and `@savej` intrinsics write a value to a file path.
`@load` reads it back. Together they provide a type-safe file persistence
mechanism.

`@save` uses the flat binary format, which is the fastest option -- the value's
in-memory representation is written almost directly to disk with minimal
serialization overhead (no text encoding or schema parsing, only pointer
translation). `@savem` uses MessagePack, which is compact and portable
across different machines and architectures. `@savej` writes plain JSON, which
is human-readable and can be edited by hand or consumed by other tools.

`@load` auto-detects the file format. Files written by `@save` or `@savem`
carry a small header that `@load` uses to distinguish the binary and MessagePack
formats. If no header is present, `@load` tries to parse the file as JSON. This
means `@load` can read files written by any of the three save intrinsics, and it
can also read plain JSON files that were created outside of Morloc.

Since `@load` returns `<IO> ?a`, it is an effectful computation that yields an
optional value. If the file does not exist, the result is `null` rather than an
error. This makes it natural to use `@load` for optional configuration or cached
data.

Here is a basic round-trip example:

[source,morloc]
----
module main (roundTrip)

import root-py (id)

roundTrip :: Int -> Str -> <IO> ?Int
roundTrip x path = do
  @save (id x) path
  @load path
----

The `@save` call writes the integer to the given path. Then `@load` reads it
back. Because `@load` is the final expression in the `do` block, its result
is the return value of `roundTrip`.

You can also use `@savej` when you want the output to be readable:

[source,morloc]
----
module main (saveReadable)

import root-py (id)

saveReadable :: [Str] -> <IO> ()
saveReadable xs = @savej (id xs) "output.json"
----

The resulting `output.json` file is plain JSON that can be inspected in any text
editor.


==== Caching with save and load

A common pattern is to check whether a cached result exists before recomputing
it. Since `@load` returns `null` when the file is missing, you can branch on
the result:

[source,morloc]
----
module main (cachedResult)

import root-py (id, fromNull)

source Py from "compute.py" ("expensiveComputation")
expensiveComputation :: Int -> Int

cachedResult :: Int -> Str -> <IO> Int
cachedResult x cachePath = do
  cached <- @load cachePath
  let result = fromNull (expensiveComputation x) cached
  @save (id result) cachePath
  result
----

On the first call, `@load` returns `null` because the cache file does not exist.
`fromNull` falls through to calling `expensiveComputation`. The result is saved
for future calls. On subsequent calls, `@load` returns the cached value and
`fromNull` uses it directly, skipping the computation.

You can also use `@hash` to build content-addressed caches where the cache path
depends on the input:

[source,morloc]
----
module main (hashedCache)

import root-py (id, concat, fromNull)

source Py from "compute.py" ("expensiveComputation")
expensiveComputation :: Int -> Int

hashedCache :: Int -> <IO> Int
hashedCache x = do
  let key = @hash (id x)
  let cachePath = concat ["/tmp/cache_", key, ".bin"]
  cached <- @load cachePath
  let result = fromNull (expensiveComputation x) cached
  @save (id result) cachePath
  result
----

Each distinct input gets its own cache file, keyed by the xxhash of its
serialized form.


==== Hashing

`@hash` computes a fast, non-cryptographic hash (xxhash) of any value. The
value is first serialized to MessagePack internally, then hashed. The result is
a 16-character hexadecimal string.

[source,morloc]
----
module main (hashInt, hashStr)

import root-py (id)

hashInt :: Int -> Str
hashInt x = @hash (id x)

hashStr :: Str -> Str
hashStr x = @hash (id x)
----

Hashing is deterministic: the same value always produces the same hash. Two
values of different types may hash differently even if they look similar (e.g.,
the integer `1` and the string `"1"`), because their MessagePack serializations
differ.


==== Compile-time constants

The `@version`, `@compiled`, and `@lang` intrinsics are resolved at compile
time. They can be used anywhere a `Str` value is expected.

[source,morloc]
----
module main (info)

import root-py (id)

info :: [Str]
info = id [@version, @compiled, @lang]
----

Running `./info info` might produce:

----
["0.50.0", "2026-02-27T10:30:00Z", "python3"]
----

`@lang` returns the language of the pool where the expression is evaluated. If
the expression is realized in Python, it returns `"python3"`; in {cpp}, it
returns `"cpp"`. This is useful for debugging or for conditional logic based on
which language backend is in use.


==== Type introspection

The `@schema` and `@typeof` intrinsics return information about how the compiler
represents a type. The value argument is not evaluated at runtime -- only its
type matters.

[source,morloc]
----
module main (showSchema, showType)

import root-py (id)

showSchema :: Int -> Str
showSchema x = @schema (id x)

showType :: Int -> Str
showType x = @typeof (id x)
----

`@schema` returns the internal serialization schema string used by the compiler
for MessagePack and binary serialization. `@typeof` returns the concrete type
name in the current language (e.g., `"int"` in Python, `"int"` in {cpp}).
These are primarily useful for debugging and diagnostics.


# features recursion

=== Recursion

Morloc supports recursive function definitions. A function may refer to itself
in its body, and the compiler will generate the appropriate code in the target
language.

The classic factorial function can be written using guards and self-reference:

[source, morloc]
----
fact :: Int -> Int
fact n
  ? n == 0 = 1
  : n * fact (n - 1)
----

Functions may also be mutually recursive. The following pair of functions
determines (rather inefficiently) whether a number is even or odd:

[source, morloc]
----
isEven :: Int -> Bool
isEven n
  ? n == 0 = True
  : isOdd (n - 1)

isOdd :: Int -> Bool
isOdd n
  ? n == 0 = False
  : isEven (n - 1)
----

[CAUTION]
====
Recursive Morloc functions are not equally well supported across all target
languages. Some backends may impose recursion depth limits or lack tail-call
optimization, which can cause stack overflows for deep recursion.

Additionally, if a recursive function calls foreign functions implemented in
different languages, each recursive step may cross a language boundary. These
cross-language calls involve data marshalling and inter-process communication, so
recursion that spans languages will be significantly slower than recursion within
a single language.
====

# features tables

=== Tables

Tables are similar to records, but all fields are lists of equal length:

[source, morloc]
----
module foo (readPeople, addPeople)

import root-py (Int, Str)

source R from "people-tables.R"
   ( "read.delim" as readPeople
   , "addPeople")

table People = People
    { name :: Str
    , age :: Int
    }

readPeople :: Filename -> People
addPeople :: [Str] -> [Int] -> People -> People
----

With "people-tables.R" containing:

[source, r]
----
addPeople <- function(names, ages, df){
    rbind(df, data.frame(name = names, age = ages)) 
}
----

This can be compiled and run as so:

[source, bash]
----
# read a tab-delimited file containing person rows
./foo readPeople data.tab > people.json

# add a row to the table
./foo addPeople '["Eve"]' '[99]' people.json
----

The record and table types are currently strict. Defining functions that add or
remove fields/columns requires defining entirely new records/tables. Generic
functions for operations such as removing lists of columns cannot be defined at
all. For now, most operations should be done in coarser functions.
Alternatively, custom non-parameterized tabular/record types may be defined.

The case study in the Morloc
https://www.zebulun-arendsee.com/images/morloc-paper-001.pdf[paper] uses a
`JsonObj` type that represents an arbitrarily nested object that serializes
to/from JSON. In Python, it deserializes to a `dict` object; in R, to a `list`
objects; and in C to an `ordered_json` object from from
https://github.com/nlohmann/json[Niels Lohmann's JSON package]).

A similar approach could be used to define a non-parameterized table type that
serialized to CSV or some binary type (such as Parquet).

These non-parameterized solutions are flexible and easy to use, but lack the
reliability of the typed structures.


==== Arrow tables

For high-performance cross-language data exchange, tables can use the
https://arrow.apache.org/docs/format/CDataInterface.html[Apache Arrow C Data Interface]
for zero-copy transfer through shared memory. To opt in, declare the table with
an `"arrow"` concrete type for each language:

[source, morloc]
----
table Stats = Stats {idx :: Int, value :: Real}
table Cpp => Stats = "arrow"
table Py  => Stats = "arrow"
table R   => Stats = "arrow"
----

Arrow-annotated tables bypass the standard serialization pipeline entirely.
Column buffers are 64-byte aligned in shared memory and accessed directly by the
receiving language -- no marshalling or copying occurs. In C++, an Arrow table is
represented as an `mlc::ArrowTable` (a move-only RAII wrapper); in Python, a
PyArrow `RecordBatch`; and in R, an Arrow `RecordBatch` from the `arrow`
package. User-facing C++ code can build tables via the bundled
https://github.com/apache/arrow-nanoarrow[nanoarrow] library.

Current limitations:

* *Immutable* -- Arrow tables are read-only once created. There is no in-place
  column append or row insert; the table must be rebuilt.
* *Primitive columns only* -- tested with `Int`, `Real`, `Str`, and `Bool`
  columns. Nested Arrow types (list or struct columns) are not yet supported.
* *No persistent format* -- Arrow is used only for in-memory IPC between
  pools, not for reading or writing Parquet or Feather files.


# features tensors

=== Tensors

Morloc has built-in tensor types with dimensions tracked in the type system.
When all dimensions are known at compile time, the compiler can catch shape
mismatches -- like passing a 3x4 matrix where a 4x3 was expected -- even when
the functions live in different languages. When dimensions are runtime values
(e.g., batch sizes or feature counts from data), the check is deferred.

The standard library defines tensors from 1D to 5D:

[source, morloc]
----
type Tensor1 (d1 :: Nat) a
type Tensor2 (d1 :: Nat) (d2 :: Nat) a
type Tensor3 (d1 :: Nat) (d2 :: Nat) (d3 :: Nat) a
-- ... up to Tensor5
----

The `(d :: Nat)` parameters are type-level natural numbers -- they exist only in
the type system and are erased at runtime. The `a` is the element type (`Real`,
`Int`, etc.). Under the hood, these map to `numpy.ndarray` in Python,
`mlc::Tensor` templates in {cpp}, and `array`/`matrix` in R.

.Writing tensor functions

Tensor signatures use lowercase variables for dimensions. These are implicitly
generic -- the function works for any size:

[source, morloc]
----
-- Works for any m-by-n matrix
transpose :: Tensor2 m n Real -> Tensor2 n m Real

-- Both inputs must have the same shape
add :: Tensor2 m n Real -> Tensor2 m n Real -> Tensor2 m n Real

-- Dot product requires equal-length vectors
dot :: Tensor1 n Real -> Tensor1 n Real -> Real
----

The compiler checks that dimensions line up when you compose these functions. If
you try to add a 3x4 matrix to a 5x6 matrix, you get a type error.

.Dimension arithmetic

Signatures can express arithmetic relationships between dimensions:

[source, morloc]
----
-- Flattening a matrix multiplies its dimensions
flatten :: Tensor2 m n Real -> Tensor1 (m * n) Real

-- Stacking vertically adds rows
vstack :: Tensor2 m n Real -> Tensor2 p n Real -> Tensor2 (m + p) n Real

-- Kronecker product multiplies both dimensions
kron :: Tensor2 m n Real -> Tensor2 p q Real -> Tensor2 (m * p) (n * q) Real
----

When concrete sizes are known, the compiler evaluates the arithmetic and checks
it. For example, flattening a `Tensor2 3 4 Real` produces a `Tensor1 12 Real`
-- and trying to use it where a `Tensor1 13 Real` is expected will fail.

When dimensions are still generic (variables, not numbers), the compiler defers
the check until sizes become known.

.Labeled nat parameters

Sometimes a function's output dimensions depend on its runtime arguments. The
`n:Int` syntax lets you express this:

[source, morloc]
----
-- The integer argument determines the vector length
makeVec :: n:Int -> Tensor1 n Real

-- Two integer arguments determine the matrix shape
makeMat :: m:Int -> n:Int -> Tensor2 m n Real
----

When you call `makeVec 5`, the compiler knows the result is a `Tensor1 5 Real`
and can propagate that through the rest of your program. This works with integer
literals, let-bound variables, and tuple accessors:

[source, morloc]
----
makeVec 5                                        -- Tensor1 5 Real
let n = 3 in makeVec n                           -- Tensor1 3 Real
let dims = (3, 4) in makeMat (.0 dims) (.1 dims) -- Tensor2 3 4 Real
----

.Example: a CNN inference pipeline

Here is a small convolutional neural network for character recognition, written
as a Morloc pipeline over {cpp} tensor functions. The architecture is:
conv2d -> relu -> flatten -> dense -> argmax.

[source, morloc]
----
module main (predictDigit)

import root
import root-cpp

source Cpp from "cnn.hpp"
  ( "makeImage", "makeKernels", "makeBias"
  , "makeWeights", "makeDenseBias"
  , "conv2d", "reluMap", "flatten3d", "dense", "argmax"
  )

-- Construct inputs with labeled dimensions
makeImage   :: h:Int -> w:Int -> Tensor2 h w Real
makeKernels :: k:Int -> fh:Int -> fw:Int -> Tensor3 k fh fw Real
makeBias    :: k:Int -> Tensor1 k Real
makeWeights :: nout:Int -> nin:Int -> Tensor2 nout nin Real
makeDenseBias :: n:Int -> Tensor1 n Real

-- Convolution: output spatial dims shrink by (kernel - 1)
conv2d :: Tensor2 h w Real
       -> Tensor3 k fh fw Real
       -> Tensor1 k Real
       -> Tensor3 k (h - fh + 1) (w - fw + 1) Real

-- ReLU preserves shape
reluMap :: Tensor3 a b c Real -> Tensor3 a b c Real

-- Flatten multiplies all dimensions together
flatten3d :: Tensor3 a b c Real -> Tensor1 (a * b * c) Real

-- Dense layer: matrix-vector multiply plus bias
dense :: Tensor2 m n Real -> Tensor1 n Real -> Tensor1 m Real -> Tensor1 m Real

-- Find the class with highest score
argmax :: Tensor1 n Real -> Int
----

Now the pipeline itself reads like a straightforward description of the
architecture:

[source, morloc]
----
predictDigit :: Int
predictDigit =
  let image    = makeImage 5 5
      kernels  = makeKernels 2 3 3
      bias     = makeBias 2
      convOut  = conv2d image kernels bias
      activated = reluMap convOut
      flat     = flatten3d activated
      weights  = makeWeights 3 18
      denseBias = makeDenseBias 3
      logits   = dense weights flat denseBias
  in argmax logits
----

The compiler infers every intermediate shape from the labeled dimensions. For
example, `makeImage 5 5` is `Tensor2 5 5 Real`. Convolving with 2 kernels of
size 3x3 yields `Tensor3 2 3 3 Real` (since 5 - 3 + 1 = 3). Flattening gives
`Tensor1 18 Real` (2 * 3 * 3 = 18). The dense layer takes `Tensor2 3 18 Real`
weights and a `Tensor1 18 Real` input, and the `18` must match -- if you changed
the kernel count or image size, the compiler would catch the mismatch.

.Opaque dimensions

Not every operation has a predictable output shape. When the output size depends
on runtime values, the dimensions are left as fresh unknowns:

[source, morloc]
----
-- Output size depends on how many elements pass the predicate
filter :: (a -> Bool) -> Tensor1 m a -> Tensor1 i a

-- Output size depends on the integer arguments
slice :: Int -> Int -> Tensor2 m n Real -> Tensor2 i j Real
----

The compiler accepts these but cannot check downstream dimension constraints
against them. Correctness here depends on getting the runtime logic right.

.What the compiler checks (and what it does not)

Morloc checks that dimensions are consistent across your compositions -- but it
trusts the type signatures you write for foreign functions. A {cpp} function
declared as `Tensor2 m n -> Tensor2 n m` but actually implementing the identity
will not be caught. This is the same tradeoff as linking against a C header
file: the types are a contract, and the implementation is expected to honor it.

Arithmetic constraints (like `m * n = 18`) are checked when all variables are
known. When some variables remain free, the check is deferred. If it can never
be resolved, it is effectively unchecked.


