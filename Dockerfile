FROM docker.io/library/ubuntu:24.04

# Install all system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby ruby-dev build-essential \
    python3 python3-pip \
    ca-certificates curl xz-utils \
    git \
    && rm -rf /var/lib/apt/lists/*

# Node: Ubuntu's package is 18, which cheerio's dependencies no longer run on,
# so the LTS build comes from nodejs.org, pinned by version and checksum.
ARG NODE_VERSION=24.21.0
ARG NODE_SHA256_X64=fd8e59d5a511510f6a298afb548f18c7d2b1be404d8b4a27d94fbe49f56cb2d6
ARG NODE_SHA256_ARM64=6ad1325edbdb5649c379b75a237147a666c95d4f9ae8d340fef2d1575d289ad2
RUN set -eu; \
    case "$(uname -m)" in \
      x86_64) arch=x64; sha="${NODE_SHA256_X64}" ;; \
      aarch64) arch=arm64; sha="${NODE_SHA256_ARM64}" ;; \
      *) echo "unsupported architecture: $(uname -m)" >&2; exit 1 ;; \
    esac; \
    tarball="node-v${NODE_VERSION}-linux-${arch}.tar.xz"; \
    curl -fsSLo "/tmp/${tarball}" "https://nodejs.org/dist/v${NODE_VERSION}/${tarball}"; \
    echo "${sha}  /tmp/${tarball}" | sha256sum -c -; \
    tar -xJf "/tmp/${tarball}" -C /usr/local --strip-components=1 --no-same-owner; \
    rm "/tmp/${tarball}"; \
    node --version && npm --version

# Install Ruby gems (asciidoctor-kroki renders mermaid via the Kroki service,
# so no headless browser is needed at build time). These are not pinned; the
# manual records the asciidoctor version it was built with in toc.json.
RUN gem install --no-document asciidoctor asciidoctor-bibtex pygments.rb asciidoctor-kroki

# Node packages used by build.sh: katex (math), cheerio + turndown (the page
# split and its markdown twins), pagefind (search index; its binary arrives as
# an optional dependency). Versions and integrity hashes come from the
# committed lockfile; nothing runs install scripts, and nothing is installed
# into the mounted source tree.
COPY build-deps/package.json build-deps/package-lock.json /opt/
RUN cd /opt && npm ci --no-audit --no-fund --ignore-scripts --omit=dev
ENV NODE_PATH=/opt/node_modules
ENV PATH=/opt/node_modules/.bin:$PATH

# Install custom lexer (tracks the repository head)
RUN git clone https://github.com/morloc-project/pygmentize morloclexer
RUN pip install --break-system-packages ./morloclexer

WORKDIR /documents
