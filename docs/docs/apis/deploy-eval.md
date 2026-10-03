# 9.4. Eval

Morloc Manual > Deployment | https://morloc-project.github.io/docs/apis/deploy-eval.html | prev: https://morloc-project.github.io/docs/apis/deploy-serving.md | next: https://morloc-project.github.io/docs/apis/deploy-freeze.md

A served view answers a fixed set of calls: `smiles mw`, `smiles formula`, and so on. **Eval** lets a caller go further and send a whole Morloc expression that composes the installed functions in ways you never exported: weigh a list of molecules, filter it, pair the results with formulas. The server typechecks the expression, compiles it, runs it, and returns the result.

A conventional API serves a fixed list of endpoints. With eval, a server offers every composition of its allowed functions, including ones you never anticipated, and because Morloc’s types span all the languages involved, each composition is typechecked before it runs. A client can read the function signatures from `/discover` or the MCP tool list and build a new pipeline from them.

Eval only ever composes functions that are already installed. A caller cannot define a new function in a foreign language, read a file directly, or import anything you did not allow. The rest of this section shows how to turn it on, how to use it, and the guard-rails around it.

## 9.4.1. Turning eval on

Eval is off until you enable it with a list of the modules an expression may import:

```console
$ mim view eval --allow smiles,root-py
$ mim start -p 8005:8005 --force
```

`smiles` provides the chemistry, and `root-py` provides the basics an expression needs: `map`, `filter`, `zip`, arithmetic, and comparison. Morloc has no implicit prelude, so even `+` must come from an imported module. The allow-list is separate from the MCP and API views; a module can be importable by eval without being served, and the reverse. `mim view eval --off` turns eval off again.

## 9.4.2. Evaluating an expression

`mim eval` sends an expression to the running server of the default environment (or `--env`) and prints the server’s JSON reply. Top-level items on one line are separated with `;`:

```console
$ mim eval 'import root-py; import smiles (mw); map mw ["CCO", "NC1=NC=NC2=C1N=CN2", "c1ccccc1"]'
```

A longer expression is easier to keep in a file. The file holds imports and a single expression, with `where` (or `let`) bindings laid out as in any Morloc source; it is an expression, not a module, so it has no `module` line and declares nothing:

**heavy.loc**

```morloc
import root-py
import smiles (mw, formula)

zip (map formula heavy) (map mw heavy)
  where
    heavy = filter (\s -> mw s > 100.0) mols
    mols = ["CCO", "NC1=NC=NC2=C1N=CN2", "c1ccccc1"]
```

`mim eval` takes the expression as its argument, so pass the file’s contents:

```console
$ mim eval "$(cat heavy.loc)"
```

The reply is `{"status":"ok","result":"…​"}`, where `result` is the expression’s value as the program would print it. `mim eval` reaches the server on `127.0.0.1` at the port recorded when it started, so run it on the machine that serves; `-p` overrides the port.

Remote callers use the same capability. Over HTTP it is `POST /eval` with the expression in a JSON object:

```console
$ curl -s http://localhost:8005/eval \
    -H "Authorization: Bearer $MORLOC_MCP_TOKEN" \
    -d '{"expr": "import root-py; import smiles (mw); map mw [\"CCO\"]"}'
```

Over MCP, eval is one extra tool named `eval`, taking an `expression` string, whose description lists the modules it may import. An assistant that has read the other tools' schemas can write an expression that chains them.

## 9.4.3. Guard-rails

An eval expression is code written by whoever can reach the server, so it runs under restrictions a program you compile yourself does not have:

-   **Allow-listed imports only.** Each `import` must name a module on the allow-list. Renaming does not help: `import M as N` is checked against `M`. Modules that an allowed module imports internally are fine.
-   **No local modules.** Imports resolve only to installed modules, never to files on the server’s disk.
-   **No new code.** An expression cannot `source` foreign functions or declare types, typeclasses, or instances.
-   **No direct IO.** IO intrinsics such as `@write` and `@open` may not appear in the expression. A function from an allowed module may still do IO internally, so the IO a caller can reach is exactly what your modules export.
-   **Resource limits.** Each evaluation runs in its own process, capped at 2 GB of compiler memory and 30 seconds of CPU time.
-   **Read-only container.** A Docker or Podman server runs with a read-only root filesystem, so an expression cannot change the installed software.

Each request is typechecked and compiled from scratch before it runs, so even a small expression takes a moment. Nothing about one request is kept for the next.

The token rule is stricter for eval than for the rest of the server. On the default loopback bind, eval needs no token. On an exposed server, eval runs only for callers presenting the token, even if you started the server with `--allow-no-auth`; without a token it is **locked**: not listed among the MCP tools, reported as locked by `/discover`, and refused with `403`. `--eval-allow-no-auth` lifts this, for a deployment where something in front of the server already checks callers. When a token is set, `mim eval` sends the one in `MORLOC_MCP_TOKEN`, or the one given with `--auth-token`.

## 9.4.4. Trying expressions locally

The `morloc eval` command applies the same checks without a server, which is how to see what a caller will get. Pass the allow-list with `--eval-allowed-modules`:

```console
$ morloc eval --eval-allowed-modules root-py -e 'import root-py; @write "x" 1'
IO intrinsics may not be used directly in a sandboxed eval expression; wrap the intrinsic in an exported function of an allow-listed module instead
$ morloc eval --eval-allowed-modules root-py -e 'import root-cpp; 1 + 2'
module 'root-cpp' is not in the eval allow-list
```

Inside the environment, `mim run — morloc eval --eval-allowed-modules smiles,root-py heavy.loc` evaluates the file above the way the server would. Without `--eval-allowed-modules`, `morloc eval` is the unrestricted local command described in [morloc eval](https://morloc-project.github.io/docs/internals/morloc-eval.md), which also covers writing `where`, `let`, and `do` blocks on one line with braces.
