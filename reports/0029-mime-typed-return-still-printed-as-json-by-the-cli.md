# 0029: FEATURE -- a media-typed return still prints as JSON from the CLI

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`@mime` declares that a type's values are bytes of a known media type. A
command returning one is the CLI shape of `convert ... > out.png`: run it,
redirect, get a file. `src/content/cli-output.asc:186` promises the label
reaches "every sink", and for the HTTP daemon and MCP it does.

## Observed

The CLI shows the label and then writes a JSON array of byte values.

```
$ cat m.loc
module m (ramp)

import root-py

--' A PNG image
--' @mime image/png
type PNG = [U8]

source Py from "m.py" ("make_png" as makePng)
makePng :: Int -> PNG

--' Render an n-by-n grayscale ramp as a PNG
ramp :: Int -> PNG
ramp = makePng

$ ./m ramp -h
...
Return: image/png
  A PNG image

$ ./m -o out.png ramp 4
$ file out.png
out.png: JSON text data
$ head -c 60 out.png
[137,80,78,71,13,10,26,10,0,0,0,13,73,72,68,82,0,0,0,4,0,0,0
```

There is no output form that writes the bytes:

```
$ ./m -f raw @ ramp 4
error: invalid value 'raw' for '--output-form <FORM>'
  [possible values: json, jsonl, mpk, voidstar, packet, arrow, parquet, csv]
```

## Reproduce

`m.py`:

```
import struct, zlib

def make_png(n):
    def chunk(typ, data):
        c = typ + data
        return struct.pack(">I", len(data)) + c + struct.pack(">I", zlib.crc32(c) & 0xffffffff)
    raw = b""
    for y in range(n):
        raw += b"\x00" + bytes([(x*255)//max(n-1,1) for x in range(n)])
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", n, n, 8, 0, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw))
    png += chunk(b"IEND", b"")
    return list(png)
```

with `m.loc` above, then `morloc make -o m m.loc`.

## Suggestion

The machinery exists; only the wiring is missing. A `@render` sink already
emits its handler's bytes verbatim, so today's workaround is a no-op handler:

```
--' identity on bytes
ident :: PNG -> PNG
ident x = x

--' Render an n-by-n grayscale ramp as a PNG
--' @render -r/--raw=ident @default
ramp :: Int -> PNG
```

which does produce a real PNG (`file out.png` says
`PNG image data, 4 x 4, 8-bit grayscale`) while `-f json` still recovers the
typed array. Two ways to close the gap without that boilerplate: make `@mime`
on a return type imply the raw-bytes default (with `-f json` as the escape
hatch, exactly as an explicit `-f` already overrides a `@default` formatter),
or expose the existing verbatim path as an `-f raw` output form.

## Impact

The one directive whose whole purpose is "these bytes are a PNG" has no effect
on the interface where bytes are cheapest to deliver. Authors either ship the
no-op handler above or tell users to pipe through a decoder.
