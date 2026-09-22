# 12.6. Extra container flags

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/extra-container-flags.html | prev: https://morloc-project.github.io/docs/install/customizing-environments.md | next: https://morloc-project.github.io/docs/install/serve-and-freeze.md

Anything a container engine needs beyond what `mim` passes on its own — a GPU device, a proxy, a bind mount, a hostname — goes in an **engine flag file**: a YAML document partitioned by phase and by engine. A phase is one of the three engine verbs an environment performs: `build` (the image build, at `new`, `update`, and `freeze`), `run` (`run`, `shell`, `install`), and `start` (the serving container). Under each phase, an engine section (`docker`, `podman`, `apptainer`) lists the flags that engine gets, and an `all` section lists the flags every engine gets. Each entry is one argument as the engine would see it on its command line:

```yaml
# flags.yaml
build:
  all:
    - --build-arg=HTTP_PROXY=http://proxy.example.com:3128
  podman:
    - --no-cache

run:
  all:
    - --volume=/data/reference:/ref:ro     # a host directory every program can read
  apptainer:
    - --nv                                 # NVIDIA GPU passthrough
  podman:
    - --device=/dev/dri

start:
  all:
    - --hostname=morloc-serve
```

Every section is optional, and an absent one is empty. The schema is strict: a section or engine name outside this set is a parse error, so a misspelt `podmann:` is refused rather than ignored. Entries pass through the shell before they reach the engine, so `$HOME`, `~`, and globs expand, and a value that needs a space must be quoted as it would be in a shell.

Install the file when the environment is created, or on an existing one with `modify`, which also takes `--no-flagfile` to remove it:

```console
$ mim new gpu --engine podman --flagfile flags.yaml
$ mim modify --env gpu --flagfile flags.yaml      # replace it; build flags apply at the next `update`
$ mim modify --env gpu --no-flagfile              # drop it
```

The file is validated and then copied whole — comments included — to `~/.config/morloc/environments/<name>/env.flags.yaml`, replacing whatever was there; it is never merged into an existing one. `mim info <name>` names the file and prints what each phase materializes to for the environment’s engine. The `build` section is part of the image’s cache key, so changing it is enough to make the next `update` rebuild.

For each invocation the flag list is `<phase>.all ++ <phase>.<engine>`, with any one-shot CLI override appended after it. Two overrides exist, and neither touches the persisted file:

-   `-x <flag>` (`--engine-arg`) appends one flag for this invocation, and is repeatable. On `run`, `shell`, and `install` it joins the `run` phase; on `start`, the `start` phase; on `new` and `update`, the `build` phase.
-   `--flagfile <file>` on `run`, `shell`, `install`, and `start` uses that file **instead of** the environment’s for this invocation, which is how a second instance of a serving environment comes up under different flags.

```console
$ mim run -x --device=/dev/dri -- ./prog render     # one extra flag, this run only
$ mim run --flagfile gpu.yaml -- ./prog render      # a different file, this run only
$ mim start --flagfile alt.yaml -p 9090:8080        # a second serve under other flags
```

One flag is owned by `mim` and refused in the file and on the command line alike: `--platform`, because the environment’s `--arch` chooses it and a raw platform flag would run the image on an architecture its toolchain was not solved for. The whole facility is for container backends; the native backend has no engine to pass flags to, and `--flagfile` is an error there.
