# 0060: the public C manifest structs in `morloc.h` do not match what libmorloc returns

- Status: fixed
- Found: 2026-09-05, while tracing manifest consumers before adding a flag field
- Component: runtime
- morloc: 0.100.2     mim: 0.28.0

## Expected

`morloc.h` is the public C header shipped to `$MORLOC_HOME/include`, and
libmorloc exports `parse_manifest`, `read_manifest`, `free_manifest`,
`daemon_run`, `daemon_dispatch` and `manifest_build_discovery` against the
struct types it declares. A C consumer that includes the header and links the
library should read the fields it asks for.

## Observed

Every field is misread. `read_manifest` returns a non-NULL manifest, and each
member read through the header's layout is garbage:

```
$ ./probe2
m=0x562abe75e750
version=-1099569184
name=0x562abe75e800
n_pools=94741584009856
n_commands=94741584037344
exit=0
```

against a manifest whose actual contents are:

```
name tool
n_pools 1
n_commands 2
```

Iterating `n_commands` segfaults, which is what the first probe did.

The cause is visible in the two declarations. `manifest_t` in
`data/morloc/morloc.h` begins:

```c
typedef struct {
    int version;
    char* name;
    char* build_dir;
    manifest_pool_t* pools;
```

while `Manifest` in `data/rust/morloc-runtime/src/manifest_ffi.rs`, the
`#[repr(C)]` struct actually returned, begins:

```rust
pub struct Manifest {
    pub name: *mut c_char,
    pub build: ManifestBuild,   // { path, time, morloc_version }
    pub pools: *mut ManifestPool,
```

The first field is an `int` on one side and a pointer on the other, so nothing
after it can line up.

The same divergence runs through the nested structs. `manifest_command_t`
declares the flat `arg_schemas` / `return_schema` / `return_type` /
`return_desc` fields that the Rust side records as having been replaced by a
return sub-struct. `manifest_arg_s` is missing `schema`, `n_desc`,
`constraints`, `n_constraints` and `metadata_json`, and places `desc` second
where the Rust struct has it tenth.

## Reproduce

From an empty directory, with any built program's `manifest.json` copied in:

```c
// probe.c
#include <stdio.h>
#include "morloc.h"

int main(void) {
    char* errmsg = NULL;
    manifest_t* m = read_manifest("manifest.json", &errmsg);
    printf("m=%p\n", (void*)m);
    if (!m) { printf("parse failed: %s\n", errmsg ? errmsg : "(null)"); return 1; }
    printf("version=%d\n", m->version);
    printf("n_pools=%zu\n", m->n_pools);
    printf("n_commands=%zu\n", m->n_commands);
    return 0;
}
```

```
$ gcc -o probe probe.c -I$MORLOC_HOME/include -L$MORLOC_HOME/lib -lmorloc \
      -Wl,-rpath,$MORLOC_HOME/lib
$ ./probe
```

## Impact

No in-tree C or C++ file uses these declarations -- the nexus reads the
manifest through the Rust crate directly -- so nothing we ship is broken by it
today. What is broken is the published contract: the header is installed, the
symbols are exported, and anyone who writes a C consumer against them gets
silent garbage and then a crash, with no version mismatch to diagnose from.

It also makes the header actively misleading to read while working on the
manifest, since it looks like the authority on the C layout and is not.

## Guess

Unverified. The header appears to describe an earlier revision of the manifest
and to have been left behind when the Rust structs moved on -- the comment on
the Rust return sub-struct explicitly says it "replaces v1's flat
return_schema/return_type/return_desc fields", which are exactly the fields the
header still has. Nothing forces the two into agreement: there is no generated
binding and no layout assertion, so they drift silently.

A fix should probably do more than resynchronize by hand, since that has
already failed once. Either generate the header from the Rust structs, or add
static offset assertions on the C side so a drift breaks the build.

## Resolution

Fixed in `morloc` commit `bce1b369`.

The guess in this report was right on both counts: the header described
manifest v1 while the runtime had moved to v2, and nothing forced the two into
agreement.

`data/morloc/morloc.h` now mirrors the `#[repr(C)]` structs in
`manifest_ffi.rs` one for one. `manifest_t` carries a `manifest_build_t`
sub-struct in place of the old `version` / `build_dir` pair;
`manifest_command_t` carries a `manifest_return_t` sub-struct in place of the
flat `arg_schemas` / `return_schema` / `return_type` / `return_desc` fields,
plus the constraint, metadata, terminal and `internal` slots it had grown;
`manifest_arg_s` gains `schema`, `n_desc`, `short_rev`, the constraint pair and
`metadata_json`, and `desc` moves back to the position the runtime puts it in.
`manifest_build_t`, `manifest_constraint_t`, `manifest_return_t` and
`manifest_terminal_t` are new. Four fields are spelled differently on the C
side because `type`, `short`, `long` and `default` are C keywords.

The same drift had reached the expression types in the section above, which
this report did not cover. A C consumer could name eight of the thirty-one
expression kinds the evaluator produces and three of the five pattern kinds.
Those enums are complete now, along with the six payload structs and the union
members the newer kinds need. Layout was never wrong there -- every missing
union member was a pointer -- so this was a completeness gap rather than a
second corruption.

The probe from this report now reads the manifest correctly rather than
returning garbage:

```
name=tool
build.morloc_version=0.100.2
n_pools=1
pool[0].lang=py
n_commands=2
cmd[0] name=greet is_pure=0 n_args=1 internal=0 ret.schema=s
   arg[0] kind=0 schema=s type=Str n_desc=0
freed ok
```

against a manifest whose real contents are `tool`, one pool, two commands.

## The mechanism

This report asked for more than a hand resynchronization, since that is what
failed the first time. `data/rust/morloc-runtime/src/c_abi_layout.rs` parses
the header, computes the layout a C compiler would give each aggregate, and
compares it against the Rust mirror: field names, field order, per-field
offsets, per-field sizes, the field count, and total size and alignment.

Two of those checks are load-bearing in ways that are easy to miss. Names are
compared because two same-typed neighbours can be swapped without moving any
offset. Per-field sizes are compared because a narrowing retype can be
swallowed whole by the padding in front of the next field -- changing
`size_t n_desc` to `uint32_t n_desc` moves no offset and leaves the struct's
total size unchanged, and an offsets-and-size check passes it. That case was
found by testing the guard rather than by reading it.

Six drift modes were introduced deliberately against the finished guard to
confirm each one fails: a dropped field, swapped same-typed neighbours, a
widening retype, a narrowing retype absorbed by padding, an extra header
field, and a missing enum variant.

## Also fixed

The header carried box-drawing characters in its comment rules. It is embedded
into the compiler binary with Template Haskell, which is exactly the case the
workspace ASCII-only rule exists for, so a POSIX-locale build could have
truncated it silently at the first such byte. The installed copy was intact on
this host, so the hazard was latent rather than active. The comment rules are
ASCII now and the file has no non-ASCII bytes left.
