# 0069: the HTTP daemon corrupts a string argument containing a quote or a backslash

- Status: fixed
- Found: 2026-09-07, while surveying the interface surfaces for FINDINGS 9
- Component: runtime
- morloc: 0.102.1     mim: 0.28.0

## Expected

`POST /call/<command>` takes its arguments as JSON. A `Str` argument holds
whatever the caller put in it, and reaches the pool unchanged -- the same
string the CLI would deliver from `./prog cmd 'say "hi"'`.

## Observed

Any string containing a quote, a backslash, or a control character is
mangled. Against `test-suite/daemon-tests/strings.loc`, whose `strlen`
returns the length of its argument:

```
$ curl -s -X POST localhost:8080/call/strlen -d '["say \"hi\""]'
{"status":"error", ...}                       # expected 8

$ curl -s -X POST localhost:8080/call/strlen -d '["a\\b"]'
{"status":"ok","result":2}                    # expected 3

$ curl -s -X POST localhost:8080/call/strlen -d '["a\nb"]'
{"status":"error", ...}                       # expected 3
```

The backslash case is the serious one: it does not fail, it silently returns a
different string than the caller sent. A morloc program cannot tell that it was
handed truncated data.

The same three values are correct through the CLI.

## Reproduce

```
$ cd test-suite/daemon-tests
$ morloc make -o strings strings.loc
$ ./strings --daemon --http-port 8080 &
$ curl -s -X POST localhost:8080/call/strlen -d '["a\\b"]'
```

## Impact

Every HTTP caller of every morloc program, for any `Str` argument holding a
quote or a backslash -- a Windows path, a regex, an escaped shell fragment,
most JSON embedded as text. Silent data corruption in the backslash case.

MCP is unaffected: it marshals through the same `/call` backend but the values
reaching it are already `serde_json::Value`s that get re-encoded correctly.

## Cause

`daemon_ffi.rs`, in the `/call` argument loop, re-encoded each value by hand:

```rust
let val_str = match val {
    serde_json::Value::String(s) => format!("\"{}\"", s),
    other => other.to_string(),
};
let c = CString::new(val_str).unwrap_or_default();
```

Wrapping the raw contents in quotes is only valid JSON when the contents
contain no quote and no backslash. The CLI path does the same job correctly in
`morloc-nexus/src/dispatch.rs`'s `quoted`, which calls `serde_json::to_string`.

The `unwrap_or_default()` was a second, latent defect of the same shape: a
string with an interior NUL fails `CString::new` and would have been replaced
by the **empty string**, substituting an argument rather than reporting an
error.

## Resolution

Fixed in `morloc` commit TBD.

Both the encoding and the C-string conversion now happen through
`serde_json::to_string`, before the argument array is allocated, so an
encoding failure returns a `400` naming the argument instead of leaking the
array. Encoding escapes NUL along with everything else, so the `CString`
conversion can no longer fail.

Covered by four cases in `test-suite/daemon-tests/run-tests.sh`'s
`http-json-args` group -- an embedded quote, a backslash, a newline, and the
quote case through the `{"args": [...]}` form -- all red before.
