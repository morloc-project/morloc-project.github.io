# 12.6. Serving

Morloc Manual > Ecosystem Architecture | https://morloc-project.github.io/docs/ecosystem-architecture/eco-serving.html | prev: https://morloc-project.github.io/docs/ecosystem-architecture/eco-freezing.md | next: https://morloc-project.github.io/docs/build-architecture/index.md

**STUB**: Specifies how a compiled program is served beyond the command line: the daemon, the router that fronts several programs, and the transports (HTTP, TCP and Unix sockets, MCP over stdio). Defines the mapping from one manifest command to a CLI subcommand, an HTTP endpoint and an MCP tool, including how argument types become input schemas, how docstrings become descriptions, and which commands are excluded and why. Specifies remote evaluation of expressions and the security model: authentication, allow-lists, sandboxing and resource limits, with the threat each one addresses.
