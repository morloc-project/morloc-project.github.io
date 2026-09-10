# 0079: a `@savem` / `@load` round trip silently corrupts the integers 48 to 57

- Status: open
- Found: 2026-09-10, while rewriting the caching example in the intrinsics chapter
- Component: runtime
- morloc: 0.102.1

## Expected

`src/content/features-intrinsics.asc` says `@load` "auto-detects the file
format. Files written by `@savem` carry a small header that identifies them as
MessagePack. If no header is present, `@load` tries to parse the file as
JSON." A value written by `@savem` and read back by `@load` should be the
value that was written.

## Observed

Ten integers come back as different integers. No error, no warning.

```
$ cat rt.loc
module main (rt)
import root
import root-py (id)

rt :: Int -> Str -> <IO> Int
rt x p = do
  @savem p x
  cached <- @load p
  match cached
    | (Ok v) = v
    | (Err _) = -1

$ morloc make -o rt rt.loc
$ for v in 47 48 49 50 55 57 58 45 123; do printf "%-6s " "$v"; ./rt rt $v v_$v.bin; done
47     47
48     0
49     1
50     2
55     7
57     9
58     58
45     45
123    123
```

The written file is correct. MessagePack encodes a small positive integer as a
single byte equal to the value, so 49 is written as the byte `0x31`:

```
$ od -An -tu1 v_49.bin
 49
```

`0x31` is also the ASCII character `1`. On the way back in, the sniffer finds
no MessagePack header, falls through to the JSON reader, and the file parses
as the JSON number `1`. The affected range is exactly the ASCII digits,
`0x30`-`0x39`, so integers 48 through 57 read back as 0 through 9.

## Reproduce

Save `rt.loc` above in an empty directory, `morloc make -o rt rt.loc`, then
`./rt rt 49 x.bin`. It prints `1`.

## Impact

Silent wrong data on the documented persistence path, for ten ordinary small
integers. Anything that caches a count, an index, an exit status or an age
through `@savem` can read back a different number, and nothing in the program
signals it. A single `Int` is the worst case because a larger MessagePack
payload is unlikely to be valid JSON by accident, but the mechanism is not
limited to integers -- any encoding whose bytes happen to parse as JSON is
read as JSON.

## Guess

Unverified. The sniffer appears to decide "MessagePack" only on a header that
`@savem` does not always write for a bare scalar, and to treat "parses as
JSON" as sufficient evidence of JSON. Writing the header unconditionally, or
checking it before attempting JSON at all, would close it.
