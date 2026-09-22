# 12.9. Execution contexts

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/execution-contexts.html | prev: https://morloc-project.github.io/docs/install/composable-function-services.md | next: https://morloc-project.github.io/docs/install/system-wide-podman.md

A term in morloc can be annotated with a label that associates the term with a computational context. Currently the main use case for this is the submission of jobs to remote worker nodes in an HPC context.

In the example below, the compute heavy function `run` is mapped over a list of input strings, each call to `run` returns an integer, the resulting integer list is reduced to a final output integer by `reduce`:

**heavy.loc**

```morloc
module heavy (foo)

import root-py
source Py from "heavy.py" ("run", "reduce")
run :: Str -> Int
reduce :: [Int] -> Int

foo :: [Str] -> Str
foo = reduce . map big@run
```

Here we have annotated `run` with the label `big`. This provides a handle for controlling how and where this heavy function is evaluated. Complex terms may also be labeled, allowing entire branches of the execution tree to be remotely evaluated. Labels may be arbitrarily nested, as shown in the example below:

**pipeline.loc**

```morloc
module pipeline (analyze)

import root-py
import root-cpp
import root-r

source Py  from "munge.py"     ("munge")
source Cpp from "analyze.hpp"  ("analyze")
source R   from "summarize.R"   ("summarize")

munge :: Str -> [Str]
analyze :: Str -> Real
reduce :: [[Real]] -> Real

bigStep :: Str -> Real
bigStep input = reduce (map big@analyze (munge input))

analyzeMany :: [Str] -> [(Str, Real)]
analyzeMany inputs = zip (map big@bigStep) inputs
```

Here `analyzeMany` submits can submit a remote job for each `bigStep` call and `bigStep` call, in turn, submits a remote call for each `analyze` call. We can flatten the execution style by removing the label on `analyze`.

## 12.9.1. The `remote:` context: dispatching as a separate job

The labels can be annotated in YAML config files that specialize the execution context for the associated term.

A `remote:` block in the label’s YAML config tells the runtime to evaluate the labeled subtree as a separate morloc invocation (through mim) instead of in-process. Without the block the label is parsed and grouped but the term runs in-process.

**heavy.yaml**

```yaml
labeled-groups:
  big:
    remote:
      threads: 8
      memory: 32        # GB
      time: 3600        # seconds
      gpus: 0
```

Dispatch sends only the outer input and output across the job boundary: a `mim` invocation that picks up the job brings up every pool the subtree references and runs all the internal foreign calls between them locally within that one invocation. The shape of the labeled term — single function or composition — does not change the protocol.

> **Note**
> SLURM is currently the only wired-up dispatch backend. The bridge wraps a `mim run` invocation in `sbatch` and polls completion via `sacct`. A future local-container backend (``exec`ing the same `mim run`` directly on the host for dependency isolation), a Kubernetes backend, or a PBS backend would consume the same `remote:` config without source-level changes. The rest of this section walks through the SLURM path.

## 12.9.2. Enabling dispatch codegen

The morloc compiler only emits the dispatch op when its build config opts in. The current opt-in is the `--slurm` flag of `morloc init` (generic name pending; it enables the same dispatch-codegen path that any future backend will share). `mim` runs `morloc init` for you when it materializes an environment, without that flag, so re-run init inside the environment once it exists:

```console
$ mim new hpcdemo --engine apptainer
$ mim run --env hpcdemo -- morloc init -f --slurm
```

Any rebuild — `mim update`, or a `mim modify` that changes languages or packages — runs `morloc init` again without the flag, so repeat the second command afterwards. `mim doctor --slurm` (below) reports when it is missing.

## 12.9.3. Running with the dispatch bridge

The runtime flag is `--slurm-bridge` (the name will generalize as other backends land):

```console
$ mim run --env hpc --slurm-bridge -- bash -c "morloc make heavy.loc && ./heavy foo 5"
```

When the flag is set, mim:

1.  Spawns a Unix-domain-socket bridge thread on the host.
2.  Launches the driver container with that socket bind-mounted at `/run/morloc-bridge.sock` and `MORLOC_BRIDGE_SOCKET` exported.
3.  Each labeled term that gets evaluated inside the container becomes a JSON RPC over the socket. The runtime hands the bridge a structured argv — a `mim run` invocation that, when executed, brings up the same env’s container and runs the nexus in call-packet mode with the labeled subtree as its payload.
4.  The bridge wraps that argv in the current backend. On SLURM the wrap is `sbatch --wrap='<argv>'` and the wrapped command lands on a compute node. A future local-container backend would just `exec` the same argv on the host; a Kubernetes backend would create a Job manifest, etc. In every case the argv is identical and the job ends up writing its result packet to a shared `.morloc-cache/<hash>.dat` file.
5.  The driver pool polls job status through the bridge (on SLURM via `sacct -j ID`), reads the result, validates the packet header, and returns the bytes up the call chain.

The dispatched job is also launched with `--slurm-bridge`, so any nested labeled terms encountered while evaluating the dispatched subtree can themselves fan out to fresh jobs.

## 12.9.4. What lands on the shared filesystem

All inter-job bytes flow through content-addressed files in the project’s `.morloc-cache/` directory:

**`<arg-hash>.dat`**

raw msgpack payload of one argument (data-sized)

**`<arg-hash>.packet`**

small header packet that references the `.dat` by path (~100 bytes)

**`<call-hash>-call.dat`**

the assembled call packet (just a CALL header plus the small arg-reference headers — tiny regardless of arg size)

**`<call-hash>.dat`**

result packet, doubles as the memoization cache

**`<call-hash>.out` / `.err`**

stdout/stderr captured by the backend (e.g. by SLURM for sbatch’d jobs)

Two consequences worth highlighting: a large argument (e.g. a genome) is written once under its hash and referenced thereafter, and a re-run with unchanged args hits the cached result without dispatching a fresh job.

## 12.9.5. Preconditions and the `doctor` check

What the dispatch design requires depends on the backend. The backend-agnostic preconditions are minimal: the active env has a runnable image, and the bridge socket directory is writable. The SLURM backend adds cluster-shape requirements:

-   The user’s `$HOME` is mounted on every compute node at the same absolute path (the HPC norm via NFS). A local-container backend would not need this.
-   The `mim` binary lives at a path reachable from every compute node (typical: `~/.local/bin/mim` on an NFS-mounted `$HOME`). A local backend would just use whichever binary is currently running.
-   `sbatch` and `sacct` are on the host’s PATH.
-   The active env’s image is reachable from every compute node. Apptainer satisfies this trivially because `.sif` is a file on the shared FS. Podman and Docker work too as long as you handle image distribution yourself (registry pull or pre-populated store).

To check all of the above before relying on the bridge:

```console
$ mim doctor --slurm
```

Each check reports PASS / WARN / FAIL with an actionable hint. The flag is `--slurm` for the same reason as the codegen flag above; it exercises the SLURM realization of the dispatch path.
