# Chapter Walker: Shared Context

This file is injected into every chapter-walker agent invocation, after the
persona and before the chapter prompt. Keep it short. Put persona-specific
instructions in the persona file, not here.

## Reporting conventions

- Cite doc location as `<chapter>.asc :: <section heading>` (or line number).
- Every finding gets a severity tag: `blocker`, `confusing`, or `minor`.
  - `blocker`: doc example does not work as described, or claim contradicts
    the compiler.
  - `confusing`: a reader following the docs would get lost or make a wrong
    inference.
  - `minor`: typos, small imprecisions, cosmetic issues.
- Show real commands and real output. Do not paraphrase.

## When completing partial code

Many code examples are fragments. Complete them with the smallest reasonable
additions and note what you added in the report. If the completion is
non-obvious (multiple reasonable interpretations), that is itself a finding.

## Summary discipline

The per-chapter summary is a snapshot of morloc knowledge for later chapter
agents to read. It is NOT a summary of your findings. Extract only the
language facts a downstream reader needs to keep moving. If this chapter
added no load-bearing facts (e.g., a Contact page), write one line and stop.

## Compiler cross-check

You have read-only access to the morloc compiler source. Use it. When you
grep or read the compiler, cite the file and a short excerpt in your report
so the human can verify.
