#!/bin/sh

# Checks a deployed copy of the manual the way a reader or an agent reaches
# it: the machine-readable files are served with the right types (a
# text/html .md means Jekyll is rewriting the tree, i.e. .nojekyll was lost),
# the search bundle is there, the page counts agree, and one legacy anchor
# still maps. Runs against GitHub Pages by default, or a local server:
#
#   python3 -m http.server -d docs 8000 &
#   bin/smoke.sh http://localhost:8000

set -eu

origin=${1:-https://morloc-project.github.io}
tmp=$(mktemp -d)
trap 'rm -rf "${tmp}"' EXIT

fetch() {
  # $1: path, $2: file to save to; prints the content-type
  curl -fsS -o "$2" -w '%{content_type}' "${origin}$1" || {
    echo "smoke: GET $1 failed" >&2
    exit 1
  }
}

expect_type() {
  # $1: path, $2: expected content-type prefix, $3: file
  type=$(fetch "$1" "$3")
  case "${type}" in
    "$2"*) ;;
    *) echo "smoke: $1 is served as '${type}', expected $2" >&2; exit 1 ;;
  esac
}

expect_type /llms.txt text/plain "${tmp}/llms.txt"
expect_type /docs/toc.json application/json "${tmp}/toc.json"
expect_type /docs/sitemap.xml application/xml "${tmp}/sitemap.xml"
expect_type /docs/anchors.json application/json "${tmp}/anchors.json"
expect_type /docs/pagefind/pagefind-entry.json application/json "${tmp}/entry.json"

# toc.json carries canonical URLs; only their paths apply to ${origin}
first_md=$(node -e 'process.stdout.write(new URL(require(process.argv[1]).pages[0].md).pathname)' "${tmp}/toc.json")
expect_type "${first_md}" text/markdown "${tmp}/first.md"

# The index bundle: pagefind-entry.json names the per-language hash; the
# metadata file for it must come back as bytes, not as an HTML error page.
meta=$(node -e 'const e = require(process.argv[1]); process.stdout.write("pagefind." + Object.values(e.languages)[0].hash + ".pf_meta")' "${tmp}/entry.json")
expect_type "/docs/pagefind/${meta}" application/octet-stream "${tmp}/meta.bin"

toc_pages=$(node -e 'process.stdout.write(String(require(process.argv[1]).pages.length))' "${tmp}/toc.json")
sitemap_pages=$(grep -c '<loc>' "${tmp}/sitemap.xml")
indexed=$(node -e 'const e = require(process.argv[1]); process.stdout.write(String(Object.values(e.languages).reduce((n, l) => n + l.page_count, 0)))' "${tmp}/entry.json")

if [ "${toc_pages}" != "${sitemap_pages}" ]; then
  echo "smoke: toc.json lists ${toc_pages} pages, sitemap.xml ${sitemap_pages}" >&2
  exit 1
fi

legacy=$(node -e 'const a = require(process.argv[1]); process.stdout.write(a._getting_started || "")' "${tmp}/anchors.json")
if [ -z "${legacy}" ]; then
  echo "smoke: anchors.json has no entry for the legacy id _getting_started" >&2
  exit 1
fi

echo "smoke: ${origin} ok (pages=${toc_pages} indexed=${indexed} legacy _getting_started -> ${legacy})"
