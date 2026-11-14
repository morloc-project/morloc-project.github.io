# 5.7. Input shape

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/input-shape.html | prev: https://morloc-project.github.io/docs/clis/sum-type-arguments.md | next: https://morloc-project.github.io/docs/clis/reading-stdin.md

The defaults from [Arguments](https://morloc-project.github.io/docs/clis/arguments.md) cover most arguments: a scalar is read from argv, a compound value is inline JSON or a file. Three directives override that when an argument needs a particular shape.

-   `@source` says where the bytes come from: `inline` (the argv token **is** the value) or `file` (the argv token is a path and the file’s contents are the value).
-   `@form` says how the bytes are read: `list`, `table`, `bytes`, `bytes-only`, or `packet`.
-   `@check.<kind>` states an invariant the argument must satisfy before the command runs. The only kind today is `path`.

For a list, the same three exist per element as `@list.source`, `@list.form`, and `@list.check.<kind>`, describing what each **line** of the outer file means.

Which combinations are legal depends on the argument’s wire type. The tables below are the complete set; anything outside them is a compile error, reported against the docstring line that caused it.

**Table 1. Non-Str primitives (numeric values and booleans)**

| Modifier | Effect |
| --- | --- |
| *(none — the only valid case)* | argv is the literal value (`42`, `true`, `3.14`). No modifiers are allowed. |

**Table 2. Str**

| Modifier | Effect |
| --- | --- |
| *(default)* | argv is the string itself, verbatim. |
| `@check.path r` / `w` / `x` / `rw` | argv must be a path satisfying the requested mode. `r` = exists and is readable; `w` = writable (an existing writable file, or a non-existent file in a writable directory); `x` = does not yet exist and the parent directory is writable (exclusive create); `rw` = exists and is both readable and writable. Mutually exclusive with `@source file`. |
| `@source file` | argv is a path; the file’s contents become the string. One trailing newline is stripped, so it behaves like `$(cat file)`. |
| `@stdin` | Makes the positional optional and reads standard input when it is omitted. Implies `@check.path r`. See [Reading a stream from standard input](https://morloc-project.github.io/docs/clis/reading-stdin.md). |

**Table 3. Arrays of fixed-width scalars (\[U8\], \[I32\], \[F64\], \[Bool\], …​)**

| Modifier | Effect |
| --- | --- |
| *(default)* | argv is a JSON array (`[1,2,3]`) or a path to a JSON / MessagePack / packet file. |
| `@form bytes` | argv is a path; the file is checked for a Morloc packet header and otherwise read as packed raw bytes. |
| `@form bytes-only` | argv is a path; the file is packed raw bytes, with no packet check. |
| `@form packet` | argv is a path; the file must be a Morloc packet. |
| `@source inline` + `@form bytes` or `bytes-only` | Only on `[U8]`. argv is the literal byte sequence, one byte per character, with `\xNN`, `\n`, `\t`, `\r`, `\0` and `\\` recognized. |

**Table 4. Any list type (\[T\], including \[Str\] and \[(Int, Str)\])**

| Modifier | Effect |
| --- | --- |
| `@form list` | argv is a file (or `-`) with one element per line, or an inline JSON array. A token whose first byte is `[` is parsed as JSON; anything else is a path. Tuple and record elements also accept TSV or CSV rows with no header, columns in field order. |
| `@form table` | Only on a list of records. argv is a path (or `-`) to a table whose header row names the fields: CSV, TSV, Arrow IPC, Parquet or a Morloc packet. See [Tables with a header](#form-table). |
| `@form list` + `@list.source file` | Each line of the outer file is a path to a per-element file, each classified on its own (JSON / MessagePack / packet). |
| `@form list` + `@list.source file` + `@list.form packet` | Each line is a path, and each per-element file must be a Morloc packet. |
| `@form list` + `@list.source file` + `@list.form bytes` (or `bytes-only`) | Each line is a path, and each file is read as packed raw bytes. The element type must be an array of fixed-width scalars. |
| `@form list` + `@list.check.path r` (or `w` / `x` / `rw`) | Each line of the outer file must be a path satisfying the requested mode. The element type must be `Str`. |

**Table 5. Tuples, records, and other non-list compound types**

| Modifier | Effect |
| --- | --- |
| *(default)* | argv is JSON, or a path to a file holding JSON / MessagePack / a packet. A `Table` also reads CSV, TSV, Arrow IPC and Parquet files. |
| `@form table` | Only on a `Table`. As the default, but never JSON or an inline value. See [Tables with a header](#form-table). |

## 5.7.1. A worked example

The `scanAll` in `sift` uses two of these. The pattern list is a file with one pattern per line, and the search root must be a directory that exists:

```morloc
--' Search for any of several patterns, one per line of a file
scanAll ::
  --' A file of patterns, one per line
  --' @form list
  [Str] ->
  --' The directory to search
  --' @check.path r
  Str ->
  Options ->
  <IO> [Hit]
```

A shaped argument gets a `format:` line in the help saying what it will accept. So does every `Str` argument, shaped or not: `Str` is the one type where argv is genuinely ambiguous, and stating the default reading is cheaper than making a reader infer it from the absence of a line.

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
...
```

```console
$ printf 'milk\nrest\n' > patterns.txt
$ ./sift scanAll patterns.txt notes -p
notes/todo.txt:1:buy milk
notes/2026/plan.txt:3:rest
```

`@form list` still accepts inline JSON, so the same command works without a file:

```console
$ ./sift scanAll '["milk","rest"]' notes -c
2
```

A failing `@check` is reported before the command runs, naming the check that failed:

```console
$ ./sift scan the nosuchdir
Error: argument #1: check.path: r requires path 'nosuchdir' to exist and be readable
```

## 5.7.2. Shape follows the wire form

Shape is classified against an argument’s **wire form**, not its source-level type name. A type declared with `Packable [(a, b)] T` crosses the language boundary as a list of pairs, so the CLI treats it as `[(a, b)]` and every list modifier is available.

`Map a b` from the standard library is the case you are most likely to meet. Its wire form is `[(a, b)]`, so a `Map Str Int` argument reads a two-column TSV or CSV exactly as `[(Str, Int)]` would:

**tally.loc**

```morloc
module tally (tally)

import root-py
import map-py

--' Count the entries of a two-column table read as a Map
tally ::
  --' A file with one `key<TAB>value` pair per line
  --' @form list
  Map Str Int -> U64
tally m = size m
```

```console
$ printf 'apple\t3\nbanana\t7\ncherry\t1\n' > counts.tsv
$ ./tally counts.tsv
3
```

Commas work as well as tabs, and a JSON array per line is the fallback:

```console
$ printf 'apple,3\nbanana,7\n' > counts.csv
$ ./tally counts.csv
2

$ printf '["apple",3]\n["banana",7]\n' > counts.jsonl
$ ./tally counts.jsonl
2
```

> **Note**
> **`@form list` is headerless.** A delimited file read this way is parsed row by row with no header, because columns are bound to tuple slots and record fields by position, not by name. A header row is read as data. It is rejected only when one of its names fails to parse as its column’s type, as `count` does here; if every column is `Str`, the header is loaded as a record without error. There is no option to skip one:
> 
> ```console
> $ printf 'name\tcount\napple\t3\n' > hdr.tsv
> $ ./tally hdr.tsv
> Error: failed to parse argument #0: serialization error: JSON parse error: expected value at line 1 column 10
>   hint: the first row (`name	count`) looks like a column-name header. `@form list` is headerless -- remove the header row, or read the file with `@form table`, which binds columns by name.
> ```
> 
> A file with a header belongs to `@form table`, below.

## 5.7.3. Tables with a header

`@form table` reads a file whose first row names its columns. On a list of records, each column binds to the field it names, so the columns may come in any order; on a `Table` it fixes how the file is read, as described at the end of this section. Every cell is checked against its field’s type before your function runs.

**genes.loc**

```morloc
module genes (load, spans)

import root-py

record Gene = Gene
  { name :: Str
  , chrom :: Str
  , start :: Int
  , end :: Int
  }

--' Load genes from a table
load ::
  --' A table with columns name, chrom, start and end
  --' @form table
  [Gene] -> [Gene]
load gs = gs

--' Length of each gene
spans ::
  --' A table with columns name, chrom, start and end
  --' @form table
  [Gene] -> [Int]
spans gs = map (\g -> .end g - .start g) gs
```

```console
$ printf 'name\tchrom\tstart\tend\ntp53\tchr17\t7661779\t7687538\nbrca1\tchr17\t43044295\t43125364\n' > genes.tsv
$ ./genes load genes.tsv
[{"name":"tp53","chrom":"chr17","start":7661779,"end":7687538},{"name":"brca1","chrom":"chr17","start":43044295,"end":43125364}]
$ ./genes spans genes.tsv
[25759,81069]
```

The header also decides the delimiter. The first row is split on tabs and then on commas, and whichever split names the fields wins, so a tab-separated file saved as `.txt` or `.csv` reads correctly and the file’s name is never consulted. CSV quoting works as usual:

```console
$ printf 'chrom,start,end,name\nchr17,7661779,7687538,tp53\nchr17,43044295,43125364,"brca1, isoform 2"\n' > genes.csv
$ ./genes load genes.csv
[{"name":"tp53","chrom":"chr17","start":7661779,"end":7687538},{"name":"brca1, isoform 2","chrom":"chr17","start":43044295,"end":43125364}]
```

A header that does not name exactly the record’s fields, or a cell that is not its field’s type, is reported with its line and column:

```console
$ printf 'name,chrom,start\ntp53,chr17,7661779\n' > short.csv
$ ./genes spans short.csv
Error: failed to parse argument #0: line 1: the header (name,chrom,start) does not match the expected columns (name, chrom, start, end); missing: `end`
$ printf 'name,chrom,start,end\ntp53,chr17,7661779,7687538\nbrca1,chr17,43044295,NA\n' > na.csv
$ ./genes spans na.csv
Error: failed to parse argument #0: line 3, column `end`: "NA" is not Int
```

How a cell spells a value:

-   **Empty**: an empty cell, as in `fred,42,,true`, is null. Only an optional field (`?Int`, `?Str`) may hold it. A quoted empty cell, `""`, is the empty string.
-   **`Bool`**: `true` or `false`, in any case, so `TRUE` and `False` read too.
-   **Numbers**: integers are decimal with an optional `-`; reals may have a fraction and an exponent (`1.5e-3`), or be `nan`, `inf` or `-inf`. A value out of range for its type is an error.
-   **Enums**: the constructor’s name.
-   **`Str`**: the cell’s text exactly, spaces included.

Nothing else is accepted. In particular `NA`, as R writes a missing value, is an error rather than a null; write the file with `na=""` instead.

A field may be any of those types or an optional of one. A field holding a list or a record is a build error, and so is `@form table` on a list of tuples or on a `Map`, which have no names to match a header against; they keep `@form list`. `@form table` is for a positional argument: an option, or a field of an unrolled record, would need a `@default`, and a default is JSON.

Besides delimited text, the argument may be an Arrow IPC or Parquet file, whose columns bind by name in the same way, or a Morloc packet of the declared type. `-` reads standard input. An inline value and a JSON file are both errors.

The same form comes back out: `-f csv` and `-f tsv` write a list of records as a header and one line per record, and the result reads back as the same records:

```console
$ ./genes -f csv load genes.csv
name,chrom,start,end
tp53,chr17,7661779,7687538
"brca1, isoform 2",chr17,43044295,43125364
```

On a `Table` argument, `@form table` keeps the declared columns' rules — the header must contain them, and any other column is kept as optional text — and refuses JSON and inline values. The header is checked before your command runs. The rest of the file is read by the pool that holds the table, and a bad cell there currently ends the pool with an internal error that names the cell, rather than failing cleanly.
