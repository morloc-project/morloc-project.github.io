# 0017: a `Table` argument cannot be read from stdin

- Status: open
- Found: 2026-09-02, writing the "Advanced Types" table section
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/features-tables.asc` documents stdin as one of the ways a table
argument is supplied:

```
# Standard input
cat census.json | ./prog summarize -
```

## Observed

```
$ cat d.csv | ./io count -
Error: failed to parse argument #0: stdin: serialization error: Cannot compute msgpack size for a Table; Tables use the Arrow IPC SHM wire path
$ echo $?
1
```

The same data passed as a file path works:

```
$ ./io count d.csv
3
```

## Reproduce

`io.loc`:

```
module main (count)

import root-py
import table-py

count :: Table n {x = Int, y = Str} -> Int
count = nrow
```

```
$ morloc make -o io io.loc
$ printf 'x,y\n0,c\n1,a\n2,b\n' > d.csv
$ ./io count d.csv
3
$ cat d.csv | ./io count -
Error: failed to parse argument #0: stdin: serialization error: Cannot compute msgpack size for a Table; Tables use the Arrow IPC SHM wire path
```

## Impact

Tables cannot be piped, so a table-consuming morloc program cannot sit in the
middle of a shell pipeline. File paths and inline JSON both work, so there is a
workaround (a process substitution or a temp file).

## Guess

Unverified: the stdin path buffers into a msgpack value before deciding the
wire form, and never reaches the format sniffing that the file path gets.
