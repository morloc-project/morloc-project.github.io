# 8. Deployment

Morloc Manual | https://morloc-project.github.io/docs/apis/ | prev: https://morloc-project.github.io/docs/modules/data-transfer.md | next: https://morloc-project.github.io/docs/apis/deploy-environments.md

This chapter uses `mim`, the Morloc installation manager from [Installing Morloc](https://morloc-project.github.io/docs/getting-started/installing.md), to take one program from a new environment to a deployed image. The program is `smiles`, a small chemistry library that wraps the Python [RDKit](https://www.rdkit.org) package. By the end you will have built an environment for it, installed it, served its functions over MCP and a JSON API, let callers compose new expressions from it, and frozen the result into an image.
