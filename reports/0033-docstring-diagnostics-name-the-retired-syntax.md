# 0033: docstring validation errors quote the retired `key:` syntax and drop the term name

- Status: open
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
