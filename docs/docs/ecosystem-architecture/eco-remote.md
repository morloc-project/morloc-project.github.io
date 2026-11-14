# 11.5. Remote jobs

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-remote.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.md | next: https://morloc-project.github.io/docs/ecosystem-architecture/eco-modules.md

> A label with a `remote:` block runs each call through it as a job on a SLURM cluster. The process that makes the call, the job’s **parent**, writes the call to a file, submits a job that runs the program’s nexus on that file, waits for the job to end, and reads its result back. This section specifies what the parent sends, the command the job runs, how the parent learns that the job has ended, the files the two share and how long they last, and the bridge through which a program in a container submits jobs to the host. What a label wraps is in [Remote job submission](https://morloc-project.github.io/docs/runs/remote-jobs.md).

**When a call becomes a job.** Submission is compiled into a program only when its build asks for it, either for one build (`morloc make --slurm`) or for every build in an installation (`morloc init --slurm`). Otherwise a label’s `remote:` block is ignored and the call runs in the parent. A label wraps one call of a function, or one run of a suspension, and that call is the job’s work: the job runs the labeled function, and everything the function’s body calls. The parent evaluates the call’s arguments before it submits the job. A job’s parent may itself be a job.

When the label also asks for `cache`, the parent looks the call up in the cache ([Caching](https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.md)) before submitting it; a hit submits nothing, and a result is stored only after the job has completed.

**What the parent sends.** The parent turns each argument into a self-contained data packet ([Packet protocol](https://morloc-project.github.io/docs/build-architecture/build-packets.md)): the whole value is copied into the packet’s payload, so nothing in it refers to the parent’s shared memory. A file handle is sent as its path, which the job reopens. A value holding an input or output stream is refused, since a stream belongs to the process that opened it. The arguments go into one call packet, which names the call by the compiler’s identifier for it.

**The job’s directory.** Each call gets a new directory under the cache base, `<cache base>/_remote/<name>/`, where the name joins the parent’s host name, its process id, a counter and the time, and the directory is created exclusively, so no two calls share one. The cache base is resolved as in [Caching](https://morloc-project.github.io/docs/ecosystem-architecture/eco-caching.md). The parent and the job must see it at the same path, so on a cluster it must be on a filesystem every node mounts.

| File | Contents |
| --- | --- |
| `call.dat` | The call packet, written by the parent before submission |
| `result.dat` | The result packet, written by the job |
| `job.out`, `job.err` | The job’s standard output and error, written by SLURM |

**Submission.** The parent submits with

```
sbatch --parsable -o <dir>/job.out -e <dir>/job.err [resources] --wrap='<command>'
```

and reads the job’s id from the output. The resources are the label’s: memory as `--mem=<N>G`, wall time as `--time=<D-HH:MM:SS>`, CPU cores as `--cpus-per-task=<N>`, and GPUs as `--gres=gpu:<N>`. A resource the label leaves unset is not requested, so the cluster’s default applies. Memory and time of 0 are requested as given, since SLURM gives them a meaning (all of a node’s memory, no limit); CPUs and GPUs of 0 are not requested, and in particular `--gres` is never passed without GPUs, since a cluster with no GPU resources defined rejects it.

The command runs the nexus of the parent’s own program, by absolute path, on the parent’s manifest:

```
<nexus> run --call-packet <dir>/call.dat --socket-base <pool socket name>
        --output-file <dir>/result.dat --output-form packet <manifest>
```

The job’s nexus sends the call to a pool of the labeled function’s language, started on the compute node, and writes the result as a self-contained packet to a temporary name beside `result.dat`, renamed into place when complete. SLURM starts a job in the directory `sbatch` ran in, which is the directory the parent was started from, and, by default, with the parent’s environment.

**Waiting.** The parent asks SLURM for the job’s state once a second, with

```
sacct -j <id> --format=State%30 --noheader
```

until a line names a state after which the job makes no further progress: `COMPLETED`, `FAILED`, `CANCELLED`, `TIMEOUT`, `OUT_OF_MEMORY`, `NODE_FAIL`, `BOOT_FAIL`, `DEADLINE` or `PREEMPTED`, including the forms SLURM abbreviates to its column width (`OUT_OF_ME+`) or annotates (`CANCELLED by 1234`).

**The result.** If the job ended `COMPLETED`, the parent reads `result.dat`, checks that it is a well-formed packet, refuses one holding an input stream, and returns it as the result of the labeled call. The parent then deletes the job’s directory, so a later identical call submits a new job.

A labeled function that fails in the job makes the job’s nexus write the error to its standard error and exit with a failure status, so the job ends `FAILED`. If the job ended in any state but `COMPLETED`, completed without writing a result, or wrote a malformed one, the call fails with an error naming the job, its state and the path of its standard error, followed by the first 4 KiB of that file; the directory is kept so the whole of it can be read. Nothing removes a failed job’s directory later.

**The bridge.** A program in a container has no `sbatch` or `sacct`. When `MORLOC_BRIDGE_SOCKET` names a Unix socket, the parent sends each submission and each status question to that socket instead, and `mim`, on the host, runs the SLURM commands. Each exchange is one connection carrying one JSON object on one line in each direction:

| Request | Fields | Reply |
| --- | --- | --- |
| `"op": "submit"` | `inner_argv` (the job’s command, one element per argument), `stdout`, `stderr`, `resources` (`mem_gb`, `time_s`, `cpus`, `gpus`) | `job_id`, or `error` |
| `"op": "status"` | `job_id` | `state` as SLURM names it, or `error` |

`mim` runs the command inside the same environment on the compute node, with the bridge enabled there too, so a job can submit jobs of its own. A status question that fails is treated as a job still running.
