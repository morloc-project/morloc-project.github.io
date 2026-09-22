# 3.8. Editor support

Morloc Manual > Getting Started | https://morloc-project.github.io/docs/getting-started/editor-support.html | prev: https://morloc-project.github.io/docs/getting-started/where-to-go-next.md | next: https://morloc-project.github.io/docs/getting-started/troubleshooting.md

Morloc is a young language and editor support reflects that. Here is the honest state of each, so you know what you are getting into.

**vim — current**

This is what I use, so it stays current. Install the syntax file and a filetype detection rule:

```console
$ mkdir -p ~/.vim/syntax/
$ mkdir -p ~/.vim/ftdetect/
$ curl -o ~/.vim/syntax/loc.vim https://raw.githubusercontent.com/morloc-project/vimmorloc/main/loc.vim
$ echo 'au BufRead,BufNewFile *.loc set filetype=loc' > ~/.vim/ftdetect/loc.vim
```

![vim highlights](https://morloc-project.github.io/docs/static/img/vim-highlights.png)

**Pygments — current**

[`morloclexer`](https://github.com/morloc-project/pygmentize) is a [Pygments](https://pygments.org/) lexer for Morloc. It is what highlights every code block in this manual, so it tracks the language closely.

```console
$ pip install morloclexer
$ pygmentize -l morloc example.loc
```

It is also usable from Python, which is how the [Weena Discord bot](https://github.com/morloc-project/weena-bot) renders snippets.

**Tree-sitter — out of date**

[tree-sitter-morloc](https://github.com/morloc-project/tree-sitter-morloc) is a full grammar for Morloc: a complete lexer and parser specification, which gives editors real structural understanding rather than regex highlighting, and parses a concrete syntax tree you can query.

The grammar has fallen behind the compiler and does not cover current syntax. Treat it as a starting point rather than a working tool. Bringing it back into step is on the list, and pull requests are very welcome.

![tree sitter](https://morloc-project.github.io/docs/static/img/tree-sitter.png)

**VS Code / VSCodium / Cursor — out of date**

There is a published `morloc` extension with highlighting and snippet expansion. It has not been updated in a while and does not know about recent syntax, so expect gaps.

![vscode highlights](https://morloc-project.github.io/docs/static/img/vscode-highlights.png)

**Zed — out of date, unfinished**

[zed-morloc](https://github.com/morloc-project/zed-morloc) is mostly written and depends on the Tree-sitter grammar above, which means it inherits that grammar’s staleness on top of its own unresolved bugs. I am happy to accept pull requests!
