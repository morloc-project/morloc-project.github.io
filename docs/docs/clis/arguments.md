# 6.4. Arguments

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/arguments.html | prev: https://morloc-project.github.io/docs/clis/docstrings.md | next: https://morloc-project.github.io/docs/clis/record-arguments.md

By default every argument in a signature is a positional, in the order it appears. `summarize :: [Hit] → [(Str, Int)]` takes one argument, so the command takes one token. Save a search first, since the rest of the chapter reuses it:

```console
$ ./sift scan the notes > hits.json
$ ./sift summarize hits.json
[["notes\/todo.txt",2],["notes\/2026\/plan.txt",2]]
```

What that token may be depends on the argument’s type.

**Scalars and strings are read verbatim.** An `Int`, `Real`, `Bool`, sized integer or float, or a `Str` is taken from argv as written — no JSON quoting, no escaping:

```console
$ ./sift scan the notes -c
4
```

`the` is the `Str` pattern and `notes` is the `Str` directory.

Numbers need no quoting either, negative ones included: a leading `-` starts an option only when the next character is a letter. A second small program to show it with, used again later in this section:

**calc.py**

```python
def add(x, y):
    return x + y

def join(sep, words):
    return sep.join(words)
```

**calc.loc**

```morloc
module calc (add, join)

import root-py

source Py from "calc.py" ("add", "join")

--' Add two numbers
add :: Real -> Real -> Real

--' Join words with a separator
--' @name cat
join ::
  --' the separator
  Str ->
  --' the words to join
  --' @many
  [Str] ->
  Str
```

```console
$ morloc make -o calc calc.loc
$ ./calc add -4.0 -7
-11
```

**Everything else is a value in a recognized format.** Lists, tuples, records, and maps accept either a JSON value inline or a path to a file holding one:

```console
$ ./sift summarize '[{"path":"a.txt","line":1,"text":"x"}]'
[["a.txt",1]]

$ ./sift summarize hits.json
[["notes\/todo.txt",2],["notes\/2026\/plan.txt",2]]
```

The file’s format is detected from its contents, not its name. JSON, MessagePack, and Morloc’s own binary form (voidstar) are all recognized, so a file produced by an earlier command is read back without saying how it was written:

```console
$ ./sift -f mpk scan the notes > hits.mpk
$ ./sift summarize hits.mpk
[["notes\/todo.txt",2],["notes\/2026\/plan.txt",2]]
```

Arrow IPC and Parquet are recognized as well when the target type is a `Table`.

**Standard input is a value source too.** The token `-` (or `/dev/stdin`) reads the argument from standard input, which is what makes two Morloc commands compose in a pipeline:

```console
$ ./sift scan the notes | ./sift summarize -
[["notes\/todo.txt",2],["notes\/2026\/plan.txt",2]]
```

Only one argument per command may claim stdin; a second `-` is an error rather than a silent read of zero bytes.

## 6.4.1. When an argument is wrong

An argument that looks like a path — it contains a `/`, or ends in a recognized data extension — but does not exist is reported as a missing file rather than parsed as inline data:

```console
$ ./sift summarize nosuch.json
Error: failed to parse argument #0: file 'nosuch.json' not found
```

A file that exists but does not hold what the type wants is reported against the file:

```console
$ echo 'not json' > bad.json
$ ./sift summarize bad.json
Error: failed to parse argument #0: file 'bad.json': serialization error: JSON parse error: expected ident at line 1 column 2
```

Failures exit non-zero, so a Morloc command is safe to put in a `set -e` script or a `&&` chain.

> **Note**
> Errors number arguments from zero (`argument #0`) while `--help` numbers positionals from one. `argument #0` is the argument printed as `1:`.

## 6.4.2. Options, flags, and repeats

An argument becomes an option instead of a positional when you give it a flag name with `@arg`. An option can be omitted, so it also needs a `@default`:

```morloc
  --' Stop after this many hits; 0 means no limit
  --' @arg -m/--max-count
  --' @default 0
  maxCount :: Int
```

The default is written in JSON, and the compiler insists on it. Drop the `@default` line from `sift.loc` and the build stops:

```console
$ morloc make -o sift sift.loc
In sift:scan, argument #3, field maxCount: optional argument -m/--max-count must be given a default value
```

A `Bool` is a flag, not an option with a value, so it uses a different pair of directives. `@true` names the spelling that turns it on, and the default is false:

```morloc
  --' Match without regard to case
  --' @true -i/--ignore-case
  ignoreCase :: Bool
```

```console
$ ./sift scan MANUAL notes -i -p
notes/todo.txt:3:write the manual
notes/2026/plan.txt:2:ship the manual
```

`@false` is the mirror image: it names the spelling that turns the flag off, and the default becomes true. Giving both declares an on switch and an off switch for the same field. Using `@arg` on a `Bool` is rejected, with the alternative spelled out — change ``ignoreCase’s `@true`` to `@arg` and:

```console
$ morloc make -o sift sift.loc
In sift:scan, argument #3, field ignoreCase: a Bool argument cannot use `@arg`. Use `@true <opt>` (default false, the flag turns it on) or `@false <opt>` (default true, the flag turns it off) instead.
```

Both spellings are delivered, and help shows the flag with the `true` default it turns off. Adding `@false -s/--skip-empty` to a `reportEmpty` field gives:

```console
  -s, --skip-empty              Report each file even when it has no hits
                                type: Bool
                                default: true
```

`@many` makes an argument variadic: it consumes the remaining argv tokens and assembles them into a list. It applies to a `[a]`\-typed argument, and as a positional it must be the last one. ``calc’s `join`` above declares one:

```console
$ ./calc cat + a b c
"a+b+c"
```

## 6.4.3. Naming

`@name` gives a command a name of its own, independent of the Morloc term. `calc` exports `join` and calls the subcommand `cat`:

```console
$ ./calc -h
Usage: ./calc <nexus_options> <command> <command_options>

Commands:
  add  Add two numbers
  cat  Join words with a separator

General Options:
  -h, --help  Print help; -hh adds details and examples, -hhh adds schemas
              (nexus options: -h @)
```

Use it when the shell-facing name and the library-facing name want to differ — a name that reads well in a pipeline is not always the name you want to import.

`@metavar` names an argument. On an option it becomes the placeholder in the help text, replacing the type name:

```morloc
  --' how many things
  --' @arg -n/--num
  --' @metavar COUNT
  --' @default 0
  Int ->
```

```
Optional arguments:
  -n, --num <COUNT>  how many things
                     type: Int [default: 0]
```

On a positional it labels the slot, beside the index:

```console
$ ./sift scan -h
...
Positional arguments:
  1: PATTERN  The text to search for
              type: Str
              format: literal string
  2:          The directory to search
              type: Str
              format: path to a readable file
...
```

`scan` names only its first positional, so the second keeps a bare index and the two labels pad to a common width.

The same name is what the interface is keyed on wherever it is consumed by a program — the property name in the JSON Schema and in the MCP tool definition (`key` and `ciphertext` below, from the `@metavar KEY` and `@metavar CIPHERTEXT` on the `cipher` type definitions of [Docstrings](https://morloc-project.github.io/docs/clis/docstrings.md)):

```console
$ ./cipher --json-help | python3 -c "
import json,sys
d=json.load(sys.stdin)
for c in d['commands']:
  print(c['name'], [(a['name'], a['metavar']) for a in c['arguments']])
"
encode [('key', 'KEY'), ('plaintext', 'PLAINTEXT')]
decode [('key', 'KEY'), ('ciphertext', 'CIPHERTEXT')]
```

An unnamed positional is identified by index alone in both places, which is worth avoiding on anything a model or a script will call.

## 6.4.4. Ending option parsing

A bare `--` ends option parsing: every token after it is a positional, even one that looks like a flag. This is rarely needed, since `-4.0` and `-7` are already treated as positionals, but it is the way to pass a string that looks like a short option:

```console
$ ./sift scan -- -p notes
[{"path":"notes\/todo.txt","line":4,"text":"use -p for plain output"}]
```

Note what that costs: after `--`, the command’s own `-p` formatter is a positional too, so a search for the literal text `-p` cannot also ask for plain output.

## 6.4.5. Reading files in other formats

`@parse` lets an argument be given as a file in a format Morloc does not read itself — a CSV, a FASTA file, a column of numbers — and names the function that reads it. The command stays typed over the values it computes on, and the file is read before the command runs.

**stats.py**

```python
import gzip

def read_csv(path):
    with open(path) as fh:
        return [float(x) for x in fh.read().split(",")]

def read_lines(path):
    opener = gzip.open if path.endswith(".gz") else open
    with opener(path, "rt") as fh:
        return [float(line) for line in fh if line.strip()]

def average(xs):
    return sum(xs) / len(xs)
```

**stats.loc**

```morloc
module stats (mean)

import root-py

source Py from "stats.py" ("read_csv" as readCsv, "read_lines" as readLines, "average")

readCsv :: Str -> <IO> [Real]
readLines :: Str -> <IO> [Real]
average :: [Real] -> Real

--' Average some numbers
mean ::
  --' the numbers to average
  --' @metavar NUMS
  --' @parse csv=readCsv .csv
  --' @parse lines=readLines .txt .txt.gz
  [Real] ->
  Real
mean xs = average xs
```

Each `@parse` line declares a format: a name (lowercase letters, digits and `-`), the function that reads it, and any number of file extensions. A value that ends in one of the extensions is read by that format’s function. So is a value prefixed with the format’s name and a colon, whatever its extension. A value that selects no format is read as always:

```console
$ ./stats '[1,2,3]'
2
$ ./stats scores.csv
3
$ ./stats scores.txt.gz
2.5
$ ./stats lines:readings
2.5
$ seq 1 9 | ./stats lines:-
5
```

The rules for choosing a format:

-   A prefix counts only when the text before the first `:` is a declared format name, or `morloc`. Anything else is part of the value, so paths and JSON that contain colons are unaffected. A file literally named `lines:x` is written `./lines:x`.
-   Without a prefix, the longest declared extension the value ends with picks the format, ignoring case: `.txt.gz` wins over `.gz`, and `SCORES.CSV` is a CSV.
-   `morloc:<path>` reads the file as a Morloc value, for a file whose name happens to end in a declared extension:
    
    ```console
    $ cat old.csv
    [10,20]
    $ ./stats morloc:old.csv
    15
    ```
    
-   `-` reads standard input; the function receives the path `/dev/stdin`. Only one argument per command may read stdin.

Formats are never guessed from a file’s contents. A function that accepts several variants — `read_lines` above takes plain and gzipped text — decides that itself.

The function’s type follows from the argument’s:

| Argument type | Function type |
| --- | --- |
| `T` | `Str → <IO> T` |
| `?T` (an option) | `Str → <IO> T` |
| `IStream a` or `IFile [a]` | `Str → ([a] → <IO> ()) → <IO> ()`: it reads the file and hands each batch to the function it is given |

A stream argument is read into a temporary file as it arrives, so it is never held in memory, and the command receives exactly the batches the function produced (see [Random access and streaming](https://morloc-project.github.io/docs/runs/random-access-and-streaming.md)). Temporary files go under `$MORLOC_TMPDIR`, else `$TMPDIR`, else `/tmp`, and are removed when the run ends, however it ends short of `kill -9`.

If the function fails, the command does not run, and the run exits non-zero with the argument, the format and the path:

```console
$ cat bad.csv
1,two,3
$ ./stats bad.csv
error: argument NUMS (format csv, path bad.csv): could not convert string to float: 'two'
```

The function reports a failure the way any sourced function does: an exception in Python or C++, `rustmorloc::morloc_throw` in Rust. A Rust panic is treated as a bug and stops the pool.

Help lists each argument’s formats:

```console
$ ./stats -h
...
Positional arguments:
  1: NUMS  the numbers to average
           type: [Real]
           formats: csv (.csv), lines (.txt .txt.gz), morloc (the default)
...
```

`@parse` belongs to the command line. A daemon, MCP or call-packet caller passes values, as before. It is not available on a `Str` argument (the function would be handed the string it is supposed to produce), on `@many`, `@unroll` or `@form list` arguments, on flags, or on an argument whose type has a type variable. The command or one of its format functions must be a foreign function: an all-Morloc command has no pool to read the file in.
