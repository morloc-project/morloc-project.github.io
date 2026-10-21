# 7.5. Remote job submission

Morloc Manual > Managing Runs | https://morloc-project.github.io/docs/runs/remote-jobs.html | prev: https://morloc-project.github.io/docs/runs/caching.md | next: https://morloc-project.github.io/docs/runs/compression.md

A labeled call can run as a separate job on a SLURM cluster. This is for the step that needs more than the machine running the program: 32 GB and eight cores, called once per sample across hundreds of samples. You describe the job’s resources in the label’s configuration, and each call through the label is submitted with `sbatch`, waited for, and its result returned to the program as if it had run locally.

> **Warning: Experimental Feature**
> Remote jobs are tested against a stand-in for `sbatch` and `sacct` that runs each job on the same machine, not on a real cluster. Setting up a cluster for them is covered in [Running on a cluster](https://morloc-project.github.io/docs/apis/execution-contexts.md).

## 7.5.1. Sending a call to a job

A label (see [Logging](https://morloc-project.github.io/docs/runs/logging.md)) with a `remote:` block makes every call through it a job:

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

**heavy.yaml**

```yaml
labeled-groups:
  big:
    remote:
      threads: 8
      memory: 32
      time: "01:00:00"
```

Here `run` is mapped over three inputs, so one run of `foo` submits three jobs, one per call of `run`. `reduce` runs in the program itself.

Job submission is compiled in only when the build asks for it. Without it, a labeled call runs in the program as usual, so the same program works on a laptop:

```console
$ morloc make -o heavy heavy.loc
$ ./heavy foo '["a","bcd","ef"]'
6
$ morloc make --slurm -o heavy heavy.loc
$ ./heavy foo '["a","bcd","ef"]'
6
```

The second build submits jobs. `morloc make --slurm` turns submission on for one build; `morloc init --slurm` turns it on for every build in the environment.

## 7.5.2. Describing the job

The `remote:` block lists the resources each job asks for. Every field is optional; a field you leave out is not requested, and the cluster’s default applies. A `memory` or `time` of 0 is passed on, and SLURM reads it as all of a node’s memory or no time limit; `threads` or `gpus` of 0 is not requested.

| Field | Meaning | Requested as |
| --- | --- | --- |
| `threads` | CPU cores | `--cpus-per-task=N` |
| `memory` | memory in gigabytes | `--mem=NG` |
| `time` | wall time, `"HH:MM:SS"` or `"D-HH:MM:SS"` | `--time=D-HH:MM:SS` |
| `gpus` | GPUs | `--gres=gpu:N` |

`time` must be a string; a bare number of seconds is refused when the program is built:

```console
$ morloc make -o heavy heavy.loc
Failed to parse module config file 'heavy.loc': Aeson exception:
Error in $['labeled-groups'].big.remote.time: Expected a string for SLURM time
```

## 7.5.3. What runs in the job

A label wraps exactly one call of the function it is written on. The job runs that function and everything the function’s own body calls, including its recursive calls. Everything else stays in the program that made the call, which the rest of this section calls the job’s **parent**.

The arguments of a labeled call are computed by the parent before the job is submitted, and the job receives them as values. In `big@run (prepare x)`, `prepare x` runs in the parent and `run` runs in the job. To send `prepare` to the job as well, name the whole computation and label the name. With a sourced `prepare :: Str → Str` added to `heavy.loc`:

```morloc
runPrepared :: Str -> Int
runPrepared x = run (prepare x)

foo :: [Str] -> Int
foo = reduce . map big@runPrepared
```

A label goes on a name, never on a larger expression. Writing `foo xs = big@(reduce xs)` is refused:

```console
$ morloc make -o heavy heavy.loc
heavy.loc:10:10: A label goes on the name of a function or a suspension, never on a larger expression; give the expression a name and label that ('big@f x', where 'f' computes it)
     |
  10 | foo xs = big@(reduce xs)
     |          ^
```

A job can submit jobs of its own. If `runPrepared` called `big@run`, each `runPrepared` job would be the parent of a `run` job. Removing the inner label runs `run` inside the outer job instead.

## 7.5.4. Effects

A job is where expensive work happens, and expensive work usually reads files or queries a database: it has an effect (see [Effects and delayed evaluation](https://morloc-project.github.io/docs/features/effects.md)). A labeled call to an effectful function runs the effect in the job. A label on a suspension makes each run of the suspension a job:

**jobs.loc**

```morloc
module jobs (summarize)

import root-py
source Py from "jobs.py" ("load", "total")

load :: Str -> <IO> [Int]
total :: [Int] -> Int

dataset :: <IO> [Int]
dataset = load "counts.txt"

summarize :: Int -> <IO> Int
summarize x = do
  xs <- big@dataset
  total xs
```

**jobs.py**

```python
def load(path):
    with open(path) as fh:
        return [int(line) for line in fh]

def total(xs):
    return sum(xs)
```

Running `big@dataset` submits a job that reads `counts.txt` and returns its numbers; `total` then runs in the parent. A suspension that is run twice is two jobs. When the program calls `sbatch` itself, a job starts in the directory the program was started from, so the relative path `counts.txt` names the same file there.

```console
$ printf '3\n4\n5\n' > counts.txt
$ morloc make --slurm -o jobs jobs.loc
$ ./jobs summarize 1
12
```

## 7.5.5. Results

Each call submits a new job. A job’s inputs and result pass through files in a directory the parent and the job share ([Remote jobs](https://morloc-project.github.io/docs/ecosystem-architecture/eco-remote.md)), and the parent deletes them once it has read the result. To keep a job’s result and skip the job the next time the same call is made, ask for the cache as well:

```yaml
labeled-groups:
  big:
    cache: true
    remote:
      threads: 8
      memory: 32
      time: "01:00:00"
```

The cache is checked before the job is submitted, so a hit submits nothing; [Caching](https://morloc-project.github.io/docs/runs/caching.md) describes when a call counts as the same call.

A job that fails is reported with its final state and the start of its standard error, and the program stops. Here the job cannot find its input:

```console
$ rm counts.txt
$ ./jobs summarize 1
Error: run failed
Error (pymorloc.c:3235 in pybinding__remote_call):
SLURM job 104 ended FAILED; its stderr is .../cache/_remote/.../job.err:
Error: run failed: [Errno 2] No such file or directory: 'counts.txt'
...
```

A failed job’s files are kept, so you can read the whole of its standard error at the path the message gives.

## 7.5.6. What a job can receive

An argument or result crosses to another machine, so it must be a value that means the same thing there. A file handle (`IFile`) is sent as its path, which the job opens on the shared filesystem. An input or output stream (`IStream`, `OStream`) belongs to the running program and cannot be sent to a job; a call that tries is an error. A job also cannot return an `IStream`.
