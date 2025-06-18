all:
	podman run -v .:/documents -w /documents ghcr.io/morloc-project/morloc/morloc-docs bash build.sh

build:
	podman build --no-cache --force-rm -t ghcr.io/morloc-project/morloc/morloc-docs .

shell:
	podman run -v ${PWD}:/documents -it ghcr.io/morloc-project/morloc/morloc-docs bash

clean:
	rm -r *pdf
