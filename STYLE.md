# Morloc manual style guide

Rules for writing `src/content/*.asc`. Read this before editing any of them.

The manual has one job: take a working programmer who has never heard of Morloc
and leave them able to build something real, without ever making them feel
stupid or lied to. Everything below serves that.

---

## 1. Audience

Write for **a junior software engineer who does not know this project**. Assume
they can program, know what a compiler and a type are, and have used a package
manager. Do not assume they know Haskell, category theory, conda, MessagePack,
or anything about Morloc. Do not assume they have read the previous chapter
carefully, but do assume they have read it.

There is a second reader: **the unfamiliar expert** -- a type theorist, compiler
engineer, or systems engineer who is fluent in their field and knows nothing
about Morloc. They want the real mechanism: the inference rules, the wire
layout, the reason a design went one way. Serve them in *dedicated* places
(section 5), never by thickening the main line.

The test for any paragraph: could the junior engineer skip every expert block in
the manual and still get to a working program? If not, something load-bearing is
in the wrong place.

## 2. Voice

The manual is informal, direct, and written by a person. Preserve that.

**Address the reader as "you."** Not "one", not "the user", not the passive
voice used to avoid choosing.

**Use "I" for judgment, history, and project status.** This is a real voice and
it is worth keeping:

> Given the need, and also given my personal background, bioinformatics is a
> good place to start.

> The tooling around Morloc is still immature. I do not have a dedicated
> dependency resolver yet. So what follows is speculative.

Reserve "I" for things only the author can say: why a decision was made, what is
still missing, what is coming. Never use it for mechanics ("I recommend you
run..." -- just say "run...").

**Use "we" only in a walkthrough**, where author and reader are building
something together in real time: "Let's define a few unit conversions." Outside
a walkthrough, "we" is either the royal we or a hiding place. Use "you."

**Answer first, then elaborate.** The first sentence of a section says what the
thing is or does. Context, motivation, and caveats come after.

**Be candid about limits.** Say a feature is experimental, unfinished, or
unimplemented, in the place a reader would otherwise trip over it. A manual that
admits gaps is trusted on everything else. See section 6.

**Do not write:**

- marketing adjectives: *powerful*, *seamless*, *blazing*, *elegant*, *robust*,
  *rich*, *first-class*, *cutting-edge*
- *simply*, *just*, *easy*, *obviously*, *of course*, *trivially* -- every one of
  these tells a stuck reader the problem is them
- filler transitions: *It is important to note that*, *It is worth mentioning*,
  *As we can see* -- delete and start with the noun
- throat-clearing before a code block: *Let's take a look at the following
  example which demonstrates* -- say what it shows, then show it
- second-guessing hedges stacked on each other: *may possibly sometimes*

**Sentence and paragraph length.** Short paragraphs, two to five sentences.
Break up anything that runs past six lines on screen. One idea per paragraph.

## 3. Narrative

This is the rule the manual most often breaks, and the most important one here.

**The manual is read front to back at least once.** Chapters build. A reader
arriving at chapter 7 has met everything in chapters 1-6 and nothing after.

**Introduce before use.** A term, a flag, a file, or a concept must be
introduced before it is used. If a section genuinely needs something from later,
xref it explicitly (`see <<_typeclasses>>`) and give a one-clause gloss inline so
the sentence still parses without the jump.

**Every section opens by orienting the reader.** Before the first code block:
what is this, why would you want it, and where does it sit relative to what you
just read. A section that opens "By default, the CLI accepts inline JSON or a
file path and figures the rest out" assumes the reader already knows what "the
CLI" means here and that arguments have shapes at all.

**New material must be placed, not appended.** When documenting a new feature,
the question is never "where can I put this?" It is "where does a reader meet
this for the first time?" That may mean editing three existing sections instead
of adding a fourth. Adding a locally-correct section that ignores the
surrounding arc is how this manual drifted, and it is the failure mode to guard
against hardest.

**Before adding or editing a section, check:**

1. Does something earlier already introduce this? Extend it instead of repeating.
2. Does anything earlier now become wrong, redundant, or out of order?
3. Does every term I use appear earlier in the manual?
4. If a reader stops here, do they have something that works?
5. Is the expert material separable (section 5), or is it stuck to the main line?

**One concept per section; one section per concept.** If the same idea is
explained in two places, one of them is a cross-reference.

## 4. Examples

Examples are the manual's backbone. They carry more weight than the prose.

**Every example must be real.** It compiles, it runs, and it produces the output
shown. See section 6.

**Examples build on each other.** Within a chapter, prefer extending a running
example to inventing a fresh one per section. Reuse the reader's loaded context.

**Smallest program that shows the point.** Strip imports, types, and helpers
that are not doing work in *this* example. But never strip to the point of not
compiling -- if the reader cannot paste it and run it, show the whole file and
say so.

**Name things concretely.** `cels2fahr`, `pmap`, `sum`. Use `foo`/`bar` only
when the point is genuinely about shape and names would distract.

**Show the failure too**, where a reader is likely to hit one. An error message
in the manual is worth ten sentences of warning, because it is what they will
actually see and search for.

## 5. Serving the expert without taxing the beginner

Deep material gets one of two homes. Never inline it into the main line.

**A collapsible foldout**, for a digression a beginner should skip:

```asciidoc
.How the coercion is inserted
[%collapsible]
====

...detail...

====
```

**A dedicated section**, for material with enough substance to be navigated to:
the Build Architecture chapters, the protocol and wire-format sections, the
typing rules.

Rules for both:

- The main line must read correctly with the block collapsed or the section
  skipped. If removing it breaks the argument, it was not a digression.
- Say up front who it is for and what it assumes: "This section assumes you know
  what a bidirectional type system is; skip it if you just want to write code."
- Write it for the **unfamiliar expert**: they know their field, not Morloc.
  Define every Morloc-specific term (manifold, pool, nexus, plane, wire packet)
  even in an expert block. Never assume internal context.
- Give the real mechanism, not a metaphor. This reader wants the byte layout,
  the rule, the invariant. Cite the source file when it is the honest answer.

## 6. Ground truth

**The compiler is ground truth. The manual is a claim about it.**

Every claim in the manual is testable, and a doc pass is expected to test it.
This is the doc-checking-compiler loop: read the manual as a new user, run
everything, and fix whichever side is wrong.

**Never write output you have not seen.** Not a plausible transcript, not a
tidied one, not one updated by hand from an older run. Fabricated output has
been the single largest source of defects in this manual. If you cannot run it,
do not show it -- describe the behaviour in prose instead.

**Eliding real output is fine**, and better than showing noise. Use `...` on its
own line for the cut, and keep the lines that matter:

```
$ mim new --non-interactive base
Provisioning morloc runtime from release v0.99.0...
...
Native environment 'base' is ready.
```

**Do not show output that churns.** Version numbers, timing, absolute paths, and
solver logs date instantly. Cut them, or use a comment: `0.100.2  # you may have
a later version`.

**When Morloc is wrong, file it and keep going.** Write a report in `reports/`
(see `reports/README.md`), leave the manual describing what *should* happen only
if you also mark it experimental, and move on. Do not stop the doc pass to
debug, and do not silently document the bug as if it were the design.

**When a report is fixed, close it.** Flip its `Status:`, append a
`## Resolution` naming the repository and commit, and rename the file with a
`SOLVED_` prefix. The full procedure is in `reports/README.md`. A manual that
cites `reports/0024` for a limitation is making a claim about the compiler like
any other, so closing the report and correcting the prose are the same job.

**Prefer verified silence to unverified prose.** Leaving a gap is recoverable.
A confident wrong sentence is not.

## 7. Mechanics

Settled by counting the existing corpus; follow the majority and stop thinking
about it.

**Files.** `src/content/*.asc`, included from `src/index.adoc`. Only the master
is `.adoc`. **Every `.asc` file must end with a blank line**, or its sections do
not reach the table of contents.

**Headings.** `index.adoc` owns `==` (chapter). Content files start at `===`:

| Level | Use | In the TOC? |
|-------|-----|-------------|
| `===` | section -- the unit a reader navigates to | yes |
| `====` | subsection | yes |
| `=====` | sub-subsection; use sparingly | no (`:toclevels: 2`) |

Sections are auto-numbered (`:sectnums:`), so never number a heading by hand.

**Line width.** Wrap prose at 80 columns. Do not wrap inside a URL or a table
cell. Never reflow a paragraph you did not otherwise edit -- it buries the real
change in the diff.

**Code blocks.** One space after the comma:

```asciidoc
[source, morloc]
----
...
----
```

Languages: `morloc`, `console`, `bash`, `python`, `cpp` (not `c++`), `r`,
`rust`, `yaml`, `json`, `dockerfile`. `[source, morloc]` triggers the custom
Pygments lexer, so use it for every Morloc snippet.

`console` for anything with a `$` prompt and its output; `bash` for a script
with no prompt. Add `%nowrap` when a line genuinely cannot be broken (a long
curl URL): `[%nowrap, console]`.

Name the file when the reader will need to create it:

```asciidoc
[source, morloc]
.units.loc
----
```

**Dashes.** ASCII only: ` -- ` with spaces for a parenthetical dash, `-` for
hyphens. No em-dashes, no en-dashes, no smart quotes, no other non-ASCII in
prose or code. Use `{cpp}` for "C++" in prose.

The one carve-out: an example whose *point* is non-ASCII -- the Unicode string
in `features-strings.asc` -- keeps its real characters, because replacing them
would destroy what it demonstrates. Note the exception in a comment at the top
of the file. Nothing else in that file may be non-ASCII.

**Admonitions.** Use the block form; it renders with the icon set:

```asciidoc
[WARNING]
.Experimental Feature
====

Short. One paragraph.

====
```

`NOTE` for a genuine aside, `WARNING` for something that will cost the reader
time or data, `IMPORTANT` for a prerequisite they will otherwise miss. Do not
stack them; two admonitions in a row means the prose is not doing its job. The
one-line `NOTE: ...` form appears in older files -- leave it alone unless you are
already editing that block, then convert it.

**Experimental features** carry a `[WARNING]` with the title
`.Experimental Feature`, placed at the top of the section, saying what does not
work yet and what to use instead.

**Tables** are for things with the same shape: flags, variables, options,
protocol fields. Two to four columns. If a cell needs more than two sentences,
it is prose, not a table. Give every table a `[cols=...]` spec and a header row.

**Lists** carry sequences and alternatives. Bold-lead bullets for a glossary run:

```asciidoc
 - *Broader usability*: your functions can be reused by other language
   communities.
```

**Cross-references.** `<<_section_title>>` against auto-generated anchors, or
`<<anchor-name>>` against an explicit `[[anchor-name]]`. Prefer an explicit
anchor for anything referenced from more than one place -- auto anchors change
when a heading is reworded, and a dangling xref renders as visible red text.
Check that every xref you write resolves.

**Terminology.** "Morloc" capitalized in prose, `morloc` in code and when naming
the binary. `mim` is always lowercase, always code-formatted. A *module* is
Morloc source; a *package* is a language dependency (conda, pip, crates); an
*environment* is what `mim` manages. Keep these distinct -- they are three
different things and the manual has conflated them before.

## 8. When you touch a file

- Run the examples you changed. Really run them.
- Check the terms you introduced are defined earlier.
- Check nothing earlier in the manual is now stale.
- Check the file still ends with a blank line.
- Check for non-ASCII: `LC_ALL=C grep -n '[^ -~\t]' <file>`
- Check block delimiters balance: `---- `, `====`, `=====`, `|===` each even.
- Build the site (`make`) before claiming the change renders.
