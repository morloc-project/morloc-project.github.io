---
name: cpp-binder-namespace-review
description: DA review 2026-10-21 of C++ binder-name isolation design (morloc_detail namespace, mlc_c C API, ::f sourced calls, mm_<N>)
metadata:
  type: project
---

Reviewed the C++ bullet of compiler model/runtime/issues/binder-names.md (golden binder-name-isolation).
Earlier B4-B7 review lives in compiler/morloc/.claude/agent-memory/devils-advocate/project-kind-args-binder-names-review.md.

Facts checked (stable unless the binder is rewritten):
- Marshalling is MlcNode<T> class specialization (cppmorloc.hpp:428-447), not overload/ADL; generated
  records/variants emit `template<> struct MlcNode<X>` (CppPrinter.hs:389-409).
- Arrow C Data Interface structs live in morloc.h under ARROW_C_DATA_INTERFACE (~1133); nanoarrow users
  (stdlib table-cpp, arrow-* goldens) use bare global ArrowSchema -> must stay global.
- Golden inline-payload-bounds/probe.hpp calls bare Schema/parse_schema from a user header.
- stdlib uses morloc_* and mlc_* prefixes for USER functions/namespaces (morloc_sin, mlc_ctor, mlc_table)
  and MORLOC_*_HPP include guards; tensor-cpp reopens namespace mlc.
- libmorloc C exports include generic names (pack, hex, quoted, remote_call, pool_main, shinit):
  extern "C" names are one entity across namespaces ([dcl.link]) -> namespacing does not isolate them.
- registry scanner (data/rust/morloc-runtime/src/source_rules.rs:510-543) is column-0 based, ignores
  namespaces: keep namespace bodies unindented.
- pool_host.cpp is a separate TU declaring `extern void cpp_register(pool_config_t*, ...)`.
- Manifold-name inverses: Common.hs:1018 manifoldIdOf, Cpp.hs:1547/1556/1587, plus reifyThunks keyed by
  render(manNamer i) (Cpp.hs:691 vs 1539/1558).
- Sourced names reach C++ via lcSrcName, lcPackerName, lcUnpackerName (Cpp.hs:1068/1118/1119);
  operators go infix (Imperative.hs:480) and cannot be `::`-anchored.
