# 0022: docstring warnings are computed but only printed when the build fails

- Status: fixed
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

## Resolution

Fixed in `morloc` commit `73852ad2`.

`writeMorlocReturn` now prints the accumulated message log on both branches, so
every warning the compiler raises reaches stderr on a build that succeeds. The
guess in this report was correct: the success branch was
`writeMorlocReturn ((Right _, _), _) = return True`, which discarded `msgs`.
The fix is not specific to docstrings -- all warnings share that one log -- but
docstring warnings are the only thing emitting into it today.

Both halves this report names are covered: the unknown argument directive
(`@nosuchdirective`, `@metvar`) and the unknown `source` directive (`@rsizee`).
The `\` escape stays silent.

The warning text also stopped teaching the retired spelling. It used to end
"(e.g. '\rsizee:')", which was harmless while the message was unreachable and
wrong the moment it became the first thing a beginner reads. It now states the
backslash rule without picking a spelling, since the warning fires for both the
`@keyword` and the transitional `key:` forms.

Covered by `test-suite/golden-tests/docstring-warnings`, which asserts on a
build that SUCCEEDS -- the program builds and runs -- and greps `build.err` for
each directive name.
