# 0056: a Python source file whose name collides with a module or a generated variable breaks the pool

- Status: fixed
- Found: 2026-09-05, probing newtype serialization in nested positions
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`source Py from "copy.py" ("f")` should call `f` from the user's `copy.py`.
The file name a user picks for their own code should not have to avoid a
reserved list they are never shown.

## Observed

The generated pool binds the user's module to a global named after the file
stem, verbatim:

```python
# AUTO include user-sources start
e = importlib.import_module("e")
# AUTO include user-sources end
```

That produces two distinct failures, both at runtime and neither naming the
file.

**A stem that matches a Python standard-library module** imports the stdlib
module instead, so none of the user's functions are found:

```
$ ./t_copy f '["a","b"]'
Error: run failed
module 'copy' has no attribute 'types_in'
  at f [py] (mid=1, t_copy.loc:1:14)
```

Reproduced identically with `copy.py`, `struct.py`, `array.py`, and `time.py`
-- all modules the pool preamble itself imports.

**A stem that matches a local variable in the generated manifold** is shadowed
by Python's function-scope rule. The generated code is:

```python
        n1 = e.types_in(n0)
    except Exception as e:
            raise RuntimeError(f"{e!s}\n  at f [py] (mid=1, plain.loc:1:14)")
```

`except ... as e` makes `e` local for the whole function, so the call on the
line above resolves to the unbound local rather than the module global:

```
$ ./plain f '["a","b"]'
Error: run failed
cannot access local variable 'e' where it is not associated with a value
  at f [py] (mid=1, plain.loc:1:14)
```

This one fires on every call, including the happy path.

## Reproduce

`e.py`:

```python
def types_in(xs):
    return [type(x).__name__ for x in xs]
```

`plain.loc`:

```
module main (f)
import root-py
source Py from "e.py" ("types_in" as f)
f :: [Str] -> [Str]
```

```
$ morloc make -o plain plain.loc
$ ./plain f '["a","b"]'
Error: run failed
cannot access local variable 'e' where it is not associated with a value
```

Rename the file to `helpers.py`, change the `source` line to match, and the
same program prints `["str","str"]`.

For the stdlib variant, copy the same file to `copy.py` and source from that.

## Impact

`copy.py`, `time.py`, `array.py`, `struct.py`, `types.py`, `io.py`, `json.py`
are all ordinary names for a helper module in a real project. The failure is a
runtime error inside the user's own manifold that says nothing about file
names, so the natural reading is that the morloc function is wrong. `e.py` is
rarer but fails more confusingly, since the message mentions a variable the
user never wrote.

## Guess

Unverified: the user-sources block would be safe if the binding were namespaced
(`_mlc_src_e = importlib.import_module(...)`, references rewritten to match)
and the import were resolved against the pool directory explicitly rather than
by plain module name.

## Resolution

Fixed 2026-09-05, in the working tree (not yet committed). Three changes, for
what turned out to be three separate mechanisms behind one symptom.

**1. The binding name is reserved.** `makeNamespace` in
`library/Morloc/CodeGenerator/Grammars/Translator/Generic.hs` now prefixes the
pool-side name with `<ldHelperVarPrefix>src_`, so `e.py` binds
`__morloc_src_e` rather than `e`. A bare helper prefix would not have been
enough: generated helper variables are `__morloc_cache_key`,
`__morloc_debug_e` and the like, so a file named `cache_key.py` would just
have moved into a new collision. The `src_` segment keeps the two spaces
disjoint. `makeNamespace` feeds both the binding and every call site, so the
two stay consistent by construction.

**2. Sources load by location, not by module name.** The Python import
template now calls `_mlc_import_source` (`data/lang/py/pool.py`), which
resolves the file on `sys.path` and loads it through
`importlib.util.spec_from_file_location` under a reserved `sys.modules` key.
`importlib.import_module` could not work here: `sys.path` already had the
source root first, so this was never a path-resolution problem -- the name was
being answered from the `sys.modules` cache. That is why `json.py` and
`textwrap.py` worked while `copy.py` and `time.py` did not, and why `heapq.py`
failed too despite nothing importing it directly.

The reserved key is what keeps the fix from causing the opposite bug: a source
file is never registered under the real module's name, so `import copy` from
inside another source file still reaches the standard library.

**3. The runtime is imported before the source root is visible.** A file named
`pymorloc.py` broke the pool by a different route -- the preamble's own
`import pymorloc as morloc` was answered from the program's source root. The
preamble in `data/lang/py/lang.yaml` now adds the morloc-owned directories,
imports the runtime, and only then adds the source root. The resulting
`sys.path` is unchanged; only the moment of the import differs.

Only Python is affected in practice (`ldQualifiedImports` is true for no other
language); R and {cpp} sources named `copy.R` / `copy.hpp` were verified
unaffected.

Covered by `test-suite/golden-tests/python-source-name-collision`, nine cases:
`copy`, `time`, `struct`, `heapq` (in `sys.modules`), `json` (a stdlib name
that is not loaded), `sub/copy` (a collision reached through a dotted path),
`e` (the generated-variable collision), `pymorloc` (the runtime import), and a
sibling file whose `import copy` must still reach the standard library.
