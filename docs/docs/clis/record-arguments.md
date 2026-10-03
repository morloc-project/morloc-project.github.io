# 6.5. Record arguments

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/record-arguments.html | prev: https://morloc-project.github.io/docs/clis/arguments.md | next: https://morloc-project.github.io/docs/clis/sum-type-arguments.md

A record argument is a natural fit for a group of related settings, but a caller does not want to write a JSON object to set one field. `@unroll` splits the record open: each field becomes its own flag, and the record is reassembled before the call.

``sift’s `Options`` is declared once and used by three commands:

```morloc
--' How to search
--' @unroll
--' @arg --options
record Options where
  --' Match without regard to case
  --' @true -i/--ignore-case
  ignoreCase :: Bool

  --' Stop after this many hits; 0 means no limit
  --' @arg -m/--max-count
  --' @default 0
  maxCount :: Int
```

Each field carries the same directives an ordinary argument would — `@true` for the `Bool`, `@arg` plus `@default` for the `Int` — and each becomes a flag on every command that takes an `Options`:

```console
$ ./sift scan -hhh
Search a directory tree for lines containing a pattern

Usage: ./sift <nexus_options> scan <command_options>

General Options:
  -h, --help   Print help; -hh adds details and examples, -hhh adds schemas
               (nexus options: -h @)
  -c, --count  Report the number of matches instead of the matches
  -p, --plain  Print one `path:line:text` record per line

Optional arguments:
      --options <Options_JSON>  How to search
                                type: Options
  -i, --ignore-case             Match without regard to case
                                type: Bool
                                default: false
  -m, --max-count <Int>         Stop after this many hits; 0 means no limit
                                type: Int [default: 0]

Positional arguments:
  1: PATTERN  The text to search for
              type: Str
              format: literal string
  2:          The directory to search
              type: Str
              format: path to a readable file

Return:
  default:    [Hit]
  -c/--count: U64
  -p/--plain: Str    (raw bytes)

Record Schemas:
  Options
    ignoreCase :: Bool
    maxCount   :: Int

  Hit
    path :: Str
    line :: Int
    text :: Str
```

An unrolled record never becomes a positional. It appears in the argument list by name only because `@arg --options` also gives it a flag of its own; without that directive the fields are the only trace of it.

Every named type the help prints is defined once at the bottom, under `Record Schemas:`, when the help is asked for at its third tier (`-hhh`). That is why `Hit` is laid out here too, though it is the return type rather than an argument — the help names it, so the help defines it. A name the help never prints is never defined, which is why a record that is unrolled without `@arg` does not appear.

(The `-c` and `-p` flags and the `Return:` table in that help belong to \`scan’s output actions, which are [Output actions](https://morloc-project.github.io/docs/clis/output-actions.md).)

Without `@unroll`, the record stays whole: it becomes an ordinary positional and the caller supplies a JSON object, a file, or `-` for the entire thing. `@unroll false` on one argument opts that command out while the others stay unrolled:

```morloc
scanAll ::
  --' A file of patterns, one per line
  --' @form list
  [Str] ->
  --' The directory to search
  --' @check.path r
  Str ->
  --' @unroll false
  Options ->
  <IO> [Hit]
```

```console
$ ./sift scanAll -h
...
Positional arguments:
  1:  A file of patterns, one per line
      type: [Str]
      format: path to text file with one string per line
  2:  The directory to search
      type: Str
      format: path to a readable file
  3:  How to search
      type: Options
...
```

## 6.5.1. Three ways to fill it

The `@arg --options` on the record declares a **group flag**, which accepts the whole record at once. It coexists with the per-field flags, so a caller can use either or both.

**The whole record.** The group flag takes a JSON object, a file path, or `-`:

```console
$ echo '{"ignoreCase":true,"maxCount":1}' > opts.json
$ ./sift scan --options opts.json MANUAL notes -p
notes/todo.txt:3:write the manual

$ ./sift scan --options '{"ignoreCase":true}' MANUAL notes -p
notes/todo.txt:3:write the manual
notes/2026/plan.txt:2:ship the manual

$ cat opts.json | ./sift scan --options - MANUAL notes -p
notes/todo.txt:3:write the manual
```

Missing keys fall back to the field’s default, so a partial object is legal and `{}` means "all defaults".

**Field by field.** Each unrolled field has its own flag:

```console
$ ./sift scan MANUAL notes -i -m 1 -p
notes/todo.txt:3:write the manual
```

**A mix.** A partial object fills some fields and individual flags fill or override the rest. The per-field flag always wins:

```console
$ ./sift scan --options '{"ignoreCase":true,"maxCount":9}' -m 1 MANUAL notes -p
notes/todo.txt:3:write the manual
```

The full precedence for each field, highest first:

1.  the per-field flag,
2.  the value in the group bundle, if the key was present,
3.  the field’s declared default,
4.  `null`, for an optional field with neither,
5.  otherwise an error naming the field.

An explicit `null` in the bundle counts as present, so it overrides a default rather than falling through to it.

## 6.5.2. What is rejected

Object form rejects unknown keys, which turns a typo into an error instead of a silently ignored setting:

```console
$ ./sift scan --options '{"ignorecase":true}' MANUAL notes -p
Error: failed to parse argument #2: serialization error: unknown field 'ignorecase' in record bundle
```

A record may also be given positionally, as a JSON array of field values in declaration order. That form has no notion of a missing field, so the length must match exactly:

```console
$ ./sift scan --options '[true,1]' MANUAL notes -p
notes/todo.txt:3:write the manual

$ ./sift scan --options '[true]' MANUAL notes -p
Error: failed to parse argument #2: serialization error: record array form must have exactly 2 fields (one per schema field, in declaration order), got 1
```

A failure while loading one field names the field:

```console
$ ./sift scan -m notanumber manual notes
Error: failed to parse argument #2: field 'maxCount': serialization error: JSON parse error: expected ident at line 1 column 2
```
