# 0024: `@false` silently discards the short option, and the reverse flag is hidden from help

- Status: open
- Found: 2026-09-02, during the "Building CLIs" documentation pass
- Component: compiler, nexus
- morloc: 0.100.2     mim: 0.28.0

## Expected

`src/content/cli-docstrings.asc:100` documents `@false` as "the flag labels
that toggle a boolean argument off". Given

```
  --' verbose on/off
  --' @true -v/--verbose
  --' @false -q/--quiet
  Bool ->
```

both `-q` and `--quiet` should turn the flag off, and both should appear in
`--help` next to `-v/--verbose`.

## Observed

`-q` does not exist, and `--quiet` exists but is invisible.

```
$ ./t opts -h
...
Optional arguments:
  -v, --verbose            verbose on/off
                           type: Bool
                           default: false
...

$ ./t opts -q
error: unexpected argument '-q' found

$ ./t opts --quiet
"includes=[] verbose=False n=3"

$ ./t opts -v --quiet
"includes=[] verbose=False n=3"

$ ./t --json-help | python3 -c "import json,sys;print([a for c in json.load(sys.stdin)['commands'] for a in c['arguments'] if a.get('role')=='flag'])"
[{'name': 'verbose', 'role': 'flag', 'required': False, 'short': 'v', 'long': 'verbose', 'long_reverse': 'quiet', 'default': 'false', ...}]
```

So the reverse spelling survives as a long name only, and only in the machine
-readable surface.

## Reproduce

```
module t (opts)
import root-py
source Py from "t.py" ("show")
show :: Bool -> Str

--' Show how options are parsed
opts ::
  --' verbose on/off
  --' @true -v/--verbose
  --' @false -q/--quiet
  Bool -> Str
opts = show
```

with `t.py`:

```
def show(verbose):
    return f"verbose={verbose}"
```

Then `morloc make -o t t.loc && ./t opts -h && ./t opts -q`.

## Impact

Two separate surprises from one directive. An author who writes
`@false -q/--quiet` gets neither the short flag they asked for nor any sign in
`--help` that the long one exists, so `--quiet` is discoverable only by reading
the source or `--json-help`.

## Guess

Unverified, two causes.

Short form: `flagRevJson` (`library/Morloc/CodeGenerator/Nexus.hs:1926`) maps
`CliOptBoth short long` to just the long name and `CliOptShort` to `null`, so
the manifest slot `long_rev` cannot carry a short option at all.

Hidden: `data/rust/morloc-nexus/src/phase2.rs:524` builds the reverse arg with
`.hide(true)`.
