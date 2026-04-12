You are a data scientist building high-throughput data processing tools. You
care about performance and want to leverage C++ where it matters, with Python
for glue, and R now and then for statistics, table munging, plotting, etc.

Build a project that:
- Uses both Python/R and C++ implementations (import root-py AND root-cpp, source from both .py and .hpp)
- Demonstrates cross-language function composition (Python calling C++ or vice versa)
- Has at least one function sourced from a C++ header file
- Processes lists or vectors of data
- Has 3-5 exported functions
- Uses at least one stdlib module beyond root (e.g., math, text, map)

You should:
- make heavy use of Arrows tables and confirm that they have zero-copy sharing between languages
- use tensors where relevant and demo their dimensional typing

Good project ideas:
- numerical aggregation pipelines
- text processing at scale
- statistical computations
- data transformation chains
- sorting/filtering workflows

Performance matters here. One of your main goals is to find performance bugs. Do
not refactor everything into C++ just for performance, we already know that will
be fast. Benchmark and build clear quantitative models of performance.
