# 9. Deployment

Morloc Manual | https://morloc-project.github.io/docs/apis/ | prev: https://morloc-project.github.io/docs/modules/data-transfer.md | next: https://morloc-project.github.io/docs/apis/deploy-environments.md

The entry point to the Morloc ecosystem is `mim` (Morloc Installation manager). This tool was introduced in the [Installing Morloc](https://morloc-project.github.io/docs/getting-started/installing.md) section. Now we will show its end-to-end use in managing and deploying Morloc environments.

This chapter walks the full deployment path with one program. The program is `smiles`, a small chemistry library that wraps the Python [RDKit](https://www.rdkit.org) package. By the end you will have built an environment for it, installed it, served its functions over MCP and a JSON API, let callers compose new expressions from it, and frozen the result into an image.
