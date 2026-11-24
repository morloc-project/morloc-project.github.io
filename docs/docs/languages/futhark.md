# 9.6. Futhark

Morloc Manual > Language Support | https://morloc-project.github.io/docs/languages/futhark.html | prev: https://morloc-project.github.io/docs/languages/rust.md | next: https://morloc-project.github.io/docs/utilities/index.md

## 9.6.1. Sourcing Futhark functions

Futhark has no pool of its own. Morloc compiles each sourced `.fut` file with the Futhark compiler and links it into the C++ pool, so a call between Futhark and C++ code does not cross a pool. You source a Futhark `entry` the way you source any other function:

**main.loc**

```morloc
module main (scaledSum)

import root-cpp
import vector

source Futhark from "kernels.fut" ("scaled_sum" as scaledSum)

scaledSum :: F32 -> Vector n F32 -> F32
```

**kernels.fut**

```
entry scaled_sum [n] (s: f32) (v: [n]f32) : f32 =
  f32.sum (map (\x -> s * x) v)
```

```console
$ morloc make -o demo main.loc
...
$ ./demo scaledSum 2.0 '[1,2,3,4]'
20
```

A Futhark signature may use only fixed-width numeric scalars, `Vector` and `Matrix` of them, and tuples of those that do not nest. The build checks each signature against the entry the Futhark compiler reports, so declaring `F64` for this `f32` entry fails before anything runs:

```
Futhark entry scaled_sum: morloc signature implies f64 rank-0 but the entry has f32 rank-0
```

## 9.6.2. Futhark backends and GPU devices

Futhark code is compiled for a backend chosen with two build parameters ([Build parameters](https://morloc-project.github.io/docs/languages/build-parameters.md)):

-   `backend` — the Futhark compilation backend: one of `c` (the default, sequential CPU), `multicore` (parallel CPU), `opencl`, `cuda`, `hip`, or `ispc`. The GPU backends (`opencl`, `cuda`, `hip`) are what make Futhark run on a GPU.
-   `device` — which device to run on, for a GPU backend, using Futhark’s device selector syntax (`#0`, `#1`, …​). It is only valid together with a GPU backend.

```bash
# build the Futhark kernels for CUDA and run on the second GPU
morloc make -X futhark:backend=cuda -X futhark:device=#1 -o nexus main.loc
```

A GPU build runs on the single selected device, and calls into the Futhark context are serialized. The required GPU runtime libraries (for example `-lcuda -lnvrtc` for CUDA) are linked automatically; if your toolchain lives in a non-standard location, add the paths with the C++ escape hatch, e.g. `-X cpp:flags=-L/usr/local/cuda/lib64`.
