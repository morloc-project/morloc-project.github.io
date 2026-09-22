# 12.2. Creating an environment

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/creating-an-environment.html | prev: https://morloc-project.github.io/docs/install/container-engine.md | next: https://morloc-project.github.io/docs/install/running-commands.md

An **environment** is a self-contained Morloc installation: a base container image (or, on the native backend, none), a pinned Morloc compiler and runtime, a solved language toolchain, any extra packages you asked for, engine flags, and its own module and binary directories. Everything in Morloc happens inside an environment.

```console
$ mim new                                  # named after the version: 'latest'
$ mim new myenv                            # use latest morloc release
$ mim new myenv --morloc-version 0.105.2   # pin a specific version
```

The first environment you create becomes the **default** — the one every command targets when you do not pass `--env`. There is no separate "activate" step. To point the default at a different environment later, use `modify --set-default`:

```console
$ mim modify --env myenv --set-default
```
