# 0070: router discovery lists the compiler's synthesized terminal commands

- Status: open
- Found: 2026-09-07, while surveying the interface surfaces for FINDINGS 9
- Component: runtime
- morloc: 0.102.1     mim: 0.28.0

## Expected

A `--' @render` or `--' @with` directive makes the compiler synthesize an
internal command named `mlcp_<parent>_<flag>`. It is not callable in its own
right -- a client selects it with `?render=<flag>` on the parent -- so it
carries `internal: true` in the manifest and every surface that lists commands
filters it out.

Four do:

- `manifest_ffi.rs:2138` (the daemon's `/discover`)
- `json_help.rs:193` (`--json-help`, `--mcp-tools`)
- `Completion.hs:51` (shell completions)
- `Subcommands.hs:823` (`morloc list`)

## Observed

`router_build_discovery` does not. Its loop over a program's commands
(`morloc-runtime/src/router_ffi.rs:836-853`) walks
`0..(*mv).n_commands` and pushes every one, so a program with three exports and
two `@render` terminals is discovered as having five commands, two of which
cannot be called.

## Reproduce

Not reachable from the shipped binaries. `router_build_discovery` is declared
in the public C ABI (`data/morloc/morloc.h:1397`) and has no caller in the
workspace: `morloc-nexus router` routes to `mcp::serve_frontend` instead, which
builds its listing from `json_help::servable_commands` and is correct.

Found by reading, and confirmed against the four filtering sites above.

## Impact

None today, because nothing calls it. The reason to fix it now rather than
later is that it is one line while it is dead, and a silently wrong command
list the moment someone wires it up -- at which point the fix competes with
whatever feature the wiring was for.

## Suggested fix

The same `if cmd.internal { continue; }` guard the other four sites use, with a
comment pointing at `manifest_to_discovery_json` so the two discovery emitters
stay recognizably the same rule.

Deliberately not applied yet: the function has no callers, so the change cannot
be exercised by any test, and an untested edit to a C-ABI function is worth less
than a report that says exactly what is wrong. Fix it together with whatever
first calls it, when there is something to test against.

The deeper issue -- that there are two independent discovery emitters at all,
and that the other one renders from a lossy C mirror of the manifest -- is
tracked with the `/discover` rebuild in the FINDINGS 9 work.
