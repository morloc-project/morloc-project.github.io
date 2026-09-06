# 0068: a served eval's `import` does not bring the imported term into scope

- Status: withdrawn
- Found: 2026-09-06, while testing the eval auth gate
- Component: nexus (or compiler eval)
- morloc: 0.101.0     mim: 0.29.0

## Expected

A served eval expression may carry leading `import` lines, and the error message
for an unknown term says so directly: "an eval expression has no implicit
prelude; prefix the expression with 'import root-py;' (or the module that
defines +) to bring it into scope". So an expression that carries that exact
prefix should resolve the term.

## Observed

The prefix is present and the term is still undefined. The hint tells you to do
what the expression already does:

```
$ curl -s -X POST localhost:8092/eval -H 'Content-Type: application/json' \
    -d '{"expr":"import root-py; add 1 2"}'
{"status":"error","error":"<expr>:3:1: error:\nUndefined term: add\nhint: an
eval expression has no implicit prelude; prefix the expression with 'import
root-py;' (or the module that defines add) to bring it into scope"}
```

Note the reported position: `<expr>:3:1` for a one-line expression, which
suggests the import line is being expanded into a preamble and the expression
placed after it, and that something in that assembly is not connecting the two.

An import of a module that is not in the allow-list is refused with a distinct
and correct message ("module 'root-py' is not in the eval allow-list"), so the
allow-list check sees the import even when scoping does not.

## Reproduce

```
$ morloc-nexus router --program <p> --fdb <fdb> --http-port 8092 \
    --eval --eval-allowed-modules root-py --eval-allow-no-auth
$ curl -s -X POST localhost:8092/eval -H 'Content-Type: application/json' \
    -d '{"expr":"import root-py; add 1 2"}'
```

## Impact

Served eval cannot use any imported term, which is most of what it is for. A
bare expression over literals still evaluates, so the endpoint is reachable and
the capability appears to work until you try to use a function.

## Guess

Unverified: the import line and the expression may be assembled into a module
whose export or scope wiring does not include the imported names, rather than
the import being ignored -- the allow-list check clearly parses it.

## Resolution

Withdrawn. Not a defect; the report is wrong.

`root-py` exports `+`, and has not exported `add` for about a year. The
expression under test changed two things at once against the failing case --
it added the import AND replaced `+` with `add` -- so the term really was
undefined, and the error was correct.

The expression the report should have used works:

```
$ curl -s -X POST localhost:8089/eval -H 'Content-Type: application/json' \
    -d '{"expr":"import root-py; 1 + 2"}'
{"status":"ok","result":"3"}
```

Without the import the same expression reports `Undefined term: +`, so the
import is what brings the term into scope: exactly the behaviour the report
claimed was missing.

The `<expr>:3:1` position was also read wrongly. The import line is expanded
into a preamble and the expression follows it, so line 3 is where a one-line
expression lands. That is the design, not evidence against it.
