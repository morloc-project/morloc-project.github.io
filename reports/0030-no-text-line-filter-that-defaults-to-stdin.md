# 0030: FEATURE -- `@stdin` is `Str`-only, so a line-oriented filter cannot default to stdin

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

`@stdin` makes a positional optional and reads standard input when it is
omitted -- the `wc`/`sort`/`grep` shape, where `prog < file`, `prog file`, and
`cat file | prog` all work. The natural argument type for a line-oriented
filter is `[Str]` with `@form list`, which already reads one element per line
from a file or from `-`.

## Observed

The combination is rejected at compile time, because `@stdin` implies
`@check.path r` and that check requires a `Str`.

```
$ cat lf.loc
module lf (count)
import root-py
source Py from "lf.py" ("n")
n :: [Str] -> Int

--' Count lines read from a file or standard input
count ::
  --' @form list
  --' @stdin
  [Str] -> Int
count = n

$ morloc make -o lf lf.loc
In lf:count, argument #1: `check.path:` requires a `Str` argument; got wire schema `as`.
```

Without `@stdin` the command works, but stdin has to be named explicitly:

```
$ printf 'a\nb\nc\n' | ./lf count -
3
$ printf 'a\nb\nc\n' | ./lf count
error: the following required arguments were not provided:
  <arg0>
```

The `Str` form of `@stdin` that does compile reads a morloc packet stream, not
text, so it is not a substitute:

```
$ printf 'a\nb\nc\n' | ./filt total
Error: run failed
Error (pymorloc.c:3022 in pybinding__mlc_next):
@next: stdin ended after 6 byte(s); not a morloc packet (a packet header is 32 bytes). Foreign or truncated input is not supported on stdin.
```

## Reproduce

`lf.py`:

```
def n(xs):
    return len(xs)
```

with `lf.loc` above, then `morloc make -o lf lf.loc`.

## Suggestion

Let `@stdin` mean "this positional is optional; when omitted, substitute the
stdin sentinel" for any argument shape that already accepts `-`, and derive the
implied check from the shape (`check.path r` for a plain `Str` path,
nothing extra for `@form list`, which opens the path itself). Everything
downstream already works -- `./lf count -` proves the read path is fine; only
the optional-positional half is withheld.

Related, and cheap: even where `@stdin` does apply, `--help` gives no sign of
it. The argument still prints as a required-looking positional whose only hint
is `format: path to a readable file`.

## Impact

Reading stdin by default is most of what makes a small tool composable in a
pipeline, and it is unavailable for the argument shape most likely to want it.
