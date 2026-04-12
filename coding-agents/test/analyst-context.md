When analyzing findings, prioritize by impact:

1. **Blockers and compilation errors** — these prevent projects from running at all
2. **Repeated workarounds** — if multiple projects used the same workaround, it signals
   a systemic issue worth highlighting
3. **Features attempted but never succeeded** — if multiple personas tried a feature
   and all failed, flag it prominently
4. **Documentation gaps** — cross-reference findings against the morloc docs; if a
   feature works differently than documented, that's a doc bug

Also read `projects/*/tutorial.md` files. Tutorials often contain implicit findings
(e.g., "I wanted to do X but had to do Y instead") that don't get written as formal
finding files.
