# 0055: a single-command program's usage line shows `@` where the command name belongs

- Status: not-a-bug
- Found: 2026-09-05, re-checking the CLI help output
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

The usage line names the command, or shows it as optional. A reader should be
able to copy the line and run it.

## Observed

A program exporting exactly one command renders a bare `@`:

```
$ ./g scan -h
Scan for a pattern

Usage: ./g <nexus_options> @ <command_options>
```

`@` is not a command name, an argument, or documented notation anywhere in the
manual. A reader cannot act on it.

The same program with a second export renders correctly:

```
$ ./h -h
Usage: ./h <nexus_options> <command> <command_options>
```

## Reproduce

Any module with exactly one export:

```
module g (scan)
import root-py
record Hit = Hit {line :: Int, text :: Str}
source Py from "g.py" ("find" as find)
find :: Str -> [Hit]
scan :: Str -> [Hit]
scan = find
```

```
$ morloc make -o g g.loc
$ ./g scan -h
```

## Impact

Cosmetic but user-facing, and it lands on the smallest programs -- the ones a
reader meets first. The usage line is the one line of help everyone reads.

Only the rendering is wrong; everything else about the single-command path is
right. Both invocations work, since the command name is optional when there is
only one:

```
$ ./g scan hello
[{"line":1,"text":"hello"}]
$ ./g hello
[{"line":1,"text":"hello"}]
```

and `--json-help` reports the name correctly:

```
$ ./g --json-help | jq -r '.commands[0].name'
scan
```

So the fix is confined to the usage-line renderer.

## Guess

Unverified. The `@` looks like a placeholder standing for "the command name may
be omitted here" that reaches the output as a literal instead of being expanded
into the name, or into a bracketed optional form such as `[scan]`.

Given that omitting the name is legal, `[scan]` would say more than either `@`
or a bare `scan`: it names the command and shows that the name is optional.

## Resolution

Withdrawn. This report is wrong on both of its claims.

`@` is a real token in the command-line grammar, not a placeholder that escaped
rendering. It is the explicit zone separator, it closes the nexus option zone by
hand, and the form the usage line prints works:

```
$ ./g @ hello
[{"line":1,"text":"hello"}]
$ ./k @ scan hello        # a multi-command program accepts it too
```

And it is documented, in the manual's own CLI chapter:

> That last one introduces `@`, the explicit zone separator.
>
> Both forms work, and the help says so by putting `@` where the subcommand
> name would go.

So the usage line for a single-command program is deliberate: the subcommand
name is optional there, and `@` marks the position it would occupy. Nothing to
fix.

The report was filed after searching `reports/` for a prior filing and never
searching the manual, then stating "not documented notation anywhere in the
manual" as though the absence of a result were a finding. Worth recording as a
reminder that a search which returns nothing is an unfinished search, not a
conclusion.
