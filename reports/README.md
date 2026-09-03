# Bug reports from the documentation loop

This directory is a drop box. When a documentation pass finds that Morloc does
not do what the manual says -- or does something plainly wrong -- the finding is
written here and the pass **keeps going**. The point is to not lose a bug to the
momentum of the task that found it, and to not derail a doc pass into a debugging
session.

## Naming

Monotonically increasing, zero padded, with a slug:

```
reports/0001-launcher-named-after-source-not-module.md
reports/0002-....md
```

Take the next unused number. Never renumber or reuse; a number that has been
handed out is permanent even if the report is later withdrawn.

## What a report is

A report records an *observation*, not a diagnosis. It should be cheap to write
-- a few minutes -- and complete enough that someone can reproduce it cold,
weeks later, without the session that found it.

Do not fix the bug in the same pass. Do not root-cause it. If the cause is
obvious, one line under **Guess** is welcome, clearly marked as a guess.

## Template

```markdown
# NNNN: <one-line summary in the imperative or as a plain statement>

- Status: open | fixed | withdrawn | not-a-bug
- Found: YYYY-MM-DD, during <what you were doing>
- Component: compiler | runtime | nexus | mim | stdlib | docs
- morloc: <morloc --version>     mim: <mim --version>

## Expected
What the manual says, or what a reasonable user would expect. Quote the doc and
cite it: `src/content/<file>.asc:<line>`.

## Observed
What actually happened. Paste real output, never a reconstruction.

## Reproduce
The smallest sequence that shows it, runnable from an empty directory.

## Impact
Who hits this, and how badly. One or two sentences.

## Guess
Optional. A hypothesis, explicitly marked as unverified.
```

## Statuses

A report is never deleted. `not-a-bug` means the manual was wrong, not Morloc --
in that case say what the manual should say instead, so the doc fix is not lost
either.

## Closing a report

When a report is resolved, three things change together:

1. Flip `Status:` to `fixed` (or `withdrawn` / `not-a-bug`).
2. Append a `## Resolution` section naming the repository and the commit that
   carries the fix, plus a one-line statement of what now happens.
3. Rename the file with a `SOLVED_` prefix, keeping the number and slug:

```
reports/0032-internal-formatter-entries-leak-into-list-and-completions.md
reports/SOLVED_0032-internal-formatter-entries-leak-into-list-and-completions.md
```

The prefix sorts every open report to the top of a plain `ls`, so the drop box
stays readable as it fills. The number never changes and is never reused.

A `## Resolution` section looks like this:

```markdown
## Resolution

Fixed in `morloc` commit `abc1234`.

`morloc list` and the generated shell completions now filter on the manifest's
`internal` flag, so a program reports only the commands a user can invoke.
```

Name the repository, not just the hash: a report can be filed from the docs
pass and fixed in `morloc`, `morloc-manager`, or a stdlib module, and the hash
alone does not say where to look.
