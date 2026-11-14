# 5. Building CLIs

Morloc Manual | https://morloc-project.github.io/docs/clis/ | prev: https://morloc-project.github.io/docs/types/tables.md | next: https://morloc-project.github.io/docs/clis/example-program.md

A Morloc module compiles to a command line tool. Every exported term becomes a subcommand, its type becomes the subcommand’s arguments and return value, and its docstring becomes the help text. You saw the smallest version of this in [Your first program](https://morloc-project.github.io/docs/getting-started/first-program.md): a two-line module, and `./hello -h` printed a usage statement nobody wrote.

This chapter is about the rest of it. Not about writing an interface — there is still no parser to write — but about the controls you have over the one the compiler derives: what the commands are called, which arguments are positional and which are flags, where an argument’s bytes come from, and what the result looks like on the way out.

The chapter builds on two properties from [Why Morloc](https://morloc-project.github.io/docs/why/index.md): the interface is generated from the checked types, so it cannot drift from the functions ([\[derived-interface\]](https://morloc-project.github.io/docs/why/index.md#derived-interface)), and what passes between two Morloc tools is a typed value, not text ([Values cross boundaries, not file formats](https://morloc-project.github.io/docs/why/index.md#values-cross-boundaries)).
