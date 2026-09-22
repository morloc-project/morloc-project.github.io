# 6.6. Sum type arguments

Morloc Manual > Building CLIs | https://morloc-project.github.io/docs/clis/sum-type-arguments.html | prev: https://morloc-project.github.io/docs/clis/record-arguments.md | next: https://morloc-project.github.io/docs/clis/input-shape.md

A record says "all of these"; a `data` type says "one of these". Unrolled, a `data` argument becomes a set of options that exclude one another, one per constructor. An argument-free constructor is a bare flag. A constructor with fields takes exactly as many values as it has fields, in order.

```morloc
--' A shape to measure
data Shape
  --' a circle of some radius
  = Circle Real
  --' a box, width then height
  | Rect Real Real
  --' a point, with no size
  | Dot

--' Measure a shape
area ::
  --' the shape
  --' @unroll
  Shape ->
  Real
```

```console
$ ./shapes area -h
...
Optional arguments:
      --circle <Real>       a circle of some radius
                            constructor of Shape
      --rect <Real> <Real>  a box, width then height
                            constructor of Shape
      --dot                 a point, with no size
                            constructor of Shape
...
$ ./shapes area --rect 2.0 3.5
7
$ ./shapes area --dot
0
$ ./shapes area --dot --circle 1.0
error: the argument '--dot' cannot be used with '--circle <Real>'
```

Each option is the constructor’s name in lowercase, and its help is the constructor’s docstring. A value inside an arm is read the way an argument of its type would be, so a field of a `data` type takes a bare constructor (`--solid red`) and a field of a record type takes JSON or a file path.

Exactly one arm is required, unless the argument may be omitted — a `?Shape` with no arm given is null — or it declares a default, which may be a bare constructor:

```morloc
--' Count the corners, defaulting to a dot
count ::
  --' the shape
  --' @unroll
  --' @default dot
  Shape ->
  Int
```

To a program the argument is still one value. `--json-help` lists it under the role `alternatives` with its arms, and the MCP tool exposes a single property holding the constructor’s JSON, since a model has no need for the flags.

`@unroll` on a `data` argument does not combine with `@arg`, `@many` or `@stdin`: the constructors are the options, and there is nothing else to name.
