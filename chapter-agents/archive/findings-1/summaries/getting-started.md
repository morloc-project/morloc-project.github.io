# Morloc knowledge snapshot after chapter 1 (getting-started)

Compiler tested: **morloc 0.93.0** (container image
`ghcr.io/morloc-project/morloc/morloc-full:edge`). Manager: **morloc-manager 0.25.0**.

## Toolchain

- `morloc-manager` runs the compiler inside a container. Invocation is
  `morloc-manager run -- morloc <args>`. The `--` is **required**;
  omitting it errors with "Use -- to separate morloc-manager flags
  from the container command".
- `morloc-manager new [NAME]` builds an environment. Default image tag
  is `:edge` (not `:latest`, despite what the docs say). Use `--tag`,
  `--version`, or `--image` to override.
- Environment lifecycle: `new`, `ls`, `select`, `info`, `update`, `rm`,
  `nuke`.
- Env setup on this VM currently requires manually running
  `morloc init -f` with `MORLOC_BIN_LINK_DIR=""` because the manager
  passes a link-dir path that isn't mounted into the init container.
  After that step, `include/morloc_pch.hpp{,.gch}`, `libcppmorloc.a`,
  `libpymorloc.so`, etc. are present.
- Standard library install: `morloc install stdlib` (a meta-module that
  re-exports every stdlib submodule).

## Module and file conventions

- Source files are `.loc`.
- Every file starts `module <Name> (export1, export2, ...)`.
- `--'` starts a docstring line (per compiler
  `library/Morloc/Frontend/Lexer.hs` line 184: "Docstring comments: --' ...").
- `--` alone is a normal comment.
- `import <mod>` for installed modules; `import .<mod>` for a local
  module (relative path).

## Foreign source

- `source <Lang> from "<file>" ("<term>" [as <alias>], ...)` pulls in
  functions from a language file next to the `.loc` file.
- `type <Lang> => <MorlocType> = "<ConcreteType>"` maps a general
  Morloc type to a concrete foreign type (e.g.
  `type Cpp => Real = "double"`).
- Languages seen so far: `Cpp` (C++), `Py` (Python). `R` extension is
  built but not exercised in this chapter.
- Type signatures use `::`, arrows `->`, list `[T]`, tuple `(a, b)`.
- Type variables are lowercase (`(a -> b) -> [a] -> [b]`).

## Standard modules

- `root` — language-agnostic typeclasses (arithmetic etc.).
- `root-cpp`, `root-py`, `root-r` — per-language instances. Import at
  least one to compile a language-agnostic module.
- `stdlib` — meta re-exporter of everything.

## Build and run

- `morloc typecheck <file>.loc` — no build, prints exported types.
  Works for pure-Morloc modules with no sourced implementations.
- `morloc make <file>.loc` — produces:
  - An executable named after the module (not the file). E.g.
    `module m (...)` in `main.loc` → `./m`.
  - `pools/<module>/pool.cpp`, `pool-cpp.out`, `pool.py`, etc., only
    when foreign code is involved. Pure-Morloc modules produce no
    `pools/` dir.
- Nexus CLI:
  - `./<exe> <command> <args>` runs a command; if the module exports
    only one command the command name is optional (`./hw`).
  - `-h` shows commands + `-h/--help` only.
  - `--help` (long form) additionally shows nexus options:
    `--print`, `--output-file`, `--output-form <json|jsonl|mpk|voidstar|packet|arrow|parquet|csv>`,
    `--keep-null`, `--quiet`, `--log-dir`.
  - `./<exe> <command> -h` shows per-command help with positional
    argument types and return type.
- Arguments to the nexus are JSON. Lists in JSON:
  `./m sumOfSums '[[1,2],[3,4,5]]'`.

## Composition

- `.` is function composition (`sum . pmap sum`).
- `foo x = bar x` style equations are allowed for definitions.
- Foreign functions can be passed as arguments across languages
  (Python function receiving a C++ function works; the compiler wires
  it).

## Docstring / help interaction

- A `--'` docstring on a top-level exported term becomes the command
  description in nexus help output (verified against `./hw -h` and
  `./units -h`).

## Compiler source layout (for cross-checks)

- Lexer/parser: `library/Morloc/Frontend/Lexer.hs`, `library/Morloc/Frontend/`
- Codegen: `library/Morloc/CodeGenerator/`
- System / env config: `library/Morloc/CodeGenerator/SystemConfig.hs`
- Test suite: `spec/` and `test-suite/`
- CLI entrypoints: `executable/`

## Docs not yet exercised (defer to later chapters)

- `install.asc`, `interface-cli.asc`, `interface-daemons.asc`,
  `runs-*.asc`, `types-*.asc`, `features-*.asc`, etc.
- Daemon/router modes of `morloc-nexus`.
- The `--pattern` argument (mentioned in `--help` output).
