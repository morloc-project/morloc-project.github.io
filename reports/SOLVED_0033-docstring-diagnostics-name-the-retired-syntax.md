# 0033: docstring validation errors quote the retired `key:` syntax and drop the term name

- Status: fixed
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

Docstring directives are written `@keyword value`. An error about a directive
should name it that way, and should identify the offending term.

## Observed

Two small defects in the same family of messages.

*They quote the old spelling.* The advice is to write syntax the manual no
longer teaches:

```
$ morloc make -o c c.loc
In c:f, argument #1: a Bool argument cannot use `arg:`. Use `true: <opt>` (default false, the flag turns it on) or `false: <opt>` (default true, the flag turns it off) instead.
```

The user wrote `@arg -v/--verbose` and is told to write `true: <opt>`. The same
pattern appears in the `metavar:`, `check.path:`, `form:` and `source:`
messages.

*Some drop the term name.* Two of the `@stdin` checks leave an empty slot and a
doubled space where the name belongs:

```
$ morloc make -o two two.loc
In two:f,  has more than one positional with `stdin: true`; at most one argument may read from stdin.

$ morloc make -o nl nl.loc
In nl:f,  has a positional after the `stdin: true` positional; the stdin argument must be the last positional.
```

## Reproduce

For the first:

```
module c (f)
import root-py
--' Do a thing
f ::
  --' verbose
  --' @arg -v/--verbose
  Bool -> Int
f _ = 1
```

For the second:

```
module two (f)
import root-py
--' Two stdin arguments
f ::
  --' @stdin
  Str ->
  --' @stdin
  Str ->
  <IO, Err> ()
f _ _ = @throw "unused"
```

Then `morloc make -o c c.loc` and `morloc make -o two two.loc`.

## Impact

Cosmetic, but these are the messages a beginner meets first when learning the
directive syntax, and they teach a spelling the documentation has retired.

## Guess

Unverified. The messages appear to predate the `@keyword` form and were never
re-worded; the empty name slot looks like a `pretty` of a value that renders
empty in the two `@stdin` arity checks.

## Resolution

Fixed in `morloc` commit `87aa5dfd`.

Both defects this report names are fixed, across every diagnostic in the
family rather than only the ones quoted here -- 82 message lines in the
docstring processor, the desugarer and the nexus code generator.

The messages now use the `@keyword` form:

```
In c:f, argument #1: a Bool argument cannot use `@arg`. Use `@true <opt>` (default false, the flag turns it on) or `@false <opt>` (default true, the flag turns it off) instead.
```

The two `@stdin` checks had no subject at all: the location prefix already ends
in a comma and the message continued with a verb, which is where the empty slot
and doubled space came from. They are sentences now:

```
In two:f, more than one positional declares `@stdin`; at most one argument may read from stdin.
In nl:f, a positional follows the `@stdin` positional; the stdin argument must be the last positional.
```

Two further instances of the same class turned up in the sweep and are fixed
with it. One message advised `.buffer` for streaming, which is itself retired
(the modifier is `@stream`). And the pretty-printer that renders a `source`
declaration back to morloc emitted `--' srcname:` -- a directive key that does
not exist, the real one being `name` -- so the compiler's own output was not
input it would accept.

Covered by `test-suite/golden-tests/docstring-diagnostics`, which pins the
three diagnostics this report quotes.

## Note

Haskell comments still describe directives in the retired spelling. They are
internal prose and both forms still parse, so rewriting them would have buried
the message changes in churn. Only user-facing text was changed.
