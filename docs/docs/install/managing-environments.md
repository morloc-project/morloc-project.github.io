# 12.4. Managing environments

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/managing-environments.html | prev: https://morloc-project.github.io/docs/install/running-commands.md | next: https://morloc-project.github.io/docs/install/customizing-environments.md

You can keep multiple named environments and act on any of them with `--env`:

```console
$ mim ls                          # list all environments (marks the default)
$ mim modify --env myenv --set-default   # make myenv the default
$ mim info myenv                  # detailed info for myenv
$ mim info                        # overview of all environments
$ mim rm myenv                    # remove an environment
```

Because every command accepts `--env`, you never have to change the default to work with another environment — and a bare command is legible from shell history, since it always means the (rarely changed) default. Removing the environment that is currently the default simply clears the default tag; set a new one with `modify --set-default`.

Environments can be created at local scope (per-user, the default) or system-wide (`--system`, requires root). Local environments shadow system environments of the same name. A regular user can `run`/`shell`/`eval` a system environment without being able to modify it, which makes a `--system` default a convenient shared, read-only place to run code.

```console
$ sudo mim new shared --morloc-version 0.105.2 --system
$ sudo mim modify --env shared --set-default --system
$ mim run -- morloc --version
```
