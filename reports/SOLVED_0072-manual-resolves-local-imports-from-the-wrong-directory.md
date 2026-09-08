# 0072: the manual resolves local imports from the wrong directory

- Status: not-a-bug
- Found: 2026-09-08, while laying out a multi-module project from the manual
- Component: docs
- morloc: 0.102.1

## Expected

`src/content/features-modules.asc` said, three times, that a dot-prefixed local
import resolves against the directory of the file that writes it.

`features-modules.asc:100` (before the fix):

> The dot prefix tells the compiler to look for the module relative to the
> directory of the importing file, not in the system library.

`features-modules.asc:113`:

> When you write `import .foo`, the compiler looks for the module relative to
> the directory containing the current file.

`features-modules.asc:179`, with a worked example:

> Local modules can also import other local modules. The path is always relative
> to the importing file. For example, if `bar/baz/main.loc` needs to import a
> sibling at `bif/biz/`, it writes `import .bif.biz (mul)`. This resolves
> relative to `bar/baz/`, looking for `bar/baz/bif/biz/main.loc`.

## Observed

A dotted import resolves against the **project root** -- the directory of the
entry file passed to `morloc make` -- in every file of a project, however deeply
nested. `library/Morloc/Frontend/API.hs:95` sets the root from the entry file:

```haskell
  -- Compute project root from entry-point file path
  let projectRoot = fmap MS.takeDirectory f
```

and `library/Morloc/Module.hs:359-382` joins every dotted import onto it. Its
Haddock is already the sentence the manual should have carried:

```haskell
-- | Resolve a local import from the project root.
-- e.g., .foo.bar -> <root>/foo/bar.loc or <root>/foo/bar/main.loc
```

The manual's own worked example is the golden test
`test-suite/golden-tests/local-import-cousin-py/` with the wrong rule attached.
That test passes, and in it `bar/baz/main.loc` writes `import .bif.biz (mul)`
while `bif/biz/` sits at the project root. The path the manual tells the reader
to expect, `bar/baz/bif/biz/main.loc`, does not exist.

A second, independent error sat in the same block. The manual gave the search
order as

> 1. A directory module: `foo/main.loc`
> 2. A file module: `foo.loc`

The compiler tries them the other way round (`Module.hs:379-381`):

```haskell
          candidates =
            [ MS.joinPath (root : init nameParts ++ [last nameParts ++ ".loc"])
            , MS.joinPath (root : nameParts ++ ["main.loc"])
            ]
```

`foo.loc` is tried first. The order is observable: a project holding both
`foo.loc` and `foo/main.loc` gets the flat file, not the directory.

## Reproduce

From an empty directory:

```
mkdir -p bar/baz bif/biz
printf 'module main (x)\nimport .bar.baz (x)\n' > main.loc
printf 'module (*)\nimport .bif.biz (x)\n' > bar/baz/main.loc
printf 'module (*)\nx :: Int\nx = 1\n' > bif/biz/main.loc
morloc typecheck main.loc          # succeeds
mkdir -p bar/baz/bif/biz
mv bif/biz/main.loc bar/baz/bif/biz/main.loc
morloc typecheck main.loc          # fails, and names the two paths it searched
```

The first run succeeds and prints `x :: Int`. The second is the layout the
manual describes, and it fails:

```
Within module '.bar.baz', failed to import local module '.bif.biz'
The following paths were searched:
     ./bif/biz.loc
     ./bif/biz/main.loc
```

Both searched paths are under the project root, and they appear in the order
the compiler tries them -- file before directory, the reverse of what the
manual listed.

## Impact

Anyone laying out a multi-module project from the manual writes imports that do
not resolve, and the failure reads as a missing module rather than as a
misplaced file. The two rules a reader has to hold apart -- `source` paths
resolve against the file that names them, dotted imports against the project
root -- were documented only in the half that was wrong.

## Resolution

Not a bug in the compiler. The manual was wrong, and
`src/content/features-modules.asc` is corrected in the commit that carries this
report.

`features-modules.asc` now states the project-root rule once, where the
resolution is explained, and says what the project root is in the terms the
manual already uses for the file passed to `morloc make`. The two sentences that
repeated the claim elsewhere no longer assert a location; the worked example
resolves to `bif/biz/` at the top of the project and says so explicitly. The
candidate search order is corrected to file-then-directory in both places it
appears.

The contrasting `source` rule -- paths relative to the file that names them --
was not documented anywhere in the manual and is now stated alongside, since it
is the rule readers confuse this one with.
