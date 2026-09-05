#!/bin/sh

set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)

echo "Building site..."

# Create the 'site' directory if it doesn't exist
mkdir -p "${script_dir}/docs/docs"

# Site root: the landing page and the crawler file
for path in \
  "index.html" \
  "robots.txt"
do
  cp -r "${script_dir}/src/${path}" "${script_dir}/docs"
done

# The manual: the PWA is scoped to /docs/, so its manifest and service worker
# sit beside the page that registers them, not at the site root.
for path in \
  "manifest.webmanifest" \
  "service-worker.js"
do
  cp -r "${script_dir}/src/${path}" "${script_dir}/docs/docs"
done

# Copy static files
cp -r "${script_dir}/src/static" "${script_dir}/docs/docs"

asciidoctor -r asciidoctor-kroki -r asciidoctor-bibtex --doctype=book "${script_dir}/src/index.adoc" -a webfonts! -o "${script_dir}/docs/docs/index.html"

mkdir -p docs/docs/static/css
cp syntax/css/*.css docs/docs/static/css

# Lazy load images
sed -i -e 's/<img/<img loading="lazy"/g' "${script_dir}/docs/docs/index.html"

echo "Morloc Manual site build complete!"
