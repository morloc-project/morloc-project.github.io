FROM docker.io/library/ubuntu:24.04

# Install all system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby ruby-dev build-essential \
    python3 python3-pip \
    nodejs npm \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Ruby gems (asciidoctor-kroki renders mermaid via the Kroki service,
# so no headless browser is needed at build time)
RUN gem install --no-document asciidoctor asciidoctor-bibtex pygments.rb asciidoctor-kroki

# KaTeX typesets the manual's math at build time, so the page ships no math
# engine. Installed outside the mounted source tree and found via NODE_PATH.
ENV NODE_PATH=/opt/node_modules
RUN npm install --no-audit --no-fund --prefix /opt katex@0.16.11

# Install custom lexer
RUN git clone https://github.com/morloc-project/pygmentize morloclexer
RUN pip install --break-system-packages ./morloclexer

WORKDIR /documents
