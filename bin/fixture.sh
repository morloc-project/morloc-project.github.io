#!/bin/sh

# Renders bin/fixtures/fixture.adoc the way build.sh renders the manual, so
# bin/paginate.test.mjs runs against markup the real toolchain produced.
# Re-run it after an asciidoctor upgrade and commit the resulting mini.html;
# the diff is the markup drift the tests need to know about.

set -eu

script_dir=$(cd "$(dirname "$0")" && pwd)
out="${script_dir}/fixtures/mini.html"

asciidoctor --doctype=book "${script_dir}/fixtures/fixture.adoc" -a webfonts! \
  -a linkcss -a stylesdir=static/css -o "${out}"

sed -i -e 's/<img/<img loading="lazy"/g' "${out}"

node "${script_dir}/prerender.mjs" "${out}" "${script_dir}/../src/math-macros.tex"
