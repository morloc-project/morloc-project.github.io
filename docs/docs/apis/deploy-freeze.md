# 9.5. Freezing

Morloc Manual > Deployment | https://morloc-project.github.io/docs/apis/deploy-freeze.html | prev: https://morloc-project.github.io/docs/apis/deploy-eval.md | next: https://morloc-project.github.io/docs/apis/execution-contexts.md

An environment is meant to change: you install programs, add packages, and rebuild. **Freezing** takes an environment as it stands and builds a container image from it that runs the same programs and serves the same views, with nothing mounted in from your machine. The image is what you move to another host, push to a registry, or hand to a cluster.

The image is built with the environment’s container engine, so freezing needs a Docker or Podman environment; a native or Apptainer environment, and a development environment made with `--dev`, cannot be frozen. The build happens on the machine that holds the environment, and you move the finished image.

## 9.5.1. Building the image

```console
$ mim freeze --tag smiles:0.1.0
```

Without `--tag` the image is named `morloc-<env>:<morloc version>`. The image is the environment’s own image with the rest of the environment added: the Morloc runtime, the toolchain installed from the environment’s `pixi.lock`, and every installed program with its source directory. If a required part is missing, for example because the environment was never fully built, `freeze` names it and stops.

The result is a tag in the engine’s image store; nothing is written to your working directory. When the build finishes, `freeze` prints commands to try the image: open a shell in it, list its programs, and run the first one.

## 9.5.2. What goes in

Each installed program travels as the copy of its project directory that `mim install` made, so whatever else sat in that directory goes along. Before building, `freeze` lists every program with its size, and flags large files and tool state:

-   **Tool state** — `.git`, `*pycache*`, `.venv`, `node_modules`, a cargo `target/`, and similar directories that nothing at run time reads — is refused. Name them in a `.morlocignore` file in the project (one pattern per line, `*pycache*/` for a directory), reinstall the program with `mim install --force`, and freeze again.
-   **Size** — a program over 100 MB, or any file over 50 MB, is a question: on a terminal, `freeze` shows the sizes and asks whether to continue. Run from a script, where nobody can answer, it stops.
-   An environment with **no programs** is asked about the same way, since it is usually a mistake.

`--force` answers yes to all of these, tool state included.

## 9.5.3. Running the image

The image’s default command serves the environment’s views, so the `mim view` declarations from [Serving](https://morloc-project.github.io/docs/apis/deploy-serving.md) and [Eval](https://morloc-project.github.io/docs/apis/deploy-eval.md) travel with it. Inside the container the server always listens on port 8080:

```console
$ podman run --rm --shm-size 2g -p 127.0.0.1:8080:8080 \
    -e MORLOC_MCP_TOKEN=$MORLOC_MCP_TOKEN smiles:0.1.0
```

Morloc moves data between languages through shared memory, and container engines give a container only 64 MB of it by default; `--shm-size` raises that. The size the environment used is recorded on the image as the label `morloc.suggested-shm-size`.

Inside a container the server has to listen on every interface, or a published port could not reach it. So the image does not decide who can reach it; you do, with the `-p` mapping (`127.0.0.1:8080:8080` publishes on the host’s loopback only) and the network you attach it to. With no token the image serves openly and says so in its log; set `MORLOC_MCP_TOKEN` to require one, exactly as with `mim start`.

Eval is the exception. It stays locked without a token. To serve it without one, because something in front of the container already checks callers, set `MORLOC_EVAL_ALLOW_NO_AUTH=1`.

The launchers of the installed programs are on the image’s `PATH`, so you can also run a program directly, with no server involved:

```console
$ podman run --rm smiles:0.1.0 smiles mw CCO
```

An environment with no views gives an image with no default command; it holds the programs and runs them only when named, as above.

## 9.5.4. Moving the image

To carry the image as a file, add `--save`. This writes the engine’s own image archive, which includes every layer and loads on any machine with the same engine:

```console
$ mim freeze --tag smiles:0.1.0 --save smiles.tar
$ podman load -i smiles.tar          # on the other machine
```

To share it through a registry, tag and push it with the engine:

```console
$ podman tag smiles:0.1.0 ghcr.io/<you>/smiles:0.1.0
$ podman push ghcr.io/<you>/smiles:0.1.0
```

Once it leaves `mim`, nothing tracks the image. It describes itself in labels instead: the Morloc version, the environment it came from, its programs, and which modules answer on each adapter.

```console
$ podman inspect -f '{{index .Config.Labels "morloc.programs"}}' smiles:0.1.0
```

`mim status`, `logs`, and `stop` act on servers started with `mim start`, not on containers you run from an image.

## 9.5.5. Slim images

The image above is the full environment, compilers included. That is what lets it evaluate expressions, which compile code at request time. When the programs are all you need, `--slim` builds an image without the compilers, the Morloc compiler, pixi, or build headers, keeping every interpreter and package the programs use:

```console
$ mim freeze --slim --tag smiles:0.1.0-slim
```

After building a slim image, `freeze` checks that every program still starts and that the runtime and every compiled pool still find their libraries. A slim image cannot evaluate, so an environment with eval enabled is refused: turn it off with `mim view eval --off`, or freeze without `--slim`. A program that compiles code while it runs, such as a Python package built on first import, also needs the full image.
