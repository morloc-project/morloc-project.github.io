# 9.2. Dependency management

Morloc Manual > Deployment | https://morloc-project.github.io/docs/apis/deploy-dependencies.html | prev: https://morloc-project.github.io/docs/apis/deploy-environments.md | next: https://morloc-project.github.io/docs/apis/deploy-serving.md

A Morloc program usually depends on packages from its languages' ecosystems: NumPy, a CRAN library, a Rust crate. You declare them once, in the program’s `package.yaml`, and `mim` installs them into the environment when you install the program. This section introduces the running example, shows how its dependencies are declared and solved, and explains when an environment is rebuilt.

## 9.2.1. The smiles example

[SMILES](https://en.wikipedia.org/wiki/Simplified_Molecular_Input_Line_Entry_System) is a text notation for molecules: `CCO` is ethanol, `NC1=NC=NC2=C1N=CN2` is adenine. The `smiles` program exports three functions over it, all implemented in Python with RDKit. It is a directory of three files.

**smiles/main.loc**

```morloc
--' Work on chemical SMILES codes
module smiles (mw, canonicalize, formula)

source Py from "smiles.py" ("mw", "canonicalize", "formula")

import root-py

--' SMILES code
type Smiles = Str

--' Get molecular weight
mw :: Smiles -> Real

--' Find the canonical form
canonicalize :: Smiles -> Smiles

--' Derive the molecular formula
formula :: Smiles -> Str
```

**smiles/smiles.py**

```python
from rdkit import Chem
from rdkit.Chem import Descriptors

def canonicalize(smiles: str) -> str:
    mol = Chem.MolFromSmiles(smiles)
    if mol is None:
        raise ValueError(f"Invalid SMILES: {smiles}")
    return Chem.MolToSmiles(mol)

def mw(smiles: str) -> float:
    mol = Chem.MolFromSmiles(smiles)
    return Descriptors.MolWt(mol)

def formula(smiles: str) -> str:
    mol = Chem.MolFromSmiles(smiles)
    return Chem.rdMolDescriptors.CalcMolFormula(mol)
```

**smiles/package.yaml**

```yaml
name: smiles
version: 0.1.0
synopsis: "Chemical structures in SMILES format"
license: MIT
dependencies: []
py-deps:
  rdkit: { version: "*", source: "conda" }
```

The entry file of a program directory is `main.loc`. The `module smiles` line, not the directory or file name, is the program’s name once installed.

## 9.2.2. Declaring dependencies

`py-deps` maps each Python package the program imports to a version constraint and a source. `"*"` accepts any version; a constraint such as `">=2023.9"` narrows it. The source says which package index the name refers to:

-   `conda` — [conda-forge](https://conda-forge.org). Use it for anything with compiled code, as RDKit has, so every package in the environment is built against the same libraries.
-   `pypi` — the Python Package Index, for pure-Python packages conda-forge does not carry.

Python requires the source because a package’s name can mean different things on the two indexes. R, C++, and Rust dependencies go in `r-deps`, `cpp-deps`, and `rust-deps`, which have defaults. The full rules for each language, including conda channels such as bioconda and packages kept inside the project, are in [Dependencies (`py-deps`)](https://morloc-project.github.io/docs/languages/python.md#py-deps), [Dependencies (`r-deps`)](https://morloc-project.github.io/docs/languages/r.md#r-deps), and [Dependencies (`rust-deps`)](https://morloc-project.github.io/docs/languages/rust.md#rust-deps).

A program’s dependencies are the union of its own and those of every module it imports. `smiles` imports `root-py`, whose needs come along with it.

## 9.2.3. Installing the program

```console
$ mim install ./smiles
```

`mim install` takes the program’s directory (or its `.loc` file) and builds it into the default environment, or the one named with `--env`. In order, it:

1.  asks the compiler for the program’s dependencies, the union described above;
2.  adds them to the environment’s requirements and solves the whole set with pixi, rebuilding the container image if the toolchain changed;
3.  compiles the program inside the environment;
4.  copies the program’s directory and build into the environment, under its module name, and puts a launcher named `smiles` on the environment’s `PATH`.

The first install of `smiles` is the slow one: RDKit and its libraries are downloaded and solved. Once it finishes, `smiles` runs like any command inside the environment:

```console
$ mim run -- smiles mw "C1=NC2=NC=NC(=C2N1)N"
135.13
$ mim run -- smiles formula "C1=NC2=NC=NC(=C2N1)N"
"C5H5N5"
$ mim run -- smiles canonicalize "C1=NC2=NC=NC(=C2N1)N"
"Nc1ncnc2nc[nH]c12"
```

Installing from a directory also makes the module importable by other programs and by eval expressions in this environment ([Eval](https://morloc-project.github.io/docs/apis/deploy-eval.md)). Installing a single `.loc` file installs the program only.

To list what an environment has installed, ask the compiler inside it. A pattern narrows the list, and `-v` adds each command’s type:

```console
$ mim run -- morloc list -v smiles
```

`mim info smiles` also names the installed programs, and `mim info smiles --packages` lists every package in the solved toolchain at its locked version.

After you change a program’s code or its `package.yaml`, install it again with `--force`, which replaces the installed copy:

```console
$ mim install --force ./smiles
```

## 9.2.4. One solved world per environment

An environment has a single set of packages, shared by every program installed in it. `mim` keeps it as a pixi project in the environment’s data directory: `pixi.toml` holds the combined requirements of every installed program plus any languages and package files you set with `mim modify`, and `pixi.lock` records the exact version of every package the solve chose. That locked set is the environment’s **solved world**.

One world means one version of each package. When two programs constrain the same package, both constraints must hold, and the solve finds a version that satisfies them together. If none exists, the install fails with the solver’s explanation and the environment keeps its previous world. Two programs asking for the same conda package from different channels is an error naming the package, since a package can come from only one channel.

Because the world is shared, installing a new program can move the version of a package another program uses, within that program’s own constraints. When two programs need versions that cannot coexist, put them in separate environments.

## 9.2.5. When an environment is rebuilt

The world is solved again whenever the requirements may have changed:

-   `mim install`, for every program;
-   `morloc make` run inside the environment, for a program built in place without installing;
-   `mim modify` with `--lang` or a package file;
-   `mim update`, including a move to another Morloc version.

Each solve is skipped when the requirements are the same as last time, and `mim` says so ("requirements unchanged"), so repeating a command is cheap. A solve can move package versions under programs already installed, but it does not recompile them. After `mim update --latest`, reinstall your programs so they are built by the new compiler.

**Local Python packages**

A program can depend on a Python package that lives in its own project tree rather than on an index, declared under `local-deps` (see [Local packages (`local-deps`)](https://morloc-project.github.io/docs/languages/python.md#local-deps)). When such a program is installed, `mim` copies the package into the environment’s pixi project under a directory named for a hash of its contents, and points the requirement at that copy. The installed program then no longer depends on your project directory, the same path works on the host, in the container, and in a frozen image, and reinstalling unchanged source does no work.
