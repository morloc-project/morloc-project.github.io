# 8. Managing Runs

Morloc Manual | https://morloc-project.github.io/docs/runs/ | prev: https://morloc-project.github.io/docs/apis/mcp.md | next: https://morloc-project.github.io/docs/runs/logging.md

A morloc program is an executable that can dispatch work across multiple language pools and, optionally, remote compute nodes. "Managing runs" covers the observability and persistence surface around one invocation of that executable: emitting per-step log lines, finding where those logs are stored on disk, and inspecting after the fact what ran.
