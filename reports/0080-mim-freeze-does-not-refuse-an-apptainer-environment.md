# 0080: `mim freeze` does not refuse an Apptainer environment

- Status: open
- Found: 2026-09-14, checking the deployment chapter against mim
- Component: mim
- morloc: 0.105.2     mim: 0.31.1

## Expected

`freeze` builds an OCI image from a generated Dockerfile. The only engines that
can do that are Docker and Podman, so an Apptainer environment should be
refused up front with a message naming the limitation, the way a native
environment is (`mim/src/main.rs`, `Cmd::Freeze`: "freezing a native
environment is not yet supported").

## Observed

Verified by reading, not by running: this host has no container engine.

The `Cmd::Freeze` arm checks `is_dev()`, `is_local_runtime()`, and
`backend.is_native()`, then takes `ec.engine()?`, which is happy to return
`ContainerEngine::Apptainer`. `freeze::freeze_environment` writes a Dockerfile
and calls `container::container_build_visible(engine, &cfg)`, which for every
engine runs `<exe> build -f <Dockerfile> -t <tag> <context>`
(`container.rs`, `build_build_args`). Under Apptainer that is
`apptainer build -f ... -t ...`, which is not an `apptainer build` invocation.

`container::save_image` does know about the engine and returns
"apptainer has no image store to save from", but it runs after the build.

## Reproduce

```
$ mim new hpc --engine apptainer
$ mim install main.loc
$ mim freeze --tag svc:v1
```

Expected a refusal before any work; expected observed outcome is a staged
build context, validation, and then an `apptainer build` usage error.

## Impact

An HPC user (the audience Apptainer exists for) reaches the freeze step, waits
through staging and program validation, and gets an engine error that does not
say the feature is unsupported. The manual now says freeze is Docker/Podman
only (`src/content/installation.asc`, "Portable images with `freeze`").

## Guess

Unverified: add an Apptainer check beside the native one in `Cmd::Freeze`.
