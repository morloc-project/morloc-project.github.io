# 0039: `morloc list -v` prints an empty return type for every command

- Status: fixed
- Found: 2026-09-03, while fixing reports/0032
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`morloc list -v` lists each installed program's commands with their types. The
line is built as `name :: returnType`, so it should read `nums :: [Int]`.

## Observed

The type is always empty.

```
$ morloc list -v
...
Programs:
  fmt  1 command
    nums ::
```

The manifest has the type:

```
$ python3 -c "import json;print(json.load(open('fmt-build/manifest.json'))['commands'][0]['return'])"
{'schema': 'aj', 'type': '[Int]', 'desc': [], 'constraints': [], 'metadata': {}}
```

## Reproduce

Any installed program, then `morloc list -v`.

```
module fmt (nums)
import root-py
source Py from "fmt.py" ("mk")
mk :: Int -> [Int]
--' The first n natural numbers
nums :: Int -> [Int]
nums = mk
```

with `fmt.py`:

```
def mk(n):
    return list(range(n))
```

Then `morloc make --install -o fmt fmt.loc && morloc list -v`.

## Impact

The verbose listing is the one place `morloc list` claims to show types, and it
shows none. Small, but it makes `-v` pointless.

## Guess

Verified by reading, not by patch: `ProgramCommand`'s parser
(`executable/Subcommands.hs:854`) reads a top-level key `"return_type"`. The
manifest emits `"return"`, an object whose `"type"` field holds the string. The
`.:?` default silently supplies `""`.

## Resolution

Fixed in `morloc` commit `843e95d1`.

`morloc list -v` reads the return type from the command's nested `return`
object rather than a flat `return_type` key the manifest has never emitted, so
it prints `nums :: [Int]` where it printed `nums ::`.
