# 12.3. Running commands

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/running-commands.html | prev: https://morloc-project.github.io/docs/install/creating-an-environment.md | next: https://morloc-project.github.io/docs/install/managing-environments.md

`run` executes a command inside an environment (the default when no `--env` is given); `shell` drops you into an interactive shell:

```console
$ mim run -- morloc make -o hello hello.loc   # default env
$ mim run --env myenv -- ./hello 21           # a named env
$ mim shell                                   # interactive shell in the default env
```

Pass container environment variables with `--env-var KEY=VALUE` (or `--env-file`); `--env` names the morloc environment.

The current directory is bind-mounted into the container so source files and build artifacts are shared with the host. On SELinux systems (Fedora, RHEL), the `:z` relabel suffix is applied automatically, and because relabeling `~` itself, `/`, or `/tmp` would be unsafe, `mim` refuses those directories there: work in a subdirectory such as `~/myproject`.
