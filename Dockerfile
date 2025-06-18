FROM docker.io/library/ruby:3.2-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential

# Install asciidoctor and asciidoctor-bibtex gems
RUN gem install --no-document asciidoctor asciidoctor-bibtex

WORKDIR /documents

CMD ["asciidoctor", "-r", "asciidoctor-bibtex", "--version"]
