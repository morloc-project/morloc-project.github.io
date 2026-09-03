# 0025: `-` is rejected on a `@source file` argument, though `/dev/stdin` works

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/cli-arguments.asc:23` states the rule without qualification:

> *Standard input.* The literal token `-` (or `/dev/stdin`) reads the value
> from STDIN.

## Observed

For an argument declared `@source file`, `-` is rejected and `/dev/stdin` is
accepted, so the two spellings are not interchangeable.

```
$ printf 'hello from stdin\n' | ./sh readIt -
Error: failed to parse argument #0: The argument '-' is a filename, but it can't be read

$ printf 'hello again\n' | ./sh readIt /dev/stdin
"hello again"
```

On a `@check.path r` argument, `-` is substituted as documented:

```
$ printf 'x\n' | ./sh pathIt -
"\/dev\/stdin"
```

## Reproduce

```
module sh (readIt, pathIt)
import root-py
source Py from "sh.py" ("ident")
ident :: Str -> Str

--' Read a file's contents as a string
readIt ::
  --' @source file
  Str -> Str
readIt = ident

--' Take a path that must exist and be readable
pathIt ::
  --' @check.path r
  Str -> Str
pathIt = ident
```

with `sh.py`:

```
def ident(x):
    return x
```

Then `morloc make -o sh sh.loc` and the two commands above.

## Impact

`-` is the universal shell idiom for "read stdin", and `@source file` is
exactly the shape that wants it (a filter that takes a text file). The error
message does not mention stdin or `/dev/stdin`, so the workaround is not
discoverable from the failure.

## Guess

Unverified. `substitute_stdio_dash`
(`data/rust/morloc-nexus/src/dispatch.rs:549`) only rewrites `-` when the
argument carries a `check.path` check; `@source file` sets `source` and adds no
check, so the token reaches the loader verbatim.
