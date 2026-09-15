# 0082: mim error and help text names flags that do not exist

- Status: open
- Found: 2026-09-14, checking the deployment chapter against mim
- Component: mim
- morloc: 0.105.2     mim: 0.31.1

## Expected

A hint printed by `mim` should be a command the current `mim` accepts.

## Observed

Verified by reading, not by running. Three messages reference options that
`clap` does not define anywhere in `mim/src/main.rs`:

1. `doctor.rs:1574` and `doctor.rs:1581` (the `--slurm` checks) say
   "run `mim update --reinit --init-arg --slurm`". `Update` has no `--reinit`
   and no `--init-arg`. The alternative in the same message,
   `mim run -- morloc init -f --slurm`, is the one that exists.

2. `freeze.rs:111` (slim freeze of an environment exposing eval) says
   "Remove the view (`mim view rm --eval`)". `ViewAction::Rm` takes a module
   name and has no `--eval`; the command that disables eval is
   `mim view eval --off`.

3. The `--slurm-bridge` help on `Run` says "Requires the environment to use
   the Apptainer engine", but `setup_slurm_bridge` (`main.rs`) only warns on
   another engine and proceeds. The help contradicts the behaviour; the
   manual follows the behaviour.

## Reproduce

```
$ mim doctor --slurm          # on an env whose build.yaml lacks slurm-support
$ mim view eval --allow dna && mim freeze --slim
$ mim run --help | grep -A3 slurm-bridge
```

## Impact

Each message sends the user to a command that fails with a clap usage error,
on exactly the paths (SLURM, slim freeze) where they are least likely to guess
the right one.
