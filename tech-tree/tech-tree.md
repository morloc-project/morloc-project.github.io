# Tech Tree

The purpose of this document is to describe the underlying Haskell packages
that are used in Morloc. It is not intended to act as a replacement for the
documentation of the packages themselves, but rather describes how they are
used within the Morloc context and why they were chosen.

## `docopt`

The `docopt` package is the Haskell implementation of the wider
["docopt"](docopt.org) paradigm. The idea is that usage statements are
standardized enough to allow them to be parsed as a language. Thus a usage
statement, such as:

```
morloc version 0.16.2

Usage:
  morloc make [--expression] <script> [--endpoint=<sparql-endpoint>]
  morloc rdf [--triple] [--expression] <script>

Options:
  -t, --triple       print RDF graph in triple format, rather than the turtle
  -e, --expression   read script as string rather than file
```

This string serves as both the usage statement that is printed when help is
needed (e.g., `morloc -h`) and the specification of the supported command line
arguments that can be called. The Haskell code in `Main.hs` determines the
behavior of Morloc when these options are used, but does not have to deal with
formatting or argument parsing.

## `hsparql`

`hsparql` is a DSL for making SPARQL queries from Haskell. In the past I wrote
raw SPARQL code since I considered the use of a DSL unnecessary, since SPARQL
is so pretty on its own. However, I found the raw SPARQL queries, which
bypassed the typechecker, were a constant source of errors. I further had no
options for abstraction and code reuse. So I converted to the DSL. It is more
verbose, but also more reliable.

## `rdf4h`

`rdf4h` is a Relational Data Format (RDF) handling package designed by Rob Stewart (the
same person is maintains the `hsparql`).

## `wl-pprint-text`

Parsers such as `parsec` and `megaparsec` take strings and turn them into
structures. The dreadfully named `wl-pprint-text` does the reverse. There is
a beautiful symmetry between the syntax for `wl-pprint-text` and `parsec`.
Commands in `parsec` that parse a string into a list (e.g., `many digit`) and
reversed by `hsep` that takes a list of Doc types and makes a new Doc.

What is this Doc things? Apart from the beauty of `wl-pprint-text`, it is also
highly performant. The `wl` is a reference to Wadley and Leijen, the authors of
the paper on a high-performance, combinator-based pretty printer.

`wl-pprint-text` is a translation of `wl-pprint` from using String to using
Text, for greater performance.

## `megaparsec`

`megaparsec` is an industrial strength alternative to `parsec`.
