# 12.5. Customizing environments

Morloc Manual > Installation, Versions, and Deployment | https://morloc-project.github.io/docs/install/customizing-environments.html | prev: https://morloc-project.github.io/docs/install/managing-environments.md | next: https://morloc-project.github.io/docs/install/extra-container-flags.md

An environment’s contents are declared, not scripted: there is no user Dockerfile. Extra software comes in through `mim new` and `mim modify` and is solved together with the language toolchain, so the declaration — not a build log — is what reproduces the environment. The two package sources are covered in [Packages](https://morloc-project.github.io/docs/utilities/mim.md#mim-packages):

```console
$ mim new scipy --conda-packages-file tools.conda    # conda-forge packages
$ mim new scipy --system-packages-file tools.apt     # apt packages (containers only)
$ mim modify --env scipy --conda-packages-file tools.conda   # change later, rebuilds
```

Python and R libraries that a **program** needs are not declared here at all: a module’s `package.yaml` lists them, and `mim` solves them into the environment when the program is built ([Dependencies (`py-deps`)](https://morloc-project.github.io/docs/languages/python.md#py-deps), [Dependencies (`r-deps`)](https://morloc-project.github.io/docs/languages/r.md#r-deps), [Dependencies (`rust-deps`)](https://morloc-project.github.io/docs/languages/rust.md#rust-deps)). Pin language versions with `--lang` ([Language toolchains](https://morloc-project.github.io/docs/utilities/mim.md#mim-language-toolchains)).

Container backends also let you choose the base image with `--base`: `heavy` (the default, `ubuntu:24.04`) or `light` (`debian:bookworm-slim`, smaller, fewer preinstalled packages). Both are accepted by `new` and `modify`, and changing the base rebuilds the environment.
