# 8.6. Running on a cluster

Morloc Manual > Deployment | https://morloc-project.github.io/docs/apis/execution-contexts.html | prev: https://morloc-project.github.io/docs/apis/deploy-freeze.md | next: https://morloc-project.github.io/docs/languages/index.md

A server answers requests on one machine. Some work is too big for one machine, and [Remote job submission](https://morloc-project.github.io/docs/runs/remote-jobs.md) showed how a label sends each call through it to a separate job on a SLURM cluster. This section covers what the cluster and the environment need for that to work: turning submission on, running a containerized program against the host’s SLURM, and putting the data where compute nodes can read it.

> **Warning: Experimental Feature**
> Job submission is tested against a stand-in for `sbatch` and `sacct` that runs each job on the same machine, not on a real cluster.

## 8.6.1. Enabling dispatch

The compiler emits job submission only when asked. `morloc make --slurm` asks for one build; the environment’s build configuration asks for every build, which `morloc init --slurm` sets. `mim` runs `morloc init` without that flag whenever it builds the environment, so run it again inside the environment once the environment exists:

```console
$ mim new hpc --engine podman
$ mim run --env hpc -- morloc init -f --slurm
```

Anything that runs `morloc init` again turns dispatch back off: `mim update`, a `mim modify` that rebuilds, and a build that provisions a language the environment did not have yet. Repeat the second command after any of them, and rebuild the program.

## 8.6.2. Running with the dispatch bridge

A program inside a container cannot call `sbatch` on the host. `mim run --slurm-bridge` connects the two:

```console
$ mim run --env hpc --slurm-bridge -- ./heavy foo '["a","bcd","ef"]'
```

With the flag, `mim`:

1.  starts a bridge on the host, listening on a Unix socket;
2.  starts the program’s container with that socket mounted at `/run/morloc-bridge.sock` and its path in `MORLOC_BRIDGE_SOCKET`;
3.  for each call to a label with a `remote:` block, receives from the program the command that runs just that call, and submits it with `sbatch --wrap`, inside a `mim run` of the same environment and with the label’s resources;
4.  answers the program’s status checks by asking `sacct` about the job.

The job runs on a compute node, starts the same environment, computes the call, and writes the result where the waiting program reads it. Jobs are started with `--slurm-bridge` too, so a labeled call inside a job can submit jobs of its own.

Every compute node must be able to start the environment’s image: push it to a registry the nodes pull from, or load it into each node’s store. Apptainer, the usual engine on clusters, would avoid this, since its image is a file on the shared filesystem, but Apptainer environments cannot be built yet (see [Installing Morloc](https://morloc-project.github.io/docs/getting-started/installing.md)).

## 8.6.3. Data on the shared filesystem

Arguments and results travel between a program and its jobs as files in a directory under the cache base, `~/.cache/morloc/cache/_remote/` by default (the cache base is chosen as in [Where the cache lives](https://morloc-project.github.io/docs/runs/caching.md#cache-layout)). Compute nodes must see that directory at the same path, as they do when your home directory is on a shared filesystem. Each call has a directory of its own there, deleted once its result is read; a failed job’s directory stays, with the job’s standard error in it. [Remote jobs](https://morloc-project.github.io/docs/ecosystem-architecture/eco-remote.md) specifies the files and the commands.

## 8.6.4. Checking the cluster setup

```console
$ mim doctor --env hpc --slurm
```

This checks what dispatch needs from the cluster: `sbatch` and `sacct` on the host’s `PATH`; the environment’s image reachable; `mim` itself and the environment’s configuration under your home directory, so compute nodes can reach them; and a writable directory for the bridge socket (`$XDG_RUNTIME_DIR`, or `/tmp`). It warns when the environment is not Apptainer.
