# 0023: `@epilogue` reaches the manifest and is never rendered; module description is truncated to one line

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

A docstring above `module` describes the program, and `@epilogue` starts a
trailing help block (the usual "Examples:" section at the bottom of `--help`).
Both are parsed: `processModuleDocLines` in
`library/Morloc/Frontend/Desugar.hs` splits the description from the epilogue
blocks, and `buildManifest` emits both as `desc` and `epilogues`.

## Observed

Only the first `desc` line reaches the help, and `epilogues` is never read.

```
$ cat tool.loc
--' A demo toolbox
--' It does several things.
--' @epilogue
--' Examples:
--'   tool greet Weena
--'   tool add 1 2
module tool (greet, add)

import root-py

--' Greet someone
greet :: Str -> Str
greet name = "Hello, " <> name

--' Add two integers
add :: Int -> Int -> Int
add x y = x + y

$ morloc make -o tool tool.loc
$ ./tool --help
A demo toolbox

Usage: ./tool <nexus_options> <command> <command_options>

Commands:
  hello  Greet someone
  add    Add two integers
...
```

"It does several things." and the whole epilogue block are gone, under `-h`
and under `--help` alike. The manifest has them:

```
$ python3 -c "import json;m=json.load(open('tool-build/manifest.json'));print(m['desc']);print(m['epilogues'])"
['A demo toolbox', 'It does several things.']
[['Examples: ', '  tool greet Weena', '  tool add 1 2']]
```

## Reproduce

The file above, from an empty directory.

## Impact

The only way to attach usage examples or a multi-paragraph overview to a
generated CLI is silently discarded. Per-command docstrings do not have this
problem -- `long_about` is set for subcommands, so `<cmd> --help` shows every
description line.

## Guess

Unverified. `data/rust/morloc-nexus/src/phase2.rs:249` sets the root command's
`about` from `manifest.desc.first()` and never sets `long_about`; `epilogues`
appears nowhere in `data/rust/` outside the schema definition in
`morloc-manifest/src/lib.rs:91`. `clap`'s `after_help` is the natural slot.
