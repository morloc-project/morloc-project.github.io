# 0052: a per-language type declaration with the wrong arity fails late, in Haskell syntax

- Status: fixed
- Found: 2026-09-04, surveying the Packable surface for reports 0048-0050
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`type Py => (Box a) = "dict"` gives a one-parameter constructor a native form
that takes no parameters. This is legal, and the standard library relies on it:

```
type Cpp => (IFile a)   = "uint64_t"
type Cpp => (IStream a) = "uint64_t"
type Py  => (IFile a)   = "int"
type R   => (IFile a)   = "bit64"
```

A use site of such a type must therefore get the declared native form, with the
parameter dropped, wherever that form is needed.

## Observed

It is accepted, then fails during serialization with a message that prints a
Haskell constructor tree at the user:

```
Here the unresolved concrete packed type:
  b: forall a . dict

Should be the subtype of the resolved packed type:
  a: AppF (VarF (FV (TV {unTVar = "Box"}) (CV {unCVar = "dict"}))) [VarF (FV (TV {unTVar = "Int"}) (CV {unCVar = "int"}))]

However, the b <: a step failed:
Cannot compare types dict and dict int
```

The declaration says the native form takes no parameters; the use site's
concrete type is built as `dict` applied to `int` regardless. The two are then
compared and cannot match, so the arity in the declaration is honoured on one
side and ignored on the other.

Dropping one parameter of two fails earlier and just as opaquely:

```
$ morloc make -o p3 p3.loc
Failed to infer concrete type for Tag Str Int: Could not reduce type in broadest scope
```

## Reproduce

```
module p2 (howInt)
import root-py
newtype Box a
type Py => (Box a) = "dict"
instance Packable [a] (Box a) where
  source Py from "b.py" ("pack_generic" as pack, "unpack_generic" as unpack)
source Py from "b.py" ("how" as how)
how :: Box a -> Str
howInt :: Box Int -> Str
howInt = how
```

with any `b.py` defining `pack_generic`, `unpack_generic` and `how`. A single
instance is enough; this does not need instance selection.

The phantom-parameter variant is the same declaration with two parameters and
one used:

```
newtype Tag t a
type Py => (Tag t a) = "dict" a
```

## Impact

Two separate costs. The declaration is wrong and is not diagnosed where it is
written, so the error arrives far from its cause with no indication that the
arity is what is at fault. And the message leaks `AppF (VarF (FV (TV {unTVar =
...})))` into user-facing output, which tells a user nothing and exposes
internal representation.

The second point is not confined to this bug: the same error site prints that
tree for every serialization mismatch that reaches it, including the ones in
reports 0049 and 0051.

## Guess

Partly verified: the standard-library declarations above compile and run, so
dropping parameters is supported. What differs is which path the type takes.

`IFile` and friends are declared `newtype IFile a = U64` -- they have a wire
parent, so they route through the alias-expansion branch, whose arg weaving is
explicitly arity-aware ("the concrete side may be shorter than the general
side"). A type whose wire form comes from a `Packable` instance instead has no
wire parent and routes through the packer branch, where the use site's concrete
type is built by applying the general arguments to the concrete head without
regard for how many the declaration actually takes. `Box Int` becomes `dict int`
against a declared `dict`, and the two cannot match.

Sharper: the two sides of the failing comparison are produced by two different
inference functions with different conventions. `inferConcreteType` runs a
structural pass that deliberately *retains* the general arguments, so that a
parameterised newtype with a non-templated per-language form keeps its head for
downstream pattern matching -- the comment at `Infer.hs:66` says so, naming
`IFile` as the case it exists for. `inferConcreteTypeU` does not run that pass.

`resolveP` compares one against the other: the instance head goes through
`inferConcreteTypeU` and becomes `dict`, the use site goes through
`inferConcreteType` and becomes `dict int`. Neither is wrong on its own terms;
they are simply not comparable, and nothing reconciles them.

So the fix is not an arity check at the declaration -- that would reject
`IFile` and every type like it -- and it is not to stop retaining the arguments,
which is load-bearing elsewhere. It is to make the comparison arity-tolerant the
way `weaveTypeFArgs` already is on the weaving path, or to put both sides
through the same inference.

The Haskell tree in the message was a separate defect: `instance Pretty TypeF`
was defined as `pretty = viaShow`, so every `TypeF` in every error printed as a
constructor tree. That half is fixed.

## Resolution

Fixed in `morloc` commit `7accdbfe`.

The fix is an arity check, but not the one this report first proposed.

A type that declares its own per-language form must list every parameter. A
type with no declaration inherits its concrete form through its wire parent --
`newtype PatternChain a b = Str` takes Str's mapping -- and an inherited form
cannot carry the newtype's parameters, so those arguments are still carried by
the compiler. The two cases are distinguishable by whether the concrete scope
holds an entry for the constructor, which is what the check tests.

That removes the fabrication that caused the mismatch. `inferConcreteType` no
longer invents `dict int` from a declaration that said `dict`; the declaration
now says `dict a`, and the two inference functions agree by construction rather
than by patching the comparison between them.

The standard library's handle types were the only declarations that omitted a
parameter, and they now list it:

```
type Py   => (IFile a)   = "int" a
type Cpp  => (IStream a) = "uint64_t" a
type R    => (OStream a) = "bit64" a
type Rust => (IFile a)   = "u64" a
```

The woven result is unchanged -- `AppF (VarF (FV IFile int)) [VarF (FV Str str)]`
either way -- because listing the parameter produces exactly what the retention
clause used to fabricate. The declaration now states what the compiler was
already assuming.

A parameter the native macro does not interpolate is still listed. `"int"` has
no `$1`, and Python's `"list" a` has none either; listing is about which
parameters the form carries, not about which the macro consumes.

## Note on an approach that was tried and reverted

An earlier attempt classified parameters as phantom -- Type-kinded and absent
from the type's wire form -- and erased them from the woven type. It broke 26
tests. `IStream a`'s parameter is absent from the *handle's* wire form, since a
handle is a `u64`, but it is read at `Serialize.hs:711` and compiled into the
MessagePack schema for the stream's payload. The handle is a `u64`; the traffic
is `a`.

Every candidate for a phantom parameter turned out to be like this: `IFile`,
`IStream` and `OStream` supply the payload schema, and `PatternChain a b` has
its parameters constructed at `Express.hs:1004` to carry a receiver and output
type. Nothing in the language is currently phantom, so the concept was dropped
rather than built on an empty category.
