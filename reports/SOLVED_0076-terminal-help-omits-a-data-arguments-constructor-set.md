# 0076: terminal help omits a `data` argument's constructor set

- Status: fixed
- Found: 2026-09-10, while writing `src/content/features-sum-types.asc`
- Component: nexus
- morloc: 0.102.1

## Expected

A `data` argument accepts a closed set of constructor names, and the nexus
knows them: `--json-help` and `--mcp-tools` both emit the set as a JSON-Schema
`enum`. `-h` should name them too, since it is the interface a person reads
before typing the value.

## Observed

`-h` prints the type name alone, so the reader is told a `Color` is wanted
without being told which words spell one.

```
$ ./colors describe -h

Usage: ./colors <nexus_options> describe <command_options>

General Options:
  -h, --help  Print help (see more with '--help')

Positional arguments:
  1:  type: Color

Return: Str
```

while `--mcp-tools` on the same program gives:

```
      "_1": {
        "type": "string",
        "enum": [
          "Red",
          "Green",
          "Blue"
        ]
      }
```

## Reproduce

```
$ cat > colors.loc <<'END'
module main (describe)
import root-py
data Color = Red | Green | Blue
describe :: Color -> Str
describe | Red = "warm"
         | Green = "cool"
         | Blue = "cold"
END
$ morloc make -o colors colors.loc
$ ./colors describe -h
```

## Impact

A person at a terminal has to read the source, or `--json-help`, to learn what
to type. A wrong guess is caught with a good message, so this costs a round
trip rather than a wrong answer. Filed upstream as morloc-project/morloc#65.

## Resolution

Fixed in `morloc` commit `83bd2774`.

Terminal help now reads the constructor set out of the argument's own wire
schema and prints it under the type line: `values:` for constructors that take
no fields, `constructors:` with a field count for those that do. Optionals,
lists, and a record the CLI destructured into options are looked through, so
every position an argument can hold a `data` type is covered.

Covered by the `data-help-constructors` golden test.
