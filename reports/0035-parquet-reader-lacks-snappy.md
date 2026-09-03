# 0035: the nexus cannot read a Parquet file written with default (snappy) compression

- Status: open
- Found: 2026-09-02, checking the table file-format claims
- Component: nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/features-tables.asc` documents Parquet as an accepted input
format for a `Table` argument, detected by the `PAR1` magic. Snappy is
pyarrow's, pandas', and Spark's default compression, so almost every Parquet
file a user already has is snappy-compressed.

## Observed

```
$ ./census summarize nullable.parquet
Error: failed to parse argument #0: file 'nullable.parquet': Failed to read Parquet record batches: Parquet argument error: Parquet error: Disabled feature at compile time: snap
```

The same data written with `compression='none'` reads fine:

```
$ ./census summarize plain.parquet
3
```

Parquet written by the nexus itself also reads fine, so the round-trip in the
manual passes and hides this.

## Reproduce

`census.loc`:

```
module main (summarize)

import root-py
import table-py

summarize :: Table n {state = Str, pop = Int} -> Int
summarize t = fold (+) 0 (getCol "pop" t)
```

```
$ morloc make -o census census.loc
$ python3 -c "
import pyarrow as pa, pyarrow.parquet as pq
t = pa.table({'state': ['WA','OR'], 'pop': [1,2]})
pq.write_table(t, 'snappy.parquet')                      # default compression
pq.write_table(t, 'plain.parquet', compression='none')
"
$ ./census summarize snappy.parquet
Error: failed to parse argument #0: file 'snappy.parquet': Failed to read Parquet record batches: Parquet argument error: Parquet error: Disabled feature at compile time: snap
$ ./census summarize plain.parquet
3
```

## Impact

Parquet input is effectively unusable against files produced anywhere else.
The error names a Rust crate feature, so nothing in it suggests "re-write the
file without compression", which is the only workaround.

## Guess

Unverified: `data/rust/morloc-runtime/Cargo.toml:42` pulls the `parquet` crate
with `default-features = false, features = ["arrow"]`, which drops the codec
features. Adding `snap` (and probably `zstd`, `brotli`, `lz4`, `flate2`) would
cover what is found in the wild.
