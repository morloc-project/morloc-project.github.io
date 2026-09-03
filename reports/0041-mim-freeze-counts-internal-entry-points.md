# 0041: `mim freeze` counts and records the compiler's internal entry points

- Status: open
- Found: 2026-09-03, tracing which consumers read `manifest.json` before a schema change
- Component: mim
- morloc: 0.100.2     mim: 0.28.0

## Expected

A program's manifest describes more commands than a user can invoke: every
`--' with:` / `--' render:` directive makes the compiler synthesize a hidden
entry point and mark it `"internal": true`. Anything reporting a program's
command surface should filter on that flag. The nexus does, and as of `morloc`
commit `843e95d1` so do `morloc list` and the generated shell completions
(see `reports/SOLVED_0032`).

`mim freeze` reports a command count per program and writes the command list
into `freeze-manifest.json`, so it should report the same surface.

## Observed

`parse_manifest_commands` (`mim/src/freeze.rs:221`) maps every
`commands[].name` with no filter. Its stub does not deserialize the field at
all, so it cannot filter:

```rust
#[derive(serde::Deserialize)]
struct ManifestStub {
    #[serde(default)]
    commands: Vec<ManifestStubCmd>,
}
#[derive(serde::Deserialize)]
struct ManifestStubCmd {
    name: String,
}
```

For a one-export program carrying two action directives:

```
$ python3 -c "
import json
m=json.load(open('fmt-build/manifest.json'))
print('mim freeze would extract:', [c['name'] for c in m['commands']])
print('the program accepts    :', [c['name'] for c in m['commands'] if not c['internal']])
"
mim freeze would extract: ['nums', 'mlcp_nums_count', 'mlcp_nums_plain']
the program accepts    : ['nums']
```

The list reaches the user twice: `serve.rs:616` prints
`"  [ok] {name} ({n} commands)"` during freeze validation, and `ProgramEntry`
derives `Serialize`, so the names are written into `freeze-manifest.json` and
travel with the frozen bundle.

## Reproduce

`fmt.py`:

```
def mk(n):
    return list(range(n))


def as_lines(xs):
    return "".join("%d\n" % x for x in xs)
```

`fmt.loc`:

```
module fmt (nums)

import root-py

source Py from "fmt.py" ("mk", "as_lines" as asLines)

mk :: Int -> [Int]

--' Print one number per line
asLines :: [Int] -> Str

--' Count the numbers
countThem :: [Int] -> U64
countThem = size

--' The first n natural numbers
--' @with   -c/--count=countThem
--' @render -p/--plain=asLines
nums :: Int -> [Int]
nums = mk
```

`morloc make --install -o fmt fmt.loc`, then `mim freeze` over that
environment.

## Impact

The count printed during freeze validation is wrong by the number of output
actions, worst on exactly the programs whose authors took the most care over
their interface. The names also persist into `freeze-manifest.json`, so a
consumer of a frozen bundle inherits a command list that includes names the
program rejects.

## Guess

Verified by reading, not by patch: adding `#[serde(default)] internal: bool` to
`ManifestStubCmd` and filtering on it in `parse_manifest_commands` matches what
`morloc list` and `Morloc/Completion.hs` now do. Left unfixed here because mim
builds belong to the user.
