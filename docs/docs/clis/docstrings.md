# 6.3. Docstrings

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/docstrings.html | prev: https://morloc-project.github.io/docs/clis/argument-zones.md | next: https://morloc-project.github.io/docs/clis/arguments.md

A docstring is a comment that the compiler keeps. An ordinary `--` comment is discarded after parsing; a `--'` comment is attached to whatever follows it and travels through to the generated interface. That is the whole authoring surface for the CLI: you never configure the parser, you annotate the code.

Docstrings attach in five places, and each one lands somewhere different in the help:

| Above | Becomes |
| --- | --- |
| `module` | The program’s description, shown at the top of `./prog -h`. |
| a term’s signature | The command’s description, shown at the top of `./prog <cmd> -h`. |
| a type inside a signature | That argument’s description; on the last type, the return description. |
| a `type` or `record` definition | The description of every argument and return that uses that type. A record must use the `record X where` form; see the warning below. |
| a `record` field | That field’s description, when the record is split into one flag per field (see [Record arguments](https://morloc-project.github.io/docs/clis/record-arguments.md)). |

The third and fourth interact usefully. ``sift’s `scan`` documents its arguments inline:

```morloc
--' Search a directory tree for lines containing a pattern
scan ::
  --' The text to search for
  Str ->
  --' The directory to search
  Str ->
  Options ->
  <IO> [Hit]
```

which is fine for two arguments used once. When the same type appears across several signatures, describing it at the type is less to write and impossible to get out of step:

**cipher.py**

```python
def xor(key, msg):
    return "".join(chr(ord(c) ^ ord(key[i % len(key)]))
                   for i, c in enumerate(msg))
```

**cipher.loc**

```morloc
module cipher (encode, decode)

import root-py

source Py from "cipher.py" ("xor")

xor :: Str -> Str -> Str

--' A secret key
--' @metavar KEY
type Key = Str

--' An encrypted message
--' @metavar CIPHERTEXT
type CipherText = Str

--' A decrypted message
--' @metavar PLAINTEXT
type PlainText = Str

--' Encode a plaintext with a key
encode :: Key -> PlainText -> CipherText
encode = xor

--' Decode a ciphertext with a key
decode :: Key -> CipherText -> PlainText
decode = xor
```

Both commands inherit the descriptions and the metavars, in the right positions, with nothing repeated:

```console
$ ./cipher encode -h
Encode a plaintext with a key

Usage: ./cipher <nexus_options> encode <command_options>

General Options:
  -h, --help  Print help; -hh adds details and examples, -hhh adds schemas
              (nexus options: -h @)

Positional arguments:
  1: KEY        A secret key
                type: Str
                format: literal string
  2: PLAINTEXT  A decrypted message
                type: Str
                format: literal string

Return: Str
  An encrypted message
```

An inline docstring on an argument wins over the one inherited from its type, so a signature can specialize a description where it matters and inherit it everywhere else.

## 6.3.1. Directives

A docstring line is either **prose** or a **directive**. A directive begins with `@`:

```
@keyword [arguments...]
```

The keyword is the first whitespace-delimited token; the rest of the line is its value. Some directives are bare switches (`@unroll`, `@many`, `@stdin`) and take no value at all.

Two other sigils appear inside directive values. `$1`, `$2`, …​ refer to the command’s own arguments by position, and `@value` and `@offset` name values the runtime supplies. Both are used by output actions and are introduced there.

To start a prose line with a literal `@`, escape it: `\@`.

The first line of \`scan’s preamble is prose; the two below it are directives:

```morloc
--' Search a directory tree for lines containing a pattern
--' @with   -c/--count=countHits
--' @render -p/--plain=asLines
```

Order does not matter. Prose lines are concatenated in the order written and become the description; directive lines are collected wherever they sit in the block.

Every directive is listed in [Directive reference](https://morloc-project.github.io/docs/clis/directive-reference.md). The rest of this chapter introduces them in the order you are likely to need them.

> **Warning**
> A misspelled directive is treated as prose, but the build says so. Writing `@metvar FILE` warns and keeps going:
> 
> ```console
> warning: unknown docstring directive 'metvar' (recognized: name, literal, many, stdin, unroll, default, metavar, arg, true, false, return, source, form, check.<kind>, list.source, list.form, list.check.<kind>, with, mime); if this line was meant as prose, prefix its content with '\' to suppress this warning
> ```
> 
> The warning prints whether or not the build succeeds. If a directive appears to have no effect, check the build output first, then its spelling against [Directive reference](https://morloc-project.github.io/docs/clis/directive-reference.md).
> 
> A related trap: for compatibility with an older syntax, a prose line whose first word ends in a colon is also read as a directive. `Example: pass a number` parses as the directive `Example` and is echoed back into the help verbatim, which usually looks fine and occasionally is not. Prefer a colon later in the line, or escape the line with a leading `\`.
