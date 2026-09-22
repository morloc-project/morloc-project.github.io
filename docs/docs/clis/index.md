# 6. Building CLIs

Morloc Manual | https://morloc-project.github.io/docs/clis/ | prev: https://morloc-project.github.io/docs/types/tables.md | next: https://morloc-project.github.io/docs/clis/example-program.md

A Morloc module compiles to a command line tool. Every exported term becomes a subcommand, its type becomes the subcommand’s arguments and return value, and its docstring becomes the help text. You saw the smallest version of this in [Your first program](https://morloc-project.github.io/docs/getting-started/first-program.md): a two-line module, and `./hello -h` printed a usage statement nobody wrote.

This chapter is about the rest of it. Not about writing an interface — there is still no parser to write — but about the controls you have over the one the compiler derives: what the commands are called, which arguments are positional and which are flags, where an argument’s bytes come from, and what the result looks like on the way out.

Two properties are worth naming up front, because they are what the rest of the chapter builds on.

**The interface cannot drift from the functions.** It is generated from the same types the compiler checks calls against. Rename an argument, add a field to a record, change a return type, and the help, the JSON Schema, and the MCP tool definition all move with it on the next build. There is no second description of the tool to keep in sync.

**What passes between two Morloc tools is a value, not text.** A command writes its return type, serialized; a command that accepts that type reads it, in any of the formats both sides already understand. Neither end invents a file format, and neither end parses one.
