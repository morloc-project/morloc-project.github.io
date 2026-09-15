# 0081: the `build:` section of `env.flags.yaml` is accepted and never applied

- Status: open
- Found: 2026-09-14, checking the deployment chapter against mim
- Component: mim
- morloc: 0.105.2     mim: 0.31.1

## Expected

`env.flags.yaml` is documented as "strict: unknown section or engine names are
a parse error" (`src/content/installation.asc`, "Extra container flags"). A
section the file accepts should do something, or be rejected like any other
unknown key.

## Observed

Verified by reading, not by running.

`types::FlagConfig` has three fields, `build`, `run`, `start`, under
`deny_unknown_fields`, and `config::read_flag_config` shell-expands all three.
But `types::Phase` has only `Run` and `Start`, `FlagConfig::materialize` only
ever reads `run` or `start`, and every `BuildConfig` constructed in `main.rs`
and `freeze.rs` passes `extra_flags: Vec::new()`. A `build:` section is
therefore parsed, expanded through `sh -c printf`, and dropped.

The manual used to show `build.apptainer: [--ignore-subuid]` as an example;
that line never reached an engine.

## Reproduce

```
$ cat ~/.config/morloc/environments/myenv/env.flags.yaml
build:
  podman:
    - --no-cache
$ mim update --env myenv --force -v
```

Expected observed outcome: the printed `podman build` line carries no
`--no-cache`, and no warning is printed.

## Impact

A user who needs a build-time engine flag (a proxy, `--no-cache`, an Apptainer
`--ignore-subuid`) writes it where the schema accepts it and it silently does
nothing. The manual now documents only `run` and `start`.

## Guess

Unverified: either thread `build` through the env-image and freeze builds, or
drop the field so the strict schema rejects it.
