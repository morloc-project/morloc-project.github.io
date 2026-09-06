#!/bin/sh

set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
katex_dir=${KATEX_DIR:-/opt/node_modules/katex}

# The prerender step needs node and katex, which live in the build image. A
# stale image is the usual reason they are missing.
if ! command -v node >/dev/null 2>&1 || [ ! -f "${katex_dir}/dist/katex.min.css" ]; then
  echo "build.sh: node or katex is missing from this environment." >&2
  echo "  If you are running in the container, rebuild the image: make build" >&2
  echo "  If you are running on the host, point KATEX_DIR at a katex install." >&2
  exit 1
fi

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

# KaTeX stylesheet and fonts, so typeset math needs nothing from a CDN.
# Only woff2 is shipped; every browser that reaches the other formats predates
# the CSS this site already relies on.
cp "${katex_dir}/dist/katex.min.css" "${script_dir}/docs/docs/static/css"
mkdir -p "${script_dir}/docs/docs/static/css/fonts"
cp "${katex_dir}"/dist/fonts/*.woff2 "${script_dir}/docs/docs/static/css/fonts"

# Lazy load images
sed -i -e 's/<img/<img loading="lazy"/g' "${script_dir}/docs/docs/index.html"

# Typeset the math and build the copy buttons now rather than in the browser
node "${script_dir}/bin/prerender.mjs" \
  "${script_dir}/docs/docs/index.html" \
  "${script_dir}/src/math-macros.tex"

echo "Morloc Manual site build complete!"
