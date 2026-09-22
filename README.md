= Morloc Technical Documentation

This site is built using asciidocs for markdown. This is compatible with LaTeX
and bibtex for references. And has completely kickass tables.

To compile this documentation run `make build` to create (or pull) the required
image. Then call `make` to build the site. `make shell` will put you in a shell
where you can play with dependencies and whatever. `make serve` previews the
result at http://localhost:8000/docs/.

The manual is written as one AsciiDoc book and published as one page per
section, with a markdown twin of every page, `llms.txt` as a machine-readable
table of contents, and a Pagefind search index. See CLAUDE.md for the
pipeline and the layout of the generated files.


```
pygmentize -S default -f html -a .pygments > pygments-light.css
pygmentize -S github-dark -f html -a .pygments > pygments-dark.css
```
