---
name: project-optional-positional-cli-semantics
description: Why a `?T` CLI positional is required today, what `null` on the command line means, and the constraints any fix must respect (nexus phase2.rs vs json_help.rs vs Docstrings.hs)
metadata:
  type: project
---

# `?T` as a CLI positional

**Fact.** `?T` in morloc is a claim about the VALUE (it may be null), not about the
argument slot. `Null` is a first-class literal, `isNull :: ?a -> Bool` exists,
`[?Int]` and `?(?Int)` are legal. Nothing in the type system says "this argument
may be absent".

**Fact.** The CLI's answer to "how do I pass null" is already **type the token
`null`**. Pinned by two goldens:
- `test-suite/golden-tests/optional-json/Makefile` (`echoOptInt null`, `echoOptList null`)
- `test-suite/golden-tests/cli-arg-comprehensive/main.loc:64-70` — `null` MUST
  classify as JSON Inline even when a file named `null` is on disk.

This works for every optional type EXCEPT `?Str`. `isQuotedArg`
(`library/Morloc/CodeGenerator/Nexus.hs:1290`) JSON-wraps any argv whose schema
reduces to `s` or `?s`, so `prog f null` yields the string `"null"`. The
inexpressible-null problem is therefore **exactly `?Str`**, not "optional
positionals" generally.

**Fact.** The three views disagree, and only the CLI is the outlier:
- CLI: `phase2.rs:482-503` destructures `Positional { many, stdin, .. }` and sets
  `.required(!stdin)`. Schema discarded -> `?T` is required.
- `--json-help`: `json_help.rs:356` `!schema_is_optional(..) && !*stdin`.
- MCP: `json_help.rs:867`, plus `ArgSlot::Value { missing: Value::Null }` at :872 —
  an omitted optional positional is substituted with JSON null.

**Sanctioned workaround, stated in-tree.** `Docstrings.hs:449-454` tells the user
"positional arguments are required and cannot take defaults ... make the field
optional by adding an 'arg:' docstring entry", and
`optional-json/main.loc:24-26` repeats it. `resolveOpt`
(`Docstrings.hs:595-596`) then AUTO-defaults a `literal: true` `?Str` option to
`null`. So a documented path exists; this is an ergonomics gap with a workaround,
not an unsound path.

## Constraints any fix must respect

1. **Null must not enter the shape pipeline.** `dispatch.rs:1128-1146` turns
   `ArgValue::Null` into the text `null` and then runs
   `ApplyShape`/`dispatch_one_arg` with `ArgShape::from_arg(arg_def)`. With
   `source: file` that asks the runtime to open a file named `null`. The
   option-default path (`phase2.rs:859-860`) already has this shape, so the bug
   likely pre-exists for a `?Str` option with `source: file`. Any absent-branch
   must bypass source/form/checks.
2. **`arg.key()` is `_1`/`_2` when there is no `@name`** (`Docstrings.hs:769`).
   Using it as a clap `value_name` prints `<_1>`, worse than `<arg0>`. Precedence
   must be metavar -> `@name` -> nothing.
3. **`@many` can never be optional.** `checkManyWire` (`Nexus.hs:1464`) requires an
   `a`-headed wire schema; `?[T]` renders `?a...`, so `@many` on an optional is
   already a compile error. No `many`+optional clap config is reachable.
4. **Groups are never positionals**, so `@unroll` is untouched by any
   `required` change.
5. Relaxing `required` only for a TRAILING RUN of optionals re-creates the
   original CLI-vs-json-help divergence for a mid-signature `?T`, and MCP (which
   has no positions) can never agree. So position-dependent required-ness is not
   an option.
6. Two adjacent optional positionals (`f :: ?Str -> ?Str -> Str`) make
   `(null, "x")` inexpressible: omission only ever drops trailing slots and
   `null` is quoted. A clap-legality validator (no required after optional) does
   NOT cover this.

## Blast radius (checked 2026-09-08)

No golden test exports a command with a non-trailing optional positional.
`useOpt :: ?(Int -> Int) -> Int -> Int` in the `defunc-record-closures-*` tests is
a sourced function, not an export; `optionalAdd` in `optional-py` is not exported.
Only `cli-error-diagnostics/Makefile:6` greps for `required|missing`, and
`positional-default-error/Makefile:8` pins the phrase `cannot take defaults`.

`test-suite/error-message-tests/` has NO runner (see `test-suite/CLAUDE.md`), so a
case added there is not run by `./test.sh` or `stack test`.
