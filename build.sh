#!/bin/sh

set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)

echo "Building site..."

# Create the 'site' directory if it doesn't exist
mkdir -p "${script_dir}/docs/docs"

# Copy files to the 'docs' directory
for path in \
  "index.html" \
  "manifest.webmanifest" \
  "robots.txt" \
  "service-worker.js"
do
  cp -r "${script_dir}/src/${path}" "${script_dir}/docs"
done

# Copy static files
cp -r "${script_dir}/src/static" "${script_dir}/docs/docs"

asciidoctor -r asciidoctor-diagram -r asciidoctor-bibtex --doctype=book "${script_dir}/src/index.adoc" -a webfonts! -o "${script_dir}/docs/docs/index.html"

mkdir -p docs/docs/static/css
cp syntax/css/*.css docs/docs/static/css

# Lazy load images
sed -i -e 's/<img/<img loading="lazy"/g' "${script_dir}/docs/docs/index.html"

echo "Morloc Manual site build complete!"
