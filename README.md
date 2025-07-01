= Morloc Technical Documentation

This site is built using asciidocs for markdown. This is compatible with LaTeX
and bibtex for references. And has completely kickass tables.

To compile this documentation run `make build` to create (or pull) the required
image. Then call `make` to build the site. `make shell` will put you in a shell
where you can play with dependencies and whatever.

```
pygmentize -S default -f html -a .pygments > pygments-light.css
pygmentize -S github-dark -f html -a .pygments > pygments-dark.css
```
