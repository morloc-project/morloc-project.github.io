all:
	podman run -v .:/documents -w /documents ghcr.io/morloc-project/morloc/morloc-docs bash build.sh

# Unit tests for the page split (bin/paginate.test.mjs against bin/fixtures)
test:
	podman run -v .:/documents -w /documents ghcr.io/morloc-project/morloc/morloc-docs node --test bin/paginate.test.mjs

# Re-render the test fixture after an asciidoctor upgrade; commit the result
fixture:
	podman run -v .:/documents -w /documents ghcr.io/morloc-project/morloc/morloc-docs sh bin/fixture.sh

# Preview the built site the way GitHub Pages serves it (search needs http)
serve:
	python3 -m http.server -d docs 8000

build:
	podman build --no-cache --force-rm -t ghcr.io/morloc-project/morloc/morloc-docs .

shell:
	podman run -v ${PWD}:/documents -it ghcr.io/morloc-project/morloc/morloc-docs bash

clean:
	rm -r *pdf

## ---- Documentation testing (requires Vagrant + libvirt + Claude Code) ----

explore:
	bash test/run-exploration.sh

explore-code:
	bash test/run-exploration.sh --agents code-tester --no-destroy

explore-review:
	bash test/run-exploration.sh --agents prose-reviewer,technical-reviewer --skip-analyst

vm-up:
	vagrant up

vm-destroy:
	vagrant destroy -f

clean-findings:
	rm -rf findings/*/
