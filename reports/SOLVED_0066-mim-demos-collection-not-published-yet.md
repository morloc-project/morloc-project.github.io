# 0066: the `mim demos` collection is not published yet

- Status: not-a-bug
- Found: 2026-09-06, re-verifying the Getting Started chapter against 0.101.0
- Component: mim
- morloc: 0.101.0     mim: 0.28.0

## Expected

`src/content/getting-started.asc:655` closes the chapter by pointing a new
reader at `mim demos`:

> `mim demos` fetches example programs published for your Morloc version. Every
> demo in a bundle is known to build and pass on that version, so nothing there
> fails for reasons unrelated to what you are learning.

So `mim demos --list` should list something.

## Observed

```
$ mim demos --list
Environment error: no demos are published yet

$ mim demos --list --morloc-version 0.100.2
Environment error: no demos published for morloc 0.100.2

$ mim demos --list --morloc-version 0.99.0
Environment error: no demos published for morloc 0.99.0
```

The release page the command reads from has no releases at all:

```
$ curl -sIL https://github.com/morloc-dungeon/dungeon-master/releases/latest | grep -i ^location
location: https://github.com/morloc-dungeon/dungeon-master/releases
```

`releases/latest` does not redirect to a tag, which is what GitHub does when a
repository has published none.

## Reproduce

```
$ mim demos --list
```

## Impact

The last thing the Getting Started chapter offers a new reader is a command
that answers with nothing. The `mim` side works -- discovery, tag filtering and
the error messages are all correct.

## Resolution

Not a bug. The collection is under construction, not broken: the
`demos-<version>` releases on `morloc-dungeon/dungeon-master` have not been cut
yet and are expected within days. `mim demos` itself is finished and correct.

`src/content/getting-started.asc` keeps the section and adds a NOTE saying the
collection is still being assembled, so a reader who runs the command is not
surprised by the answer. When the first bundles land, drop that NOTE.
