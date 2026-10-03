# 9.6. Running on a cluster

Morloc Manual > Deployment | https://morloc-project.github.io/docs/apis/execution-contexts.html | prev: https://morloc-project.github.io/docs/apis/deploy-freeze.md | next: https://morloc-project.github.io/docs/languages/index.md

A server answers requests on one machine. Some work is too big for one machine: a function that needs 32 GB and eight cores, called once per sample across hundreds of samples. Morloc lets you mark such a function with a **label**, and attach to the label a description of the resources it needs. With dispatch enabled, each call to a labeled function becomes a separate job on a SLURM cluster, and its result comes back into the program as if it had run locally.

> **Warning: Experimental Feature**
> SLURM dispatch is not covered by an end-to-end test yet. Labels and their configuration work, and without dispatch the labeled terms run in-process as shown below; the job submission path is described from the source.

## 9.6.1. Labeling a term

A label is a name followed by `@`, written in front of a function name where the function is used:

**heavy.loc**

```morloc
module heavy (foo)

import root-py
source Py from "heavy.py" ("run", "reduce")

run :: Str -> Int
reduce :: [Int] -> Int

foo :: [Str] -> Int
foo = reduce . map big@run
```

**heavy.py**

```python
def run(x):
    return len(x)

def reduce(xs):
    return sum(xs)
```

Here `run` is mapped over the inputs, and every call to it carries the label `big`. A label goes on a single name, never on a larger expression: `big@(reduce xs)` is a syntax error. To send a larger computation to a job, give it a name and label the name. Labels nest, because a labeled function can itself use labeled functions:

**pipeline.loc**

```morloc
module pipeline (analyzeMany)

import root-py
source Py from "pipeline.py" ("munge", "analyze", "reduce")

munge :: Str -> [Str]
analyze :: Str -> Real
reduce :: [Real] -> Real

bigStep :: Str -> Real
bigStep input = reduce (map big@analyze (munge input))

analyzeMany :: [Str] -> [(Str, Real)]
analyzeMany inputs = zip inputs (map big@bigStep inputs)
```

Each `bigStep` call can become a job, and each job can submit a further job for each `analyze` call. Removing the label from `analyze` runs those calls inside the `bigStep` job instead.

## 9.6.2. Describing a label’s resources

A label is configured in the module’s YAML file, named after the source file (`heavy.yaml` beside `heavy.loc`). Every label used in the module must have an entry under `labeled-groups`, and a `remote:` block describes the job:

**heavy.yaml**

```yaml
labeled-groups:
  big:
    remote:
      threads: 8          # sbatch --cpus-per-task
      memory: 32          # GB, sbatch --mem=32G
      time: "01:00:00"    # sbatch --time, as HH:MM:SS or D-HH:MM:SS
      gpus: 0             # sbatch --gres=gpu:N
```

`time` must be a SLURM time string; a bare number is refused:

```console
$ morloc make -o heavy heavy.loc
Failed to parse module config file 'heavy.loc': Aeson exception:
Error in $['labeled-groups'].big.remote.time: Expected a string for SLURM time
```

Until dispatch is enabled, a labeled term runs in the program as usual, so the same program works on a laptop:

```console
$ morloc make -o heavy heavy.loc
$ ./heavy foo '["a","bcd","ef"]'
6
$ morloc make -o pipeline pipeline.loc
$ ./pipeline analyzeMany '["a,bb","ccc"]'
[["a,bb",3],["ccc",3]]
```

## 9.6.3. Enabling dispatch

The compiler emits job dispatch only when the environment’s build configuration asks for it, which `morloc init --slurm` sets. `mim` runs `morloc init` without that flag whenever it builds the environment, so run it again inside the environment once the environment exists:

```console
$ mim new hpc --engine podman
$ mim run --env hpc -- morloc init -f --slurm
```

Anything that runs `morloc init` again turns dispatch back off: `mim update`, a `mim modify` that rebuilds, and a build that provisions a language the environment did not have yet. Repeat the second command after any of them, and rebuild the program.

## 9.6.4. Running with the dispatch bridge

A program inside a container cannot call `sbatch` on the host. `mim run --slurm-bridge` connects the two:

```console
$ mim run --env hpc --slurm-bridge -- ./heavy foo '["a","bcd","ef"]'
```

With the flag, `mim`:

1.  starts a bridge on the host, listening on a Unix socket;
2.  starts the program’s container with that socket mounted at `/run/morloc-bridge.sock` and its path in `MORLOC_BRIDGE_SOCKET`;
3.  for each call to a label with a `remote:` block, receives from the program a `mim run` command that would run just that call, and submits it with `sbatch --wrap`, using the label’s resources;
4.  answers the program’s status checks by asking `sacct` about the job.

The job runs on a compute node, starts the same environment, computes the call, and writes the result where the waiting program reads it. Jobs are started with `--slurm-bridge` too, so a labeled call inside a job can submit jobs of its own.

Every compute node must be able to start the environment’s image: push it to a registry the nodes pull from, or load it into each node’s store. Apptainer, the usual engine on clusters, would avoid this, since its image is a file on the shared filesystem, but Apptainer environments cannot be built yet (see [Installing Morloc](https://morloc-project.github.io/docs/getting-started/installing.md)).

## 9.6.5. Data on the shared filesystem

Arguments and results travel between the program and its jobs as files in a cache directory, `~/.cache/morloc/cache/_remote/` (set `MORLOC_CACHE_BASE` or `XDG_CACHE_HOME` to move it). Compute nodes must see that directory at the same path, as they do when your home directory is on a shared filesystem.

**`<arg-hash>.dat`**

one argument’s data, written once and named by its hash

**`<call-hash>-call.dat`**

the call itself, which refers to its arguments' files, so it stays small whatever their size

**`<result-hash>.dat`**

the result, named by a hash of the function’s source and its arguments' hashes

**`<result-hash>.out`, `.err`**

the job’s standard output and error

Because results are named by what produced them, running the same call again with the same arguments finds the result already there and submits no job. Changing the function’s source changes the hash, so a stale result is never reused.

## 9.6.6. Checking the cluster setup

```console
$ mim doctor --env hpc --slurm
```

This checks what dispatch needs from the cluster: `sbatch` and `sacct` on the host’s `PATH`; the environment’s image reachable; `mim` itself and the environment’s configuration under your home directory, so compute nodes can reach them; and a writable directory for the bridge socket (`$XDG_RUNTIME_DIR`, or `/tmp`). It warns when the environment is not Apptainer.
