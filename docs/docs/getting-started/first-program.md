# 3.2. Your first program

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/first-program.html | prev: https://morloc-project.github.io/docs/getting-started/installing.md | next: https://morloc-project.github.io/docs/getting-started/sourcing.md

The inevitable "Hello World" case is implemented in Morloc like so:

**hello.loc**

```morloc
module hw (hello)

--' A Morlock's hello world
hello = "Hello up there"
```

Three things are happening. `module hw (hello)` names the module and lists what it exports. `hello = "Hello up there"` binds a term to a string literal. The `--'` line is a **docstring**: an ordinary `--` comment is ignored, but `--'` attaches documentation to the term below it, and that documentation ends up in the generated command line interface.

Compile it:

```console
$ morloc make hello.loc
```

This produces two things next to your source:

**`hello`**

a launcher script, named after the **source file**. Override the name with `-o`. (Installing a program is different — it takes the module’s name instead. See [Search and install](https://morloc-project.github.io/docs/apis/search-and-install.md).)

**`hello-build/`**

the build directory. `manifest.json` describes the program and `envspec.json` records the packages it needs. A program that sources a foreign language also gets a compiled pool per language under `pools/<language>/`; this one sources nothing, so it has none.

The launcher is a thin shell script. It execs the shared `morloc-nexus` runtime against `manifest.json`; the nexus parses your arguments, starts whichever language pools the call needs, routes data between them, and prints the result.

Run it:

```console
$ ./hello hello
"Hello up there"
$ ./hello
"Hello up there"
```

Because `hw` exports exactly one term, naming the command is optional — the second form means the same thing.

The `-h` flag prints help generated from your types and docstrings:

```console
$ ./hello -h
A Morlock's hello world

Usage: ./hello <nexus_options> @ <command_options>

General Options:
  -h, --help  Print help; -hh adds details and examples, -hhh adds schemas
              (nexus options: -h @)

Return: Str
```

You wrote no argument parser, no usage text, and no type annotation. The docstring became the summary and `Str` was inferred. This is the first thing worth noticing about Morloc: the command line interface is not something you build, it is a **view** of the library you wrote. The same library also has API and MCP views, covered in [Building APIs](https://morloc-project.github.io/docs/apis/index.md).

The `@` in the usage line sits where a subcommand name would go. It is the separator between the options the runtime provides and the ones your function declares, and it shows up here because `hw` has a single export and there is no name to mark that boundary. [The two argument zones](https://morloc-project.github.io/docs/clis/argument-zones.md) covers it; you can ignore it until then.
