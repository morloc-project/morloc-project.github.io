#!/bin/sh

set -eu;

script_dir=$(dirname "${0}");

echo "Building site...";

# Create the 'site' directory if it doesn't exist
mkdir -p "${script_dir}/site/docs";

# Copy files to the 'docs' directory
for path in							\
  "index.html" \
	"static"						\
	"manifest.webmanifest"			\
	"robots.txt"					\
	"service-worker.js"				\
; do
	cp -r "${script_dir}/src/${path}" "${script_dir}/site";
done;

# Build site
asciidoctor -r asciidoctor-bibtex --doctype=book "${script_dir}/src/index.adoc" -a webfonts! -o "${script_dir}/site/docs/index.html"

# Lazy load images
sed -i -e 's/<img/<img loading="lazy"/g' "${script_dir}/site/docs/index.html";

echo "Asciidoctor Jet site build complete!";
