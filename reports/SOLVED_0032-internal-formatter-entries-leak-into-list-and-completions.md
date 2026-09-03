# 0032: compiler-synthesized formatter entry points leak into `morloc list` and shell completion

- Status: fixed
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler
- morloc: 0.100.2     mim: 0.28.0

## Expected

Each `@with` / `@render` directive makes the compiler synthesize a hidden
command that composes the handler with the export. The manifest marks these
`"internal": true`, and the nexus honors that -- they never appear in `--help`
and are not offered as subcommands. Everything else that reads the manifest
should honor it too.

## Observed

`morloc list` counts them, and the generated bash/zsh completion offers them as
subcommands.

`sift` exports five commands and carries eight formatter directives:

```
$ morloc make --install -o sift sift.loc
Installed 'sift' to /opt/morloc/bin/sift
$ morloc list
...
Programs:
  sift  13 commands
```

```
$ sed -n '/Installed program: sift/,+9p' $MORLOC_HOME/completions/morloc-completions.bash
# --- Installed program: sift ---
_morloc_prog_sift() {
  local cur prev
  COMPREPLY=()
  cur="${COMP_WORDS[COMP_CWORD]}"
  prev="${COMP_WORDS[COMP_CWORD-1]}"

  if [[ $COMP_CWORD -eq 1 ]]; then
    COMPREPLY=($(compgen -W "scan scanAll summarize total stream mlcp_scan_count mlcp_scan_plain mlcp_scanAll_count mlcp_scanAll_plain mlcp_stream_plain mlcp_stream_count mlcp_stream_staged mlcp_stream_numbered" -- "$cur"))
```

The manifest is unambiguous:

```
$ python3 -c "import json;[print(c['name'], c['internal']) for c in json.load(open('sift-build/manifest.json'))['commands']]"
scan False
scanAll False
summarize False
total False
stream False
mlcp_scan_count True
mlcp_scan_plain True
mlcp_scanAll_count True
mlcp_scanAll_plain True
mlcp_stream_plain True
mlcp_stream_count True
mlcp_stream_staged True
mlcp_stream_numbered True
```

## Reproduce

Any program with a `--' @with` or `--' @render` directive, built with
`morloc make --install`, then `morloc list`.

## Impact

Tab completion offers names that print `error: unrecognized subcommand`, and
the command count in `morloc list` is wrong by the number of formatters --
worst on exactly the programs that took the most care over their interface.

## Guess

Unverified. `ProgramCommand` in `executable/Subcommands.hs:811` has no
`internal` field, so `morloc list` cannot filter; `Morloc/Completion.hs`'s
`CmdInfo` does not read one either. `getFirstSubcommand`
(`Subcommands.hs:557`) takes `head` of the same unfiltered list.

## Resolution

Fixed in `morloc` commit `843e95d1`.

`morloc list` and the generated bash/zsh completions now filter on the
manifest's `internal` flag through a shared accessor, so a program reports only
the commands a user can invoke. A one-export program carrying two action
directives reports `1 command` (was `3 commands`), and its completion offers
`nums` alone.
