# 9. Utilities

Morloc Manual | https://morloc-project.github.io/docs/utilities/ | prev: https://morloc-project.github.io/docs/runs/random-access-and-streaming.md | next: https://morloc-project.github.io/docs/utilities/nexus-file.md

The nexus ships two utility subcommands that operate on data files without needing a compiled morloc program: `file` (identifies a file) and `view` (loads and re-emits a file in a chosen format).

Both are invoked directly via `morloc-nexus`, not through a wrapper script, since they don’t take a manifest.

A typical workflow for ad-hoc inspection of binary morloc data:

```console
$ ./myprog -f packet -o result.packet mycmd
$ morloc-nexus file result.packet
$ morloc-nexus view result.packet -f json | jq '.' | less
```
