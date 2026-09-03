# 0040: the `workdir-basics` golden test expects a `start.json` nothing writes

- Status: open
- Found: 2026-09-03, running the compiler test suite before committing an unrelated fix
- Component: runtime
- morloc: 0.100.2     mim: 0.28.0

## Expected

`test-suite/golden-tests/workdir-basics` is committed with an `exp.txt` that
lists `start.json` in a materialized run directory and reads two fields out of
it. Its `Makefile` documents the contract:

> Labeled call (foo) triggers materialization of `MORLOC_LOG_DIR/<id>/` with
> `start.json`, `summary.json` (clean exit), and `a/log`

`data/rust/morloc-runtime/src/run.rs:20` says the same:

> The directory is created lazily on first need (logging tee, prologue write,
> cache or SLURM artifacts). A `start.json` is written on first
> materialization; a structured `summary.json` is written on clean exit by the
> nexus's `clean_exit`.

## Observed

The test fails; the run directory has no `start.json`.

```
$ stack test morloc:morloc-test
...
    workdir-basics:                                        FAIL (1.76s)
      Files '.../workdir-basics/exp.txt' and '.../workdir-basics/obs.txt' differ
```

```
$ diff exp.txt obs.txt
4,5c4,5
< files: a start.json summary.json
< files: a start.json summary.json
---
> files: a summary.json
> files: a summary.json
8,9c8,9
< start_run_id_field: 1
< start_pid_field: 1
---
> start_run_id_field:
> start_pid_field:
```

Nothing in the Rust tree writes the file. The only occurrence of the name is
the doc comment quoted above:

```
$ grep -rn "start\.json\|start_json" data/rust/ --include=*.rs | wc -l
1
```

`summary.json` has a writer (`write_summary_json`, `run.rs:326`); `start.json`
has none.

## Reproduce

`stack test morloc:morloc-test` from the compiler repo, or
`make -C test-suite/golden-tests/workdir-basics`.

## Impact

The suite is red on a clean tree, which costs every later change a moment of
"is this mine?" -- and eventually stops being read at all. Either the feature
is missing or the test and the doc comment describe a design that was dropped;
whichever it is, one of the two should move.

## Guess

Unverified. `git log` on `run.rs` shows `Add per-run id and on-disk run
directory` (which committed the test) followed by `Add prologue/epilogue and
summary.json`. The `start.json` writer looks like it was planned in the first
commit, described in its doc comment and test, and never written.
