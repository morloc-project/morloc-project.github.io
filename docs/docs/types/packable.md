# 4.5. Serializing custom types with `Packable`

Morloc Manual > Advanced Types | https://morloc-project.github.io/docs/types/packable.html | prev: https://morloc-project.github.io/docs/types/newtype.md | next: https://morloc-project.github.io/docs/types/kinds.md

Morloc can move a value between languages when it knows how to write that value down. Primitives, lists, tuples and records all have a canonical written form, so they cross a boundary with no help from you. A type that does not decompose into those forms needs you to say what it looks like on the wire. You say it by declaring a `Packable` instance.

Consider `Map k v`. In Python it is a `dict`, in C++ a `std::map`, in R a named list; it could equally be a list of pairs, a pair of columns, or a balanced tree. None of those is more canonical than the others. What they share is that any of them can be written as a list of key/value pairs, and that is what `Packable` records.

The class lives in `internal` and has two methods:

```morloc
class Packable a b where
    pack :: a -> b
    unpack :: b -> a
```

`a` is the wire form and `b` is the type being described. `pack` builds the type from its wire form, `unpack` takes it apart.

## 4.5.1. When a `newtype` needs a `Packable` instance

The type you most often describe this way is a `newtype` ([Naming a type: `type` and `newtype`](https://morloc-project.github.io/docs/types/newtype.md)), which crosses a language boundary as its wire parent, the type on its right-hand side. Whether anything has to convert that wire value into the newtype’s native form — and so whether you need a `Packable` instance — depends on one question: is the native form something the pool already has?

**Declare no per-language form and the answer is yes.** The newtype inherits its parent’s native form, so the value that arrives already is the right thing. No instance is needed, whatever the parent’s shape — a primitive, a list, a tuple, or another newtype.

**Declare a form and it travels with the value as a schema hint.** If the language binding knows how to build that form, you still need no instance. Python’s binding recognises `bytes`, `bytearray`, `list`, and `numpy.ndarray`.

**Anything else needs a `Packable`.** The instance is the general answer: it says how to build the native form from the wire form and back.

Three newtypes over `Str`, one of each kind:

**forms.loc**

```morloc
module main (nameKind, blobKind, pathKind)

import root-py

newtype Name = Str

newtype Blob = Str
type Py => Blob = "bytes"

newtype Path = Str
type Py => Path = "pathlib.Path"

source Py from "native.py"
  ("kind" as nameKind, "kind" as blobKind, "kind" as pathKind)

nameKind :: Name -> Str
blobKind :: Blob -> Str
pathKind :: Path -> Str
```

**native.py**

```python
import pathlib

def kind(x):
    return type(x).__name__

def str_to_path(s):
    return pathlib.Path(s)

def path_to_str(p):
    return str(p)
```

`kind` reports what the pool actually received:

```console
$ morloc make -o forms forms.loc
$ ./forms nameKind notes/report.txt
"str"
$ ./forms blobKind notes/report.txt
"bytes"
$ ./forms pathKind notes/report.txt
"str"
```

`Name` inherits ``Str’s form and gets a `str``, as declared. `Blob` asked for `bytes` and got one, with no instance, because the Python binding builds that hint. `Path` asked for `pathlib.Path` and got a `str` — the binding does not know that hint, and nothing said so.

> **Warning: An unsupported form is dropped silently**
> That third line is a trap. The module declares `pathlib.Path`, the pool receives a `str`, and there is no error and nothing on stderr. Your foreign function fails later, against a contract the compiler accepted.
> 
> Add the `Packable` instance and it is right:
> 
> ```morloc
> instance Packable Str Path where
>   source Py from "native.py" ("str_to_path" as pack, "path_to_str" as unpack)
> ```
> 
> ```console
> $ ./forms2 pathKind notes/report.txt
> "PosixPath"
> ```
> 
> Until this is caught at compile time, write the instance whenever you declare a per-language form outside the four the binding recognises.

A worked example with the instance in place, and a typeclass scoped to the new type:

**path.loc**

```morloc
module main (ext, joined, absolute)

import root-py

newtype Path = Str
type Py => Path = "pathlib.Path"

instance Packable Str Path where
  source Py from "pathlib_ops.py" ("str_to_path" as pack,
                                   "path_to_str" as unpack)

class Filelike a where
  extension  :: a -> Str
  joinPath   :: a -> a -> a
  isAbsolute :: a -> Bool

instance Filelike Path where
  source Py from "pathlib_ops.py"
    ( "path_extension"   as extension
    , "path_join"        as joinPath
    , "path_is_absolute" as isAbsolute
    )

ext :: Path -> Str
ext = extension

joined :: Path -> Path -> Path
joined = joinPath

absolute :: Path -> Bool
absolute = isAbsolute
```

**pathlib\_ops.py**

```python
import pathlib

def str_to_path(s):
    return pathlib.Path(s)

def path_to_str(p):
    return str(p)

def path_extension(p):
    return p.suffix

def path_join(a, b):
    return a / b

def path_is_absolute(p):
    return p.is_absolute()
```

```console
$ morloc make -o prog path.loc
$ ./prog ext 'notes/report.txt'
".txt"
$ ./prog joined '/home/z' 'notes.txt'
"\/home\/z\/notes.txt"
$ ./prog absolute 'notes.txt'
false
```

`Filelike` methods are available on `Path` and not on bare `Str`, which is exactly the constraint that makes the `newtype` worth declaring: a function over filesystem paths cannot be handed an arbitrary string.

## 4.5.2. A worked example: `Map`

`Map` follows the same pattern as `Path`, with type parameters and two languages: a `newtype` over a list of pairs, with a form in each language. The `Packable` instance says how each native form converts to and from that list:

**counts.loc**

```morloc
module main (tally, topCount)

import root-py
import root-cpp

newtype Map key val = [(key, val)]

type Py  => Map key val = "dict" key val
type Cpp => Map key val = "std::map<$1,$2>" key val

instance Packable [(a, b)] (Map a b) where
    source Py  from "map-packing.py"  ("pack", "unpack")
    source Cpp from "map-packing.hpp" ("pack", "unpack")

source Py from "counts.py" ("tally")
tally :: [Str] -> Map Str Int

source Cpp from "counts.hpp" ("biggest")
biggest :: Map Str Int -> Int

topCount :: [Str] -> Int
topCount = biggest . tally
```

The packers are ordinary functions in their own languages. Python:

**map-packing.py**

```python
def pack(xs):
    return dict(xs)

def unpack(d):
    return list(d.items())
```

C++:

**map-packing.hpp**

```cpp
#pragma once
#include <map>
#include <tuple>
#include <vector>

template <class K, class V>
std::map<K,V> pack(std::vector<std::tuple<K,V>> xs){
    std::map<K,V> m;
    for (auto& kv : xs) m[std::get<0>(kv)] = std::get<1>(kv);
    return m;
}

template <class K, class V>
std::vector<std::tuple<K,V>> unpack(std::map<K,V> m){
    std::vector<std::tuple<K,V>> xs;
    for (auto& kv : m) xs.push_back({kv.first, kv.second});
    return xs;
}
```

And the two functions that actually do the work:

**counts.py**

```python
def tally(words):
    d = {}
    for w in words:
        d[w] = d.get(w, 0) + 1
    return d
```

**counts.hpp**

```cpp
#pragma once
#include <map>
#include <string>

inline int biggest(std::map<std::string,int> m){
    int best = 0;
    for (auto& kv : m) if (kv.second > best) best = kv.second;
    return best;
}
```

`topCount` composes a Python function that returns a `dict` with a C++ function that takes a `std::map`. Neither language knows about the other:

```console
$ morloc make -o counts counts.loc
$ ./counts topCount '["a","b","a"]'
2
$ ls counts-build/pools/
cpp
py
```

The standard library ships a fuller `Map` in its `map` module, declared exactly this way — `newtype Map a b = [(a, b)]`, then `instance Packable [(a, b)] (Map a b)`, with the per-language forms and packers in `map-py`, `map-cpp` and `map-r`. The version above is standalone so it can be read on its own.

You never call `pack` or `unpack` yourself here. The compiler builds a serialization tree from the general type and generates the native code to decompose the value recursively until only primitives remain. Those are what travel. The wire form is also what the command line accepts and prints, which is why `Map Str Int` appears as a list of pairs:

```console
$ ./counts tally '["a","b","a"]'
[["a",2],["b",1]]
```

## 4.5.3. Specialized instances

A native type is sometimes less general than the Morloc type. R’s named list, for example, can only have string keys. Declare a narrower instance and the compiler will use it where it fits and prune the language elsewhere:

```morloc
type R => Map key val = "list" key val

instance Packable [(Str, b)] (Map Str b) where
    source R from "map-packing.R" ("pack", "unpack")
```

If R is the only language available and a signature demands a non-string key, the program does not build:

**ronly.loc**

```morloc
module main (countStr, countInt)

import root-r

newtype Map key val = [(key, val)]
type R => Map key val = "list" key val

instance Packable [(Str, b)] (Map Str b) where
    source R from "map-packing.R" ("pack", "unpack")

source R from "ops.R" ("count_keys" as countKeys)
countKeys :: Map a b -> Int

countStr :: Map Str Int -> Int
countStr = countKeys

countInt :: Map Int Str -> Int
countInt = countKeys
```

```console
$ morloc make -o ronly ronly.loc
ronly.loc:1:24: error:
No Packable instance covers 'Map Int Str' (concrete: list integer character).
Instances declared for Map, and why each was rejected:
  forall b . Map Str b
    its concrete form forall b . list character b does not cover list integer character: Cannot compare types character and integer
  |
1 | module main (countStr, countInt)
  |                        ^
```

That is the message telling you the R backend cannot serve `Map Int Str`. With a Python implementation also in scope, the same program compiles and the R implementations are not selected.

## 4.5.4. Sharing a wire format across newtypes

`newtype` is how a family of related types share one serialized representation while keeping distinct behaviour. `root` declares `Deque` this way:

```morloc
newtype Deque a = List a
instance Packable (List a) (Deque a)
```

`Deque` is a separate type from `List` — it has its own `Stack` and `Queue` instances, tuned to a deque’s performance profile — but it travels as a flat list, so on the command line it looks like one:

**deque.loc**

```morloc
module main (pushFront, asList)

import root-py

pushFront :: Int -> Deque Int -> Deque Int
pushFront = cons

asList :: Deque Int -> [Int]
asList = unpack
```

```console
$ morloc make -o prog deque.loc
$ ./prog pushFront 0 '[1,2,3]'
[0,1,2,3]
$ ./prog asList '[1,2,3]'
[1,2,3]
```

`asList` calls `unpack` itself: it is the explicit conversion from a `Deque` back to its wire form that the nominal distinction demands.

## 4.5.5. Deriving `Packable` for a `newtype`

A newtype with no native form of its own needs no foreign code to convert to and from its wire parent, but you still decide whether `pack` exists.

`unpack` you always get. Every `newtype` with a right-hand side can be unwrapped, with no declaration at all. `pack` you get by deriving `Packable`, with the `deriving` clause of [Deriving instances](https://morloc-project.github.io/docs/types/typeclasses.md#deriving):

**temp.loc**

```morloc
module main (fromReal, toReal)

import root-py

newtype Celsius = Real deriving (Packable)

fromReal :: Real -> Celsius
fromReal = pack

toReal :: Celsius -> Real
toReal = unpack
```

```console
$ morloc make -o temp temp.loc
$ ./temp fromReal 21.5
21.5
$ ./temp toReal 21.5
21.5
```

Neither conversion changes the value. A `Celsius` is a `Real` on the wire, so the conversion is free when it happens as part of passing the value to another language, and it is free inside a language too as long as `Celsius` declares no native form of its own there. If it does, say `type Py => Celsius = "MyCelsius"`, then something has to build that object. The compiler moves the conversion to a boundary with a language where `Celsius` has no form of its own, and when the program has no such language it stops:

```console
$ morloc make -o formed formed.loc
formed.loc:5:1: error:
Cannot convert between 'Celsius' and its representation in py: Celsius has a py form of its own, and no language without one is available.
  |
5 | newtype Celsius = Real deriving (Packable)
  | ^
```

The fix is a hand-written `Packable` instance that sources the conversion in that language, in place of the `deriving` clause.

Leave out `deriving (Packable)` and `pack` is not defined:

```console
$ morloc make -o nopack nopack.loc
nopack.loc:8:12: error:
General type error: No instance found for Packable::pack at type Real -> Celsius
  The newtype 'Celsius' has no 'pack'; add 'deriving (Packable)' to its declaration or declare a Packable instance.
  |
8 | fromReal = pack
  |            ^
```

That is deliberate: the point of a `newtype` is that you cannot create one by accident.

`pack` is derivable only when the right-hand side fixes every parameter of the newtype. Below, `(n :: Nat)` is a length carried in the type ([The kind system](https://morloc-project.github.io/docs/types/kinds.md)). It appears only on the left and cannot be recovered from the list it wraps, so this is rejected:

```console
$ morloc make -o sized sized.loc
sized.loc:5:47: 'Sized' cannot derive Packable: its representation does not determine 'n'
    |
  5 | newtype Sized (n :: Nat) a = List a deriving (Packable)
    |                                               ^
```

For a type like that, write the `Packable` instance by hand, as the standard library does for `Vector`, its length-indexed list ([Tensors](https://morloc-project.github.io/docs/types/tensors.md)).

## 4.5.6. `pack` in your own code

`pack` and `unpack` are ordinary methods, so you can call them, as `asList` and `fromReal` above do.

Calling `pack` has one sharp edge. If the wire form itself contains a packable type, the compiler will not chain the two conversions and reports a missing instance. Annotate the inner expression with its type and it goes through; [Tensors](https://morloc-project.github.io/docs/types/tensors.md) shows this for a `Matrix` literal.
