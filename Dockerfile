FROM docker.io/library/ubuntu:24.04

# Install all system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    ruby ruby-dev build-essential \
    python3 python3-pip \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install Ruby gems (asciidoctor-kroki renders mermaid via the Kroki service,
# so no headless browser is needed at build time)
RUN gem install --no-document asciidoctor asciidoctor-bibtex pygments.rb asciidoctor-kroki

# Install custom lexer
RUN git clone https://github.com/morloc-project/pygmentize morloclexer
RUN pip install --break-system-packages ./morloclexer

WORKDIR /documents
