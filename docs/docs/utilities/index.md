# 10. Utilities

Morloc Manual | https://morloc-project.github.io/docs/utilities/ | prev: https://morloc-project.github.io/docs/languages/futhark.md | next: https://morloc-project.github.io/docs/utilities/nexus-file.md

The nexus has two subcommands that work on data files without a compiled Morloc program: `file` identifies a file, and `view` loads it and re-emits it in a chosen format. Call them on `morloc-nexus` directly; they take no manifest, so no program launcher is involved.

To inspect a binary result:

```console
$ ./myprog -f packet -o result.packet mycmd
$ morloc-nexus file result.packet
$ morloc-nexus view result.packet -f json | jq '.' | less
```
