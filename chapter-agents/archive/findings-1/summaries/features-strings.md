# Morloc knowledge added by chapter 7 (features-strings)

## String literals

- `"..."` — regular double-quoted. Full Unicode/emoji support
  end-to-end through the nexus.
- `"""..."""` and `'''...'''` — triple-quoted, both forms lex
  identically (see `library/Morloc/Frontend/Lexer.hs:206`). Useful
  for avoiding escapes of interior quotes.
- Single-quoted `'foo'` is NOT a string literal — the parser reports
  `unexpected type-level string "'hi'"`. Only doubles and
  triple-quoted variants are expressions.

## Escape sequences

Exactly six recognized (`Lexer.hs:601-608`):

  `\n`  `\t`  `\r`  `\0`  `\\`  `\"`

Any other backslashed char is a lex-time error:
`invalid escape sequence \q` (with source caret). So Windows paths
must double every backslash: `"C:\\Users\\weena\\file.txt"`. Writing
`"C:\Users"` fails with `invalid escape sequence \U`.

## Interpolation

- `"hello #{expr}"` — `expr` must have type `Str`. No auto-coercion;
  use `show n` for `Int`/`Real`/`Bool`.
- Brace balancing works — nested `{...}` inside the interpolation are
  tracked (`lexInterpBody` in Lexer.hs).

## Multi-line trimming

Three passes in `processMultilineString` (Lexer.hs:1050):

1. If the first line (before the first `\n`) is whitespace-only, drop
   it. Otherwise leave content alone.
2. If the last line is whitespace-only, drop it. Otherwise leave.
3. Compute the min leading-space count across NON-EMPTY lines only,
   then drop that many spaces from every line.

Doc's wording ("initial spaces up to and including the first newline
are removed") is looser than the actual algorithm. Confirmed on
`"""abc\n  def"""` → `"abc\n  def"` (nothing trimmed; first line has
content).

## NUL bytes in `Str`

Two mechanisms in the compiler; only one is user-reachable:

1. **Compile-time**: A `Str` LITERAL that flows into a pool whose
   `lang.yaml` sets `allow_string_null: false` (R and C) is rejected
   by codegen with a multi-sentence message pointing at that
   `allow_string_null` field (see
   `library/Morloc/CodeGenerator/Grammars/Translator/Generic.hs:1001+`).
2. **Runtime**: `data/rust/morloc-nexus/src/dispatch.rs` has a
   `first_null_in_json` scan meant to reject cross-pool NUL passes at
   the nexus with `Error: <lang> does not support embedded NUL bytes
   in strings (at args[N]<pos>)`. In v0.93.0 this scan does NOT
   trigger in the direct-exec path — verified with both the
   `source: file` route (using the compiler's own
   `test-suite/golden-tests/string-nul-skip-check` recipe) and a
   Python-produced NUL routed through `idr`. Both surface R's raw
   `embedded nul in string` error instead. Treat the runtime NUL
   guard as unreliable and put no examples in later chapters that
   depend on the friendly message.

## Runtime flags for NUL

- `morloc make --unsafe-skip-null-check` — real CLI flag (help text
  at `morloc make --help`). Bakes a manifest flag.
- `MORLOC_SKIP_NULL_CHECK=1` — real env var.
- In practice both are no-ops in v0.93.0 exec mode because the guard
  they bypass doesn't fire (see above).

## Language `allow_string_null` flags

From `data/lang/*/lang.yaml`:
  - Python: `true`
  - C++: `true`
  - Julia: `true`
  - R: `false`
  - C: `false`

Doc only mentions R; C is also NUL-intolerant.

## Nexus arg parsing (reminder for later chapters)

- Str args on the CLI are treated as raw text, not JSON. `./m fn ab`
  passes the string "ab"; `./m fn '"ab"'` passes the 4-char string
  `"ab"` (with literal quotes). This matters when trying to hand-craft
  edge-case Str values.
- `--' source: file` on a parameter (docstring form) makes the CLI
  argv a path; the file contents become the arg value. This is the
  only way to inject arbitrary bytes (including NUL) into a `Str`
  argument. The feature is exercised in the compiler's golden tests
  but not documented in the chapters walked so far.

## For downstream chapters

- Trust triple-quoted strings for multi-line text; expect them to
  round-trip through JSON with `\n` escapes preserved.
- Don't write `Str` examples that expect the runtime NUL guard to fire.
- When a doc example promises a specific error message, grep the
  compiler source; several strings in this chapter are aspirational.
