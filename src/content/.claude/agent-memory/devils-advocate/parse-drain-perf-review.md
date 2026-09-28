---
name: parse-drain-perf-review
description: 2026-09-28 review of /work/plans/perf-2026-09-28-render-action/ANALYSIS.md (@parse + drainStream SHM/copy blowup); non-obvious facts for future perf reviews
metadata:
  type: project
---

Review of the F20 perf diagnosis (C1-C4 / S1-S4). Facts verified by reading code, worth not rederiving:

- `noopDrain` in exp.loc is NOT a proxy-free control of the same shape: StaticArgs.hs specializes
  drainStream on the closed sink `nop` (exp-build pool.cpp m5272 takes only the stream), and it
  writes nothing. The @collect sink is a lambda capturing the stdout handle, so StaticArgs declines.
- Express.hs addNativeRecEntries comment claims a loop "has no round trip left to remove"; false
  when a param is function-typed (the closure becomes a per-iteration socket proxy).
- A loop manifold already runs natively inside; only its prologue (_get_value of params) and base
  (serialize) are serial, so a native-ARGS entry does not need a native-loop IR.
- Python pool reads numpy arrays as zero-copy views over SHM and relies on the dispatch flush for
  their lifetime (pymorloc.c ~1715, ~2727): any scoped/watermark release is unsound there unless the
  array owns a ref (capsule base). C++ from_voidstar copies (except ArrowTable, which owns a ref).
- cpp_local_dispatch flushes the thread tracker on entry; a same-thread self-call short-circuit
  through it would free the caller's in-flight packets.
- @stdin channel IStream treats an empty sub-packet as EOF (stream.rs shared_next_frame); reusing it
  for @parse would silently truncate on an empty batch.

**Why:** the user wants @parse to stream and the drain path fixed structurally; these points
change which fix is cheapest/sound.
**How to apply:** start any follow-up review of S1-S4 from these; re-verify line numbers first.
