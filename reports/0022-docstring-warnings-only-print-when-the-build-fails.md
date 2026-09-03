# 0022: docstring warnings are computed but only printed when the build fails

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

A misspelled docstring directive should be reported. The compiler already
builds the message: `unknownDirectiveWarning` in
`library/Morloc/Frontend/Desugar.hs` produces one for every `@keyword` outside
`argDocDirectiveKeys`, and `literal: true` produces a deprecation warning.

## Observed

Nothing is printed, and the typo is silently demoted to prose.

```
$ cat d.loc
module d (f)
import root-py

--' Do a thing
--' @nosuchdirective hello
f :: Int -> Int
f x = x

$ morloc make -o d d.loc
$ ./d --help
Do a thing
nosuchdirective: hello

Usage: ./d <nexus_options> @ <command_options>
...
```

A near-miss on a real directive behaves the same way: `@metvar FILE` becomes
the help line `metvar: FILE` and the argument keeps its default placeholder.

## Reproduce

The snippet above, from an empty directory. `morloc make -v` makes no
difference.

## Impact

Docstring directives are the entire authoring surface for CLI generation, and
every one of them is a silent no-op when misspelled. The result is a generated
interface that quietly differs from the one the author wrote, with the typo
rendered into the help text as though it were prose.

## Guess

Unverified. `MM.tell` writes to the writer log; `writeMorlocReturn`
(`library/Morloc/Monad.hs:197`) prints `msgs` only in the `Left` branch, and
the success branch is `writeMorlocReturn ((Right _, _), _) = return True`,
which discards them. Warnings are therefore visible only on a build that also
fails.

## Also affects source-level directives (added 2026-09-02, rsize pass)

The same silence covers `sourceDocDirectiveKeys` -- the directives valid on a
`source` declaration, `name` and `rsize`. There the consequence is worse than a
typo demoted to prose, because `rsize` decides the calling convention of a
foreign function:

```morloc
source Py from "lib.py" where
  --' rsizee: 1
  scale
```

builds silently and emits a flat call, which is the exact convention the
directive existed to override. A curried Python function then fails at run time
with "takes 1 positional argument but 2 were given", pointing nowhere near the
misspelled key.

An unparseable *value* was silently dropped the same way (`rsize: two` became
no directive at all); that half is fixed -- the value is now validated where it
is parsed. The unknown-*key* half is this report.
