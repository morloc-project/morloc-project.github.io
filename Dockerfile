FROM docker.io/library/ruby:3.2-slim

RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    build-essential \
    python3 \
    pip

# Install asciidoctor and asciidoctor-bibtex gems
RUN gem install --no-document asciidoctor asciidoctor-bibtex pygments.rb

RUN pip install --break-system-packages pygments

COPY syntax/morloclexer morloclexer
RUN pip install --break-system-packages ./morloclexer

WORKDIR /documents

CMD ["asciidoctor", "-r", "asciidoctor-bibtex", "--version"]
