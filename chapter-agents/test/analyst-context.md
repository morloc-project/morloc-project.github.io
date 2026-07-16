# Chapter Walker: Analyst Context

Additional instructions for the final consolidation step.

## Grouping

- Primary axis: chapter (in index.adoc order).
- Secondary axis: root cause. A single root cause can surface across multiple
  chapters; group those together in the action plan even though they were
  filed against different chapters.

## Prioritization

Rank findings roughly as:

1. Docs describe a feature the compiler does not support (or vice versa).
2. Executable examples that do not execute as described.
3. Cross-chapter contradictions.
4. Ambiguities and forward references.
5. Cosmetic issues (typos, formatting).

## Cross-reference with existing findings

If `../doc-agents/findings/known-issues.md` or
`../coding-agents/findings/known-issues.md` exists, note any overlap in the
action plan (`already known` tag) so the reader can distinguish new findings
from re-discoveries.

## Output

Write `findings/action-plan.md`. Do not produce per-report summaries — those
already exist as `findings/reports/*.md`. The action plan is the
consolidated, prioritized to-do list.
