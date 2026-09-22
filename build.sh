#!/bin/sh

set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
site="${script_dir}/docs"
manual="${site}/docs"

# Node packages live outside the source tree in the build image (/opt, see the
# Dockerfile) and are found through NODE_PATH; katex is also needed on PATH-less
# hosts via KATEX_DIR. Versions come from build-deps/package-lock.json.
katex_dir=${KATEX_DIR:-/opt/node_modules/katex}

preflight() {
  # $1: package name as it appears in the lockfile
  want=$(node -e '
    const lock = require(process.argv[1]);
    const entry = lock.packages["node_modules/" + process.argv[2]];
    process.stdout.write(entry ? entry.version : "");
  ' "${script_dir}/build-deps/package-lock.json" "$1")
  have=$(node "${script_dir}/bin/pkgversion.mjs" "$1")

  if [ -z "${have}" ]; then
    echo "build.sh: node package '$1' is not installed." >&2
    echo "  If you are running in the container, rebuild the image: make build" >&2
    echo "  If you are running on the host, npm ci in build-deps/ and set NODE_PATH." >&2
    exit 1
  fi

  if [ "${have}" != "${want}" ]; then
    echo "build.sh: node package '$1' is ${have}, but build-deps/package-lock.json pins ${want}." >&2
    exit 1
  fi
}

if ! command -v node >/dev/null 2>&1 || ! command -v asciidoctor >/dev/null 2>&1; then
  echo "build.sh: node or asciidoctor is missing from this environment." >&2
  echo "  If you are running in the container, rebuild the image: make build" >&2
  exit 1
fi

# cheerio's dependencies need Node 20 or later (Node 18 lacks the File global).
if ! node -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 20 ? 0 : 1)'; then
  echo "build.sh: node $(node --version) is too old; the build needs 20 or later." >&2
  echo "  If you are running in the container, rebuild the image: make build" >&2
  exit 1
fi

for pkg in katex cheerio turndown turndown-plugin-gfm pagefind; do
  preflight "${pkg}"
done

if [ ! -f "${katex_dir}/dist/katex.min.css" ]; then
  echo "build.sh: katex stylesheet not found at ${katex_dir}; set KATEX_DIR." >&2
  exit 1
fi

if ! command -v pagefind >/dev/null 2>&1; then
  echo "build.sh: pagefind is not on PATH (the npm package puts it in node_modules/.bin)." >&2
  exit 1
fi

echo "Building site..."

# Start from an empty manual directory so a renamed section cannot leave an
# orphan page behind. Kroki's diagram cache in .asciidoctor/ survives, so a
# rebuild does not depend on kroki.io being reachable.
mkdir -p "${manual}"
find "${manual}" -mindepth 1 -maxdepth 1 ! -name .asciidoctor -exec rm -rf {} +

# Site root: the landing page, the crawler files, and the Jekyll switch-off
# (without .nojekyll GitHub Pages rewrites *.md and drops pagefind/).
for path in \
  "index.html" \
  "robots.txt" \
  ".nojekyll"
do
  cp "${script_dir}/src/${path}" "${site}"
done

# The manual: the PWA is scoped to /docs/, so its manifest and service worker
# sit beside the pages that register them, not at the site root.
for path in \
  "manifest.webmanifest" \
  "service-worker.js"
do
  cp "${script_dir}/src/${path}" "${manual}"
done

cp -r "${script_dir}/src/static" "${manual}"

# One page holding the whole manual. linkcss writes asciidoctor's stylesheet
# and the pygments token stylesheet beside the other css instead of embedding
# them in every page.
asciidoctor -r asciidoctor-kroki -r asciidoctor-bibtex --doctype=book \
  "${script_dir}/src/index.adoc" -a webfonts! \
  -a linkcss -a copycss -a stylesdir=static/css \
  -o "${manual}/all.html"

cp "${script_dir}"/syntax/css/*.css "${manual}/static/css"

# KaTeX stylesheet and fonts, so typeset math needs nothing from a CDN.
# Only woff2 is shipped; every browser that reaches the other formats predates
# the CSS this site already relies on.
cp "${katex_dir}/dist/katex.min.css" "${manual}/static/css"
mkdir -p "${manual}/static/css/fonts"
cp "${katex_dir}"/dist/fonts/*.woff2 "${manual}/static/css/fonts"

# Lazy load images
sed -i -e 's/<img/<img loading="lazy"/g' "${manual}/all.html"

# Typeset the math and build the copy buttons now rather than in the browser
node "${script_dir}/bin/prerender.mjs" \
  "${manual}/all.html" \
  "${script_dir}/src/math-macros.tex"

# Split into pages and write the machine-readable files
node "${script_dir}/bin/paginate.mjs" "${site}"

# Full-text search index over the pages that carry data-pagefind-body
pagefind --site "${manual}" --quiet

# Check the tree that will be pushed
node "${script_dir}/bin/audit.mjs" "${site}"

echo "Morloc Manual site build complete!"
