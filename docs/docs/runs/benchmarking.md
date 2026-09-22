# 8.2. Benchmarking

Morloc Manual > Managing Runs | https://morloc-project.github.io/docs/runs/benchmarking.html | prev: https://morloc-project.github.io/docs/runs/logging.md | next: https://morloc-project.github.io/docs/runs/run-directory.md

`log: true` reports every call as it happens. A benchmark wants the opposite: not a line per iteration but one row per label summarising every call the run made. That is `benchmark: true`.

```yaml
labeled-groups:
  parse: { benchmark: true }
```

```console
$ ./main run big.fasta
parse:readSeqs [cpp] n=2000 mean=0.000431 min=0.000298 max=0.004117
```

The two settings are independent and compose: a group may log, benchmark, both, or neither.

Timing is per-manifold, so process startup and pool spawn are outside the measurement. Because the label follows the manifold into whatever pool realises it, `{lang}` tells you which language actually ran the work — and a labeled call that crosses a pool boundary is measured on the **caller** side, so its row includes the round trip.

Only successful calls are recorded. A call that raised did not do the work being measured, and folding its duration into the mean would report a number that describes nothing.

## 8.2.1. The summary row

The row shape is the program-wide `benchmark-template`, whose one subfield is `summary`. Unlike `log-template` it is not per-label: the nexus aggregates every label’s timings and renders them through a single template.

The built-in default is readable rather than machine-shaped:

```yaml
benchmark-template:
  summary: "{group}:{name} [{lang}] n={count} mean={mean} min={min} max={max}"
```

A suite that wants columns overrides it. Rows go to stderr, like every other morloc log line, so the program’s own output is unaffected:

```yaml
benchmark-template:
  summary: "{group}\t{name}\t{lang}\t{count}\t{mean}\t{stddev}"
```

```console
$ ./main run big.fasta 2> bench.tsv
```

Available placeholders:

| Placeholder | Value |
| --- | --- |
| `{group}` | The label group name. |
| `{name}` | The labeled term’s identifier in source. |
| `{lang}` | The pool language that ran the calls. |
| `{count}` | Number of successful calls recorded. |
| `{mean}` | Arithmetic mean of the durations, in seconds. |
| `{min}` | Fastest recorded call, in seconds. |
| `{max}` | Slowest recorded call, in seconds. |
| `{total}` | Sum of all durations, in seconds. |
| `{stddev}` | Sample standard deviation; `0.000000` for a single call. |

Rows are ordered by `{group}`, then `{name}`, then `{lang}` — not by arrival. A benchmark exists to be compared against another run, and arrival order is not reproducible.

Setting `benchmark: true` while nulling `summary` is rejected at compile time: the timings would be collected and never reported.

## 8.2.2. Comparing implementations

Because labels are per-call-site, the same work measured under two labels yields two rows. That is the shape of an A/B comparison — one run, one input, the same warm pools:

```morloc
module cmp (compare2)

import root-py
import root-cpp

source Py from "lib.py" ("incr")
source Cpp from "lib.hpp" ("triple")

incr :: Int -> Int
triple :: Int -> Int

compare2 :: Int -> (Int, Int)
compare2 x = (slow@incr x, fast@triple x)
```

```console
$ ./cmp compare2 5
[6,15]
fast:triple [cpp] n=1 mean=0.000003 min=0.000003 max=0.000003
slow:incr [cpp] n=1 mean=0.000662 min=0.000662 max=0.000662
```

Both rows say `cpp`, including the one for the Python `incr`. That is the caller-side rule at work: this program is rooted in the C++ pool, so the call into Python is measured where it is made, and the 0.000662 seconds is the round trip rather than the addition. Measuring the Python side in isolation means rooting the program there instead.

Note also that `fast` precedes `slow` in the output despite running second. Rows are sorted, not logged.
