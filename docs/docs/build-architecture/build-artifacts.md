# 13.2. Compilation artifacts

Morloc Manual > Build Architecture | https://morloc-project.github.io/docs/build-architecture/build-artifacts.html | prev: https://morloc-project.github.io/docs/build-architecture/build-overview.md | next: https://morloc-project.github.io/docs/build-architecture/build-lifecycle.md

> `morloc make` turns a Morloc program into a build directory and one or more launchers. The build directory holds the generated pools and a manifest that describes every command. A launcher is a short shell script that hands the manifest to the nexus. This section specifies that layout, the manifest, and what installing a program does.

**Layout.** A program is identified by a **key**: the `--name` given, else the `-o` name, else the source file’s base name. Building `demo.loc` that calls Python and C++ produces:

```
./
|-- demo                  CLI launcher
|-- demo.loc, foo.py ...  the program's sources (not copied)
`-- demo-build/
    |-- .morloc-build     marker: this directory is a Morloc build
    |-- manifest.json     commands, pools and runtime settings
    |-- envspec.json      dependencies, for the environment manager
    `-- pools/
        |-- cpp/          generated source and the compiled pool binary
        `-- py/           generated pool script
```

Compiled languages (C++, Rust) are built into a pool binary. Interpreted languages (Python, R) get a generated script that loads the user’s source files when it starts. Those files are found relative to the build directory, in the directory that contains it. The build directory and its source directory therefore move together; neither is relocatable alone. No absolute build path is recorded.

**Rebuilds** assemble the new tree in a sibling staging directory and move it into place only after every pool compiles. A failed build leaves the previous build in place. A rebuild deletes an existing `<key>-build` directory only if it carries the marker file, so a user directory that happens to have the same name is never removed.

**Launchers.** Each launcher records the manifest path on a comment line (`# morloc-manifest: demo-build/manifest.json`), resolves its own location, and execs the nexus with a mode and the manifest:

| Launcher | Created by | Runs |
| --- | --- | --- |
| CLI | default (`-o` names it, `--no-cli` suppresses it) | `morloc-nexus run <manifest> …​` |
| Daemon | `--daemon-out NAME` | `morloc-nexus daemon <manifest> …​` |

There is no MCP launcher. `morloc-nexus mcp` takes either launcher or the manifest itself as its target. Every nexus mode that names a program accepts both forms.

**The manifest** is a JSON object written by the compiler and read only by the nexus. Its main fields:

| Field | Meaning |
| --- | --- |
| `name` | Program name. |
| `build` | Compiler version, build time, and the build directory (always `.`, the manifest’s own directory). |
| `pools` | One entry per language: the command line that starts the pool, relative to the build directory, and the pool’s socket name. |
| `commands` | One entry per exported function (below). |
| `groups` | Named groups of commands for the CLI. |
| `inline_size`, `no_shm`, `tmpdir` | Data-route settings fixed at build time ([Runtime overview](https://morloc-project.github.io/docs/build-architecture/build-overview.md)). |
| `run_log` | Prologue and epilogue templates for the run log ([Logs and result caching](https://morloc-project.github.io/docs/build-architecture/build-runs.md)). |

Each command records its name, its documentation, its arguments and return value, and either how to run it or the expression itself:

| Field | Meaning |
| --- | --- |
| `type` | `remote` (runs in a pool) or `pure` (the nexus evaluates `expr` itself). |
| `mid`, `pool` | For `remote`: the function’s index inside its pool, and which pool holds it. |
| `needed_pools` | Every pool the command can reach, so a CLI run starts only those. |
| `args`, `return` | Each with its Morloc type and its schema string, which fixes the binary layout of the value ([Voidstar format and schema strings](https://morloc-project.github.io/docs/build-architecture/build-voidstar.md)). |

The manifest carries no schema version of its own. The nexus accepts a manifest only if it was written by the same Morloc version, and refuses any other with a message to rebuild. Builds are artifacts, regenerated on every `make`, so an exact match costs nothing and removes every cross-version compatibility question. Within a version, readers ignore keys they do not know. Every entity also carries an empty `constraints` list and `metadata` object, reserved so that later additions need no format change.

**Installing** (`morloc make --install`, or `morloc install --build`) builds into the Morloc home rather than the working directory. The program’s key is its module name. The source directory is mirrored to `exe/<module>/`, skipping version-control data, paths listed in a `.morlocignore` file, and stale build directories (found by their marker). The build lands in `exe/<module>/<module>-build/`, and the CLI launcher is copied to `bin/`, which you put on your `PATH`. A reinstall requires `--force`, and replaces the whole mirrored tree.
