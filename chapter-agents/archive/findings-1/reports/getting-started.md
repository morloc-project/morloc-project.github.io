# getting-started.asc — findings

Reviewer: skeptical-tester
Chapter: `getting-started.asc` (chapter 1 of 48)
morloc-manager version tested: 0.25.0
morloc compiler version in container: 0.93.0
Container image: `ghcr.io/morloc-project/morloc/morloc-full:edge`

## Preface: environment setup gaps

The task prompt pointed at `~/test/getting-started` on the VM and at a docs
tree that did not exist on the host or on the VM. I cloned
`morloc-project/morloc-project.github.io` and `morloc-project/morloc`
into `/tmp/morloc-docs` and `/tmp/morloc-compiler` respectively, and
symlinked them into the expected paths so I could actually read the
chapter and grep the compiler. The `morloc-manager` binary the
Vagrantfile pre-installed at `/usr/local/bin/morloc-manager` was a
`404: Not Found` HTML string, not an ELF. I downloaded the real
`morloc-manager-linux-x86_64` from the v0.93.0 release. These are
harness bugs, not doc bugs, and I mention them only so the human
running this pass knows why the report is one chapter deep instead of
never-having-started.

## Findings

### 1. `morloc-manager new` (as documented) fails to initialize C++/Python/R extensions — blocker

**Severity:** blocker
**Location:** `getting-started.asc :: Creating environments` (lines 152–160)

The documented invocation:

```
$ morloc-manager new --non-interactive base
Pulling ghcr.io/morloc-project/morloc/morloc-full:latest...
Created environment: base
Initializing morloc (this may take several minutes)...
Environment 'base' is ready.
Activate it with: morloc-manager select base
```

...does not succeed on a stock docker install. What I actually see:

```
$ morloc-manager -v new --non-interactive base
[morloc-manager] ... docker run ... -v /home/vagrant/.local/share/morloc/environments/base:/opt/morloc \
  -e MORLOC_BIN_LINK_DIR=/home/vagrant/.local/share/morloc/bin ...
[INFO] Force rebuild: cleaning init-owned artifacts
...
[INFO] Installing pre-built morloc-manager
cp /opt/morloc-rust-bin/morloc-manager /opt/morloc/bin/morloc-manager
chmod +x /opt/morloc/bin/morloc-manager
[ERROR] Configuration failed: permission denied
```

Then any C++ build fails:

```
$ morloc-manager run -- morloc make units.loc
...
<command-line>: fatal error: morloc_pch.hpp: No such file or directory
compilation terminated.
```

Root cause is in the compiler: `library/Morloc/CodeGenerator/SystemConfig.hs`
lines ~239–255 reads `MORLOC_BIN_LINK_DIR` and calls
`createDirectoryIfMissing True dir` on the container path
`/home/vagrant/.local/share/morloc/bin`. During `morloc init`,
morloc-manager only bind-mounts `.../environments/base:/opt/morloc` — it
does **not** bind-mount the host `/home/vagrant`. So `createFileLink`
fails, an exception is raised, and the C++/Python/R init loop (which
compiles `morloc_pch.hpp.gch`, `libcppmorloc.a`, `pymorloc.so`, etc.)
never runs. The whole environment ships without foreign-language
extensions.

I worked around this by re-running `morloc init -f` directly against the
container with `MORLOC_BIN_LINK_DIR=""` set. Only after that do all the
docs' code examples build.

A first-time reader would run `morloc-manager new --non-interactive base`,
see `[ERROR] Configuration failed: permission denied`, and be stuck.
Either the manager/compiler needs to be fixed, or the docs need to
explain the workaround. Since the docs are the surface being tested here,
this is a blocker for the chapter.

Compiler citation:
```
library/Morloc/CodeGenerator/SystemConfig.hs:239
    Just dir -> do
      createDirectoryIfMissing True dir
      return (Just dir)
```

### 2. `tutorial-development.asc` cross-reference is dead — blocker

**Severity:** blocker
**Location:** `getting-started.asc :: Apptainer / Singularity instructions` (line 97)

```
The link:tutorial-development.asc[development tutorial] covers the
Apptainer-specific workflow ...
```

There is no `tutorial-development.asc` under `src/content/` (I searched
the whole content dir and the archive). Grep confirms `getting-started.asc`
is the sole file referencing it:

```
$ grep -rn "tutorial-development" /tmp/morloc-docs/src/
/tmp/morloc-docs/src/content/getting-started.asc:97:...
```

Readers on Apptainer are sent to a page that does not exist.

### 3. Default image tag documented as `:latest`, actually `:edge` — confusing

**Severity:** confusing
**Location:** `getting-started.asc :: Creating environments` (lines 155, 162)

Docs say:

> `Pulling ghcr.io/morloc-project/morloc/morloc-full:latest...`
> By default, the `new` subcommand pulls the latest Morloc release.

`morloc-manager new --help` says the opposite:

```
Default (when --version, --tag, and --image are all omitted): pulls the
:edge tag from the morloc registry and records the resolved version.
```

Actual pull line I saw:
```
Using local copy of ghcr.io/morloc-project/morloc/morloc-full:edge
```

So the default is `:edge` (the current dev tip), not `:latest` (the last
tagged release). This matters because the docs claim to install "the
latest Morloc release" and users who care about stability are being
lied to.

### 4. Filename gap between `units.loc` and `units2.loc` — confusing

**Severity:** confusing
**Location:** `getting-started.asc :: Defining language-agnostic functions` (lines 464–498)

The section opens with a code block introducing a new `module units (...)`
implementation with **no filename given**:

```
[source, morloc]
----
module units (cels2fahr, meters2feet)

import root
...
```

The next commands abruptly reference `units2.loc`:

```
$ morloc typecheck units2.loc
```

A reader following the chapter would save this into `units.loc`
(overwriting the earlier C++-backed one, since the module name is the
same) and then be confused when the typecheck command uses a different
filename. Please either say "Save this to `units2.loc`" before the code
block or drop the `2`.

### 5. `./units -h` docs describe the `--help` (long) output — confusing

**Severity:** confusing
**Location:** `getting-started.asc :: Unit conversion example` (lines 454–461)

Docs claim:

> `./units -h` lists the two exported commands (`cels2fahr` and
> `meters2feet`) plus the standard nexus options (output format, run
> directory, pretty-printing, and so on).

Actual `./units -h`:
```
Usage: units <nexus_options> <command> <command_options>

Commands:
  cels2fahr    Convert from Celsius to Fahrenheit
  meters2feet  Convert from meters to feet

General Options:
  -h, --help  Print help (see more with '--help')
```

Nexus options (`--print`, `--output-file`, `--output-form`, `--keep-null`,
`--quiet`, `--log-dir`, …) only appear under `./units --help`. Either
soften the claim, show the shorter `-h` output, or point readers at
`--help`.

### 6. `morloc-manager run morloc <args>` (as used in the task prompt) is rejected; docs are correct — minor, but worth noting

**Severity:** minor
**Location:** `getting-started.asc :: The Morloc shell and first runs` (line 229)

The docs correctly use `morloc-manager run -- morloc --version`. My
copy of the task prompt showed the un-dashed form. Confirming here that
the manager actively rejects the un-dashed form:

```
$ morloc-manager run morloc --version
Error: unrecognized arguments for 'run'.

Use -- to separate morloc-manager flags from the container command:
  morloc-manager run -- morloc --version
```

Not a doc bug. Recording so the harness prompt (`test/chapter-context.md`
etc.) can be corrected before other agents trip on it.

### 7. `pool.py` / `pool.R` / "the `pools/` directory" claim is only partially correct — minor

**Severity:** minor
**Location:** `getting-started.asc :: First Morloc programs` (lines 371–378)

> This command will produce an executable named after the module (in
> this case, `hw`) and pool files for each language used (e.g.,
> `pool.py`, `pool-cpp.out`, `pool.R`) in the `pools/` directory.

`hello.loc` uses no foreign source, so `morloc make hello.loc` produces
only `hw` in the CWD — no `pools/` directory is created. On the C++
example, the pool files actually landed at `pools/units/pool.cpp` and
`pools/units/pool-cpp.out` (nested under a per-module dir), not the
flatter `pools/pool-cpp.out` implied by the prose. The nested layout is
what `morloc make` really produces:

```
$ ls pools/units/
pool.cpp  pool-cpp.out
```

Worth clarifying "`pools/<module>/pool-*` when foreign source is
involved; nothing at all for a pure-morloc module".

### 8. Typos — minor

- Line 14: `you can follow the script below can be followed to install ...`
  — duplicated `can be followed`.
- Line 185: `everthing is set up correctly with `info`:` — should read
  something like `We can verify everything is set up correctly with
  `info`:`. "everthing" → "everything".
- Line 233: `This confirms that that the morloc compiler is installed
  and shows its version.` — duplicated `that`.
- Line 254: `That beind the case, let's install the Morloc standard
  library:` — `beind` → `being`.

### 9. Docs example `morloc-manager info base` mixes `/home/z/` and `/home/username/` — minor

**Severity:** minor
**Location:** `getting-started.asc :: Creating environments` (lines 189–221)

The plain `info` example uses `/home/z/.config/morloc` (author's real
home). The `info base` example switches to a `/home/username/`
placeholder. Pick one style so the reader isn't left wondering whether
`z` and `username` are the same user.

### 10. Daemon/router cross-reference — no finding

`<<Building API interfaces>>` (line 385) resolves to a section title in
`interface-daemons.asc`. Fine.

## Examples that were built and run cleanly

For the record, once the environment was fixed:

- `hello.loc` → `./hw hello` and `./hw` both print `"Hello up there"`.
- `units.loc` (C++ source) → `./units cels2fahr 100` → `212`,
  `./units meters2feet 1` → `3.28084`. `./units -h` and
  `./units cels2fahr -h` both render sensible help.
- `units2.loc` (language-agnostic) → `morloc typecheck` prints the
  documented signatures.
- `main.loc` (imports `.units` + `root-cpp`) → `./main cels2fahr 100`
  → `212`, `./main meters2feet 5` → `16.4042`.
- Polyglot `report` (Python calls a C++ function) → `./main report 100`
  → `"The current temperature is 100.0°C (212.0°F)"`.
- Parallel `sumOfSums` → `./m sumOfSums '[[1,2],[3,4,5]]'` → `15`.

All snippet completions were literal cut-and-paste; the only additions
were the surrounding shell state (mkdir/cd) and, for the language-agnostic
section, having to guess `units2.loc` as the filename (see finding 4).
