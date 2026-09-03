# 0018: `metavar:` on a positional argument is recorded but never shown in `--help`

- Status: fixed
- Found: 2026-09-02, checking the docstring-inheritance claim in the newtype section
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/types-newtype.asc` claims a `metavar:` directive on a type alias
reaches the generated CLI:

> a command-line tool that takes a `Key` and a `CipherText` shows distinct
> `KEY` and `CIPHERTEXT` placeholders in its `--help` output

## Observed

The directive is picked up -- `--json-help` shows it -- but `--help` never
prints it:

```
$ ./prog encrypt --help
Encrypt a message

Usage: ./prog <nexus_options> @ <command_options>
...
Positional arguments:
  1:  A secret key
      type: Str    (literal string)
  2:  type: Str    (literal string)
```

```
$ ./prog --json-help | python3 -m json.tool
...
                    "name": "key",
                    "role": "positional",
                    "position": 0,
                    "metavar": "KEY",
```

The description inherited from the alias does render, so docstring inheritance
itself works; only the metavar is dropped.

## Reproduce

`main.loc`:

```
module main (encrypt)

import root-py

--' A secret key
--' metavar: KEY
type Key = Str

--' An encrypted message
--' metavar: CIPHERTEXT
type CipherText = Str

--' Encrypt a message
encrypt :: Key -> Str -> CipherText
encrypt k m = m <> k
```

```
$ morloc make -o prog main.loc
$ ./prog encrypt --help          # no KEY anywhere
$ ./prog --json-help             # "metavar": "KEY"
```

## Impact

Cosmetic, but it makes the documented reason for using `type` aliases in a CLI
(distinct placeholders per argument) not actually visible to a CLI user. Option
arguments do render their metavar, so the inconsistency is visible in a single
program that has both.

## Guess

Unverified: `render_positional_block` in
`data/rust/morloc-nexus/src/phase2.rs` builds each entry from `desc`,
`type_desc`, and `format` only; the `metavar` field of `ManifestArg::Positional`
is not read.

## Resolution

Fixed in `morloc` commit `e5730d1b`.

`--help` now labels each positional slot with its index and metavar together
(`1: PATTERN  the text to find`), padded so the description column stays
aligned when only some slots are named. A command with no metavars renders
exactly as before. The usage line still reads `<command_options>` rather than
naming the positionals -- positionals are hidden from clap's own renderer and
re-emitted by hand, so that is a separate change.
