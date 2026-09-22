# 4.13. Recursion

Morloc Manual > Syntax and Features | https://morloc-project.github.io/docs/features/recursion.html | prev: https://morloc-project.github.io/docs/features/conditionals.md | next: https://morloc-project.github.io/docs/features/sum-types.md

## 4.13.1. Recursive functions

A function may refer to itself, and the compiler generates the corresponding recursion in the target language. Factorial, with guards:

```morloc
fact :: Int -> Int
fact n
  ? n == 0 = 1
  : n * fact (n - 1)
```

```console
$ ./recur fact 10
3628800
```

Functions may also be mutually recursive. This pair decides, inefficiently, whether a number is even:

```morloc
isEven :: Int -> Bool
isEven n
  ? n == 0 = True
  : isOdd (n - 1)

isOdd :: Int -> Bool
isOdd n
  ? n == 0 = False
  : isEven (n - 1)
```

```console
$ ./recur isEven 10
true
```

> **Caution**
> Recursion is not equally well supported across target languages. Some impose a recursion depth limit or lack tail-call optimization, so deep recursion can overflow the stack or crash the pool.

## 4.13.2. Recursive types

A type is **recursive** when its definition refers to itself. To terminate, that recursion has to be guarded: every cycle through the definition must pass under an `?T` (optional, with `Null` as the base case) or a `[T]` (list, with `[]` as the base case).

A bare self-reference is rejected at compile time:

```console
recx.loc:5:1: Type alias 'X' has a vacuous body: it reduces to a self-reference with no payload
    |
  5 | type X = X
    | ^
```

The examples below need one stdlib import for working with optional values:

```morloc
import maybe-py (require, isNull)
```

`isNull` tests whether an optional is absent; `require` asserts it is present and strips the `?`.

### Linked lists

The canonical case: a payload paired with an optional tail of the same type. When the tail slot reaches `Null`, the chain ends.

```morloc
type LL a = (a, ?(LL a))

llExample :: LL Int
llExample = (42, (7, (99, Null)))
```

```console
$ ./recur llExample
[42,[7,[99,null]]]
```

A builder producing a descending range:

```morloc
llRange :: Int -> LL Int
llRange n ? n > 0 = (n, llRange (n - 1))
          : (0, Null)
```

```console
$ ./recur llRange 3
[3,[2,[1,[0,null]]]]
```

The recursive call returns `LL Int`, but the second slot wants `?(LL Int)`. The typechecker’s element-wise coercion from `a` to `?a` bridges that with no annotation. The base case writes `Null` straight into the optional slot.

Consumers use the tuple selectors `.0` and `.1`:

```morloc
llLen :: LL Int -> Int
llLen x ? isNull (.1 x) = 1
        : 1 + llLen (require (.1 x))

llSum :: LL Int -> Int
llSum x ? isNull (.1 x) = .0 x
        : (.0 x) + llSum (require (.1 x))
```

```console
$ ./recur llLen '[1,[2,[3,null]]]'
3
$ ./recur llSum '[1,[2,[3,null]]]'
6
```

### Branching: binary trees

A node can carry more than one optional child, giving a branching structure. A binary tree node has a payload and two independently optional subtrees, so it may have zero, one, or two children:

```morloc
type BTree a = (a, ?(BTree a), ?(BTree a))

btreeExample :: BTree Int
btreeExample = (10, (5, Null, Null), (15, Null, Null))
```

```console
$ ./recur btreeExample
[10,[5,null,null],[15,null,null]]
```

A balanced builder, sharing its subtree through `let`:

```morloc
btreeBuild :: Int -> BTree Int
btreeBuild d ? d <= 0 = (1, Null, Null)
             : let sub = btreeBuild (d - 1)
               in (0, sub, sub)
```

```console
$ ./recur btreeBuild 2
[0,[0,[1,null,null],[1,null,null]],[0,[1,null,null],[1,null,null]]]
```

Summing every payload reads best when the optional handling is factored into a helper, leaving the main function as the structural recursion it is:

```morloc
btreeSum :: BTree Int -> Int
btreeSum x = .0 x + maybeSum (.1 x) + maybeSum (.2 x)

maybeSum :: ?(BTree Int) -> Int
maybeSum m ? isNull m = 0
           : btreeSum (require m)
```

```console
$ ./recur btreeSum '[10,[5,null,null],[15,null,null]]'
30
```

### List-guarded recursion: rose trees

The other permitted guard is `[T]`. An empty list is the natural base case, and arbitrary branching falls out as a list of children rather than a fixed number of optional slots:

```morloc
type Rose a = (a, [Rose a])

roseExample :: Rose Int
roseExample = (1, [(2, []), (3, [])])
```

```console
$ ./recur roseExample
[1,[[2,[]],[3,[]]]]
```

A builder for a complete binary rose tree, and a sum that folds the children:

```morloc
roseBuild :: Int -> Rose Int
roseBuild d ? d <= 0 = (1, [])
            : let sub = roseBuild (d - 1)
              in (0, [sub, sub])

roseSum :: Rose Int -> Int
roseSum x = .0 x + fold (\acc child -> acc + roseSum child) 0 (.1 x)
```

```console
$ ./recur roseBuild 2
[0,[[0,[[1,[]],[1,[]]]],[0,[[1,[]],[1,[]]]]]]
$ ./recur roseSum '[1,[[2,[]],[3,[]]]]'
6
```

### Record form

The same rules apply to `record` declarations. The only surface difference is that fields are addressed by name instead of position; the wire format and the typecheck rules are identical to the tuple-alias form. This is an alternative encoding of the same linked list, so it lives in its own program below — two declarations of `LL` cannot share a module.

```morloc
record LL where
  head :: Int
  tail :: ?LL

llRecordExample :: LL
llRecordExample = {head = 42, tail = {head = 7, tail = Null}}

llLen :: LL -> Int
llLen x ? isNull (.tail x) = 1
        : 1 + llLen (require (.tail x))
```

```console
$ ./recrec llRecordExample
{"head":42,"tail":{"head":7,"tail":null}}
$ ./recrec llLen '{"head":1,"tail":{"head":2,"tail":null}}'
2
```

### Parameterised recursion

Recursive types can carry type parameters, which thread through every recursive position:

```morloc
record Container a where
  val :: a
  sub :: ?(Container a)

containerExample :: Container Int
containerExample = {val = 1, sub = {val = 2, sub = Null}}

containerLength :: Container a -> Int
containerLength x ? isNull (.sub x) = 1
                  : 1 + containerLength (require (.sub x))
```

```console
$ ./recrec containerExample
{"val":1,"sub":{"val":2,"sub":null}}
```

`containerLength` stays polymorphic in the payload, which is what you want inside a program. It cannot be given a command line interface, though, so exporting it draws a warning and the program builds without that one command:

```console
$ morloc make recrec.loc
Warning: skipping generic export 'containerLength'
```

> **Caution**
> Mutually recursive type aliases — two or more type definitions that reference each other in a cycle — are not supported. The frontend detects them and names the cycle:
> 
> ```console
> recy.loc:5:1: error:
> Mutual recursion between type definitions is not supported. Cycle: A, B
>   |
> 5 | type A = (Int, B)
>   | ^
> ```
> 
> The rule holds across general and language-specific scopes, and whether the cycle lives in one module or spans several.
