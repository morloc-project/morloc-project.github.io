# 12.1. Choosing a container engine

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/container-engine.html | prev: https://morloc-project.github.io/docs/install/index.md | next: https://morloc-project.github.io/docs/install/creating-an-environment.md

There is no separate setup step. `mim new` picks the container engine and remembers it for later environments: if exactly one engine is installed it is auto-detected, otherwise pass `--engine` on your first `new`:

```console
$ mim new --engine podman    # or: --engine docker, --engine apptainer
```

`--engine` accepts `docker`, `podman`, `apptainer`, or `singularity` (the last is an alias for `apptainer`, the common engine on HPC clusters), or `none` for the native (no-container) backend. The choice made on the first `new` becomes the default for subsequent environments.
