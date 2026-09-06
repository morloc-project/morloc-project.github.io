# 0067: a frozen artifact is not portable to a machine without the environment image

- Status: fixed
- Found: 2026-09-06, while auditing the deployment path
- Component: mim
- morloc: 0.101.0     mim: 0.29.0

## Expected

`mim freeze` writes `state.tar.gz` and a manifest; `mim unfreeze --from
<tarball> -t <tag>` builds an image from them. The two-command split only earns
its keep if the archive can cross to a machine that did not produce it, which is
the reason a portable archive exists at all rather than an image.

## Observed

`mim unfreeze` builds the deployment image `FROM` the environment's own image.
That image supplies pixi, which installs the toolchain from the lock the archive
carries; the activation wrapper that every container process goes through; and
the morloc compiler that a sandboxed eval forks. A generic base has none of the
three, so on a machine without the environment image the build fails at its
first instruction.

Before the current commit the fallback was a published image
(`ghcr.io/morloc-project/morloc/morloc-full:<version>`) whose recipe has not
existed in the repository since 0.50.0 in 2024, so the failure arrived as a pull
of something that was never going to be there. That fallback is gone and the
missing image is now reported by name, which makes the limitation visible rather
than confusing, but does not remove it.

## Reproduce

Freeze a container environment on one machine, copy `morloc-freeze/` to another
that has `mim` but has never built that environment, and run `mim unfreeze
--from ./morloc-freeze/state.tar.gz -t svc:v1`. The build cannot start.

## Impact

Anyone following the documented "freeze it and share it" story. The artifact
that looks portable is portable only back to the machine that made it. Building
the deployment image where the environment lives and moving the *image* works.

## Guess

Not a guess so much as a design note: the image is the portable unit, and freeze
should produce one directly rather than an archive that a second command turns
into one. Written up in `plans/deployment/NOTE-01` in the workspace repository.

## Resolution

Fixed in `morloc-manager` commit `3bea253`.

There is no archive any more. `mim freeze --tag <image>` builds the deployment
image directly, where the environment lives and where its image therefore is,
and `mim unfreeze` is gone along with base-image resolution and the stored
environment-layer Dockerfile. Moving the artifact is now moving an image: a
registry push, or `--save`, which is the engine's own `docker save` and
produces a tarball carrying every layer including the base.

The limitation the report describes is not worked around so much as dissolved:
the thing that could not travel was an archive that had to be rebuilt against
an image, and the thing that travels now is the built image.
