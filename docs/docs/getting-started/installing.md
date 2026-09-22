# 3.1. Installing Morloc

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/installing.html | prev: https://morloc-project.github.io/docs/getting-started/index.md | next: https://morloc-project.github.io/docs/getting-started/first-program.md

Morloc is installed and managed by `mim`, the Morloc installation manager. It fetches the compiler and runtime, resolves each program’s cross-language package dependencies into one coherent world, and runs, serves, and inspects Morloc programs. There is no separate Morloc install step: `mim` is the whole of it.

Morloc runs on Linux and on Apple Silicon macOS. On Windows, install through the [Windows Subsystem for Linux](https://learn.microsoft.com/en-us/windows/wsl/about) and follow the Linux instructions inside it.

## 3.1.1. Installing `mim`

One command, on Linux (x86-64 or ARM) or Apple Silicon macOS:

```console
$ curl -fsSL https://raw.githubusercontent.com/morloc-project/morloc-manager/main/scripts/install.sh | sh
```

This downloads the prebuilt `mim` binary for your platform, checks it against the published SHA-256 when that checksum is reachable, and installs it into `~/.local/bin` (or `$XDG_BIN_HOME`, if you set it). No `sudo` is needed. Two environment variables adjust it:

| Variable | Effect |
| --- | --- |
| `MIM_DEST` | Directory to install into. Default: `$XDG_BIN_HOME`, else `~/.local/bin`. |
| `MIM_VERSION` | Git tag to install (e.g. `v0.31.1`). Default: the latest release. |

The installer never edits your shell startup files. If the destination is already on your `PATH` — as `~/.local/bin` is on most Linux distributions — you are done:

```console
$ mim --version
```

Otherwise the installer prints the exact command to add it, which on macOS it usually will: macOS builds its default `PATH` from `/etc/paths`, which does not include `~/.local/bin`. For zsh, the macOS default shell, that command is:

```console
$ echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
```

Open a new shell afterwards, or run the same `export` in the current one. `mim` is the only executable you need on your `PATH`; everything else lives inside the environments `mim` manages.

### What `mim` needs from your host

`mim` is a single static binary with no libraries to install, but it does shell out to a few standard tools:

-   `curl` — required for fetching data
-   `tar` — required for unpacking archives.
-   a container engine — if you can’t run native or if you like boxes.
-   `nix` — if you run NixOS

Those last two are explained next.

## 3.1.2. Choosing a backend

You do not normally have to choose. `mim new` probes the host, picks a viable backend, and remembers the choice for later environments.

**Native** is the default wherever it works. Morloc runs directly on your host against a toolchain `mim` provisions with conda/pixi into a private directory. Nothing is installed system-wide and no container engine is needed. **Container** is the fallback, taken automatically when the native backend cannot work; Docker and Podman are supported.

To force one:

```console
$ mim new --engine none      # native
$ mim new --engine podman    # or: --engine docker
```

If more than one container engine is installed and no default has been recorded yet, `mim` asks you to name one rather than guessing.

**Which hosts get which backend**

The native backend works on:

-   Linux with glibc and a standard filesystem layout (Debian, Ubuntu, Fedora, RHEL, Arch, and so on), on x86-64 and ARM
-   macOS on Apple Silicon
-   NixOS, provided the `nix` toolchain is available and unprivileged user namespaces are enabled. Conda binaries expect the dynamic loader at a path NixOS does not have, so `mim` builds a `buildFHSEnv` sandbox to supply one.

Everything else falls back to a container: musl distributions such as Alpine, hosts with a non-standard filesystem layout, NixOS without `nix` or without user namespaces, and Intel macOS, for which no prebuilt Morloc compiler is published.

**Podman notes**

Unlike Docker, `podman` runs rootless by default, so no sudo is required, and on Linux it runs with no daemon.

On macOS and Windows (even through WSL) a virtual machine is required, so you will need to initialize `podman` first:

```console
$ podman machine init
$ podman machine start
```

**Apptainer / Singularity notes**

Apptainer (formerly Singularity) is the usual container engine on HPC clusters. It runs rootless, has no daemon, and uses a single-file image format (`.sif`) that lives on the shared filesystem, which makes it a natural fit for SLURM-style job dispatch. The historical fork SingularityCE is treated as equivalent; either binary is detected automatically.

> **Warning: Experimental Feature**
> Apptainer support is in development and is the least tested of the backends. Creating an environment with `--engine apptainer` is not currently expected to work: the image build emits a Dockerfile, which Apptainer cannot consume. Use the native backend, or Docker/Podman, until this is finished. The SLURM dispatch described in [Execution contexts](https://morloc-project.github.io/docs/install/execution-contexts.md) depends on Apptainer and is blocked behind the same work.

## 3.1.3. Creating an environment

An **environment** is a named, self-contained Morloc installation: a solved toolchain of compilers and language runtimes, the Morloc compiler and runtime built against it, and a data directory holding installed modules and binaries. On the container backend that toolchain lives in an image; on the native backend it lives in a private directory on your host. Either way, everything Morloc does happens inside an environment, and environments do not interfere with each other or with anything else on your machine.

Create one and name it `base`:

```console
$ mim new base
...
Solving native toolchain with pixi (this may take a few minutes)...
...
Native environment 'base' is ready.
Set 'base' as the default environment.
```

Every setting has a default, so that is the whole command. Pass `--wizard` to be prompted for each one instead; `mim new -h` lists them all.

The first run is the slow one. `mim` downloads the Morloc compiler for your platform, solves a conda toolchain, and builds the Morloc runtime from source against it. Budget several minutes. Later environments reuse the downloaded compiler, and re-running `new` or `update` with unchanged requirements skips the solve entirely.

It is also the run that fails if your network inspects TLS. If a download stops with a certificate error, pass your organization’s CA with `--cert-bundle`; see [Troubleshooting](https://morloc-project.github.io/docs/getting-started/troubleshooting.md).

Without a name, an environment is named after the Morloc version it tracks: `latest`, or `v0.105.2` for a pinned `--morloc-version`. The first environment you create becomes the **default** — the one every command targets when you do not pass `--env` — so `base` is ready to use immediately.

No language toolchain is installed up front. Python, R, C++, and Rust are provisioned on demand the first time you build a program that uses them, so your first `morloc make` will also pause to solve and install. Use `--lang` to pin a language into the environment whether or not a program asks for it:

```console
$ mim new polyglot --lang py,cpp
```

You can keep as many environments as you like and act on any of them with `--env`:

```console
$ mim ls                                  # list them; the default is marked
$ mim info base                           # detail on one
$ mim modify --env edge --set-default     # change the default
$ mim rm base                             # remove one
```

`mim info <name>` reports the environment’s backend, its Morloc version, the languages in its solved world, and the directories it owns. Add `--packages` to list every package in the solved world at its locked version.

## 3.1.4. Working inside an environment

Two ways in. `mim run` executes a single command:

```console
$ mim run -- morloc --version
0.101.0    # you may have a later version
```

`mim shell` drops you into an interactive session:

```console
$ mim shell
```

Inside that shell `morloc` is on your `PATH`, so you can drop the `mim run --` prefix. The rest of this manual writes commands as if you are in a `mim shell`; outside one, prefix them with `mim run --`.

The shell starts in your current working directory, and changes you make there persist. On the container backend that directory is bind-mounted in. The environment’s module directory persists too, so anything installed into it stays installed.

If you want syntax highlighting before you start typing, skip ahead to [Editor support](https://morloc-project.github.io/docs/getting-started/editor-support.md) and come back.
