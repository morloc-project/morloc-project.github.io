# 0001: `morloc make` names the launcher after the source file, not the module

- Status: not-a-bug (documentation defect; manual fixed)
- Found: 2026-09-02, while verifying that the container can run the manual's examples
- Component: docs
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/getting-started.asc` says:

> This command produces a launcher script named after the module (in this case,
> `hw`) alongside a `hw-build/` directory.

and then shows `$ ./hw hello`.

## Observed

Building `hello.loc` (which declares `module hw`) produces a launcher named
`hello` and a build directory named `hello-build`:

```
$ morloc make hello.loc
$ ls
hello  hello-build  hello.loc
$ ./hello
"Hello up there"
```

`/work/CLAUDE.md` agrees with the observed behaviour: the build directory is
"keyed on the source basename; `<name>` overridable with `--name`".

## Reproduce

```
$ cat > hello.loc <<'LOC'
module hw (hello)

--' A Morlock's hello world
hello = "Hello up there"
LOC
$ morloc make hello.loc
$ ls
```

## Impact

The manual's very first executable example does not work as written: a reader
who copies it runs `./hw` and gets "no such file or directory" on their first
contact with Morloc.

Note also that `mim install`'s help text says the installed program "is named
after its module (the `module <name>` declaration), not the source file". The
two paths do name programs differently -- see the addendum -- so the manual
should say both rather than picking one.

## Addendum (2026-09-02, verified)

The two names differ, and that is the design, not a second defect.
`morloc make --install` installs under the module name:

```
$ ls
dice.R  dice.hpp  dice.py  main.loc      # main.loc declares `module dnd`
$ morloc make --install main.loc
...
Installed 'dnd' to /opt/morloc/bin/dnd
$ morloc list --programs
  dnd  2 commands
$ ls
dice.R  dice.hpp  dice.py  main.loc      # no launcher, no build dir left behind
```

The rule is which namespace the artifact lands in. `morloc make` writes a
*local* artifact into your working directory, so naming it after the source is
the right default -- the same reason a C compiler hands you `a.out`, and the
same reason several sources built side by side get distinct `<source>-build`
directories instead of colliding on `module Main`. `morloc make --install`
writes into a *global* namespace, where the program's identity is its module
name: you import `cryptography`, not `main`. The entry file is conventionally
`main.loc` and carries no identity at all.

`Nexus.hs` (around line 2545, `dirKey`) states this directly, including the
third case: eval's module is a synthetic `main`, so eval keys on the build key
(its `--save` name) instead, or every `--save` would collide on `exe/main`.

## Resolution

Morloc was right; the manual was wrong. Fixed in `morloc-project.github.io`
(uncommitted at time of writing -- this session does not commit).

`getting-started.asc` already said the launcher is named after the source file;
its bullet now also points forward to the install rule so a reader does not
generalize from one case. `interface-install.asc` gained a paragraph after the
`morloc install` / `morloc make --install` NOTE stating that an installed
program takes its *module* name, and why the two differ: `make` leaves a local
artifact in the working directory (source name, like `a.out`), while
`--install` writes into a global namespace where a program's identity is the
name other code imports it by.
