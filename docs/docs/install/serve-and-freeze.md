# 12.7. Deployment: serve and freeze

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/serve-and-freeze.html | prev: https://morloc-project.github.io/docs/install/extra-container-flags.md | next: https://morloc-project.github.io/docs/install/composable-function-services.md

Once a program is installed in an environment (`mim install`, or `morloc make --install` inside it) there are two ways to put it in front of other machines and other people, and they are complementary:

-   **`start`** serves an environment in place: the environment’s state is bind-mounted, read-only, into a container (or, on the native backend, a host process) that answers HTTP. Fast, and no build step.
-   **`freeze`** bakes the environment into a self-contained container image that runs the same programs, and serves the same views, with nothing mounted in from outside. This is the artifact you push to a registry or hand to a cluster.

Both serve only what you have declared with `mim view` — installing a program does not make it reachable. The whole lifecycle, from `install` through `view` to `start` and `freeze`, is walked through in [Serving installed programs](https://morloc-project.github.io/docs/utilities/mim.md#mim-serve); this section is the short form.

## 12.7.1. Local serving with `start`

```console
$ mim start                   # serve the default environment on :8080
$ mim start --env myenv -p 9090:8080
$ mim status                  # list running servers
$ mim logs --env myenv        # view logs
$ mim logs --env myenv -f     # stream logs
$ mim stop --env myenv        # stop the container
```

The serve process is `morloc-nexus router`, one HTTP listener that answers:

**`GET /health`**

Liveness check; answers before any token check

**`POST /mcp`**

The MCP endpoint, for AI assistants

**`GET /discover`**

List the modules on the JSON API and whether eval is callable

**`GET /discover/<module>`**

Show a module’s commands and their ordered arguments

**`POST /call/<module>/<command>`**

Invoke one command with positional JSON arguments

**`POST /eval`**

Compose and evaluate expressions from installed modules

By default the listener binds the host’s loopback and needs no token; reaching it from elsewhere is an opt-in (`--expose`, `--auth-token`) described in [start](https://morloc-project.github.io/docs/utilities/mim.md#mim-start).

## 12.7.2. Portable images with `freeze`

> **Warning: Experimental Feature**
> `freeze` is in development and likely to change. It builds with the Docker or Podman engine: it refuses a native environment (a native freeze would be a multi-platform lock, not an image), a dev environment (`--dev`), and one built from a `--local-runtime`, since neither of the last two pins a released compiler. It does not yet handle an Apptainer environment either.

For deploying to a different machine, freeze the environment into a tagged image and move that:

```console
$ mim freeze --tag myservice:v1
$ mim freeze --tag myservice:v1 --save ./myservice-v1.tar   # also write a tarball
$ docker run -d -p 8080:8080 myservice:v1                   # serves the declared views
$ docker run myservice:v1 <program> <command> <args>        # or run a program by name
```

Nothing lands in your working directory: the image is a tag in the engine’s image store (default `morloc-<env>:<version>`), and `--save` is the engine’s own `docker save`, so the tarball restores with `docker load` and needs nothing else. The image carries its provenance as labels — the Morloc version, the environment it came from, the programs inside, and which of them answer on each adapter — and `docker inspect` reads them back.

The full image is the environment whole, compiler and toolchain included, which is what lets it eval and rebuild a pool. Add `--slim` for an image that keeps every interpreter and package but drops the compilers, pixi, and the Morloc compiler — about half the size, tagged `-slim` by default, and refused if the environment exposes eval, since a slim image cannot evaluate. Before building, `freeze` audits each installed program and refuses one that carries tool state (a `.git/`, a cargo `target/`); the fix is the project’s `.morlocignore`. See [freeze](https://morloc-project.github.io/docs/utilities/mim.md#mim-freeze) for the audit, the slim cut, and how the image decides whether to require a token.
