# 0008: the cross-pool half of the NUL guard was written but never called

- Status: fixed (886aba83)
- Resolution: the cross-pool half of the guard is now called. Whether to scan
  is decided at codegen from the receiving language and whether the value's
  type carries a string, so a type with no strings requests no check and a
  NUL-tolerant language emits unchanged code. The walk lives once in the
  runtime, written against the C-ABI schema mirror, and reports the access path
  to the offending slot.
- Found: 2026-09-02, testing `features-strings.asc`
- Component: runtime (R pool boundary check)
- morloc: 0.100.2     mim: 0.28.0

## Expected

`features-strings.asc` documented this message:

```
Error: r does not support embedded NUL bytes in strings
       (at args[0] (byte 3 of 7))
```

It names the language, the argument position, and the byte offset, and does not
reproduce the payload.

## Observed

```
$ ./nul5 toR abc
Error: run failed
Error: embedded nul in string: 'abcNULabc'
  at _ [r] (mid=2053, nul5.loc:11:14)
  at toR [r] (mid=1, nul5.loc:1:14)
```

(where NUL above is the literal zero byte, printed raw)

Differences from the documented form:

1. The language is not named. "embedded nul in string" does not say that R is
   the constraint, or that another pool would have accepted the value -- which
   is the most useful thing to tell the user.
2. No argument index and no byte offset.
3. The offending string is echoed into the error, raw zero byte included. For a
   NUL-carrying `Str` -- which the manual itself says is most likely binary data
   -- that dumps a payload into stderr and into any log that captures it.
4. `Error: run failed` followed by `Error: embedded nul` is the same doubled
   prefix reported in reports/0005.

The call chain underneath is good and should be kept.

## Reproduce

A NUL cannot pass through argv, so the value is built in Python at run time and
then handed to R:

```morloc
module nul5 (toR)

import root-py
import root-r

source Py from "mk.py" ("make_nul")
make_nul :: Str -> Str

toR :: Str -> Str
toR s = idr (make_nul s)
```

```python
# mk.py
def make_nul(s):
    return s + chr(0) + s
```

```
$ morloc make nul5.loc
$ ./nul5 toR abc
```

## Impact

Users hitting this get less information than the manual promised and more
exposure than they wanted. The fix looks small: restore the language name and
the argument/byte position, and replace the echoed value with its length and the
offset of the first NUL.

## Guess

Unverified: the message probably comes from a generic string-validation helper
shared with other checks, rather than from the language-aware boundary check
that knows `allow_string_null` is false for R.

## Correction (2026-09-03, supersedes the 2026-09-02 note below)

The guard is not missing and this is not a design question. It was built in two
halves and only one was wired up.

`data/rust/morloc-runtime-types/src/null_check.rs` holds the stateless half:

- `env_skip_null_check` -- the `MORLOC_SKIP_NULL_CHECK` probe
- `first_null_in_json` -- walks a JSON value, used for arguments arriving at
  the nexus from the command line

`data/rust/morloc-runtime/src/null_check.rs` holds the other half:

- `first_null_in_strings(ptr: AbsPtr, schema: &Schema)` -- walks a schema-typed
  value in shared memory, which is the representation a cross-pool call uses

The first is called once, at `daemon_ffi.rs:1832`. The second has **no
production caller anywhere**: `grep -rn first_null_in_strings` finds its
definition, its own unit tests, and nothing else. It is not `#[no_mangle]`
either, so no C binder can reach it.

That the second half is meant to run is stated in the manifest field's own
documentation (`morloc-manifest/src/lib.rs:94`):

> When true, suppress the runtime NUL-in-Str scan that normally fires **at
> every cross-pool boundary** into a language with `allow_string_null = false`.

and in the module header, which names the exact failure observed here:

> ... rather than letting the NUL propagate into user-language code where it
> would crash inside something like base R's `nchar` with a confusing
> diagnostic.

So the opt-out for the cost of scanning already exists on both axes -- the
manifest flag from `morloc make --unsafe-skip-null-check` and the environment
variable -- and the earlier note in this report was wrong to treat the cost as
an open question. What is missing is the call.

Two further gaps found while confirming this:

- The manifest's `unsafe_skip_null_check` never reaches a pool. It is read only
  by the nexus at the one wired site. A pool has no way to honour it, so
  wherever the cross-pool check lands it can currently only respect the
  environment variable.
- `MORLOC_SKIP_NULL_CHECK` is likewise only consulted at that one site.

## Where the call belongs

The sending pool cannot make the decision: `foreign_call` is handed a socket
path and a manifold id, and knows nothing about the receiving language. The
receiving side knows its own language trivially, and by then has the argument
as a voidstar plus its schema -- which is exactly the signature
`first_null_in_strings` was given.

For R that boundary is a single choke point, `rmorloc.c:1118`, where
`mkCharLen` builds a CHARSXP from the morloc string. It is also where R's own
error currently comes from. Every string entering an R pool over the binary
path passes through it, and the bytes are already being touched there, so a
scan costs a `memchr` over a buffer that is being copied anyway.

The open question is placement, not cost:

1. Check in each binder at its string-materialization point (R and C are the
   two languages with `allow_string_null = false`). Cheapest and exactly at the
   boundary, but duplicates the walk in C rather than using the tested Rust
   one, and needs the skip flag plumbed to pools.
2. Export `first_null_in_strings` to C and call it from each binder's dispatch
   before unpacking. Uses the tested code, one walk per argument rather than
   per string, but adds a traversal the unpack then repeats.
3. Push the check into the shared Rust receive path (`pool_ffi::pool_dispatch`),
   which would cover every language at once. It has the argument packets but
   not their schemas; the schema is only known inside the language-specific
   dispatch callback, so this needs the schema recovered first.

## Superseded note (2026-09-02)



The original diagnosis was wrong in an important way. Points 1-3 above are not
a badly-worded Morloc message -- they are R's OWN error. `embedded nul in
string` comes from base R, as `data/lang/r/lang.yaml` notes. The Morloc guard
never fired.

That guard exists and produces exactly the message this report expected:

```rust
// data/rust/morloc-runtime/src/daemon_ffi.rs
"{} does not support embedded NUL bytes in strings (at {})"
```

but it runs only on the nexus-to-pool request path, scanning `args_json`. The
reproduction above builds the NUL inside a Python pool at run time and hands it
straight to R, pool to pool, which never passes through `args_json`. So the
value reaches R unscanned and base R rejects it on its own terms.

Point 4 (the doubled `Error:` prefix) is fixed: R's rendered error buffer is
now normalized to a bare message before it is packed, so the R pool reports
like the C++ and Python pools do. The message above is now:

```
Error: run failed
embedded nul in string: 'abc<NUL>abc'
  at _ [r] (mid=2053, nul5.loc:11:14)
  at toR [r] (mid=1, nul5.loc:1:14)
```

What remains is the coverage gap, and closing it is a design decision rather
than a repair. A cross-pool guard would have to scan every string crossing
every foreign call, on a path whose budget is a few microseconds. That is the
cost `morloc make --unsafe-skip-null-check` and `MORLOC_SKIP_NULL_CHECK` exist
to let a user opt out of -- but those switch off a check that, on this path,
is not currently running at all.

Options, none of them free:

1. Scan at the sending pool when the receiving pool declares
   `allow_string_null = false`. Correct and complete, but pays on every
   cross-pool string.
2. Scan only when the receiving pool is one that cannot take NULs, which is
   knowable statically at codegen: emit the check into the sending pool only
   for calls whose target is R or C. Cost is confined to programs that
   actually mix a NUL-intolerant language in.
3. Leave it, and document that R's own error is what a user sees for a
   run-time NUL. Cheapest, and arguably honest, but it contradicts the
   manual's claim that the runtime rejects the call with a clear message.

Option 2 looks right -- the compiler already knows every call's target
language, so the check can be generated exactly where it can fire -- but it
needs a decision before implementation.

## Resolution

Fixed in `morloc` commit `886aba83`.

The cross-pool half of the guard is now reachable: the schema-walking scanner
was written but had no caller and was not exported, so only JSON arguments at
the nexus were ever checked. Codegen decides per deserialization -- it knows the
receiving language and whether the type contains a string at all -- and passes a
flag to the binder, so a value that cannot carry a NUL costs nothing and a
NUL-tolerant pool is compiled exactly as before. The error names the access path
to the offending slot and no longer echoes the payload.

Not covered: interior NULs in Arrow-backed table columns, which the walk does
not descend into.
