#!/bin/sh

set -eu;

script_dir=$(dirname "${0}");

echo "Building site...";

# Create the 'build' directory if it doesn't exist
mkdir -p "${script_dir}/docs";

# Remove all files from the 'docs' directory to prevent residual files
rm -rf "${script_dir}/docs/"*;

# Copy files to the 'docs' directory
for path in							\
	"static"						\
	"manifest.webmanifest"			\
	"robots.txt"					\
	"service-worker.js"				\
; do
	cp -r "${script_dir}/src/${path}" "${script_dir}/docs";
done;

# Build site
asciidoctor -r asciidoctor-bibtex --doctype=book "${script_dir}/src/index.adoc" -a webfonts! -o "${script_dir}/docs/index.html"

# Lazy load images
sed -i -e 's/<img/<img loading="lazy"/g' "${script_dir}/docs/index.html";

echo "Asciidoctor Jet site build complete!";
