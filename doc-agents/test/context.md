## Additional context

The documentation uses `menv` as the command prefix for running morloc inside
the container (e.g., `menv morloc make ...`). On the VM, the equivalent command
is `morloc-manager run`. When the docs say `menv <command>`, run it as
`morloc-manager run <command>`.

If you encounter `menv` references in the docs that don't match the actual
available commands, report this as a documentation issue.
