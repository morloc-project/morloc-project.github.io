# 0059: in a single-command program the module docstring is dropped entirely

- Status: fixed
- Found: 2026-09-05, while fixing reports/0023 (module epilogue never rendered)
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

A docstring above `module` describes the program. Report 0023 fixed the
multi-command case, where the first line is the `-h` synopsis and the whole
block reaches `--help`. A program that exports one function is still a program
with a description, so its module docstring should reach its help too.

## Observed

It reaches nothing. In the single-command layout the root command's description
comes from the exported command, and `manifest.desc` is never consulted.

```
$ cat solo.loc
--' A one-trick program
--' The trick is addition.
module solo (add)

import root-py

--' Add two integers
add :: Int -> Int -> Int
add x y = x + y

$ morloc make -o solo solo.loc
$ ./solo -h
Add two integers

Usage: ./solo <nexus_options> @ <command_options>
...
```

"A one-trick program" and "The trick is addition." appear nowhere, under `-h`
or `--help`. The manifest carries them:

```
$ python3 -c "import json;print(json.load(open('solo-build/manifest.json'))['desc'])"
['A one-trick program', 'The trick is addition.']
```

Add a second export and both lines appear, because the program then takes the
multi-command path.

## Reproduce

The file above, from an empty directory.

## Impact

Small in reach -- it needs a one-export program -- but it is silent, and a
one-export program is what a first-time user writes. The author writes a
description of the program, gets no warning, and sees the function's
description in its place.

## Guess

Unverified, and the fix is a judgment call rather than a lookup. In this layout
the root *is* the command, so two descriptions are available for one slot and
something has to choose. Plausible resolutions: prefer the module's when it
exists; or keep the command's as the synopsis and append the module's to the
long form. Report 0023 deliberately did not decide this.

Note the epilogue is not affected: `@epilogue` renders correctly in this layout
as of `morloc` commit `ab019ed5`.

## Resolution

Fixed in `morloc` commit `6b024bd7`.

This report left the fix open as a judgment call, since the layout has one
description slot and two docstrings available. The resolution is to use both:
the module's first, because it answers what a reader of the program's help is
asking, then the export's, which would otherwise have nowhere to appear. Where
only one exists it is used alone, so a program described only at the export --
the arrangement that already worked -- reads exactly as before.

The blank-description case this report highlights is the one that made the
decision easy. A program with a module docstring and no export docstring
printed nothing at all, which is not a defensible reading of either
docstring's intent.

`test-suite/golden-tests/module-help-blocks` now covers all three
arrangements: both docstrings, module only, and export only.

## Verification pending

The expected output was derived from the code rather than observed: another
session held the shared morloc installation when this landed, so building and
running would have collided with it. The derivation rests on behaviour already
recorded in the same golden -- clap shows one description line under `-h` and
the whole block under `--help` -- and on the observed rendering of an empty
description, which emits nothing. One suite run confirms it.
