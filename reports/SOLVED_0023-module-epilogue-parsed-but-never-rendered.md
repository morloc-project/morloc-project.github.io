# 0023: `@epilogue` reaches the manifest and is never rendered; module description is truncated to one line

- Status: fixed
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

## Resolution

Fixed in `morloc` commit `ab019ed5`.

Both guesses in this report were right. The root command set `about` from
`manifest.desc.first()` and never `long_about`, and `epilogues` had no reader in
`data/rust/` outside the schema definition.

The root command now makes the same `about` / `long_about` split every
subcommand already made: the first line is the synopsis `-h` shows, and the full
block reaches `--help`. Command groups do the same with their own `desc`.
Epilogue blocks render through clap's `after_help`, so they appear under both
`-h` and `--help`; blocks are separated by a blank line and trailing whitespace
is trimmed. In the single-command layout the root also carries the command's
positional and return blocks, so the epilogue appends to those rather than
replacing them.

This is a read-side change only -- the manifest already carried both fields --
so an existing build gains the blocks without recompiling.

Covered by `test-suite/golden-tests/module-help-blocks`.

## Still open, split out

In the single-command layout the root's description comes from the command, not
the module, so a module docstring is dropped there entirely. That is a question
about what the single-command layout should show when a program has two
descriptions available, not about whether the epilogue renders, and it is filed
separately as report 0059.
